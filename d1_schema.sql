CREATE TABLE IF NOT EXISTS suppliers (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS customerPayments (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS governmentFinalizedPayments (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS ledgerAccounts (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS ledgerEntries (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS ledgerCashAccounts (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS incomes (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS banks (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS bankBranches (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS bankAccounts (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS supplierBankAccounts (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS loans (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS fundTransactions (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS mandiReports (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS employees (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS payroll (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS attendance (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS inventoryItems (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS inventoryAddEntries (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS kantaParchi (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS customerDocuments (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS options (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS incomeCategories (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS expenseCategories (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS manufacturingCosting (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS expenseTemplates (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
CREATE TABLE IF NOT EXISTS sync_registry (collection_name TEXT PRIMARY KEY, updated_at INTEGER);

CREATE TABLE IF NOT EXISTS _sync_log (
    id TEXT PRIMARY KEY,
    collection TEXT NOT NULL,
    docId TEXT NOT NULL,
    operation TEXT NOT NULL,
    data TEXT,
    updated_at INTEGER NOT NULL,
    _company_id TEXT,
    _sub_company_id TEXT,
    _year TEXT
);

