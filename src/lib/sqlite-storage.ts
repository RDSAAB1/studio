/**
 * Phase 2: SQLite Only Storage Manager.
 *
 * - SQLite is the primary and only data store.
 * - Dexie (IndexedDB) has been removed.
 */

const STORAGE_KEY = 'bizsuite:sqliteMode';
const FOLDER_KEY = 'bizsuite:sqliteFolderPath';

function getElectron() {
  if (typeof window === 'undefined') return undefined;
  return (window as any).electron;
}

/**
 * In SQLite-only architecture, mode is implicitly always true
 * but we keep this for compatibility with existing UI checks.
 */
export function isSqliteMode(): boolean {
  return true; 
}

export function setSqliteMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  if (enabled) localStorage.setItem(STORAGE_KEY, '1');
  else localStorage.setItem(STORAGE_KEY, '0');
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
  error?: string;
  details?: Record<string, any>;
  loaded?: number;
}> {
  const electron = getElectron();
  if (!electron?.sqliteSetFolder) {
    return { success: false, error: 'SQLite bridge not available (Electron only)' };
  }
  if (!folderPath || typeof folderPath !== 'string') {
    return { success: false, error: 'invalid_folder_path' };
  }

  try {
    const setRes = await electron.sqliteSetFolder(folderPath);
    if (!setRes?.success) {
      return { success: false, error: setRes?.error || 'Could not set SQLite folder' };
    }

    const effectiveFolder = setRes.folder || folderPath;
    setSqliteFolderPath(effectiveFolder);
    setSqliteMode(true);

    // In pure SQLite mode, switching folders just means the IPC bridge points to a new file.
    // We notify the UI to refresh its current views.
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sqlite-change', { detail: 'all' }));
    }

    return {
      success: true,
      folder: effectiveFolder
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Stub for legacy code that might still call this */
export async function loadFromSqliteToDexie() {
    return { success: true, loaded: 0 };
}

export const SQLITE_TABLES = [
  'suppliers', 'customers', 'payments', 'customerPayments', 'governmentFinalizedPayments',
  'ledgerAccounts', 'ledgerEntries', 'ledgerCashAccounts', 'incomes', 'expenses', 'transactions',
  'banks', 'bankBranches', 'bankAccounts', 'supplierBankAccounts', 'loans', 'fundTransactions',
  'mandiReports', 'employees', 'payroll', 'attendance',
  'inventoryItems', 'inventoryAddEntries', 'kantaParchi', 'customerDocuments',
  'projects', 'options', 'settings', 'incomeCategories', 'expenseCategories', 'accounts',
  'manufacturingCosting', 'expenseTemplates',
] as const;
