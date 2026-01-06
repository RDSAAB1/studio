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
export function createMetadataBasedListener<T>(
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
        console.log(`[${collectionName}] Sync registry snapshot received, exists: ${snapshot.exists()}`);
        
        if (!snapshot.exists()) {
            // Registry doc doesn't exist yet - always do initial fetch to detect deletions
            if (isInitialLoad) {
                // ✅ FIX: Always fetch FULL sync on initial load, even if sync_registry doesn't exist
                // This ensures we get all documents, including those added without sync_registry update
                console.log(`[${collectionName}] Sync registry doesn't exist - doing FULL initial sync`);
                try {
                    const freshData = await fetchFunction();
                    
                    // Update IndexedDB and detect deletions
                    if (db && localTableName) {
                        const localTable = (db as any)[localTableName];
                        if (localTable && localTableName !== 'payments' && localTableName !== 'governmentFinalizedPayments') {
                            const existingIds = new Set((await localTable.toArray()).map((item: any) => item.id));
                            const freshIds = new Set(freshData.map((item: any) => item.id));
                            const idsToDelete = Array.from(existingIds).filter(id => !freshIds.has(id));
                            if (idsToDelete.length > 0) {
                                console.log(`[${collectionName}] Initial sync: deleting ${idsToDelete.length} items`);
                                await chunkedBulkDelete(localTable, idsToDelete, 200);
                            }
                            if (freshData.length > 0) {
                                await chunkedBulkPut(localTable, freshData, 100);
                            }
                        }
                    }
                    
                    callback(freshData);
                    isInitialLoad = false;
                } catch (error) {
                    console.error(`[${collectionName}] Initial sync failed:`, error);
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
        
        console.log(`[${collectionName}] Sync registry change detected:`, {
            hasTimestamp: !!currentTimestamp,
            hasTrigger: currentTrigger !== undefined,
            currentTrigger,
            lastKnownTrigger,
            lastKnownTimestampStr,
            isInitialLoad
        });
        
        // ✅ Step 3: Always fetch on initial load to catch any missed documents
        if (isInitialLoad) {
            // Initial load - always fetch FULL sync to ensure we get all documents
            // This catches any documents that might have been missed due to sync registry issues
            console.log(`[${collectionName}] Initial load - fetching FULL sync`);
            isInitialLoad = false;
            // Continue to fetch below
        } else {
            // If we don't have last known values yet, always fetch (first update after initial load)
            if (lastKnownTimestampStr === null && lastKnownTrigger === null) {
                console.log(`[${collectionName}] No last known values - fetching (first update)`);
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
                        console.log(`[${collectionName}] Timestamp changed: ${lastKnownTimestampStr} -> ${currentTimestampStr}`);
                    }
                }
                
                // Check if trigger changed
                // Trigger is always a number when set, so compare directly
                // Handle case where trigger might be 0 (falsy but valid)
                const hasCurrentTrigger = currentTrigger !== undefined && currentTrigger !== null;
                const hasLastTrigger = lastKnownTrigger !== undefined && lastKnownTrigger !== null;
                const triggerChanged = hasCurrentTrigger && 
                                      (hasLastTrigger ? currentTrigger !== lastKnownTrigger : true);
                
                console.log(`[${collectionName}] Change check:`, {
                    timestampChanged,
                    triggerChanged,
                    currentTrigger,
                    lastKnownTrigger,
                    hasCurrentTrigger,
                    hasLastTrigger,
                    willFetch: timestampChanged || triggerChanged
                });
                
                // Only fetch if timestamp OR trigger changed (actual change detected)
                if (timestampChanged || triggerChanged) {
                    console.log(`[${collectionName}] ✅ Change detected - fetching (timestamp: ${timestampChanged}, trigger: ${triggerChanged})`);
                    // Continue to fetch below (don't return)
                } else {
                    // No change detected - skip fetch to avoid unnecessary reads
                    console.log(`[${collectionName}] ⏭️ No change detected, skipping fetch`);
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
                        const existingIds = new Set(existingItems.map((item: any) => item.id));
                        const freshIds = new Set(freshData.map((item: any) => item.id));
                        
                        // ✅ OPTIMIZED: Use chunked bulkDelete to prevent blocking
                        const idsToDelete = Array.from(existingIds).filter(id => !freshIds.has(id));
                        if (idsToDelete.length > 0) {
                            console.log(`[${collectionName}] 🗑️ Detected ${idsToDelete.length} deletions:`, idsToDelete);
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
                        
                        // Log deletion detection for debugging
                        if (idsToDelete.length > 0) {
                            console.log(`[${collectionName}] ✅ Deleted ${idsToDelete.length} items from IndexedDB:`, idsToDelete);
                        }
                    }
                }
            }
            
            // ✅ Step 6: Call callback with final data (always call, even if empty, to trigger UI update)
            // finalData already excludes deleted items (from Firestore fetch)
            // and IndexedDB has been updated to match, so callback will update UI correctly
            // This ensures other devices' IndexedDB and UI update immediately
            // Always create a new array reference to ensure React detects the change
            const dataToCallback = [...finalData];
            console.log(`[${collectionName}] Sync registry change detected, updating with ${dataToCallback.length} items`);
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
                    console.log(`[${collectionName}] Saved trigger: ${currentTrigger}`);
                } else {
                    // Clear trigger if it's undefined/null (document might not have trigger field yet)
                    (window as any)[`lastTrigger_${collectionName}`] = null;
                }
            }
            isInitialLoad = false;
            
        } catch (error) {
            console.error(`[${collectionName}] Error fetching data:`, error);
            onError(error as Error);
        }
    }, (error) => {
        // Handle Firestore errors
        console.error(`[${collectionName}] Sync registry listener error:`, error);
        if (isFirestoreTemporarilyDisabled()) {
            // Fallback to polling if Firestore is disabled
            const pollUnsub = createPollingFallback(fetchFunction, callback);
            return pollUnsub;
        }
        
        onError(error);
    });
    
    // ✅ FIX: Add immediate sync check on mount + periodic full sync check to catch any missed documents
    // This ensures documents added without sync_registry update are caught quickly
    const performFullSyncCheck = async () => {
        try {
            const freshData = await fetchFunction();
            
            // ✅ FIX: Handle expenses specially - they're stored in transactions table
            if (collectionName === 'expenses' && db && db.transactions) {
                const localData = await db.transactions.where('type').equals('Expense').toArray();
                const localIds = new Set(localData.map((item: any) => item.id));
                const freshIds = new Set(freshData.map((item: any) => item.id));
                
                // Find missing documents (in Firestore but not in local)
                const missingIds = Array.from(freshIds).filter(id => !localIds.has(id));
                if (missingIds.length > 0) {
                    console.log(`[${collectionName}] 🔍 Full sync check found ${missingIds.length} missing documents:`, missingIds);
                    const missingDocs = freshData.filter(item => missingIds.includes(item.id));
                    // Add type field before saving
                    const expensesWithType = missingDocs.map(e => ({
                        ...e,
                        type: 'Expense' as const,
                        transactionType: 'Expense' as const
                    }));
                    await chunkedBulkPut(db.transactions, expensesWithType, 100);
                    
                    // Also check for extra documents (in local but not in Firestore - might be deleted)
                    const extraIds = Array.from(localIds).filter(id => !freshIds.has(id));
                    if (extraIds.length > 0) {
                        console.log(`[${collectionName}] 🗑️ Full sync check found ${extraIds.length} extra documents (deleted):`, extraIds);
                        await chunkedBulkDelete(db.transactions, extraIds, 200);
                    }
                    
                    // Update callback with fresh data
                    callback([...freshData]);
                    return true; // Indicates changes were found
                } else {
                    // Check for deletions
                    const extraIds = Array.from(localIds).filter(id => !freshIds.has(id));
                    if (extraIds.length > 0) {
                        console.log(`[${collectionName}] 🗑️ Full sync check found ${extraIds.length} deleted documents:`, extraIds);
                        await chunkedBulkDelete(db.transactions, extraIds, 200);
                        callback([...freshData]);
                        return true; // Indicates changes were found
                    }
                }
            } else if (db && localTableName) {
                const localTable = (db as any)[localTableName];
                if (localTable && localTableName !== 'payments' && localTableName !== 'governmentFinalizedPayments') {
                    const localData = await localTable.toArray();
                    const localIds = new Set(localData.map((item: any) => item.id));
                    const freshIds = new Set(freshData.map((item: any) => item.id));
                    
                    // Find missing documents (in Firestore but not in local)
                    const missingIds = Array.from(freshIds).filter(id => !localIds.has(id));
                    if (missingIds.length > 0) {
                        console.log(`[${collectionName}] 🔍 Full sync check found ${missingIds.length} missing documents:`, missingIds);
                        const missingDocs = freshData.filter(item => missingIds.includes(item.id));
                        await chunkedBulkPut(localTable, missingDocs, 100);
                        
                        // Also check for extra documents (in local but not in Firestore - might be deleted)
                        const extraIds = Array.from(localIds).filter(id => !freshIds.has(id));
                        if (extraIds.length > 0) {
                            console.log(`[${collectionName}] 🗑️ Full sync check found ${extraIds.length} extra documents (deleted):`, extraIds);
                            await chunkedBulkDelete(localTable, extraIds, 200);
                        }
                        
                        // Update callback with fresh data
                        callback([...freshData]);
                        return true; // Indicates changes were found
                    } else {
                        // Check for deletions
                        const extraIds = Array.from(localIds).filter(id => !freshIds.has(id));
                        if (extraIds.length > 0) {
                            console.log(`[${collectionName}] 🗑️ Full sync check found ${extraIds.length} deleted documents:`, extraIds);
                            await chunkedBulkDelete(localTable, extraIds, 200);
                            callback([...freshData]);
                            return true; // Indicates changes were found
                        }
                    }
                }
            }
            return false; // No changes found
        } catch (error) {
            console.error(`[${collectionName}] Full sync check failed:`, error);
            return false;
        }
    };
    
    // ✅ Immediate sync check after initial load (wait 2 seconds to let initial load complete)
    // ✅ FIX: Also run for expenses (even though localTableName is undefined, we handle it specially)
    if (typeof window !== 'undefined' && (localTableName || collectionName === 'expenses')) {
        setTimeout(() => {
            performFullSyncCheck().then((hadChanges) => {
                if (hadChanges) {
                    console.log(`[${collectionName}] ✅ Immediate sync check completed and found changes`);
                }
            });
        }, 2000); // 2 seconds after mount
        
        // ✅ Periodic full sync check (every 2 minutes) to catch any missed documents
        // Reduced from 5 minutes to 2 minutes for faster detection
        periodicSyncInterval = setInterval(() => {
            performFullSyncCheck();
        }, 2 * 60 * 1000); // 2 minutes
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
export function createFetchFunctionFromQuery<T>(
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

