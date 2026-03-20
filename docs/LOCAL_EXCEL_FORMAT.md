# Excel data mapping – konsi file, kaise map, kaise data

Local folder mode mein **konsi Excel file kis collection se map hoti hai**, **path kaise banata hai**, aur **data kis format mein hai** — sab yahan defined hai.

**Excel ↔ UI mapping** (column names = object keys): **`src/lib/excel-ui-mapping.ts`** — yahi use check karo aur dobara mapping yahi se karo. Wahi keys Excel headers aur UI/Dexie dono mein use hoti hain.

---

## 1. Folder structure (path kaise banata hai)

### Flat mode (simple)
```
{BaseFolder}/
  Entry/
    suppliers.xlsx
    customers.xlsx
    inventory-items.xlsx
  Payments/
    supplier-payments.xlsx
    customer-payments.xlsx
    ledger-accounts.xlsx
    ledger-entries.xlsx
    ledger-cash-accounts.xlsx
    expenses.xlsx
    incomes.xlsx
  CashAndBank/
    banks.xlsx
    bank-branches.xlsx
    bank-accounts.xlsx
    supplier-bank-accounts.xlsx
    loans.xlsx
    fund-transactions.xlsx
  Reports/
    mandi-reports.xlsx
  HR/
    employees.xlsx
    payroll.xlsx
    attendance.xlsx
  Projects/
    projects.xlsx
  Settings/
    options.xlsx
    settings.xlsx
```

Path example: `C:\MyData\Entry\suppliers.xlsx`

### Hierarchical mode (company / sub / season)
```
{BaseFolder}/
  _meta/
    companies.json
    selection.json
  companies/
    {companyId}/
      {subCompanyId}/
        {seasonKey}/
          Entry/suppliers.xlsx
          Payments/supplier-payments.xlsx
          ... (same files as above)
```

Path example: `C:\MyData\companies\main\main\default\Entry\suppliers.xlsx`

- **Read path** code: `local-folder-storage.ts` → `getLocalFlatPath()` (flat) / `getLocalDataPath()` (hierarchical).
- **File list** code: `local-mode-structure.ts` → `LOCAL_DATA_FILES` (folder → file names).

---

## 2. File → Collection → Data mapping (full table)

| # | Folder       | Excel file                  | Collection (app name) | App mein data kahan | Data format (main columns) |
|---|-------------|-----------------------------|------------------------|----------------------|----------------------------|
| 1 | Entry       | suppliers.xlsx              | suppliers              | Dexie `db.suppliers` | id, srNo, date, name, so, address, contact, variety, weight, rate, amount, netAmount, receiptType, paymentType, customerId, … |
| 2 | Entry       | customers.xlsx              | customers              | Dexie `db.customers` | Same as suppliers (Customer type) |
| 3 | Entry       | inventory-items.xlsx        | inventoryItems         | Dexie `db.inventoryItems` | id, name, variety, unit |
| 4 | Payments    | supplier-payments.xlsx      | payments               | Dexie `db.payments` | id, paymentId, customerId, date, amount, type, receiptType, paymentMethod, paidFor (JSON), … |
| 5 | Payments    | customer-payments.xlsx       | customerPayments       | Dexie `db.customerPayments` | id, paymentId, customerId, date, amount, type, paymentMethod, paidFor (JSON), … |
| 6 | Payments    | ledger-accounts.xlsx        | ledgerAccounts         | Dexie `db.ledgerAccounts` | id, name, address, contact |
| 7 | Payments    | ledger-entries.xlsx         | ledgerEntries          | Dexie `db.ledgerEntries` | id, accountId, date, particulars, debit, credit, balance, linkGroupId, linkStrategy |
| 8 | Payments    | ledger-cash-accounts.xlsx    | ledgerCashAccounts     | **localStorage** `ledgerCashAccountsCache` | id, name, noteGroups (JSON) |
| 9 | Payments    | expenses.xlsx               | expenses               | Dexie `db.transactions` (type=Expense) | id, transactionId, date, type, category, amount, payee, paymentMethod, status, … |
|10 | Payments    | incomes.xlsx                | incomes                | Dexie `db.transactions` (type=Income) | Same as expenses (type=Income) |
|11 | CashAndBank | banks.xlsx                  | banks                  | Dexie `db.banks` | id, name |
|12 | CashAndBank | bank-branches.xlsx          | bankBranches           | Dexie `db.bankBranches` | id, bankName, branchName, ifscCode |
|13 | CashAndBank | bank-accounts.xlsx          | bankAccounts           | Dexie `db.bankAccounts` | id, accountHolderName, bankName, accountNumber, ifscCode, accountType |
|14 | CashAndBank | supplier-bank-accounts.xlsx  | supplierBankAccounts   | Dexie `db.supplierBankAccounts` | id, accountHolderName, bankName, accountNumber, ifscCode, supplierId |
|15 | CashAndBank | loans.xlsx                 | loans                  | Dexie `db.loans` | id, loanId, loanName, loanType, totalAmount, amountPaid, remainingAmount, startDate, depositTo, … |
|16 | CashAndBank | fund-transactions.xlsx     | fundTransactions       | Dexie `db.fundTransactions` | id, transactionId, date, type, source, destination, amount, description |
|17 | Reports     | mandi-reports.xlsx         | mandiReports           | Dexie `db.mandiReports` | id, voucherNo, sellerName, commodity, quantityQtl, ratePerQtl, … |
|18 | HR          | employees.xlsx             | employees              | Dexie `db.employees` | id, name, email, phone, role |
|19 | HR          | payroll.xlsx               | payroll                | Dexie `db.payroll` | id, employeeId, period, amount |
|20 | HR          | attendance.xlsx            | attendance             | Dexie `db.attendance` | id, employeeId, date, status |
|21 | Projects    | projects.xlsx              | projects               | Dexie `db.projects` | id, name, description |
|22 | Settings    | options.xlsx               | options                | Dexie `db.options` | id, type (variety/paymentType/centerName), name |
|23 | Settings    | settings.xlsx              | settings               | Dexie `db.settings` | id, firmName, firmAddress, mandiName, licenseNo, … (firm/RTGS/receipt details) |

