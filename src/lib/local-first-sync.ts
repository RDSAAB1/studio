"use client";

/**
 * Local-First Sync Manager
 * 
 * Rules:
 * 1. All writes go to local first
 * 2. Local changes sync to Firestore only on user events (click, input, blur, etc.)
 * 3. Firestore changes sync to local only on user events (not on idle)
 * 4. If nothing changed locally, nothing changes in Firestore
 * 5. Conflict resolution: Last write wins (timestamp-based)
 */

import { db } from './database';
import { firestoreDB } from './firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, query, where, Timestamp, orderBy, writeBatch, limit, startAfter, CollectionReference, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { enqueueSyncTask } from './sync-queue';
import { yieldToMainThread, chunkedBulkPut } from './chunked-operations';
import { logError } from './error-logger';
import { retryFirestoreOperation } from './retry-utils';

// Helper function to handle errors silently (for sync fallback scenarios)
function handleSilentError(error: unknown, context: string): void {
  // Log error using error logging service
  logError(error, context, 'low');
}

type CollectionName = 
    | 'suppliers' 
    | 'customers' 
    | 'payments' 
    | 'customerPayments' 
    | 'transactions'
    | 'options'
    | 'bankAccounts'
    | 'kantaParchi'
    | 'customerDocuments'
    | 'incomes'
    | 'expenses'
    | 'loans'
    | 'fundTransactions'
    | 'projects'
    | 'employees'
    | 'payroll'
    | 'inventoryItems';

type ChangeType = 'create' | 'update' | 'delete';

interface LocalChange {
    id: string;
    type: ChangeType;
    collection: CollectionName;
    data?: Record<string, unknown>;
    changes?: Record<string, unknown>;
    timestamp: number;
}

// Track pending local changes
const pendingChanges = new Map<string, LocalChange>();
let isSyncScheduled = false;

// Event listeners for user interactions
let eventListenersAttached = false;

/**
 * Attach event listeners for user interactions
 * Only sync when user is actively using the software
 */
function attachEventListeners() {
    if (eventListenersAttached || typeof window === 'undefined') return;
    eventListenersAttached = true;

    const events = ['click', 'input', 'change', 'blur', 'focus', 'submit', 'keydown'];
    const syncHandler = () => {
        scheduleSyncFromFirestore();
    };

    // Use passive listeners for better performance
    events.forEach(event => {
        window.addEventListener(event, syncHandler, { passive: true, once: false });
    });

    // Also sync on visibility change (when user switches back to tab)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            scheduleSyncFromFirestore();
        }
    });
}

/**
 * Initialize local-first sync
 */
export function initLocalFirstSync() {
    if (typeof window === 'undefined') return;
    attachEventListeners();

}

/**
 * Write to local database first
 * Returns immediately - sync to Firestore happens on user events
 */
