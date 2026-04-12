-- BIZSUITE COMPOSITE PRIMARY KEY MIGRATION
-- This script drops old tables and recreates them with (id, _company_id, _year) as the Composite Primary Key.
-- This prevents ID collisions across different companies and years.

DROP TABLE IF EXISTS suppliers;
CREATE TABLE suppliers (
    id TEXT,
    data TEXT,
    _company_id TEXT,
    _sub_company_id TEXT,
    _year TEXT,
    updated_at INTEGER,
    _last_user TEXT,
    PRIMARY KEY (id, _company_id, _year)
);

DROP TABLE IF EXISTS customers;
CREATE TABLE customers (
    id TEXT,
    data TEXT,
    _company_id TEXT,
    _sub_company_id TEXT,
    _year TEXT,
    updated_at INTEGER,
    _last_user TEXT,
    PRIMARY KEY (id, _company_id, _year)
);

DROP TABLE IF EXISTS payments;
CREATE TABLE payments (
    id TEXT,
    data TEXT,
    _company_id TEXT,
    _sub_company_id TEXT,
    _year TEXT,
    updated_at INTEGER,
    _last_user TEXT,
    PRIMARY KEY (id, _company_id, _year)
);

DROP TABLE IF EXISTS customerPayments;
CREATE TABLE customerPayments (
    id TEXT,
    data TEXT,
    _company_id TEXT,
    _sub_company_id TEXT,
    _year TEXT,
    updated_at INTEGER,
    _last_user TEXT,
    PRIMARY KEY (id, _company_id, _year)
);

DROP TABLE IF EXISTS ledgerEntries;
CREATE TABLE ledgerEntries (
    id TEXT,
    data TEXT,
    _company_id TEXT,
    _sub_company_id TEXT,
    _year TEXT,
    updated_at INTEGER,
    _last_user TEXT,
    PRIMARY KEY (id, _company_id, _year)
);

DROP TABLE IF EXISTS transactions;
CREATE TABLE transactions (
    id TEXT,
    data TEXT,
    _company_id TEXT,
    _sub_company_id TEXT,
    _year TEXT,
    updated_at INTEGER,
    _last_user TEXT,
    PRIMARY KEY (id, _company_id, _year)
);

DROP TABLE IF EXISTS activity_logs;
CREATE TABLE activity_logs (
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

-- Note: Baaki tables (banks, inventory, etc.) ke liye bhi hum yahi structure follow karenge sync ke waqt.
-- D1 automatically Table create kar lega agar wo missing hai, par structure yehi rahega.
