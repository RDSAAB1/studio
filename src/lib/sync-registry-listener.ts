import { firestoreDB } from "./firebase";
import { collection, doc, onSnapshot, getDocs, query, orderBy, Timestamp, Query } from "firebase/firestore";
import { db } from "./database";
import { isFirestoreTemporarilyDisabled, createPollingFallback } from "./realtime-guard";
import { firestoreMonitor } from "./firestore-monitor";
import { getFirestoreCollectionName } from "./sync-registry";
import { chunkedBulkPut, chunkedBulkDelete } from "./chunked-operations";

type CollectionName = string;
type FetchFunction<T> = () => Promise<T[]>;
type LocalTableName = string;

interface CollectionConfig<T> {
    collectionName: CollectionName;
    fetchFunction: FetchFunction<T>;
    localTableName?: LocalTableName;
    firestoreQuery?: Query; // Optional: if you want to pass a pre-built query
}

/**
 * Metadata-based real-time listener
 * 
 * Strategy:
 * 1. Load from IndexedDB first (immediate response, no Firestore read)
 * 2. Listen to sync_registry document (not the actual data collection)
 * 3. When timestamp changes, trigger one-time fetch (getDocs)
 * 4. Update IndexedDB and call callback
 * 
 * This dramatically reduces Firestore reads by only fetching when metadata indicates changes
 */
