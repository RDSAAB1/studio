-- FULL BACKFILL SCRIPT (33 TABLES)
-- This script re-indexes all your Cloud data into the Global Notice Board with Tenant-Unique IDs.

-- 1. Clear old conflicted logs
DELETE FROM _sync_log;

-- 2. Master Tables
INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':suppliers:' || id, 'suppliers', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM suppliers;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':customers:' || id, 'customers', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM customers;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':ledgerAccounts:' || id, 'ledgerAccounts', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM ledgerAccounts;

-- 3. Payment Tables
INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':payments:' || id, 'payments', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM payments;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':customerPayments:' || id, 'customerPayments', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM customerPayments;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':governmentFinalizedPayments:' || id, 'governmentFinalizedPayments', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM governmentFinalizedPayments;

-- 4. Ledgers & Accounts
INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':ledgerEntries:' || id, 'ledgerEntries', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM ledgerEntries;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':ledgerCashAccounts:' || id, 'ledgerCashAccounts', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM ledgerCashAccounts;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':banks:' || id, 'banks', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM banks;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':bankBranches:' || id, 'bankBranches', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM bankBranches;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':bankAccounts:' || id, 'bankAccounts', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM bankAccounts;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':supplierBankAccounts:' || id, 'supplierBankAccounts', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM supplierBankAccounts;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':loans:' || id, 'loans', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM loans;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':fundTransactions:' || id, 'fundTransactions', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM fundTransactions;

-- 5. Operations & Mandi
INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':mandiReports:' || id, 'mandiReports', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM mandiReports;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':kantaParchi:' || id, 'kantaParchi', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM kantaParchi;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':inventoryItems:' || id, 'inventoryItems', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM inventoryItems;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':inventoryAddEntries:' || id, 'inventoryAddEntries', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM inventoryAddEntries;

-- 6. People & Payroll
INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':employees:' || id, 'employees', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM employees;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':payroll:' || id, 'payroll', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM payroll;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':attendance:' || id, 'attendance', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM attendance;

-- 7. Config & Utilities
INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':settings:' || id, 'settings', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM settings;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':options:' || id, 'options', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM options;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':incomeCategories:' || id, 'incomeCategories', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM incomeCategories;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':expenseCategories:' || id, 'expenseCategories', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM expenseCategories;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':accounts:' || id, 'accounts', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM accounts;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':projects:' || id, 'projects', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM projects;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':customerDocuments:' || id, 'customerDocuments', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM customerDocuments;

-- 8. Specialized
INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':transactions:' || id, 'transactions', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM transactions;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':incomes:' || id, 'incomes', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM incomes;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':expenses:' || id, 'expenses', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM expenses;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':manufacturingCosting:' || id, 'manufacturingCosting', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM manufacturingCosting;

INSERT OR REPLACE INTO _sync_log (id, collection, docId, operation, data, updated_at, _company_id, _sub_company_id, _year)
SELECT _company_id || ':' || _sub_company_id || ':' || _year || ':expenseTemplates:' || id, 'expenseTemplates', id, 'upsert', data, updated_at, _company_id, _sub_company_id, _year FROM expenseTemplates;