export async function writeLocalFirst<T extends { id: string }>(
    collectionName: CollectionName,
    operation: ChangeType,
    id: string,
    data?: T,
    changes?: Partial<T>
): Promise<T | void> {
    if (!db) {
        throw new Error('Database not initialized');
    }

    const localTable = getLocalTable(collectionName);
    if (!localTable) {
        throw new Error(`Unknown collection: ${collectionName}`);
    }

    const timestamp = Date.now();

    try {
        switch (operation) {
            case 'create':
                if (!data) throw new Error('Data required for create operation');
                // ✅ Ensure updatedAt and createdAt fields exist with current timestamp
                const now = new Date();
                const dataWithTimestamp = {
                    ...data,
                    updatedAt: (data as any).updatedAt || now.toISOString(),
                    createdAt: (data as any).createdAt || now.toISOString()
                };
                await localTable.put(dataWithTimestamp as any);
                pendingChanges.set(`${collectionName}:${id}`, {
                    id,
                    type: 'create',
                    collection: collectionName,
                    data: dataWithTimestamp,
                    timestamp
                });
                scheduleSyncToFirestore();
                // ✅ Force immediate sync for create operations to ensure Firestore is updated
                await syncToFirestore();
                return dataWithTimestamp;

            case 'update':
                if (!changes) throw new Error('Changes required for update operation');
                const existing = await localTable.get(id);
                if (existing) {
                    // ✅ Ensure updatedAt field exists
                    const updated = { 
                        ...existing, 
                        ...changes,
                        updatedAt: new Date().toISOString()
                    };

                    await localTable.put(updated as any);
                    
                    // Verify the update
                    const verify = await localTable.get(id);
                    if (!verify) {
                        throw new Error(`Failed to verify update: ${collectionName}:${id}`);
                    }

                    pendingChanges.set(`${collectionName}:${id}`, {
                        id,
                        type: 'update',
                        collection: collectionName,
                        changes: { ...changes, updatedAt: updated.updatedAt },
                        data: updated,
                        timestamp
                    });
                    scheduleSyncToFirestore();
                    // ✅ Force immediate sync for update operations to ensure Firestore is updated
                    await syncToFirestore();
                    return updated as unknown as T;
                } else {

                    // If not found locally, treat as create
                    if (data) {
                        // ✅ Ensure updatedAt and createdAt fields exist with current timestamp
                        const now = new Date();
                        const dataWithTimestamp = {
                            ...data,
                            updatedAt: (data as any).updatedAt || now.toISOString(),
                            createdAt: (data as any).createdAt || now.toISOString()
                        };
                        await localTable.put(dataWithTimestamp as any);
                        pendingChanges.set(`${collectionName}:${id}`, {
                            id,
                            type: 'create',
                            collection: collectionName,
                            data: dataWithTimestamp,
                            timestamp
                        });
                        scheduleSyncToFirestore();
                        // ✅ Force immediate sync for create operations to ensure Firestore is updated
                        await syncToFirestore();
                        return dataWithTimestamp;
                    } else {
                        throw new Error(`Entry not found and no data provided for create: ${collectionName}:${id}`);
                    }
                }
                break;

            case 'delete':
                await localTable.delete(id);
                pendingChanges.set(`${collectionName}:${id}`, {
                    id,
                    type: 'delete',
                    collection: collectionName,
                    timestamp
                });
                scheduleSyncToFirestore();
                // ✅ Force immediate sync for delete operations to ensure Firestore is updated
                await syncToFirestore();
                break;
        }
    } catch (error) {

        throw error;
    }
}

/**
 * Read from local database
 * Always reads from local first - no Firestore read
 */
export async function readLocalFirst<T extends { id: string }>(
    collectionName: CollectionName,
    id?: string
): Promise<T | T[] | null> {
    if (!db) return null;

    const localTable = getLocalTable(collectionName);
    if (!localTable) return null;

    try {
        if (id) {
            const item = await localTable.get(id);
            return item as unknown as T | null;
        } else {
            const items = await localTable.toArray();
            return items as unknown as T[];
        }
    } catch (error) {

        return null;
    }
}

/**
 * Get local table reference
 */
function getLocalTable(collectionName: CollectionName) {
    if (!db) return null;
    
    switch (collectionName) {
        case 'suppliers':
            return db.suppliers;
        case 'customers':
            return db.customers;
        case 'payments':
            return db.payments;
        case 'customerPayments':
            return db.customerPayments;
        case 'transactions':
            return db.transactions;
        case 'options':
            return db.options;
        case 'bankAccounts':
            return db.bankAccounts;
        case 'kantaParchi':
            // KantaParchi might be stored in a different table - adjust as needed
            return null;
        case 'customerDocuments':
            // CustomerDocuments might be stored in a different table - adjust as needed
            return null;
        case 'incomes':
            // Incomes stored in transactions table
            return null;
        case 'expenses':
            // Expenses stored in transactions table
            return null;
        case 'loans':
            return db.loans;
        case 'fundTransactions':
            return db.fundTransactions;
        case 'projects':
            return db.projects;
        case 'employees':
            return db.employees;
        case 'payroll':
            return db.payroll;
        case 'inventoryItems':
            return db.inventoryItems;
        default:
            return null;
    }
}

