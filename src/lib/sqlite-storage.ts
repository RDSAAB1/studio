/**
 * Phase 2: SQLite as primary data store (source of truth).
 *
 * - SQLite replaces Excel/Folder for read and write.
 * - Dexie (IndexedDB) remains in-memory cache for the app.
 * - Load: loadFromSqliteToDexie() reads SQLite → fills Dexie.
 * - Write: All Dexie put/bulkPut/delete are mirrored to SQLite via sqlite-sync.
 *
 * Enable via "Use SQLite for data" in ERP Migration page (sets bizsuite:sqliteMode + folder).
 */

const STORAGE_KEY = 'bizsuite:sqliteMode';
const FOLDER_KEY = 'bizsuite:sqliteFolderPath';

function getElectron() {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as {
    electron?: {
      sqliteAll?: (table: string) => Promise<unknown[]>;
      sqliteImportTable?: (table: string, rows: unknown[]) => Promise<{ success: boolean; count?: number; error?: string }>;
      sqlitePut?: (table: string, row: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
      sqliteDelete?: (table: string, id: string) => Promise<{ success: boolean; error?: string }>;
      sqliteGetFolder?: () => Promise<{ folder?: string | null; error?: string }>;
      sqliteSetFolder?: (path: string) => Promise<{ success?: boolean; folder?: string; error?: string }>;
    };
  }).electron;
}

export function isSqliteMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === '1';
}

export function setSqliteMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  if (enabled) localStorage.setItem(STORAGE_KEY, '1');
  else {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(FOLDER_KEY);
  }
}

export function getSqliteFolderPath(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(FOLDER_KEY);
}

export function setSqliteFolderPath(path: string | null): void {
  if (typeof window === 'undefined') return;
  if (path) localStorage.setItem(FOLDER_KEY, path);
  else localStorage.removeItem(FOLDER_KEY);
}

