
import Dexie, { type Table } from 'dexie';
import { db as firestoreDB } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export interface MainData {
  id: string;
  collection?: string; // Add collection property to identify the data type
  [key: string]: any;
}

export interface SyncQueueItem {
  id?: number;
  action: 'create' | 'update' | 'delete';
  payload: {
    collection: string;
    id?: string;
    data?: any;
    changes?: any;
  };
  timestamp: number;
}

class MyOfflineDB extends Dexie {
  mainDataStore!: Table<MainData, string>;
  syncQueueStore!: Table<SyncQueueItem, number>;

  constructor() {
    super('myOfflineDB');
    this.version(3).stores({ // Incremented version for schema change
      mainDataStore: 'id, collection', // Added 'collection' as an index
      syncQueueStore: '++id, timestamp, payload.collection', // Added index for payload.collection
    });
  }
}

export const db = new MyOfflineDB();

// This function will register a background sync task
async function registerBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('background-sync');
            console.log('Background sync registered');
        } catch (error) {
            console.error('Background sync registration failed:', error);
        }
    }
}

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp'>) {
    await db.syncQueueStore.add({ ...item, timestamp: Date.now() });
    await registerBackgroundSync();
}

export async function syncData(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return { success: false, syncedCount: 0, error: "You are offline." };
    }

    const pendingActions = await db.syncQueueStore.orderBy('timestamp').toArray();
    if (pendingActions.length === 0) {
        return { success: true, syncedCount: 0 };
    }

    let syncedCount = 0;

    for (const actionItem of pendingActions) {
        try {
            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(actionItem),
            });

            if (response.ok) {
                await db.syncQueueStore.delete(actionItem.id!);
                syncedCount++;
            } else {
                const errorData = await response.json();
                console.error('Sync failed for action:', actionItem, 'Error:', errorData.message);
                return { success: false, syncedCount, error: `Sync failed: ${errorData.message}` };
            }
        } catch (error) {
            console.error('Network error during sync for action:', actionItem, error);
            return { success: false, syncedCount, error: "A network error occurred during sync." };
        }
    }

    return { success: true, syncedCount };
}

let isSyncing = false;
let lastSyncTime = 0;
const SYNC_COOLDOWN = 5 * 60 * 1000; // 5 minutes

export async function initialDataSync(): Promise<void> {
    const now = Date.now();
    if (isSyncing || (now - lastSyncTime < SYNC_COOLDOWN)) {
        console.log("Initial data sync is already in progress or was completed recently. Skipping.");
        return;
    }
    
    isSyncing = true;
    
    return new Promise(async (resolve, reject) => {
        try {
            console.log("Starting initial data sync...");
            const collectionsToSync = [
                'customers', 
                'suppliers', 
                'expenses', 
                'incomes', 
                'loans',
                'fund_transactions',
                'bankAccounts',
                'employees',
                'payroll',
                'attendance',
                'projects',
                'inventoryItems',
                'payments',
                'customer_payments'
            ];

            const allData: MainData[] = [];

            for (const collectionName of collectionsToSync) {
                const querySnapshot = await getDocs(collection(firestoreDB, collectionName));
                const data = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, collection: collectionName } as MainData));
                allData.push(...data);
                console.log(`Fetched ${data.length} items from ${collectionName}`);
            }
            
            await db.mainDataStore.clear();
            await db.mainDataStore.bulkPut(allData);
            
            lastSyncTime = Date.now();
            console.log(`Initial data sync completed. Total ${allData.length} items synced.`);
            resolve();
        } catch (error) {
            console.error("Initial data sync failed:", error);
            reject(error);
        } finally {
            isSyncing = false;
        }
    });
}


// Listen for messages from the service worker
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.type === 'SYNC_DATA') {
            console.log('Client received sync message from service worker.');
            syncData();
        }
    });
}
