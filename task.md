# Task List: Customer Import Mode

## Database & Sync Layer
- [ ] Update [database.ts](file:///c:/RAMAN%20DUGGAL/JRMD%20SOFTWARE/studio/src/lib/database.ts) to register `staged_customers` schema and HybridTable.
- [ ] Update [local-first-sync.ts](file:///c:/RAMAN%20DUGGAL/JRMD%20SOFTWARE/studio/src/lib/local-first-sync.ts) to map `staged_customers` case.
- [ ] Update [d1-sync.ts](file:///c:/RAMAN%20DUGGAL/JRMD%20SOFTWARE/studio/src/lib/d1-sync.ts) to exclude `staged_customers` from syncing.
- [ ] Update [core.ts](file:///c:/RAMAN%20DUGGAL/JRMD%20SOFTWARE/studio/src/lib/firestore/core.ts) to define and refresh `stagedCustomersCollection`.
- [ ] Update [customers.ts](file:///c:/RAMAN%20DUGGAL/JRMD%20SOFTWARE/studio/src/lib/firestore/customers.ts) to implement staging helper operations (`addStagedCustomer`, `updateStagedCustomer`, `deleteStagedCustomer`, `deleteMultipleStagedCustomers`, `getStagedCustomersRealtime`, `mergeStagedCustomers`).

## Import & Hook Layer
- [ ] Modify [use-customer-import-export.ts](file:///c:/RAMAN%20DUGGAL/JRMD%20SOFTWARE/studio/src/components/sales/customer-entry/hooks/use-customer-import-export.ts) to write to `db.stagedCustomers` in import mode and skip duplicate sequential numbers.

## UI Component Layer
- [ ] Update [customer-entry-client.tsx](file:///c:/RAMAN%20DUGGAL/JRMD%20SOFTWARE/studio/src/components/sales/customer-entry/customer-entry-client.tsx) to wire `isImportMode`, identity dropdown filter, multi-edit suggest/fill options, and transactional merge buttons.

## Verification
- [ ] Run `npx tsc --noEmit` and check for compile/type errors.