/**
 * Schedule sync to Firestore
 * Only syncs when user interacts (via event listeners)
 */
function scheduleSyncToFirestore() {
    if (isSyncScheduled) return;
    isSyncScheduled = true;

    // Sync immediately on next event loop (will be triggered by user event)
    if (typeof window !== 'undefined') {
        requestAnimationFrame(() => {
            syncToFirestore();
            isSyncScheduled = false;
        });
    }
}

/**
 * Sync pending local changes to Firestore
 * Only runs when user is actively using the software
 */
/**
 * Convert ISO string dates to Firestore Timestamps
 */
function convertDatesToTimestamps<T extends Record<string, unknown>>(data: T): T {
    if (!data || typeof data !== 'object') return data;
    
    const converted = { ...data };
    
    // Convert updatedAt and createdAt from ISO string to Timestamp
    if (converted.updatedAt && typeof converted.updatedAt === 'string') {
        (converted as Record<string, unknown>).updatedAt = Timestamp.fromDate(new Date(converted.updatedAt));
    }
    if (converted.createdAt && typeof converted.createdAt === 'string') {
        (converted as Record<string, unknown>).createdAt = Timestamp.fromDate(new Date(converted.createdAt));
    }
    
    return converted;
}

// Map collection names to sync processor task types
function getSyncTaskType(collectionName: CollectionName, operation: ChangeType): string {
    // Map plural collection names to singular task types for processors
    const collectionMap: Record<string, string> = {
        'suppliers': 'supplier',
        'customers': 'customer',
        'payments': 'payment',
        'customerPayments': 'customerPayment',
    };
    
    const mappedName = collectionMap[collectionName] || collectionName;
    
    // ✅ Map 'create' operations to 'upsert' for suppliers and customers (processors use 'upsert')
    if (operation === 'create' && (collectionName === 'suppliers' || collectionName === 'customers')) {
        return `upsert:${mappedName}`;
    }
    
    return `${operation}:${mappedName}`;
}

