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
  payload: any;
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
