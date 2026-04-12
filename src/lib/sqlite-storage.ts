/**
 * Phase 2 & 3: Hybrid Storage Manager.
 *
 * - SQLite is the primary store on Desktop (Electron).
 * - Dexie (IndexedDB) is the fallback/standard store for Web browsers.
 * - Both sync to Cloudflare D1.
 */

const STORAGE_KEY = 'bizsuite:sqliteMode';
const FOLDER_KEY = 'bizsuite:sqliteFolderPath';

function getElectron() {
  if (typeof window === 'undefined') return undefined;
  return (window as any).electron;
}

/**
 * Returns true only if running inside Electron with the SQLite bridge.
 */
export function isSqliteMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (window as any).electron !== undefined;
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

    // Derive Season, Sub Company, Company from folder path hierarchy
    // Season = current folder, Sub = parent, Company = grandparent
    const parts = effectiveFolder.split(/[\\/]/).filter((p: string) => !!p.trim());
    const seasonKey = parts[parts.length - 1] || "DefaultSeason";
    const subCompanyId = parts[parts.length - 2] || "DefaultSub";
    // Handle cases where path depth < 3 (e.g. C:\Season)
    const companyId = parts[parts.length - 3] || (parts.length >= 2 ? "DefaultCompany" : "LocalStore");

    // Auto-update ERP configuration to match the folder context
    const { setErpSelectionStorage, setErpMode } = await import('@/lib/tenancy');
    setErpSelectionStorage({ companyId, subCompanyId, seasonKey });
    setErpMode(true);

    // In pure SQLite mode, switching folders just means the IPC bridge points to a new file.
    // We notify the UI to refresh its current views.
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sqlite-change', { detail: 'all' }));
        window.dispatchEvent(new CustomEvent('erp:selection-changed', { detail: { companyId, subCompanyId, seasonKey } }));
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