export async function syncToFirestore() {
    if (!pendingChanges.size || typeof window === 'undefined') return;

    const changes = Array.from(pendingChanges.values());
    pendingChanges.clear();

    for (const change of changes) {
        try {
            const firestoreCollection = getFirestoreCollection(change.collection);
            const docRef = doc(firestoreCollection, change.id);

            // ✅ Use batch write to ensure atomicity with sync registry
            const batch = writeBatch(firestoreDB);
            
            switch (change.type) {
                case 'create':
                    if (change.data) {
                        try {
                            // Convert ISO string dates to Firestore Timestamps
                            const firestoreData = convertDatesToTimestamps(change.data);
                            batch.set(docRef, firestoreData);
                        } catch (error: unknown) {
                            const firestoreError = error as { code?: string };
                            if (firestoreError?.code === 'permission-denied' || firestoreError?.code === 'unavailable') {
                                // Queue for later sync - use correct task type
                                const taskType = getSyncTaskType(change.collection, 'create');
                                // ✅ Pass the full data object directly (processors expect Customer/Supplier object, not {id, data})
                                await enqueueSyncTask(
                                    taskType,
                                    change.data,
                                    { dedupeKey: `${change.collection}:${change.id}` }
                                );
                                continue; // Skip this change
                            } else {
                                throw error;
                            }
                        }
                    }
                    break;

                case 'update':
                    if (change.changes) {
                        try {
                            // Check if document exists
                            const docSnap = await getDoc(docRef);
                            if (docSnap.exists()) {
                                // Convert ISO string dates to Firestore Timestamps
                                const firestoreChanges = convertDatesToTimestamps(change.changes);
                                batch.update(docRef, firestoreChanges);
                            } else {
                                // If doesn't exist, create it
                                if (change.data) {
                                    const firestoreData = convertDatesToTimestamps(change.data);
                                    batch.set(docRef, firestoreData);
                                }
                            }
                        } catch (error: unknown) {
                            const firestoreError = error as { code?: string };
                            if (firestoreError?.code === 'permission-denied' || firestoreError?.code === 'unavailable') {
                                // Queue for later sync - use correct task type
                                const taskType = getSyncTaskType(change.collection, 'update');
                                await enqueueSyncTask(
                                    taskType,
                                    { id: change.id, changes: change.changes },
                                    { dedupeKey: `${change.collection}:update:${change.id}` }
                                );
                                continue; // Skip this change
                            } else {
                                throw error;
                            }
                        }
                    }
                    break;

                case 'delete':
                    // Use sync queue for delete operations to ensure proper multi-device sync
                    try {
                        // Use correct task type
                        const taskType = getSyncTaskType(change.collection, 'delete');
                        await enqueueSyncTask(
                            taskType,
                            { id: change.id },
                            { 
                                attemptImmediate: true,
                                dedupeKey: `${change.collection}:delete:${change.id}` 
                            }
                        );
                        // Don't add to batch since sync queue will handle it
                        continue;
                    } catch (error: unknown) {
                        // If enqueue fails, try direct delete as fallback
                        try {
                            batch.delete(docRef);
                        } catch (deleteError: unknown) {
                            const firestoreError = deleteError as { code?: string };
                            if (firestoreError?.code === 'permission-denied' || firestoreError?.code === 'unavailable') {
                                // Re-queue for later
                                pendingChanges.set(`${change.collection}:${change.id}`, change);
                            } else {
                                throw deleteError;
                            }
                        }
                    }
                    break;
            }
            
            // ✅ Update sync registry atomically for this change
            try {
                const { notifySyncRegistry } = await import('./sync-registry');
                await notifySyncRegistry(change.collection, { batch });
                
                // ✅ Also update payment sync registry when suppliers/customers are updated
                // This ensures payment listeners refresh when entry data changes
                if (change.collection === 'suppliers' || change.collection === 'customers') {
                    await notifySyncRegistry('payments', { batch });
                    if (change.collection === 'customers') {
                        await notifySyncRegistry('customerPayments', { batch });
                    }
                }
            } catch (registryError) {
                // Continue even if registry update fails
                handleSilentError(registryError, 'syncToFirestore - registry update fallback');
            }
            
            // Commit batch for this change
            try {
                await batch.commit();
            } catch (error: unknown) {
                const firestoreError = error as { code?: string };
                if (firestoreError?.code === 'permission-denied' || firestoreError?.code === 'unavailable') {
                    // Re-queue the change
                    pendingChanges.set(`${change.collection}:${change.id}`, change);
                } else {
                    throw error;
                }
            }
        } catch (error) {

            // Re-add to pending changes for retry
            pendingChanges.set(`${change.collection}:${change.id}`, change);
        }
    }
}

/**
 * Schedule sync from Firestore
 * Only runs when user is actively using the software
 */
let syncFromFirestoreScheduled = false;
let lastSyncTime = 0;
const SYNC_COOLDOWN = 60_000; // Minimum 60 seconds between syncs to reduce reads

function scheduleSyncFromFirestore() {
    if (syncFromFirestoreScheduled) return;
    if (Date.now() - lastSyncTime < SYNC_COOLDOWN) return;

    syncFromFirestoreScheduled = true;

    if (typeof window !== 'undefined') {
        requestAnimationFrame(() => {
            syncFromFirestore();
            syncFromFirestoreScheduled = false;
            lastSyncTime = Date.now();
        });
    }
}

/**
 * Get last sync time from localStorage
 */
function getLastSyncTime(collectionName: string): number | undefined {
    if (typeof window === 'undefined') return undefined;
    const stored = localStorage.getItem(`lastSync:${collectionName}`);
    return stored ? parseInt(stored, 10) : undefined;
}

/**
 * Save last sync time to localStorage
 */
function saveLastSyncTime(collectionName: string, timestamp: number): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem(`lastSync:${collectionName}`, String(timestamp));
    }
}

/**
 * Sync from Firestore to local
 * Only runs when user interacts with the software
 * ✅ OPTIMIZED: Non-blocking with chunked processing
 */
