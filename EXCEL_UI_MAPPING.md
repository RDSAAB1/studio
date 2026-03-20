# Excel ↔ UI Complete Mapping (DATABASE)

**Purpose:** Is file mein saari Excel files ka UI se mapping hai — kaun si file kis screen/feature se connect karni hai, path, collection name aur columns.

---

## 1. Base path (DATABASE folder)

```
DATABASE\
├── CashAndBank\    → Bank & accounts module
├── Entry\          → Customers, suppliers, inventory
├── HR\             → Employees, attendance, payroll
├── Payments\       → Ledger, payments, expenses, incomes
├── Projects\       → Projects
├── Reports\        → Reports (mandi, etc.)
└── Settings\       → App settings
```

---

## 2. UI Screen → Excel File Mapping (Quick Reference)

| UI Module / Screen | Excel File | Full Path | Collection Name |
|--------------------|------------|-----------|-----------------|
| **Cash & Bank** | | | |
| Banks list / Master | banks.xlsx | `DATABASE\CashAndBank\banks.xlsx` | `banks` |
| Bank branches | bank-branches.xlsx | `DATABASE\CashAndBank\bank-branches.xlsx` | `bankBranches` |
| Bank accounts | bank-accounts.xlsx | `DATABASE\CashAndBank\bank-accounts.xlsx` | `bankAccounts` |
| Supplier bank accounts | supplier-bank-accounts.xlsx | `DATABASE\CashAndBank\supplier-bank-accounts.xlsx` | `supplierBankAccounts` |
| **Entry / Masters** | | | |
| Customers | customers.xlsx | `DATABASE\Entry\customers.xlsx` | `customers` |
| Suppliers | suppliers.xlsx | `DATABASE\Entry\suppliers.xlsx` | `suppliers` |
| Inventory items | inventory-items.xlsx | `DATABASE\Entry\inventory-items.xlsx` | `inventoryItems` |
| **HR** | | | |
| Employees | employees.xlsx | `DATABASE\HR\employees.xlsx` | `employees` |
| Attendance | attendance.xlsx | `DATABASE\HR\attendance.xlsx` | `attendance` |
| Payroll | payroll.xlsx | `DATABASE\HR\payroll.xlsx` | `payroll` |
| **Payments** | | | |
| Ledger accounts | ledger-accounts.xlsx | `DATABASE\Payments\ledger-accounts.xlsx` | `ledgerAccounts` |
| Ledger cash accounts | ledger-cash-accounts.xlsx | `DATABASE\Payments\ledger-cash-accounts.xlsx` | `ledgerCashAccounts` |
| Ledger entries | ledger-entries.xlsx | `DATABASE\Payments\ledger-entries.xlsx` | `ledgerEntries` |
| Customer payments | customer-payments.xlsx | `DATABASE\Payments\customer-payments.xlsx` | `customerPayments` |
| Supplier payments | supplier-payments.xlsx | `DATABASE\Payments\supplier-payments.xlsx` | `supplierPayments` |
| Expenses | expenses.xlsx | `DATABASE\Payments\expenses.xlsx` | `expenses` |
| Incomes | incomes.xlsx | `DATABASE\Payments\incomes.xlsx` | `incomes` |
| **Projects** | | | |
| Projects | projects.xlsx | `DATABASE\Projects\projects.xlsx` | `projects` |
| **Reports** | | | |
| Mandi reports | mandi-reports.xlsx | `DATABASE\Reports\mandi-reports.xlsx` | `mandiReports` |
| **Settings** | | | |
| Settings | settings.xlsx | `DATABASE\Settings\settings.xlsx` | `settings` |

---

## 3. Excel File → UI Mapping (Reverse Lookup)

| Excel File | UI Module | Suggested UI Route / Screen |
|------------|-----------|-----------------------------|
| bank-accounts.xlsx | Cash & Bank | `/cash-bank/accounts` ya Bank Accounts list |
| bank-branches.xlsx | Cash & Bank | `/cash-bank/branches` ya Bank Branches |
| banks.xlsx | Cash & Bank | `/cash-bank/banks` ya Banks master |
| supplier-bank-accounts.xlsx | Cash & Bank | `/cash-bank/supplier-accounts` |
| customers.xlsx | Entry | `/entry/customers` ya Customers master |
| inventory-items.xlsx | Entry | `/entry/inventory` ya Inventory items |
| suppliers.xlsx | Entry | `/entry/suppliers` ya Suppliers master |
| attendance.xlsx | HR | `/hr/attendance` ya Attendance screen |
| employees.xlsx | HR | `/hr/employees` ya Employees master |
| payroll.xlsx | HR | `/hr/payroll` ya Payroll screen |
| customer-payments.xlsx | Payments | `/payments/customer-payments` |
| expenses.xlsx | Payments | `/payments/expenses` |
| incomes.xlsx | Payments | `/payments/incomes` |
| ledger-accounts.xlsx | Payments | `/payments/ledger/accounts` |
| ledger-cash-accounts.xlsx | Payments | `/payments/ledger/cash-accounts` |
| ledger-entries.xlsx | Payments | `/payments/ledger/entries` |
| supplier-payments.xlsx | Payments | `/payments/supplier-payments` |
| projects.xlsx | Projects | `/projects` ya Projects list |
| mandi-reports.xlsx | Reports | `/reports/mandi` ya Mandi reports |
| settings.xlsx | Settings | `/settings` ya App settings |

---

## 4. Column Mapping (Excel ↔ UI Fields)

### 4.1 CashAndBank