---

## 3. Kaise map karna hai (code reference)

- **Table → File**: `local-folder-storage.ts` → `TABLE_TO_FILE`  
  Example: `payments` → `{ folder: 'Payments', file: 'supplier-payments.xlsx' }`

- **File → Table** (file watcher / reload): `RELATIVE_PATH_TO_TABLE` (same file)  
  Example: `Payments/supplier-payments.xlsx` → `payments`

- **Excel ↔ UI column order**: `src/lib/excel-ui-mapping.ts` → `EXCEL_COLUMN_ORDER`. Har collection ke liye column list; Excel read/write aur UI dono isi keys use karte hain.

- **Read**: `loadFromFolderToDexie()` — har file ko `read(folder, file)` se read karke usi table/cache mein daalta hai (table name upar table se).

- **Write**: `syncCollectionToFolder(collectionName)` → Dexie/cache se data leke `saveTableToFolder(path, tableName, data)` → `dataToExcelBase64(data, tableName)` se Excel banata hai.

---

## 4. Data format (Excel ke andar)

- **Row 1** = headers (column names = object keys). Same order `excel-ui-mapping.ts` → `EXCEL_COLUMN_ORDER` se aata hai.
- **Row 2 onwards** = ek row = ek record. Har cell = ek field value.
- **Nested objects/arrays** (e.g. `paidFor`, `noteGroups`, `bankDetails`) = Excel mein **JSON string**; read par `parseMaybeJson()` se parse ho jata hai.

Agar Excel mein extra columns hon (manual add), to read unhe bhi key ke hisaab se leta hai; **write** hamesha `EXCEL_COLUMN_ORDER` + extra keys use karta hai taaki format consistent rahe.

---

## 5. Special cases

| Case | Kaise use karna hai |
|------|----------------------|
| **expenses / incomes** | Dono alag files hain lekin app mein ek hi Dexie table: `db.transactions`. `type` = `'Expense'` ya `'Income'`. Write: `syncCollectionToFolder('transactions')` dono files update karta hai. |
| **ledgerCashAccounts** | Dexie table nahi; **localStorage** `ledgerCashAccountsCache` mein store. Excel se read → cache update; cache se write → ledger-cash-accounts.xlsx. |
| **bankBranches** | Read par IFSC se dedupe hota hai (`dedupeByIfscCode`). |
| **ledgerEntries** | Read par balance recalc hota hai (`recalculateLedgerBalances`). |

---

## 6. Code locations (quick check)

| Kaam | File | Function / constant |
|------|------|---------------------|
| File list (folder → files) | `local-mode-structure.ts` | `LOCAL_DATA_FILES` |
| Table → folder + file | `local-folder-storage.ts` | `TABLE_TO_FILE` |
| Path (flat / hierarchical) | `local-mode-structure.ts` | `getLocalFlatPath`, `getLocalDataPath` |
| Excel ↔ UI column order | `excel-ui-mapping.ts` | `EXCEL_COLUMN_ORDER` |
| Read Excel → data | `local-folder-storage.ts` | `excelBase64ToData`, `deserializeRow` |
| Data → Excel write | `local-folder-storage.ts` | `dataToExcelBase64`, `serializeRecord` |
| Folder → Dexie load | `local-folder-storage.ts` | `loadFromFolderToDexie` |
| Dexie → folder save | `local-folder-storage.ts` | `syncCollectionToFolder`, `saveTableToFolder` |
| File path → table name | `local-folder-storage.ts` | `getTableFromRelativePath`, `RELATIVE_PATH_TO_TABLE` |

Is doc ko follow karke tum **konsi file hai, kaise use map karna hai, aur kaise usme data hai** — teeno cheezein ek jagah check kar sakte ho.
