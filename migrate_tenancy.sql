-- BIZSUITE MULTI-TENANCY MIGRATION SCRIPT
-- Run this once to update your Cloudflare D1 schema to support Multi-company and Multi-user isolation.

-- 1. suppliers
ALTER TABLE suppliers ADD COLUMN _company_id TEXT;
ALTER TABLE suppliers ADD COLUMN _sub_company_id TEXT;
ALTER TABLE suppliers ADD COLUMN _year TEXT;
ALTER TABLE suppliers ADD COLUMN _last_user TEXT;
CREATE INDEX IF NOT EXISTS idx_suppliers_tenancy ON suppliers(_company_id, _sub_company_id, _year);

-- 2. customers
ALTER TABLE customers ADD COLUMN _company_id TEXT;
ALTER TABLE customers ADD COLUMN _sub_company_id TEXT;
ALTER TABLE customers ADD COLUMN _year TEXT;
ALTER TABLE customers ADD COLUMN _last_user TEXT;
CREATE INDEX IF NOT EXISTS idx_customers_tenancy ON customers(_company_id, _sub_company_id, _year);

-- 3. payments
ALTER TABLE payments ADD COLUMN _company_id TEXT;
ALTER TABLE payments ADD COLUMN _sub_company_id TEXT;
ALTER TABLE payments ADD COLUMN _year TEXT;
ALTER TABLE payments ADD COLUMN _last_user TEXT;
CREATE INDEX IF NOT EXISTS idx_payments_tenancy ON payments(_company_id, _sub_company_id, _year);

-- 4. customerPayments
ALTER TABLE customerPayments ADD COLUMN _company_id TEXT;
ALTER TABLE customerPayments ADD COLUMN _sub_company_id TEXT;
ALTER TABLE customerPayments ADD COLUMN _year TEXT;
ALTER TABLE customerPayments ADD COLUMN _last_user TEXT;
CREATE INDEX IF NOT EXISTS idx_customerPayments_tenancy ON customerPayments(_company_id, _sub_company_id, _year);

-- 5. governmentFinalizedPayments
ALTER TABLE governmentFinalizedPayments ADD COLUMN _company_id TEXT;
ALTER TABLE governmentFinalizedPayments ADD COLUMN _sub_company_id TEXT;
ALTER TABLE governmentFinalizedPayments ADD COLUMN _year TEXT;
ALTER TABLE governmentFinalizedPayments ADD COLUMN _last_user TEXT;

-- 6. ledgerAccounts
ALTER TABLE ledgerAccounts ADD COLUMN _company_id TEXT;
ALTER TABLE ledgerAccounts ADD COLUMN _sub_company_id TEXT;
ALTER TABLE ledgerAccounts ADD COLUMN _year TEXT;
ALTER TABLE ledgerAccounts ADD COLUMN _last_user TEXT;

-- 7. ledgerEntries
ALTER TABLE ledgerEntries ADD COLUMN _company_id TEXT;
ALTER TABLE ledgerEntries ADD COLUMN _sub_company_id TEXT;
ALTER TABLE ledgerEntries ADD COLUMN _year TEXT;
ALTER TABLE ledgerEntries ADD COLUMN _last_user TEXT;
CREATE INDEX IF NOT EXISTS idx_ledgerEntries_tenancy ON ledgerEntries(_company_id, _sub_company_id, _year);

-- 8. ledgerCashAccounts
ALTER TABLE ledgerCashAccounts ADD COLUMN _company_id TEXT;
ALTER TABLE ledgerCashAccounts ADD COLUMN _sub_company_id TEXT;
ALTER TABLE ledgerCashAccounts ADD COLUMN _year TEXT;
ALTER TABLE ledgerCashAccounts ADD COLUMN _last_user TEXT;

-- 9. incomes
ALTER TABLE incomes ADD COLUMN _company_id TEXT;
ALTER TABLE incomes ADD COLUMN _sub_company_id TEXT;
ALTER TABLE incomes ADD COLUMN _year TEXT;
ALTER TABLE incomes ADD COLUMN _last_user TEXT;

