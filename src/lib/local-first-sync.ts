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
import { getTenantCollectionPath, getStorageKeySuffix } from './tenancy';
import { getFirestoreCollectionName } from './sync-registry';
import { withCreateMetadata, withEditMetadata, logActivity } from './audit';

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
    | 'supplierBankAccounts'
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
 * Skipped in local folder mode — no Firestore sync at all
 */
async function attachEventListeners() {
    if (eventListenersAttached || typeof window === 'undefined') return;
    try {
        const { isLocalFolderMode } = await import('./local-folder-storage');
        if (isLocalFolderMode()) return; // Local folder: do not attach Firestore sync
    } catch (e) {
        // Ignore Next.js HMR orphaned module disposal errors
        return;
    }
    eventListenersAttached = true;

    const events = ['click', 'input', 'change', 'blur', 'focus', 'submit', 'keydown'];
    const syncHandler = () => {
        scheduleSyncFromFirestore().catch(() => {});
    };

    events.forEach(event => {
        window.addEventListener(event, syncHandler, { passive: true, once: false });
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            scheduleSyncFromFirestore();
        }
    });
}

/**
 * Initialize local-first sync (skipped in local folder mode — data is folder/IndexedDB only)
 */
export function initLocalFirstSync() {
    if (typeof window === 'undefined') return;
    void attachEventListeners();
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
    const { isSqliteMode } = await import('./sqlite-storage');
    const isSqlite = isSqliteMode();
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
                // ✅ Ensure updatedAt and createdAt + audit metadata (createdBy, createdByName)
                const now = new Date();
                const baseCreate = {
                    ...data,
                    updatedAt: (data as any).updatedAt || now.toISOString(),
                    createdAt: (data as any).createdAt || now.toISOString()
                };
                const dataWithTimestamp = withCreateMetadata(baseCreate as Record<string, unknown>) as any;
                await localTable.put(dataWithTimestamp);
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: collectionName } }));
                }
                if (isSqlite) return dataWithTimestamp;
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
                    // ✅ Ensure updatedAt + audit metadata (editedBy, editedByName)
                    const baseUpdated = { 
                        ...existing, 
                        ...changes,
                        updatedAt: new Date().toISOString()
                    };
                    const updated = withEditMetadata(baseUpdated as Record<string, unknown>) as any;

                    await localTable.put(updated);
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: collectionName } }));
                    }
                    
                    // Verify the update
                    const verify = await localTable.get(id);
                    if (!verify) {
                        throw new Error(`Failed to verify update: ${collectionName}:${id}`);
                    }

                    const changesWithAudit = {
                        ...changes,
                        updatedAt: updated.updatedAt,
                        editedBy: (updated as any).editedBy,
                        editedByName: (updated as any).editedByName,
                    };
                    if (isSqlite) return updated as unknown as T;
                    pendingChanges.set(`${collectionName}:${id}`, {
                        id,
                        type: 'update',
                        collection: collectionName,
                        changes: changesWithAudit,
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
                        const now = new Date();
                        const baseCreate = {
                            ...data,
                            updatedAt: (data as any).updatedAt || now.toISOString(),
                            createdAt: (data as any).createdAt || now.toISOString()
                        };
                        const dataWithTimestamp = withCreateMetadata(baseCreate as Record<string, unknown>) as any;
                        await localTable.put(dataWithTimestamp);
                        if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: collectionName } }));
                        }
                        pendingChanges.set(`${collectionName}:${id}`, {
                            id,
                            type: 'create',
                            collection: collectionName,
                            data: dataWithTimestamp,
                            timestamp
                        });
                        if (isSqlite) return dataWithTimestamp;
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
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: collectionName } }));
                }
                if (isSqlite) return;
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
        case 'supplierBankAccounts':
            return db.supplierBankAccounts;
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
/** Firestore does not allow undefined; remove keys with undefined value to avoid write errors */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
    if (!obj || typeof obj !== 'object') return obj as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) out[k] = obj[k];
    }
    return out;
}

/**
 * Convert ISO string dates to Firestore Timestamps
 */
