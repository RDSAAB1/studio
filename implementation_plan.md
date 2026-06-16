# Import Mode for Customer Entry

Implement Import Mode functionality for **Customer Entry**, mirroring the Excel Import, Config Dialog, Staging IndexedDB Table, Filter by Identity, Bulk Deletion, Multi-Edit suggestion/auto-fill, and high-performance "Merge to Main Database" bulk sync from Supplier Entry.

## User Review Required
> [!IMPORTANT]
> - Duplicate check: During import, customers with sequential/serial numbers that already exist in the main database will be automatically skipped to prevent accidental overwrites.
> - Transactional Merge: We will use bulk operations (`bulkPut` & `bulkDelete`) to ensure the transition from staged to main database is instant and lag-free.

## Proposed Changes

### Database & Sync Layer

#### [MODIFY] [database.ts](file:///c:/RAMAN%20DUGGAL/JRMD%20SOFTWARE/studio/src/lib/database.ts)
- Add `staged_customers` to the list of tables.
- Add `stagedCustomers = new HybridTable<Customer>('staged_customers');` to `AppDatabase` class.

#### [MODIFY] [local-first-sync.ts](file:///c:/RAMAN%20DUGGAL/JRMD%20SOFTWARE/studio/src/lib/local-first-sync.ts)
- Add `'staged_customers'` to `CollectionName` type definition.
- Map `'staged_customers'` case in `getLocalTable` to return `db.stagedCustomers`.

#### [MODIFY] [d1-sync.ts](file:///c:/RAMAN%20DUGGAL/JRMD%20SOFTWARE/studio/src/lib/d1-sync.ts)
- Mark `'staged_customers'` as local-only inside the sync push engine (bypass sync) and exclude from remote changes log warning arrays, similar to `staged_suppliers`.

#### [MODIFY] [core.ts](file:///c:/RAMAN%20DUGGAL/JRMD%20SOFTWARE/studio/src/lib/firestore/core.ts)
- Define and export `stagedCustomersCollection`.
- Bind/rebind `stagedCustomersCollection` in `refreshTenantFirestoreBindings`.

#### [MODIFY] [customers.ts](file:///c:/RAMAN%20DUGGAL/JRMD%20SOFTWARE/studio/src/lib/firestore/customers.ts)
- Implement staged database operations:
  - `addStagedCustomer`
  - `updateStagedCustomer`
  - `deleteStagedCustomer`
  - `deleteMultipleStagedCustomers`
  - `bulkUpsertStagedCustomers`
  - `getStagedCustomersRealtime`
  - `mergeStagedCustomers` (handles bulk merging staged items into main customer database in a single transaction).

---

### Import & Hook Layer

#### [MODIFY] [use-customer-import-export.ts](file:///c:/RAMAN%20DUGGAL/JRMD%20SOFTWARE/studio/src/components/sales/customer-entry/hooks/use-customer-import-export.ts)
- Introduce `isImportMode` configuration.
- Direct parsed Excel rows to `db.stagedCustomers` instead of directly writing to the main database when `isImportMode` is active.
- Display configuration dialog during Excel import to specify default and exceptional laboury rates.
- Skip records that already exist in the main database (matching sequential/serial numbers).

---

### UI Component Layer

#### [MODIFY] [customer-entry-client.tsx](file:///c:/RAMAN%20DUGGAL/JRMD%20SOFTWARE/studio/src/components/sales/customer-entry/customer-entry-client.tsx)
- Wire `isImportMode` state toggle.
- Create an asynchronous subscription to `db.stagedCustomers` when `isImportMode` is active.
- Incorporate a searchable Identity Dropdown Filter (`selectedIdentityFilter`) to filter customer records by Name + Father Name + Address.
- Implement staging actions header/bar:
  - "Merge Selected to Main Database" button.
  - "Bulk Delete" button.
  - Multi-Edit suggest/fill settings (e.g. updating laboury rate or other properties of the selected entries).
- Connect tables to toggle seamlessly between main customers and staged customers.

## Verification Plan

### Automated Checks
- Run `npx tsc --noEmit` to verify type safety.

### Manual Verification
1. Open the Customer Entry page.
2. Toggle "Import Mode" on.
3. Import an Excel sheet and configure laboury rates in the pop-up modal.
4. Verify that duplicate serial numbers are skipped, and valid entries are populated in the staging table.
5. Search/filter using the Identity Dropdown.
6. Select entries, multi-edit fields (verifying that recalculations like laboury amounts run correctly).
7. Select and click "Merge to Main Database". Verify that entries are safely written to the main collection and cleared from staging.
