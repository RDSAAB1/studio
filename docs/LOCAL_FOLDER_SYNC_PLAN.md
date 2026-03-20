# Local folder sync plan (file = source of truth)

## Rules

1. **File = source of truth**  
   Excel/folder files are the real database. Dexie (IndexedDB) is only a cache for speed.

2. **No Dexie → file overwrite**  
   We never push the full Dexie state to file on every write. That would overwrite file and lose data (e.g. PaidFor).

3. **Save (file-first)**  
   - **Payments:** `writePaymentToFolderFile` (read file → merge one payment → write file), then update Dexie. Payment delete: `removePaymentsFromFolderFile('payments'|'customerPayments', paymentIds)` then Dexie bulkDelete.  
   - **Suppliers / customers:** `mergeRecordToFolderFile` (read file → merge one record → write file), then Dexie put/add. Delete: `removeRecordFromFolderFile` then Dexie delete.  
   - **Loans / fundTransactions:** `mergeRecordToFolderFile` on add/update, `removeRecordFromFolderFile` on delete, then Dexie.

4. **Full sync only on refresh**  
   - **F5 / page reload:** App loads → `syncAllData()` → `loadFromFolderToDexie(path)` → file read → Dexie replaced.  
   - **“Refresh from file” button:** Data Folder dropdown → “Refresh from file (full sync)” → `loadFromFolderToDexie(path)`.

5. **Incremental**  
   Normal save only touches one record in file and one in Dexie. No full file read/write on every keystroke.

6. **PaidFor**  
   Payment Excel has two sheets: Payments + PaidFor. File-first save and no Dexie→file overwrite keep PaidFor intact.

## Where it’s implemented

- **database.ts:** In local folder mode, table writes (put/add/…) do **not** call `syncCollectionToFolder`.
- **local-folder-storage.ts:** `syncCollectionToFolder` returns immediately in local folder mode (no-op).  
  `mergeRecordToFolderFile`, `removeRecordFromFolderFile`, `writePaymentToFolderFile`, `removePaymentsFromFolderFile`, `writeLedgerCashAccountsToFolder` do file-first updates.
- **indexed-db.ts:** Payment save: `writePaymentToFolderFile` first, then Dexie add/put. No `syncCollectionToFolder`.
- **firestore.ts:** Supplier and customer add/update/delete call `mergeRecordToFolderFile` / `removeRecordFromFolderFile`. Payment delete (deleteSupplier, deletePaymentsForSrNo, deleteCustomerPaymentsForSrNo, deleteMultipleSuppliers, deleteCustomerPayment) call `removePaymentsFromFolderFile` before Dexie bulkDelete; payment updates in deleteSupplier call `writePaymentToFolderFile`. Loans and fundTransactions add/update/delete use `mergeRecordToFolderFile` / `removeRecordFromFolderFile`.
- **erp-company-selector.tsx:** “Refresh from file (full sync)” menu item calls `loadFromFolderToDexie`.