function convertDatesToTimestamps<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
    if (!data || typeof data !== 'object') return data as Record<string, unknown>;
    const cleaned = stripUndefined(data);
    // Convert updatedAt and createdAt from ISO string to Timestamp
    if (cleaned.updatedAt && typeof cleaned.updatedAt === 'string') {
        cleaned.updatedAt = Timestamp.fromDate(new Date(cleaned.updatedAt));
    }
    if (cleaned.createdAt && typeof cleaned.createdAt === 'string') {
        cleaned.createdAt = Timestamp.fromDate(new Date(cleaned.createdAt));
    }
    return cleaned;
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
    const { isSqliteMode } = await import('./sqlite-storage');
    if (isSqliteMode()) return;
    if (!pendingChanges.size || typeof window === 'undefined') return;

    const changes = Array.from(pendingChanges.values());
    pendingChanges.clear();

    // ✅ Local folder mode: sync to folder instead of Firestore
    let isLocalFolderModeValue = false;
    let syncCollectionToFolderFn: any = null;
    try {
        const { isLocalFolderMode, syncCollectionToFolder } = await import('./local-folder-storage');
        isLocalFolderModeValue = isLocalFolderMode();
        syncCollectionToFolderFn = syncCollectionToFolder;
    } catch (importErr) {
        // Handle Next.js HMR "unexpected require" from disposed module silently
        return;
    }

    if (isLocalFolderModeValue) {
        const collections = [...new Set(changes.map((c) => c.collection))];
        for (const col of collections) {
            try {
                if (syncCollectionToFolderFn) {
                    await syncCollectionToFolderFn(col);
                }
            } catch (e) {
                handleSilentError(e, `syncToFolder - ${col}`);
            }
        }
        return;
    }

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
                                // Queue for later sync - use correct task type (processors expect { id, data })
                                const taskType = getSyncTaskType(change.collection, 'update');
                                await enqueueSyncTask(
                                    taskType,
                                    { id: change.id, data: change.changes },
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
                const path = getTenantCollectionPath(change.collection).join("/");
                if (change.type === "create" && change.data) {
                    logActivity({
                        type: "create",
                        collection: change.collection,
                        docId: change.id,
                        docPath: path,
                        summary: `Created ${change.collection}/${change.id}`,
                        afterData: change.data as Record<string, unknown>,
                    }).catch(() => {});
                } else if (change.type === "update" && change.changes) {
                    logActivity({
                        type: "edit",
                        collection: change.collection,
                        docId: change.id,
                        docPath: path,
                        summary: `Updated ${change.collection}/${change.id}`,
                        afterData: change.changes as Record<string, unknown>,
                    }).catch(() => {});
                }
            } catch (error: unknown) {
                const firestoreError = error as { code?: string };
                if (firestoreError?.code === 'permission-denied' || firestoreError?.code === 'unavailable') {
                    pendingChanges.set(`${change.collection}:${change.id}`, change);
                } else {
                    throw error;
                }
            }
        } catch (error) {
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

async function scheduleSyncFromFirestore() {
    if (syncFromFirestoreScheduled) return;
    if (Date.now() - lastSyncTime < SYNC_COOLDOWN) return;
    try {
        const { isLocalFolderMode } = await import('./local-folder-storage');
        if (isLocalFolderMode()) return; // Local folder: no Firestore sync
    } catch (e) {
        // Ignore Next.js HMR orphaned listener module disposal errors
        return;
    }

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
 * Get last sync time from localStorage (per-tenant key)
 */
function getLastSyncTime(collectionName: string): number | undefined {
    if (typeof window === 'undefined') return undefined;
    const suffix = getStorageKeySuffix();
    const key = `lastSync:${collectionName}${suffix ? `_${suffix}` : ''}`;
    const stored = localStorage.getItem(key);
    return stored ? parseInt(stored, 10) : undefined;
}

/**
 * Save last sync time to localStorage (per-tenant key)
 */
function saveLastSyncTime(collectionName: string, timestamp: number): void {
    if (typeof window !== 'undefined') {
        const suffix = getStorageKeySuffix();
        const key = `lastSync:${collectionName}${suffix ? `_${suffix}` : ''}`;
        localStorage.setItem(key, String(timestamp));
    }
}

/**
 * Sync from Firestore to local
 * Only runs when user interacts with the software
 * ✅ OPTIMIZED: Non-blocking with chunked processing
 */
async function syncFromFirestore() {
    if (!db || typeof window === 'undefined') return;

    // ✅ Local folder mode: do not sync from Firestore (would overwrite local data)
    try {
        const { isLocalFolderMode } = await import('./local-folder-storage');
        if (isLocalFolderMode()) return;
    } catch (importErr) {
        return;
    }

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
        const firestoreCollection = collection(firestoreDB, ...getTenantCollectionPath(firestoreCollectionName));
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
    const firestoreCollectionName = getFirestoreCollectionName(collectionName);
    return collection(firestoreDB, ...getTenantCollectionPath(firestoreCollectionName));
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
 * No-op in local folder mode — data is only from folder/IndexedDB.
 */
export async function forceSyncFromFirestore(): Promise<void> {
    const { isLocalFolderMode } = await import('./local-folder-storage');
    if (isLocalFolderMode()) return;
    await syncFromFirestore();
}

/** Clear lastSync for a collection and sync it - use after restore to refresh local data */
export async function forceSyncCollectionFromFirestore(collectionName: string): Promise<void> {
    const { isLocalFolderMode } = await import('./local-folder-storage');
    if (isLocalFolderMode()) return; // Local folder: no Firestore read
    if (typeof window !== 'undefined') {
        const suffix = getStorageKeySuffix();
        const key = `lastSync:${collectionName}${suffix ? `_${suffix}` : ''}`;
        localStorage.removeItem(key);
    }
    const firestoreName = getFirestoreCollectionName(collectionName as CollectionName);
    await syncCollectionFromFirestore(collectionName as CollectionName, firestoreName, undefined);
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: collectionName } }));
    }
}
