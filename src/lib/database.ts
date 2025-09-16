
import Dexie, { type Table } from 'dexie';

export interface MainData {
  id: string;
  // This is a generic interface for your main data.
  // You can define more specific properties based on your application's needs.
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
  mainDataStore!: Table<MainData, string>; // Explicitly type the primary key as string
  syncQueueStore!: Table<SyncQueueItem, number>; // Explicitly type the primary key as number

  constructor() {
    super('myOfflineDB');
    this.version(1).stores({
      mainDataStore: 'id', // Primary key is 'id'
      syncQueueStore: '++id', // Auto-incrementing primary key
    });
  }
}

export const db = new MyOfflineDB();

export async function syncData(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return { success: false, syncedCount: 0, error: "You are offline." };
    }

    const pendingActions = await db.syncQueueStore.toArray();
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
                // Stop on first error to maintain order
                return { success: false, syncedCount, error: `Sync failed: ${errorData.message}` };
            }
        } catch (error) {
            console.error('Network error during sync for action:', actionItem, error);
            // Stop on first network error
            return { success: false, syncedCount, error: "A network error occurred during sync." };
        }
    }

    return { success: true, syncedCount };
}