async function syncFromFirestore() {
    if (!db || typeof window === 'undefined') return;

    try {
        // ✅ OPTIMIZED: Sync collections in parallel (non-blocking)
        // Core collections first, then optional ones
        const coreSyncs = Promise.allSettled([
            syncCollectionFromFirestore('suppliers', 'suppliers', getLastSyncTime('suppliers')),
            syncCollectionFromFirestore('customers', 'customers', getLastSyncTime('customers')),
            syncCollectionFromFirestore('payments', 'payments', getLastSyncTime('payments')),
            syncCollectionFromFirestore('customerPayments', 'customerPayments', getLastSyncTime('customerPayments')),
        ]);
        
        // Yield to main thread after core syncs
        await coreSyncs;
        await yieldToMainThread();
        
        // ✅ Sync additional collections (optional, non-blocking)
        // Note: These are optional and will be synced only if local table exists
        const optionalSyncs = Promise.allSettled([
            syncCollectionFromFirestore('incomes', 'incomes', getLastSyncTime('incomes')).catch(() => {}),
            syncCollectionFromFirestore('expenses', 'expenses', getLastSyncTime('expenses')).catch(() => {}),
        ]);
        
        // Don't await optional syncs - let them complete in background
        optionalSyncs.catch(() => {});
        
    } catch (error) {
        // Silent fail - sync will retry on next interaction
        handleSilentError(error, 'syncToFirestore - background sync fallback');
    }
}

/**
 * Helper to fetch all documents from Firestore with pagination
 * Handles large collections that might exceed Firestore query limits
 * ✅ FIXED: Ensures all documents are fetched, including those without updatedAt
 */
async function getAllDocsPaginated<T extends DocumentData>(
    collectionRef: CollectionReference<T>,
    batchSize: number = 1000
): Promise<T[]> {
    const allDocs: T[] = [];
    let lastDoc: QueryDocumentSnapshot<T> | null = null;
    let hasMore = true;
    
    while (hasMore) {
        let q;
        if (lastDoc) {
            q = query(collectionRef, startAfter(lastDoc), limit(batchSize));
        } else {
            q = query(collectionRef, limit(batchSize));
        }
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            hasMore = false;
            break;
        }
        
        snapshot.forEach((doc) => {
            allDocs.push({ id: doc.id, ...(doc.data() as object) } as unknown as T);
        });
        
        // Check if we got fewer docs than batch size (last batch)
        if (snapshot.docs.length < batchSize) {
            hasMore = false;
        } else {
            lastDoc = snapshot.docs[snapshot.docs.length - 1] as unknown as QueryDocumentSnapshot<T>;
            // Yield to main thread between batches
            await yieldToMainThread();
        }
    }
    
    return allDocs;
}

/**
 * Optimized version - sync only changed documents
 * ✅ OPTIMIZED: Non-blocking with chunked processing
 * ✅ FIXED: Includes documents without updatedAt field
 */