-- 10. expenses
ALTER TABLE expenses ADD COLUMN _company_id TEXT;
ALTER TABLE expenses ADD COLUMN _sub_company_id TEXT;
ALTER TABLE expenses ADD COLUMN _year TEXT;
ALTER TABLE expenses ADD COLUMN _last_user TEXT;

-- 11. transactions
ALTER TABLE transactions ADD COLUMN _company_id TEXT;
ALTER TABLE transactions ADD COLUMN _sub_company_id TEXT;
ALTER TABLE transactions ADD COLUMN _year TEXT;
ALTER TABLE transactions ADD COLUMN _last_user TEXT;
CREATE INDEX IF NOT EXISTS idx_transactions_tenancy ON transactions(_company_id, _sub_company_id, _year);

-- 12. banks
ALTER TABLE banks ADD COLUMN _company_id TEXT;
ALTER TABLE banks ADD COLUMN _sub_company_id TEXT;
ALTER TABLE banks ADD COLUMN _year TEXT;
ALTER TABLE banks ADD COLUMN _last_user TEXT;

-- 13. bankBranches
ALTER TABLE bankBranches ADD COLUMN _company_id TEXT;
ALTER TABLE bankBranches ADD COLUMN _sub_company_id TEXT;
ALTER TABLE bankBranches ADD COLUMN _year TEXT;
ALTER TABLE bankBranches ADD COLUMN _last_user TEXT;

-- 14. bankAccounts
ALTER TABLE bankAccounts ADD COLUMN _company_id TEXT;
ALTER TABLE bankAccounts ADD COLUMN _sub_company_id TEXT;
ALTER TABLE bankAccounts ADD COLUMN _year TEXT;
ALTER TABLE bankAccounts ADD COLUMN _last_user TEXT;

-- 15. supplierBankAccounts
ALTER TABLE supplierBankAccounts ADD COLUMN _company_id TEXT;
ALTER TABLE supplierBankAccounts ADD COLUMN _sub_company_id TEXT;
ALTER TABLE supplierBankAccounts ADD COLUMN _year TEXT;
ALTER TABLE supplierBankAccounts ADD COLUMN _last_user TEXT;

-- 16. loans
ALTER TABLE loans ADD COLUMN _company_id TEXT;
ALTER TABLE loans ADD COLUMN _sub_company_id TEXT;
ALTER TABLE loans ADD COLUMN _year TEXT;
ALTER TABLE loans ADD COLUMN _last_user TEXT;

-- 17. fundTransactions
ALTER TABLE fundTransactions ADD COLUMN _company_id TEXT;
ALTER TABLE fundTransactions ADD COLUMN _sub_company_id TEXT;
ALTER TABLE fundTransactions ADD COLUMN _year TEXT;
ALTER TABLE fundTransactions ADD COLUMN _last_user TEXT;

-- 18. mandiReports
ALTER TABLE mandiReports ADD COLUMN _company_id TEXT;
ALTER TABLE mandiReports ADD COLUMN _sub_company_id TEXT;
ALTER TABLE mandiReports ADD COLUMN _year TEXT;
ALTER TABLE mandiReports ADD COLUMN _last_user TEXT;

-- 19. employees
ALTER TABLE employees ADD COLUMN _company_id TEXT;
ALTER TABLE employees ADD COLUMN _sub_company_id TEXT;
ALTER TABLE employees ADD COLUMN _year TEXT;
ALTER TABLE employees ADD COLUMN _last_user TEXT;

-- 20. payroll
ALTER TABLE payroll ADD COLUMN _company_id TEXT;
ALTER TABLE payroll ADD COLUMN _sub_company_id TEXT;
ALTER TABLE payroll ADD COLUMN _year TEXT;
ALTER TABLE payroll ADD COLUMN _last_user TEXT;

-- 21. attendance
ALTER TABLE attendance ADD COLUMN _company_id TEXT;
ALTER TABLE attendance ADD COLUMN _sub_company_id TEXT;
ALTER TABLE attendance ADD COLUMN _year TEXT;
ALTER TABLE attendance ADD COLUMN _last_user TEXT;

