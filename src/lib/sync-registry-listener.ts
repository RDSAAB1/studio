import { firestoreDB } from "./firebase";
import { collection, doc, onSnapshot, getDocs, query, orderBy, Timestamp, Query } from "firebase/firestore";
import { db } from "./database";
import { isFirestoreTemporarilyDisabled, createPollingFallback } from "./realtime-guard";
import { firestoreMonitor } from "./firestore-monitor";
import { getFirestoreCollectionName } from "./sync-registry";

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
    
    // ✅ Step 1: Load from IndexedDB first (immediate response, no Firestore read)
    if (db && localTableName) {
        const localTable = (db as any)[localTableName];
        if (localTable) {
            localTable.orderBy('date').reverse().toArray().then((localData: T[]) => {
                if (localData && localData.length > 0) {
                    callbackCalledFromIndexedDB = true;
                    callback(localData);
                }
            }).catch(() => {
                // If local read fails, continue with Firestore
                callbackCalledFromIndexedDB = false;
            });
        }
    }
    
    // ✅ Step 2: Listen to sync_registry document for this collection
    // Use the mapped Firestore collection name (same as notifySyncRegistry uses)
    const registryDocId = getFirestoreCollectionName(collectionName);
    const registryDocRef = doc(collection(firestoreDB, "sync_registry"), registryDocId);
    
    const unsubscribe = onSnapshot(registryDocRef, async (snapshot) => {
        if (!snapshot.exists()) {
            // Registry doc doesn't exist yet - do initial fetch
            if (isInitialLoad) {
                try {
                    const freshData = await fetchFunction();
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
        
        // ✅ Step 3: Check if timestamp has changed
        // Always fetch on initial load (when lastKnownTimestamp is null)
        // For subsequent loads, only fetch if timestamp actually changed
        if (isInitialLoad) {
            // Initial load - always fetch
            isInitialLoad = false;
        } else if (lastKnownTimestamp && currentTimestamp) {
            // Compare timestamps - skip if unchanged
            let timestampsEqual = false;
            if (currentTimestamp instanceof Timestamp && lastKnownTimestamp instanceof Timestamp) {
                timestampsEqual = currentTimestamp.isEqual(lastKnownTimestamp);
            } else if (currentTimestamp === lastKnownTimestamp) {
                timestampsEqual = true;
            }
            
            if (timestampsEqual) {
                return; // No change - skip fetch
            }
        } else if (!currentTimestamp) {
            // No timestamp in registry - skip
            return;
        }
        
        // ✅ Step 4: Timestamp changed or initial load - fetch fresh data (one-time getDocs)
        try {
            // Track Firestore read (only one read per change, not streaming)
            firestoreMonitor.logRead(collectionName, 'metadataBasedListener', 1);
            
            const freshData = await fetchFunction();
            
            // ✅ Step 5: Update local IndexedDB
            if (db && localTableName) {
                const localTable = (db as any)[localTableName];
                if (localTable) {
                    // Get all existing IDs from IndexedDB
                    const existingIds = new Set((await localTable.toArray()).map((item: any) => item.id));
                    const freshIds = new Set(freshData.map((item: any) => item.id));
                    
                    // Delete items that are no longer in Firestore
                    const idsToDelete = Array.from(existingIds).filter(id => !freshIds.has(id));
                    if (idsToDelete.length > 0) {
                        await localTable.bulkDelete(idsToDelete);
                    }
                    
                    // Update/add fresh data
                    if (freshData.length > 0) {
                        await localTable.bulkPut(freshData);
                    }
                }
            }
            
            // ✅ Step 6: Call callback with fresh data
            callback(freshData);
            
            // Update last known timestamp
            if (currentTimestamp) {
                lastKnownTimestamp = currentTimestamp instanceof Timestamp 
                    ? currentTimestamp 
                    : Timestamp.fromMillis(currentTimestamp);
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
        
        onError(error);
    });
    
    return unsubscribe;
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

