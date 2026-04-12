-- BIZSUITE MASTER HIERARCHY TABLES
-- These tables manage the high-level onboarding, ownership, and user permissions across the platform.

-- 1. Companies Master (Metadata about the business entity)
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at INTEGER
);

-- 2. Seasons Master (Scoped by company)
CREATE TABLE IF NOT EXISTS seasons (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL, -- e.g., "Season 2024-25"
    created_at INTEGER,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- 3. Memberships (Multi-user permissions log)
CREATE TABLE IF NOT EXISTS memberships (
    user_id TEXT NOT NULL, -- Firebase UID
    company_id TEXT NOT NULL,
    role TEXT DEFAULT 'member', -- 'owner', 'admin', 'member', 'viewer'
    added_at INTEGER,
    PRIMARY KEY (user_id, company_id),
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- 4. Initial indexing for authentication queries
CREATE INDEX IF NOT EXISTS idx_memberships_uid ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_seasons_cid ON seasons(company_id);