async function syncCollectionFromFirestore(
    collectionName: CollectionName,
    firestoreCollectionName: string,
    lastSyncTime?: number // Track last sync timestamp
) {
    if (!db) return;

    try {
        const firestoreCollection = collection(firestoreDB, firestoreCollectionName);
        const localTable = getLocalTable(collectionName);
        if (!localTable) return;

        const updates: (DocumentData & { id: string })[] = [];
        const updatesMap = new Map<string, DocumentData>(); // To avoid duplicates
        
        // ✅ Incremental sync only (reduces reads dramatically)
        if (lastSyncTime) {
            const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
            try {
                const incrementalQuery = query(
                    firestoreCollection,
                    where('updatedAt', '>', lastSyncTimestamp),
                    orderBy('updatedAt')
                );
                const incrementalSnapshot = await getDocs(incrementalQuery);
                
                incrementalSnapshot.forEach((docSnap) => {
                    const data = { id: docSnap.id, ...docSnap.data() };
                    // Add to updatesMap to avoid duplicates
                    const existingIndex = updates.findIndex(u => u.id === docSnap.id);
                    if (existingIndex >= 0) {
                        // Update existing entry with latest data
                        updates[existingIndex] = data;
                    } else {
                        // Add new entry
                        updates.push(data);
                    }
                });
            } catch (error) {
                // If incremental query fails, do not fallback to full sync automatically
                // This avoids massive reads; will retry on next scheduled sync
                handleSilentError(error, 'syncCollectionFromFirestore - incremental query error');
            }
        } else {
            // ✅ First sync only: fetch all documents once
            try {
                const allSnapshot = await getDocs(query(firestoreCollection));
                allSnapshot.forEach((docSnap) => {
                    const data = { id: docSnap.id, ...docSnap.data() };
                    updates.push(data);
                });
            } catch (fallbackError) {
                handleSilentError(fallbackError, 'syncCollectionFromFirestore - initial full sync error');
            }
        }

        if (updates.length > 0) {
            // ✅ FIX: Handle expenses and incomes specially - they're stored in transactions table
            if (collectionName === 'expenses' || collectionName === 'incomes') {
                // Save to transactions table with type field
                const transactionsTable = db.transactions;
                if (transactionsTable) {
                    const transactionsWithType = updates.map(item => ({
                        ...item,
                        type: collectionName === 'expenses' ? 'Expense' : 'Income',
                        transactionType: collectionName === 'expenses' ? 'Expense' : 'Income'
                    }));
                    await chunkedBulkPut(transactionsTable, transactionsWithType as any[], 100);
                }
            } else if (localTable) {
                // ✅ OPTIMIZED: Use chunked bulkPut to prevent main thread blocking
                await chunkedBulkPut(localTable, updates as any[], 100);
            }
            
            // ✅ Save last sync time (only if we got documents)
            const currentTime = Date.now();
            saveLastSyncTime(collectionName, currentTime);
            
            // ✅ OPTIMIZED: Process pending changes in batches to avoid blocking
            const pendingKeys: string[] = [];
            updates.forEach(item => {
                const key = `${collectionName}:${item.id}`;
                const pendingChange = pendingChanges.get(key);
                
                // If local change is older than Firestore data, mark for removal
                if (pendingChange) {
                    const firestoreTime = (item as any).updatedAt || (item as any).timestamp || 0;
                    if (firestoreTime > pendingChange.timestamp) {
                        pendingKeys.push(key);
                    }
                }
            });
            
            // Remove pending changes in batches
            if (pendingKeys.length > 0) {
                // Process in chunks to avoid blocking
                const chunkSize = 50;
                for (let i = 0; i < pendingKeys.length; i += chunkSize) {
                    const chunk = pendingKeys.slice(i, i + chunkSize);
                    chunk.forEach(key => pendingChanges.delete(key));
                    
                    // Yield to main thread every chunk
                    if (i + chunkSize < pendingKeys.length) {
                        await yieldToMainThread();
                    }
                }
            }
        } else if (!lastSyncTime) {
            // ✅ First sync completed (even if no updates), save timestamp
            const currentTime = Date.now();
            saveLastSyncTime(collectionName, currentTime);
        }
    } catch (error: unknown) {
        // Error handling - will retry on next sync
        const firestoreError = error as { code?: string };
        if (firestoreError?.code !== 'permission-denied' && firestoreError?.code !== 'unavailable') {
            // Will retry on next sync
        }
    }
}

/**
 * Get Firestore collection reference
 */
function getFirestoreCollection(collectionName: CollectionName) {
    return collection(firestoreDB, collectionName);
}

/**
 * Check if there are pending local changes
 */
export function hasPendingChanges(): boolean {
    return pendingChanges.size > 0;
}

/**
 * Get pending changes count
 */
export function getPendingChangesCount(): number {
    return pendingChanges.size;
}

/**
 * Force sync to Firestore (for testing/manual sync)
 */
export async function forceSyncToFirestore(): Promise<void> {
    await syncToFirestore();
}

/**
 * Force sync from Firestore (for testing/manual sync)
 */
export async function forceSyncFromFirestore(): Promise<void> {
    await syncFromFirestore();
}