export function createMetadataBasedListener<T extends { id: string }>(
    config: CollectionConfig<T>,
    callback: (data: T[]) => void,
    onError: (error: Error) => void
): () => void {
    const { collectionName, fetchFunction, localTableName } = config;
    
    // Track last known timestamp
    let lastKnownTimestamp: Timestamp | null = null;
    let isInitialLoad = true;
    let callbackCalledFromIndexedDB = false;
    let checkInterval: NodeJS.Timeout | null = null;
    let periodicSyncInterval: NodeJS.Timeout | null = null;
    
    // ✅ Step 1: Load from IndexedDB first (immediate response, no Firestore read)
    // Then immediately check Firestore to detect deletions (even if sync registry hasn't changed)
    if (db && localTableName) {
        const localTable = (db as any)[localTableName];
        if (localTable) {
            // Try to order by 'date' first (for payments, expenses, etc.), fallback to 'srNo' (for suppliers, customers), then 'name' (for ledger accounts)
            localTable.orderBy('date').reverse().toArray().then((localData: T[]) => {
                if (localData && localData.length > 0) {
                    callbackCalledFromIndexedDB = true;
                    callback(localData);
                }
            }).catch(() => {
                // If 'date' field doesn't exist, try 'srNo' (for suppliers/customers)
                localTable.orderBy('srNo').reverse().toArray().then((localData: T[]) => {
                    if (localData && localData.length > 0) {
                        callbackCalledFromIndexedDB = true;
                        callback(localData);
                    }
                }).catch(() => {
                    // If 'srNo' doesn't exist, try 'name' (for ledger accounts)
                    localTable.orderBy('name').toArray().then((localData: T[]) => {
                        if (localData && localData.length > 0) {
                            callbackCalledFromIndexedDB = true;
                            callback(localData);
                        }
                    }).catch(() => {
                        // If all ordering fails, just get all data without ordering
                    localTable.toArray().then((localData: T[]) => {
                        if (localData && localData.length > 0) {
                            callbackCalledFromIndexedDB = true;
                            callback(localData);
                        }
                    }).catch(() => {
                        // If local read fails, continue with Firestore
                        callbackCalledFromIndexedDB = false;
                        });
                    });
                });
            });
            
            // ✅ Periodic checks removed - only sync when sync registry indicates actual changes
            // This prevents unnecessary reads and only fetches when edit/delete/update occurs
        }
    }
    
    // ✅ Step 2: Listen to sync_registry document for this collection
    // Use the mapped Firestore collection name (same as notifySyncRegistry uses)
    const registryDocId = getFirestoreCollectionName(collectionName);
    const registryDocRef = doc(collection(firestoreDB, "sync_registry"), registryDocId);
    
    const unsubscribe = onSnapshot(registryDocRef, async (snapshot) => {
        if (!snapshot.exists()) {
            // Registry doc doesn't exist yet - always do initial fetch to detect deletions
            if (isInitialLoad) {
                // ✅ FIX: Always fetch FULL sync on initial load, even if sync_registry doesn't exist
                // This ensures we get all documents, including those added without sync_registry update
                try {
                    const freshData = await fetchFunction();
                    
                    // Update IndexedDB and detect deletions
                    if (db && localTableName) {
                        const localTable = (db as any)[localTableName];
                        if (localTable && localTableName !== 'payments' && localTableName !== 'governmentFinalizedPayments') {
                            const existingIds = new Set<string>((await localTable.toArray()).map((item: { id: string }) => item.id));
                            const freshIds = new Set<string>(freshData.map((item) => item.id));
                            const idsToDelete = Array.from(existingIds).filter((id) => !freshIds.has(id));
                            if (idsToDelete.length > 0) {
                                await chunkedBulkDelete(localTable, idsToDelete, 200);
                            }
                            if (freshData.length > 0) {
                                await chunkedBulkPut(localTable, freshData, 100);
                            }
                        }
                    }
                    
                    if (db && db.transactions && (collectionName === 'expenses' || collectionName === 'incomes')) {
                        const isExpense = collectionName === 'expenses';
                        const localData = await db.transactions.where('type').equals(isExpense ? 'Expense' : 'Income').toArray();
                        const localIds = new Set<string>(localData.map((item: { id: string }) => item.id));
                        const freshIds = new Set<string>(freshData.map((item) => item.id));
                        const missingIds = Array.from(freshIds).filter((id) => !localIds.has(id));
                        if (missingIds.length > 0) {
                            const missingDocs = freshData.filter(item => missingIds.includes((item as any).id));
                            const withType = missingDocs.map(e => ({
                                ...e,
                                type: isExpense ? 'Expense' : 'Income',
                                transactionType: isExpense ? 'Expense' : 'Income'
                            }));
                            await chunkedBulkPut(db.transactions, withType as any[], 100);
                        }
                        const extraIds = Array.from(localIds).filter((id) => !freshIds.has(id));
                        if (extraIds.length > 0) {
                            await chunkedBulkDelete(db.transactions, extraIds, 200);
                        }
                    }
                    
                    callback(freshData);
                    isInitialLoad = false;
                } catch (error) {
                    onError(error as Error);
                }
            }
            return;
        }
        
        const data = snapshot.data();
        const currentTimestamp = data.last_updated || data.updated_at;
        const currentTrigger = (data as any)._trigger;
        
        // Track last known values
        const lastTriggerKey = `lastTrigger_${collectionName}`;
        const lastTimestampKey = `lastTimestamp_${collectionName}`;
        const lastKnownTrigger = typeof window !== 'undefined' ? (window as any)[lastTriggerKey] : null;
        const lastKnownTimestampStr = typeof window !== 'undefined' ? (window as any)[lastTimestampKey] : null;
        
        // ✅ Step 3: Always fetch on initial load to catch any missed documents
        if (isInitialLoad) {
            // Initial load - always fetch FULL sync to ensure we get all documents
            // This catches any documents that might have been missed due to sync registry issues
            isInitialLoad = false;
            // Continue to fetch below
        } else {
            // If we don't have last known values yet, always fetch (first update after initial load)
            if (lastKnownTimestampStr === null && lastKnownTrigger === null) {
                // Continue to fetch below
            } else {
                // Check if timestamp changed
                let timestampChanged = false;
                if (currentTimestamp) {
                    const currentTimestampStr = currentTimestamp instanceof Timestamp 
                        ? currentTimestamp.toMillis().toString() 
                        : String(currentTimestamp);
                    
                    if (lastKnownTimestampStr !== currentTimestampStr) {
                        timestampChanged = true;
                    }
                }
                
                // Check if trigger changed
                // Trigger is always a number when set, so compare directly
                // Handle case where trigger might be 0 (falsy but valid)
                const hasCurrentTrigger = currentTrigger !== undefined && currentTrigger !== null;
                const hasLastTrigger = lastKnownTrigger !== undefined && lastKnownTrigger !== null;
                const triggerChanged = hasCurrentTrigger && 
                                      (hasLastTrigger ? currentTrigger !== lastKnownTrigger : true);
                
                // Only fetch if timestamp OR trigger changed (actual change detected)
                if (timestampChanged || triggerChanged) {
                    // Continue to fetch below (don't return)
                } else {
                    // No change detected - skip fetch to avoid unnecessary reads
                    return; // Skip fetch
                }
            }
        }
        
        // ✅ Step 4: Timestamp changed or initial load - fetch fresh data immediately (one-time getDocs)
        // Always fetch when timestamp changes - no cooldown to ensure deletions are detected immediately
        try {
            
            // Track Firestore read (only one read per change, not streaming)
            firestoreMonitor.logRead(collectionName, 'metadataBasedListener', 1);
            
            const freshData = await fetchFunction();
            
            // ✅ Step 5: Update local IndexedDB and prepare final data for callback
            let finalData = freshData;
            
            if (db && localTableName) {
                const localTable = (db as any)[localTableName];
                if (localTable) {
                    // For dual-collection payments, skip default IndexedDB update (handled separately)
                    if (localTableName === 'payments' || localTableName === 'governmentFinalizedPayments') {
                        // Skip - payments are handled by savePaymentsToIndexedDB
                        finalData = freshData;
                    } else {
                        // Get all existing IDs from IndexedDB BEFORE updating
                        const existingItems = await localTable.toArray();
                        const existingIds = new Set<string>(existingItems.map((item: { id: string }) => item.id));
                        const freshIds = new Set<string>(freshData.map((item) => item.id));
                        
                        // ✅ OPTIMIZED: Use chunked bulkDelete to prevent blocking
                        const idsToDelete = Array.from(existingIds).filter((id) => !freshIds.has(id));
                        if (idsToDelete.length > 0) {
                            await chunkedBulkDelete(localTable, idsToDelete, 200);
                        }
                        
                        // ✅ OPTIMIZED: Use chunked bulkPut to prevent blocking
                        if (freshData.length > 0) {
                            await chunkedBulkPut(localTable, freshData, 100);
                        } else if (idsToDelete.length > 0) {
                            // If all items were deleted, ensure IndexedDB is empty
                            await localTable.clear();
                        }
                        
                        // After updating IndexedDB, get the final data (which excludes deleted items)
                        // This ensures the callback gets the correct data that matches IndexedDB
                        finalData = freshData; // freshData already excludes deleted items from Firestore
                    }
                }
            }
            
            if (db && db.transactions && (collectionName === 'expenses' || collectionName === 'incomes')) {
                const isExpense = collectionName === 'expenses';
                const withType = freshData.map(e => ({
                    ...e,
                    type: isExpense ? 'Expense' : 'Income',
                    transactionType: isExpense ? 'Expense' : 'Income'
                }));
                await chunkedBulkPut(db.transactions, withType as any[], 100);
                const localData = await db.transactions.where('type').equals(isExpense ? 'Expense' : 'Income').toArray();
                const localIds = new Set<string>(localData.map((item: { id: string }) => item.id));
                const freshIds = new Set<string>(freshData.map((item) => item.id));
                const extraIds = Array.from(localIds).filter((id) => !freshIds.has(id));
                if (extraIds.length > 0) {
                    await chunkedBulkDelete(db.transactions, extraIds, 200);
                }
            }
            
            // ✅ Step 6: Call callback with final data (always call, even if empty, to trigger UI update)
            // finalData already excludes deleted items (from Firestore fetch)
            // and IndexedDB has been updated to match, so callback will update UI correctly
            // This ensures other devices' IndexedDB and UI update immediately
            // Always create a new array reference to ensure React detects the change
            const dataToCallback = [...finalData];
            callback(dataToCallback);
            
            // Update last known timestamp and trigger (save BEFORE callback to ensure it's saved)
            if (currentTimestamp) {
                lastKnownTimestamp = currentTimestamp instanceof Timestamp 
                    ? currentTimestamp 
                    : Timestamp.fromMillis(currentTimestamp);
                
                // Save timestamp string for comparison
                if (typeof window !== 'undefined') {
                    const timestampStr = currentTimestamp instanceof Timestamp 
                        ? currentTimestamp.toMillis().toString() 
                        : String(currentTimestamp);
                    (window as any)[`lastTimestamp_${collectionName}`] = timestampStr;
                }
            }
            // Always save trigger if it exists (even if 0, to track state)
            // Use explicit check for undefined/null, not falsy check (0 is valid)
            if (typeof window !== 'undefined') {
                if (currentTrigger !== undefined && currentTrigger !== null) {
                    (window as any)[`lastTrigger_${collectionName}`] = currentTrigger;
                } else {
                    // Clear trigger if it's undefined/null (document might not have trigger field yet)
                    (window as any)[`lastTrigger_${collectionName}`] = null;
                }
            }
            isInitialLoad = false;
            
        } catch (error) {
            onError(error as Error);
        }
    }, (error) => {
        // Handle Firestore errors
        if (isFirestoreTemporarilyDisabled()) {
            // Fallback to polling if Firestore is disabled
            const pollUnsub = createPollingFallback(fetchFunction, callback);
            return pollUnsub;
        }
        
        onError(error as Error);
    });
    
    // ✅ FIX: Add immediate sync check on mount + periodic full sync check to catch any missed documents
    // This ensures documents added without sync_registry update are caught quickly
    const performFullSyncCheck = async () => {
        try {
            const freshData = await fetchFunction();
            
            // ✅ FIX: Handle expenses specially - they're stored in transactions table
            if (collectionName === 'expenses' && db && db.transactions) {
                const localData = await db.transactions.where('type').equals('Expense').toArray();
                const localIds = new Set<string>(localData.map((item: { id: string }) => item.id));
                const freshIds = new Set<string>(freshData.map((item) => item.id));
                
                // Find missing documents (in Firestore but not in local)
                const missingIds = Array.from(freshIds).filter((id) => !localIds.has(id));
                if (missingIds.length > 0) {
                    const missingDocs = freshData.filter(item => missingIds.includes(item.id));
                    // Add type field before saving
                    const expensesWithType = missingDocs.map(e => ({
                        ...e,
                        type: 'Expense' as const,
                        transactionType: 'Expense' as const
                    }));
                    await chunkedBulkPut(db.transactions, expensesWithType, 100);
                    
                    // Also check for extra documents (in local but not in Firestore - might be deleted)
                    const extraIds = Array.from(localIds).filter((id) => !freshIds.has(id));
                    if (extraIds.length > 0) {
                        await chunkedBulkDelete(db.transactions, extraIds, 200);
                    }
                    
                    // Update callback with fresh data
                    callback([...freshData]);
                    return true; // Indicates changes were found
                } else {
                    // Check for deletions
                    const extraIds = Array.from(localIds).filter((id) => !freshIds.has(id));
                    if (extraIds.length > 0) {
                        await chunkedBulkDelete(db.transactions, extraIds, 200);
                        callback([...freshData]);
                        return true; // Indicates changes were found
                    }
                }
            } else if (db && localTableName) {
                const localTable = (db as any)[localTableName];
                if (localTable && localTableName !== 'payments' && localTableName !== 'governmentFinalizedPayments') {
                    const localData = await localTable.toArray();
                    const localIds = new Set<string>(localData.map((item: { id: string }) => item.id));
                    const freshIds = new Set<string>(freshData.map((item) => item.id));
                    
                    // Find missing documents (in Firestore but not in local)
                    const missingIds = Array.from(freshIds).filter((id) => !localIds.has(id));
                    if (missingIds.length > 0) {
                        const missingDocs = freshData.filter(item => missingIds.includes(item.id));
                        await chunkedBulkPut(localTable, missingDocs, 100);
                        
                        // Also check for extra documents (in local but not in Firestore - might be deleted)
                        const extraIds = Array.from(localIds).filter((id) => !freshIds.has(id));
                        if (extraIds.length > 0) {
                            await chunkedBulkDelete(localTable, extraIds, 200);
                        }
                        
                        // Update callback with fresh data
                        callback([...freshData]);
                        return true; // Indicates changes were found
                    } else {
                        // Check for deletions
                        const extraIds = Array.from(localIds).filter((id) => !freshIds.has(id));
                        if (extraIds.length > 0) {
                            await chunkedBulkDelete(localTable, extraIds, 200);
                            callback([...freshData]);
                            return true; // Indicates changes were found
                        }
                    }
                }
            }
            return false; // No changes found
        } catch (error) {
            return false;
        }
    };
    
    const shouldEnablePeriodicSync = () => {
        if (typeof window === 'undefined') return false;
        const flag = window.localStorage?.getItem('periodic-sync-enabled');
        return flag === 'true';
    };
    
    if (typeof window !== 'undefined' && (localTableName || collectionName === 'expenses')) {
        if (shouldEnablePeriodicSync()) {
            setTimeout(() => {
                performFullSyncCheck();
            }, 2000);
            
            periodicSyncInterval = setInterval(() => {
                performFullSyncCheck();
            }, 10 * 60 * 1000);
        }
    }
    
    // Return unsubscribe function that also cleans up intervals
    return () => {
        if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
        }
        if (periodicSyncInterval) {
            clearInterval(periodicSyncInterval);
            periodicSyncInterval = null;
        }
        unsubscribe();
    };
}

/**
 * Helper to create a fetch function from a Firestore query
 */
export function createFetchFunctionFromQuery<T extends { id: string }>(
    firestoreQuery: Query,
    transformFn?: (doc: any) => T
): FetchFunction<T> {
    return async () => {
        const snapshot = await getDocs(firestoreQuery);
        const data = snapshot.docs.map(doc => {
            const docData = { id: doc.id, ...doc.data() };
            return transformFn ? transformFn(docData) : docData as T;
        });
        return data;
    };
}