export async function switchToSqliteFolder(folderPath: string): Promise<{
  success: boolean;
  folder?: string;
  loaded?: number;
  details?: Record<string, { sqlite: number; dexie: number; skipped?: number; error?: string }>;
  error?: string;
}> {
  const electron = getElectron();
  if (!electron?.sqliteSetFolder) {
    return { success: false, error: 'SQLite bridge not available (Electron only)' };
  }
  if (!folderPath || typeof folderPath !== 'string') {
    return { success: false, error: 'invalid_folder_path' };
  }

  const { clearAllLocalData, setDbInUseByFolderLoad } = await import('./database');

  try {
    const setRes = await electron.sqliteSetFolder(folderPath);
    if (!setRes?.success) {
      return { success: false, error: setRes?.error || 'Could not set SQLite folder' };
    }

    const effectiveFolder = setRes.folder || folderPath;
    setSqliteFolderPath(effectiveFolder);
    setSqliteMode(true);

    // Strict session reset: clear Dexie first, then repopulate only from the selected SQLite DB.
    // The load guard prevents any Dexie clear/put/delete from mirroring back into SQLite.
    setDbInUseByFolderLoad(true);
    try {
      await clearAllLocalData();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ledgerCashAccountsCache');
        localStorage.removeItem('ledgerCashAccountsLastSynced');
      }
      const loadRes = await loadFromSqliteToDexie();
      return {
        success: loadRes.success,
        folder: effectiveFolder,
        loaded: loadRes.loaded,
        details: loadRes.details,
        error: loadRes.error,
      };
    } finally {
      setDbInUseByFolderLoad(false);
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Tables that SQLite mode supports (same as SQLITE_ALLOWED_TABLES) */
export const SQLITE_TABLES = [
  'suppliers', 'customers', 'payments', 'customerPayments', 'governmentFinalizedPayments',
  'ledgerAccounts', 'ledgerEntries', 'ledgerCashAccounts', 'incomes', 'expenses', 'transactions',
  'banks', 'bankBranches', 'bankAccounts', 'supplierBankAccounts', 'loans', 'fundTransactions',
  'mandiReports', 'employees', 'payroll', 'attendance',
  'inventoryItems', 'inventoryAddEntries', 'kantaParchi', 'customerDocuments',
  'projects', 'options', 'settings', 'incomeCategories', 'expenseCategories', 'accounts',
  'manufacturingCosting', 'expenseTemplates',
] as const;

function extractId(row: Record<string, unknown>, tableName: string, index: number): string {
  const stableFallback = () => {
    try {
      const json = JSON.stringify(row) || '';
      // Simple deterministic hash (djb2) to avoid index-based IDs that change between runs
      let h = 5381;
      for (let i = 0; i < json.length; i++) h = ((h << 5) + h) ^ json.charCodeAt(i);
      const hex = (h >>> 0).toString(16).padStart(8, '0');
      return `${tableName}_${hex}`;
    } catch {
      return `${tableName}_${index}`;
    }
  };
  const id =
    (row.id != null && String(row.id).trim()) ||
    (row.paymentId && String(row.paymentId).trim()) ||
    (row.srNo && String(row.srNo).trim()) ||
    (row.parchiNo && String(row.parchiNo).trim()) ||
    (row.transactionId && String(row.transactionId).trim()) ||
    (row.voucherNo && String(row.voucherNo).trim()) ||
    (row.employeeId && String(row.employeeId).trim()) ||
    (row.accountId && String(row.accountId).trim()) ||
    (row.accountNumber && String(row.accountNumber).trim()) ||
    (row.ifscCode && String(row.ifscCode).trim()) ||
    (row.loanId && String(row.loanId).trim()) ||
    (row.sku && String(row.sku).trim()) ||
    (row.documentSrNo && String(row.documentSrNo).trim()) ||
    stableFallback();
  return String(id).slice(0, 500);
}

/**
 * Load all data from SQLite into Dexie.
 * Call on app init / refresh when in SQLite mode.
 */
export async function loadFromSqliteToDexie(): Promise<{ success: boolean; loaded: number; error?: string; details?: Record<string, { sqlite: number; dexie: number; skipped?: number; error?: string }> }> {
  const electron = getElectron();
  if (!electron?.sqliteAll) {
    return { success: false, loaded: 0, error: 'SQLite bridge not available (Electron only)' };
  }

  const { getDb, setDbInUseByFolderLoad } = await import('./database');
  const db = getDb();
  if (!db) return { success: false, loaded: 0, error: 'Database not initialized' };

  setDbInUseByFolderLoad(true);
  let loaded = 0;
  const details: Record<string, { sqlite: number; dexie: number; skipped?: number; error?: string }> = {};
  try {
    const notify = (collection: string) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection } }));
      }
    };

    const { chunkedBulkPut } = await import('./chunked-operations');

    const safeBulkReplace = async (tableName: string, table: any, data: Record<string, unknown>[]): Promise<number> => {
      if (!table || !Array.isArray(data) || data.length === 0) {
        details[tableName] = { sqlite: data?.length || 0, dexie: 0 };
        return 0;
      }

      const sqliteCount = data.length;
      try {
        if (typeof table.clear === 'function') await table.clear();
      } catch (e) {
        details[tableName] = { sqlite: sqliteCount, dexie: 0, error: `clear_failed: ${e instanceof Error ? e.message : String(e)}` };
        return 0;
      }

      // Try fast chunked bulkPut first
      try {
        await chunkedBulkPut(table, data as any[], 200);
        details[tableName] = { sqlite: sqliteCount, dexie: sqliteCount };
        return sqliteCount;
      } catch (e) {
        // Fallback: per-row put so one bad row doesn't drop the whole table
        let ok = 0;
        let skipped = 0;
        for (const row of data) {
          try {
            await table.put(row);
            ok += 1;
          } catch {
            skipped += 1;
          }
        }
        details[tableName] = {
          sqlite: sqliteCount,
          dexie: ok,
          skipped,
          error: `bulk_failed: ${e instanceof Error ? e.message : String(e)}`,
        };
        return ok;
      }
    };

    // Map SQLite table names to Dexie tables; handle special cases
    const loadTable = async (sqliteTable: string, dexieTable: string | null, transform?: (rows: unknown[]) => unknown[]) => {
      if (!dexieTable) return;
      const rows = (await electron.sqliteAll!(sqliteTable)) as Record<string, unknown>[];
      let data = rows;
      if (transform) data = transform(rows) as Record<string, unknown>[];
      const table = (db as Record<string, unknown>)[dexieTable];

      if (!table || typeof table !== 'object' || typeof (table as { bulkPut?: unknown }).bulkPut !== 'function') {
        details[sqliteTable] = { sqlite: data?.length || 0, dexie: 0, error: 'dexie_table_missing' };
        return;
      }

      // IMPORTANT: Agar SQLite table empty hai (0 rows), to Dexie table ko bhi clear karna hoga,
      // warna purane folder / purane DB ka data UI me dikhte reh jayega.
      if (!rows?.length) {
        try {
          if (typeof (table as any).clear === 'function') {
            await (table as any).clear();
          }
          details[sqliteTable] = { sqlite: 0, dexie: 0 };
        } catch (e) {
          details[sqliteTable] = {
            sqlite: 0,
            dexie: 0,
            error: `clear_failed: ${e instanceof Error ? e.message : String(e)}`,
          };
        }
        return;
      }

      // If Dexie primary key is auto-increment, remove incoming `id` so IndexedDB can generate numeric key.
      const schema = (table as any).schema;
      const autoInc = Boolean(schema?.primKey?.autoIncrement);
      let finalData = data;
      if (autoInc) {
        finalData = data.map((r) => {
          const x = { ...(r as Record<string, unknown>) };
          delete (x as any).id;
          return x;
        });
      }

      // If Dexie expects an explicit id (non-auto), ensure id is present.
      const expectsId = Boolean(schema?.primKey && !schema?.primKey?.autoIncrement);
      if (expectsId) {
        let generated = 0;
        finalData = finalData.map((r, index) => {
          const row = { ...(r as Record<string, unknown>) };
          const hasId = row.id != null && String(row.id).trim() !== '';
          if (!hasId) {
            // Reuse same id generation logic as SQLite writer
            row.id = extractId(row, sqliteTable, index);
            generated += 1;
          }
          return row;
        });
        if (generated > 0) {
          details[sqliteTable] = {
            ...(details[sqliteTable] || { sqlite: data.length, dexie: 0 }),
            skipped: 0,
          };
        }
      }

      const inserted = await safeBulkReplace(sqliteTable, table as any, finalData as any[]);
      loaded += inserted;
    };

    await loadTable('suppliers', 'suppliers');
    notify('suppliers');
    await loadTable('customers', 'customers');
    notify('customers');
    // payments tables: Dexie uses ++id (number). Strip incoming string `id` from SQLite rows
    // so Dexie can auto-generate numeric primary key, while we keep `paymentId` for lookup.
    await loadTable('payments', 'payments', (rows) => rows.map((r) => {
      const x = { ...(r as Record<string, unknown>) };
      delete (x as any).id;
      return x;
    }));
    notify('payments');
    await loadTable('customerPayments', 'customerPayments', (rows) => rows.map((r) => {
      const x = { ...(r as Record<string, unknown>) };
      delete (x as any).id;
      return x;
    }));
    notify('customerPayments');
    await loadTable('governmentFinalizedPayments', 'governmentFinalizedPayments', (rows) => rows.map((r) => {
      const x = { ...(r as Record<string, unknown>) };
      delete (x as any).id;
      return x;
    }));
    await loadTable('ledgerAccounts', 'ledgerAccounts');
    notify('ledgerAccounts');
    await loadTable('ledgerEntries', 'ledgerEntries');
    notify('ledgerEntries');
    // ledgerCashAccounts has no Dexie table — handled below via localStorage
    await loadTable('banks', 'banks');
    await loadTable('bankBranches', 'bankBranches');
    await loadTable('bankAccounts', 'bankAccounts');
    await loadTable('supplierBankAccounts', 'supplierBankAccounts');
    await loadTable('loans', 'loans');
    await loadTable('fundTransactions', 'fundTransactions');
    await loadTable('mandiReports', 'mandiReports');
    await loadTable('employees', 'employees');
    await loadTable('payroll', 'payroll');
    await loadTable('attendance', 'attendance');
    await loadTable('inventoryItems', 'inventoryItems');
    await loadTable('inventoryAddEntries', 'inventoryAddEntries');
    await loadTable('kantaParchi', 'kantaParchi');
    await loadTable('customerDocuments', 'customerDocuments');
    await loadTable('projects', 'projects');
    await loadTable('options', 'options');
    await loadTable('settings', 'settings');
    await loadTable('incomeCategories', 'incomeCategories');
    await loadTable('expenseCategories', 'expenseCategories');
    await loadTable('accounts', 'accounts');
    await loadTable('manufacturingCosting', 'manufacturingCosting');
    await loadTable('expenseTemplates', 'options', (rows) =>
      rows.map((r) => ({ ...r, type: 'expenseTemplates' }))
    );

    // transactions (incomes/expenses are subsets; merge all for Dexie)
    const incomes = (await electron.sqliteAll!('incomes')) as Record<string, unknown>[];
    const expenses = (await electron.sqliteAll!('expenses')) as Record<string, unknown>[];
    const transactions = (await electron.sqliteAll!('transactions')) as Record<string, unknown>[];
    const byId = new Map<string, Record<string, unknown>>();
    for (const r of transactions || []) {
      const id = extractId(r, 'transactions', 0);
      if (id) byId.set(id, { ...r });
    }
    for (const r of incomes || []) {
      const id = extractId(r, 'incomes', 0);
      if (id) byId.set(id, { ...r, type: 'Income', transactionType: 'Income' });
    }
    for (const r of expenses || []) {
      const id = extractId(r, 'expenses', 0);
      if (id) byId.set(id, { ...r, type: 'Expense', transactionType: 'Expense' });
    }
    const allTransactions = Array.from(byId.values());
    const txTable = db.transactions;
    if (txTable && typeof txTable.bulkPut === 'function') {
      try {
        if (typeof txTable.clear === 'function') await txTable.clear();
        if (allTransactions.length) {
          await txTable.bulkPut(allTransactions);
          loaded += allTransactions.length;
          details['transactions'] = { sqlite: allTransactions.length, dexie: allTransactions.length };
        } else {
          details['transactions'] = { sqlite: 0, dexie: 0 };
        }
      } catch (e) {
        details['transactions'] = {
          sqlite: allTransactions.length,
          dexie: 0,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }
    notify('incomes');
    notify('expenses');
    notify('transactions');

    // ledgerCashAccounts → localStorage
    const ledgerCash = (await electron.sqliteAll!('ledgerCashAccounts')) as Record<string, unknown>[];
    if (typeof window !== 'undefined') {
      if (ledgerCash?.length) {
        localStorage.setItem('ledgerCashAccountsCache', JSON.stringify(ledgerCash));
        localStorage.setItem('ledgerCashAccountsLastSynced', String(Date.now()));
        loaded += ledgerCash.length;
      } else {
        // Agar nayi SQLite DB me ledgerCashAccounts empty hai to purani cache bhi clear kar do
        localStorage.removeItem('ledgerCashAccountsCache');
        localStorage.removeItem('ledgerCashAccountsLastSynced');
      }
      notify('ledgerCashAccounts');
    }

    return { success: true, loaded, ...(Object.keys(details).length ? { details } : {}) } as any;
  } catch (e) {
    return {
      success: false,
      loaded,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    setDbInUseByFolderLoad(false);
  }
}

/**
 * Persist a single row to SQLite. Call after Dexie put.
 */
export async function sqlitePut(tableName: string, row: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  const electron = getElectron();
  if (!electron?.sqlitePut) return { success: false, error: 'SQLite bridge not available' };
  // Ensure stable SQLite primary key (id) for payment tables
  if ((tableName === 'payments' || tableName === 'customerPayments' || tableName === 'governmentFinalizedPayments') && row.paymentId) {
    row = { ...row, id: String(row.paymentId) };
  }
  return electron.sqlitePut(tableName, row);
}

/**
 * Delete a row from SQLite. Call after Dexie delete.
 */
export async function sqliteDelete(tableName: string, id: string): Promise<{ success: boolean; error?: string }> {
  const electron = getElectron();
  if (!electron?.sqliteDelete) return { success: false, error: 'SQLite bridge not available' };
  return electron.sqliteDelete(tableName, id);
}

/**
 * Persist full table to SQLite. Call after Dexie bulkPut or when syncing collection.
 */
export async function sqliteBulkPut(tableName: string, rows: unknown[]): Promise<{ success: boolean; count?: number; error?: string }> {
  const electron = getElectron();
  if (!electron?.sqliteImportTable) return { success: false, error: 'SQLite bridge not available' };
  if (tableName === 'payments' || tableName === 'customerPayments' || tableName === 'governmentFinalizedPayments') {
    const normalized = (rows || []).map((r) => {
      const x = { ...(r as Record<string, unknown>) };
      if (x.paymentId != null) x.id = String(x.paymentId);
      return x;
    });
    return electron.sqliteImportTable(tableName, normalized);
  }
  return electron.sqliteImportTable(tableName, rows);
}
