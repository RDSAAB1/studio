import { db, setDbInUseByFolderLoad } from './database';

type ElectronWithSqlite = {
  sqliteImportTable?: (table: string, rows: unknown[], options?: { clear?: boolean }) => Promise<{ success: boolean; count?: number; error?: string }>;
};

function getElectron(): ElectronWithSqlite | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { electron?: ElectronWithSqlite }).electron ?? null;
}

/**
 * Phase 1: Import current Dexie data into SQLite.
 *
 * Typical flows:
 * - Excel -> Dexie -> SQLite (one-way migration)
 * - Current DB -> selected collections -> new SQLite (when creating a new DB from existing data)
 *
 * If selectedCollections is provided, ONLY those tables are modified.
 * Tables NOT in selectedCollections are LEFT UNTOUCHED in SQLite.
 */
export async function importDexieToSqlite(selectedCollections?: string[]): Promise<{
  success: boolean;
  details: Record<string, { sourceCount: number; sqliteCount: number; error?: string }>;
}> {
  setDbInUseByFolderLoad(true);
  try {
    return await _importDexieToSqlite(selectedCollections);
  } finally {
    setDbInUseByFolderLoad(false);
  }
}

async function _importDexieToSqlite(selectedCollections?: string[]): Promise<{
  success: boolean;
  details: Record<string, { sourceCount: number; sqliteCount: number; error?: string }>;
}> {
  const electron = getElectron() as any;
  if (!electron?.sqliteImportTable) {
    return { success: false, details: { _global: { sourceCount: 0, sqliteCount: 0, error: 'sqlite bridge not available (Electron only)' } } };
  }

  if (!db) {
    return { success: false, details: { _global: { sourceCount: 0, sqliteCount: 0, error: 'Dexie database not initialized' } } };
  }

  const details: Record<string, { sourceCount: number; sqliteCount: number; error?: string }> = {};

  const hasSelection = Array.isArray(selectedCollections) && selectedCollections.length > 0;
  const isSelected = (tableName: string): boolean =>
    !hasSelection || selectedCollections!.includes(tableName);

  // Helper to read from Dexie (if table exists) and push to SQLite
  const importTable = async (tableName: string, dexieTable: any | undefined) => {
    if (!isSelected(tableName)) return; // Skip if not selected
    
    if (!dexieTable) {
      details[tableName] = { sourceCount: 0, sqliteCount: 0, error: 'dexie table missing' };
      return;
    }
    try {
      const rows = await dexieTable.toArray();
      const sourceCount = rows.length ?? 0;
      // We use clear: true here because we are mirroring the full Dexie table to SQLite
      const res = await electron.sqliteImportTable!(tableName, rows as unknown[], { clear: true });
      details[tableName] = {
        sourceCount,
        sqliteCount: res.count ?? sourceCount,
        error: res.success ? undefined : res.error ?? 'import failed',
      };
    } catch (e) {
      details[tableName] = {
        sourceCount: 0,
        sqliteCount: 0,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  };

  // Helper for incomes/expenses: read from transactions table with type filter
  const importFromTransactions = async (tableName: string, type: 'Income' | 'Expense') => {
    if (!isSelected(tableName)) return;
    try {
      const rows = await (db as any).transactions?.where('type').equals(type).toArray() ?? [];
      const sourceCount = rows.length ?? 0;
      const res = await electron.sqliteImportTable!(tableName, rows as unknown[], { clear: true });
      details[tableName] = {
        sourceCount,
        sqliteCount: res.count ?? sourceCount,
        error: res.success ? undefined : res.error ?? 'import failed',
      };
    } catch (e) {
      details[tableName] = {
        sourceCount: 0,
        sqliteCount: 0,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  };

  // Helper for expenseTemplates: stored in options table with type filter
  const importFromOptions = async (tableName: string, optionType: string) => {
    if (!isSelected(tableName)) return;
    try {
      const rows = await (db as any).options?.where('type').equals(optionType).toArray() ?? [];
      const sourceCount = rows.length ?? 0;
      const res = await electron.sqliteImportTable!(tableName, rows as unknown[], { clear: true });
      details[tableName] = {
        sourceCount,
        sqliteCount: res.count ?? sourceCount,
        error: res.success ? undefined : res.error ?? 'import failed',
      };
    } catch (e) {
      details[tableName] = {
        sourceCount: 0,
        sqliteCount: 0,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  };

  // Helper for ledgerCashAccounts: stored in localStorage (no Dexie table)
  const importFromLocalStorage = async (tableName: string, cacheKey: string) => {
    if (!isSelected(tableName)) return;
    try {
      if (typeof window === 'undefined') {
        details[tableName] = { sourceCount: 0, sqliteCount: 0, error: 'localStorage not available' };
        return;
      }
      const raw = localStorage.getItem(cacheKey);
      const rows = raw ? (JSON.parse(raw) as unknown[]) : [];
      const sourceCount = rows.length ?? 0;
      const res = await electron.sqliteImportTable!(tableName, rows, { clear: true });
      details[tableName] = {
        sourceCount,
        sqliteCount: res.count ?? sourceCount,
        error: res.success ? undefined : res.error ?? 'import failed',
      };
    } catch (e) {
      details[tableName] = {
        sourceCount: 0,
        sqliteCount: 0,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  };

  // Core Entry & Payments
  await importTable('suppliers', (db as any).suppliers);
  await importTable('customers', (db as any).customers);
  await importTable('payments', (db as any).payments);
  await importTable('customerPayments', (db as any).customerPayments);
  await importTable('governmentFinalizedPayments', (db as any).governmentFinalizedPayments);

  // Ledger & Cash
  await importTable('ledgerAccounts', (db as any).ledgerAccounts);
  await importTable('ledgerEntries', (db as any).ledgerEntries);
  await importFromLocalStorage('ledgerCashAccounts', 'ledgerCashAccountsCache');
  await importFromTransactions('incomes', 'Income');
  await importFromTransactions('expenses', 'Expense');
  await importTable('transactions', (db as any).transactions);

  // Cash & Bank
  await importTable('banks', (db as any).banks);
  await importTable('bankBranches', (db as any).bankBranches);
  await importTable('bankAccounts', (db as any).bankAccounts);
  await importTable('supplierBankAccounts', (db as any).supplierBankAccounts);
  await importTable('loans', (db as any).loans);
  await importTable('fundTransactions', (db as any).fundTransactions);

  // Reports & HR
  await importTable('mandiReports', (db as any).mandiReports);
  await importTable('employees', (db as any).employees);
  await importTable('payroll', (db as any).payroll);
  await importTable('attendance', (db as any).attendance);

  // Entry & Inventory
  await importTable('inventoryItems', (db as any).inventoryItems);
  await importTable('inventoryAddEntries', (db as any).inventoryAddEntries);
  await importTable('kantaParchi', (db as any).kantaParchi);
  await importTable('customerDocuments', (db as any).customerDocuments);

  // Projects & Settings
  await importTable('projects', (db as any).projects);
  await importTable('options', (db as any).options);
  await importTable('settings', (db as any).settings);
  await importTable('incomeCategories', (db as any).incomeCategories);
  await importTable('expenseCategories', (db as any).expenseCategories);
  await importTable('accounts', (db as any).accounts);
  await importTable('manufacturingCosting', (db as any).manufacturingCosting);
  await importFromOptions('expenseTemplates', 'expenseTemplates');

  const hasError = Object.values(details).some((d) => (d as any).error);
  return { success: !hasError, details };
}
