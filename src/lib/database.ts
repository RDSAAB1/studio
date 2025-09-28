
"use client";

import Dexie, { type Table } from 'dexie';

export class LocalDatabase extends Dexie {
    mainDataStore!: Table<any>; 

    constructor() {
        super('BizSuiteDB');
        this.version(1).stores({
            // The 'id' field is the primary key.
            // 'collection' is indexed to allow for quick filtering by data type (e.g., 'suppliers', 'payments').
            // Additional fields like 'srNo' and 'date' are indexed for efficient sorting and querying.
            mainDataStore: 'id, collection, srNo, date, customerId',
        });
    }
}

export const db = new LocalDatabase();