| File | Collection | Columns (Excel header → UI field) |
|------|------------|-----------------------------------|
| **banks.xlsx** | banks | `id`, `name`, `createdAt`, `updatedAt`, `__erpMigrated`, `__erpModule`, `__erpSeasonName`, `__erpCompanyId`, `__erpSeason`, `__erpSubCompanyId`, `__companyId`, `__seasonKey`, `__subCompanyId`, `__seasonName` |
| **bank-branches.xlsx** | bankBranches | `id`, `bankName`, `branchName`, `ifscCode`, `__erpModule`, `__erpMigrated`, `updatedAt`, `__erpSeasonName`, `__seasonKey`, `__companyId`, `__erpSubCompanyId`, `__erpSeason`, `__erpCompanyId`, `__seasonName`, `__subCompanyId` |
| **bank-accounts.xlsx** | bankAccounts | `id`, `accountHolderName`, `bankName`, `branchName`, `accountNumber`, `ifscCode`, `accountType`, `__erpMigrated`, `__erpModule`, `updatedAt`, `__erpSeasonName`, `__erpSubCompanyId`, `__companyId`, `__seasonKey`, `__erpCompanyId`, `__erpSeason`, `__seasonName`, `__subCompanyId`, `collection` |
| **supplier-bank-accounts.xlsx** | supplierBankAccounts | *(Excel mein Row 1 verify karein)* |

### 4.2 Entry

| File | Collection | Columns (Excel header → UI field) |
|------|------------|-----------------------------------|
| **customers.xlsx** | customers | *(Excel mein Row 1 verify karein — typically: name, address, contact, etc.)* |
| **inventory-items.xlsx** | inventoryItems | *(Excel mein Row 1 verify karein)* |
| **suppliers.xlsx** | suppliers | *(Excel mein Row 1 verify karein)* |

### 4.3 HR

| File | Collection | Columns (Excel header → UI field) |
|------|------------|-----------------------------------|
| **attendance.xlsx** | attendance | `id`, `employeeId`, `date`, `status`, `createdAt`, `updatedAt`, `__erpModule`, `__erpMigrated`, `__erpSeasonName`, `__erpCompanyId`, `__erpSeason`, `__erpSubCompanyId`, `__companyId`, `__seasonKey`, `__subCompanyId`, `__seasonName` |
| **employees.xlsx** | employees | *(Excel mein Row 1 verify karein)* |
| **payroll.xlsx** | payroll | *(Excel mein Row 1 verify karein)* |

### 4.4 Payments

| File | Collection | Columns (Excel header → UI field) |
|------|------------|-----------------------------------|
| **ledger-accounts.xlsx** | ledgerAccounts | `id`, `name`, `address`, `contact`, `createdAt`, `updatedAt` |
| **ledger-cash-accounts.xlsx** | ledgerCashAccounts | `id`, `name`, `noteGroups`, `createdAt`, `updatedAt` |
| **ledger-entries.xlsx** | ledgerEntries | `id`, `accountId`, `date`, `particulars`, `remarks`, `debit`, `credit`, `balance`, `createdAt`, `updatedAt`, `linkGroupId`, `linkStrategy` |
| **customer-payments.xlsx** | customerPayments | *(Excel mein Row 1 verify karein)* |
| **supplier-payments.xlsx** | supplierPayments | *(Excel mein Row 1 verify karein)* |
| **expenses.xlsx** | expenses | *(Excel mein Row 1 verify karein)* |
| **incomes.xlsx** | incomes | *(Excel mein Row 1 verify karein)* |

### 4.5 Projects

| File | Collection | Columns (Excel header → UI field) |
|------|------------|-----------------------------------|
| **projects.xlsx** | projects | *(Excel mein Row 1 verify karein)* |

### 4.6 Reports

| File | Collection | Columns (Excel header → UI field) |
|------|------------|-----------------------------------|
| **mandi-reports.xlsx** | mandiReports | *(Excel mein Row 1 verify karein)* |

### 4.7 Settings

| File | Collection | Columns (Excel header → UI field) |
|------|------------|-----------------------------------|
| **settings.xlsx** | settings | *(Excel mein Row 1 verify karein)* |

---

## 5. Common system columns (UI / API mapping)

Ye columns kai Excel files mein hote hain — inhe UI/backend mein tenant/company/season ke liye use karein:

| Column | Use in UI / Backend |
|--------|----------------------|
| `__companyId` | Company ID |
| `__subCompanyId` | Sub-company / branch ID |
| `__seasonKey` | Season key (e.g. PADDY 2025) |
| `__seasonName` | Season display name |
| `__erpCompanyId` | ERP company ref |
| `__erpSubCompanyId` | ERP sub-company ref |
| `__erpSeason` | ERP season ref |
| `__erpSeasonName` | ERP season name |
| `__erpModule` | Module (e.g. accounting) |
| `__erpMigrated` | Migration flag |
| `createdAt` | Record create time |
| `updatedAt` | Record update time |

---

## 6. UI integration summary

- **Read:** UI screen load hone par sahi module folder se Excel file path use karein (table 2).
- **Collection name:** Backend/state mein data ko table 2 ke **Collection name** se store karein (e.g. `bankAccounts`, `customers`).
- **Columns:** Form/table ke fields ko section 4 ke columns se map karein; jahan "verify karein" likha hai wahan Excel khol kar header row confirm karein.
- **Path pattern:** `DATABASE\{ModuleFolder}\{fileName}.xlsx` — e.g. `DATABASE\Payments\ledger-entries.xlsx`.

---

*Complete mapping for all 20 Excel files in DATABASE. UI se connect karne ke liye Table 2 (UI → File) aur Table 3 (File → UI) use karein.*
