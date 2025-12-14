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
import { collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, query, where, Timestamp, orderBy, writeBatch } from 'firebase/firestore';
import { enqueueSyncTask } from './sync-queue';

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
    data?: any;
    changes?: any;
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
    console.log('✅ Local-First Sync initialized');
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
                await localTable.put(dataWithTimestamp);
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
                    
                    console.log(`[writeLocalFirst] Updating ${collectionName}:${id}`, {
                        existingKeys: Object.keys(existing),
                        changesKeys: Object.keys(changes),
                        updatedKeys: Object.keys(updated),
                        sampleChanges: {
                            name: changes.name || existing.name,
                            variety: changes.variety || existing.variety,
                            grossWeight: changes.grossWeight || existing.grossWeight
                        }
                    });
                    
                    await localTable.put(updated);
                    
                    // Verify the update
                    const verify = await localTable.get(id);
                    if (!verify) {
                        throw new Error(`Failed to verify update: ${collectionName}:${id}`);
                    }
                    console.log(`[writeLocalFirst] Update verified for ${collectionName}:${id}`);
                    
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
                    return updated;
                } else {
                    console.warn(`[writeLocalFirst] Entry not found locally: ${collectionName}:${id}, treating as create`);
                    // If not found locally, treat as create
                    if (data) {
                        // ✅ Ensure updatedAt and createdAt fields exist with current timestamp
                        const now = new Date();
                        const dataWithTimestamp = {
                            ...data,
                            updatedAt: (data as any).updatedAt || now.toISOString(),
                            createdAt: (data as any).createdAt || now.toISOString()
                        };
                        await localTable.put(dataWithTimestamp);
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
        console.error(`Error in writeLocalFirst (${collectionName}/${operation}):`, error);
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
            return item as T | null;
        } else {
            const items = await localTable.toArray();
            return items as T[];
        }
    } catch (error) {
        console.error(`Error reading from local (${collectionName}):`, error);
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
function convertDatesToTimestamps(data: any): any {
    if (!data || typeof data !== 'object') return data;
    
    const converted = { ...data };
    
    // Convert updatedAt and createdAt from ISO string to Timestamp
    if (converted.updatedAt && typeof converted.updatedAt === 'string') {
        converted.updatedAt = Timestamp.fromDate(new Date(converted.updatedAt));
    }
    if (converted.createdAt && typeof converted.createdAt === 'string') {
        converted.createdAt = Timestamp.fromDate(new Date(converted.createdAt));
    }
    
    return converted;
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
                        } catch (error: any) {
                            if (error?.code === 'permission-denied' || error?.code === 'unavailable') {
                                // Queue for later sync
                                await enqueueSyncTask(
                                    `create:${change.collection}`,
                                    { id: change.id, data: change.data },
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
                        } catch (error: any) {
                            if (error?.code === 'permission-denied' || error?.code === 'unavailable') {
                                await enqueueSyncTask(
                                    `update:${change.collection}`,
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
                    try {
                        batch.delete(docRef);
                    } catch (error: any) {
                        if (error?.code === 'permission-denied' || error?.code === 'unavailable') {
                            await enqueueSyncTask(
                                `delete:${change.collection}`,
                                { id: change.id },
                                { dedupeKey: `${change.collection}:delete:${change.id}` }
                            );
                            continue; // Skip this change
                        } else {
                            throw error;
                        }
                    }
                    break;
            }
            
            // ✅ Update sync registry atomically for this change
            try {
                const { notifySyncRegistry } = await import('./sync-registry');
                await notifySyncRegistry(change.collection, { batch });
            } catch (registryError) {
                console.error(`Error updating sync registry for ${change.collection}:`, registryError);
                // Continue even if registry update fails
            }
            
            // Commit batch for this change
            try {
                await batch.commit();
            } catch (error: any) {
                if (error?.code === 'permission-denied' || error?.code === 'unavailable') {
                    // Re-queue the change
                    pendingChanges.set(`${change.collection}:${change.id}`, change);
                } else {
                    throw error;
                }
            }
        } catch (error) {
            console.error(`Error syncing ${change.collection}/${change.id} to Firestore:`, error);
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
const SYNC_COOLDOWN = 5000; // Minimum 5 seconds between syncs

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
 */
async function syncFromFirestore() {
    if (!db || typeof window === 'undefined') return;

    try {
        // ✅ Sync suppliers (only changed ones)
        await syncCollectionFromFirestore('suppliers', 'suppliers', getLastSyncTime('suppliers'));
        
        // ✅ Sync customers (only changed ones)
        await syncCollectionFromFirestore('customers', 'customers', getLastSyncTime('customers'));
        
        // ✅ Sync payments (only changed ones)
        await syncCollectionFromFirestore('payments', 'payments', getLastSyncTime('payments'));
        
        // ✅ Sync customer payments (only changed ones)
        await syncCollectionFromFirestore('customerPayments', 'customerPayments', getLastSyncTime('customerPayments'));
        
        // ✅ Sync additional collections if needed (only changed ones)
        // Note: These are optional and will be synced only if local table exists
        try {
            await syncCollectionFromFirestore('incomes', 'incomes', getLastSyncTime('incomes'));
        } catch {}
        try {
            await syncCollectionFromFirestore('expenses', 'expenses', getLastSyncTime('expenses'));
        } catch {}
    } catch (error) {
        console.error('Error syncing from Firestore:', error);
    }
}

/**
 * Optimized version - sync only changed documents
 */
async function syncCollectionFromFirestore(
    collectionName: CollectionName,
    firestoreCollectionName: string,
    lastSyncTime?: number // Track last sync timestamp
) {
    if (!db) return;

    try {
        const firestoreCollection = collection(firestoreDB, firestoreCollectionName);
        
        // ✅ Only get documents modified after last sync
        let q;
        if (lastSyncTime) {
            const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
            q = query(
                firestoreCollection,
                where('updatedAt', '>', lastSyncTimestamp),
                orderBy('updatedAt')
            );
        } else {
            // First sync - get all (only once)
            q = query(firestoreCollection);
        }
        
        const snapshot = await getDocs(q); // ✅ Only changed docs
        
        if (snapshot.empty) return; // No changes
        
        const localTable = getLocalTable(collectionName);
        if (!localTable) return;

        const updates: any[] = [];
        
        snapshot.forEach((docSnap) => {
            const data = { id: docSnap.id, ...docSnap.data() };
            updates.push(data);
        });

        if (updates.length > 0) {
            // Use bulkPut for efficiency
            await localTable.bulkPut(updates);
            
            // ✅ Save last sync time (only if we got documents)
            const currentTime = Date.now();
            saveLastSyncTime(collectionName, currentTime);
            
            // Remove from pending changes if it exists (conflict resolved)
            updates.forEach(item => {
                const key = `${collectionName}:${item.id}`;
                const pendingChange = pendingChanges.get(key);
                
                // If local change is older than Firestore data, remove from pending
                if (pendingChange) {
                    const firestoreTime = (item as any).updatedAt || (item as any).timestamp || 0;
                    if (firestoreTime > pendingChange.timestamp) {
                        pendingChanges.delete(key);
                    }
                }
            });
        } else if (!lastSyncTime) {
            // ✅ First sync completed (even if no updates), save timestamp
            const currentTime = Date.now();
            saveLastSyncTime(collectionName, currentTime);
        }
    } catch (error: any) {
        if (error?.code !== 'permission-denied' && error?.code !== 'unavailable') {
            console.error(`Error syncing ${collectionName} from Firestore:`, error);
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