-- 22. inventoryItems
ALTER TABLE inventoryItems ADD COLUMN _company_id TEXT;
ALTER TABLE inventoryItems ADD COLUMN _sub_company_id TEXT;
ALTER TABLE inventoryItems ADD COLUMN _year TEXT;
ALTER TABLE inventoryItems ADD COLUMN _last_user TEXT;

-- 23. inventoryAddEntries
ALTER TABLE inventoryAddEntries ADD COLUMN _company_id TEXT;
ALTER TABLE inventoryAddEntries ADD COLUMN _sub_company_id TEXT;
ALTER TABLE inventoryAddEntries ADD COLUMN _year TEXT;
ALTER TABLE inventoryAddEntries ADD COLUMN _last_user TEXT;

-- 24. kantaParchi
ALTER TABLE kantaParchi ADD COLUMN _company_id TEXT;
ALTER TABLE kantaParchi ADD COLUMN _sub_company_id TEXT;
ALTER TABLE kantaParchi ADD COLUMN _year TEXT;
ALTER TABLE kantaParchi ADD COLUMN _last_user TEXT;

-- 25. customerDocuments
ALTER TABLE customerDocuments ADD COLUMN _company_id TEXT;
ALTER TABLE customerDocuments ADD COLUMN _sub_company_id TEXT;
ALTER TABLE customerDocuments ADD COLUMN _year TEXT;
ALTER TABLE customerDocuments ADD COLUMN _last_user TEXT;

-- 26. projects
ALTER TABLE projects ADD COLUMN _company_id TEXT;
ALTER TABLE projects ADD COLUMN _sub_company_id TEXT;
ALTER TABLE projects ADD COLUMN _year TEXT;
ALTER TABLE projects ADD COLUMN _last_user TEXT;

-- 27. options
ALTER TABLE options ADD COLUMN _company_id TEXT;
ALTER TABLE options ADD COLUMN _sub_company_id TEXT;
ALTER TABLE options ADD COLUMN _year TEXT;
ALTER TABLE options ADD COLUMN _last_user TEXT;

-- 28. settings
ALTER TABLE settings ADD COLUMN _company_id TEXT;
ALTER TABLE settings ADD COLUMN _sub_company_id TEXT;
ALTER TABLE settings ADD COLUMN _year TEXT;

-- 29. incomeCategories
ALTER TABLE incomeCategories ADD COLUMN _company_id TEXT;
ALTER TABLE incomeCategories ADD COLUMN _sub_company_id TEXT;
ALTER TABLE incomeCategories ADD COLUMN _year TEXT;

-- 30. expenseCategories
ALTER TABLE expenseCategories ADD COLUMN _company_id TEXT;
ALTER TABLE expenseCategories ADD COLUMN _sub_company_id TEXT;
ALTER TABLE expenseCategories ADD COLUMN _year TEXT;

-- 31. accounts
ALTER TABLE accounts ADD COLUMN _company_id TEXT;
ALTER TABLE accounts ADD COLUMN _sub_company_id TEXT;
ALTER TABLE accounts ADD COLUMN _year TEXT;

-- 32. manufacturingCosting
ALTER TABLE manufacturingCosting ADD COLUMN _company_id TEXT;
ALTER TABLE manufacturingCosting ADD COLUMN _sub_company_id TEXT;
ALTER TABLE manufacturingCosting ADD COLUMN _year TEXT;

-- 33. expenseTemplates
ALTER TABLE expenseTemplates ADD COLUMN _company_id TEXT;
ALTER TABLE expenseTemplates ADD COLUMN _sub_company_id TEXT;
ALTER TABLE expenseTemplates ADD COLUMN _year TEXT;

-- 34. activity_logs (Who did what - Audit Logs)
CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    _company_id TEXT,
    _sub_company_id TEXT,
    _year TEXT,
    table_name TEXT,
    record_id TEXT,
    action TEXT,
    user_id TEXT,
    timestamp INTEGER
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenancy ON activity_logs(_company_id, _sub_company_id, _year, timestamp);
