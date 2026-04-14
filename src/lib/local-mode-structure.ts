/**
 * Local mode structure: Company, Sub Company, Season, User management
 *
 * Folder structure (hierarchical):
 *   Folder/
 *     _meta/
 *       companies.json    # Company/Sub/Season index
 *       selection.json    # Active selection { companyId, subCompanyId, seasonKey }
 *       users.json        # Optional: local users (or use Firebase auth)
 *     companies/
 *       {companyId}/
 *         {subCompanyId}/
 *           {seasonKey}/
 *             Entry/suppliers.xlsx, customers.xlsx, ...
 *             Payments/supplier-payments.xlsx, ...
 *             CashAndBank/banks.xlsx, ...
 *             Reports/mandi-reports.xlsx
 *
 * Flat mode (backward compatible):
 *   Folder/
 *     Entry/suppliers.xlsx, ...
 *     Payments/supplier-payments.xlsx, ...
 *   → Maps to companyId="main", subCompanyId="main", seasonKey="default"
 */

const LOCAL_SELECTION_KEY = 'bizsuite:localErpSelection';

export type LocalSeason = { key: string; name: string };
export type LocalSubCompany = { id: string; name: string; seasons: LocalSeason[] };
export type LocalCompany = { id: string; name: string; subCompanies: LocalSubCompany[] };

export interface LocalCompaniesIndex {
  companies: Record<string, LocalCompany>;
  updatedAt?: string;
}

export interface LocalSelection {
  companyId: string;
  subCompanyId: string;
  seasonKey: string;
}

export interface LocalUser {
  id: string;
  email?: string;
  displayName?: string;
  role?: 'owner' | 'admin' | 'member';
}

export interface LocalUsersIndex {
  users: Record<string, LocalUser>;
  updatedAt?: string;
}

const DEFAULT_SELECTION: LocalSelection = {
  companyId: 'main',
  subCompanyId: 'main',
  seasonKey: 'default',
};

/** Get active Company/Sub/Season for local mode */
export function getLocalErpSelection(): LocalSelection | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(LOCAL_SELECTION_KEY);
  if (!raw) return DEFAULT_SELECTION;
  try {
    const parsed = JSON.parse(raw) as LocalSelection;
    if (parsed?.companyId && parsed?.subCompanyId && parsed?.seasonKey) return parsed;
  } catch {}
  return DEFAULT_SELECTION;
}

/** Set active Company/Sub/Season for local mode */
export function setLocalErpSelection(sel: LocalSelection | null): void {
  if (typeof window === 'undefined') return;
  if (sel) {
    localStorage.setItem(LOCAL_SELECTION_KEY, JSON.stringify(sel));
  } else {
    localStorage.removeItem(LOCAL_SELECTION_KEY);
  }
  window.dispatchEvent(new CustomEvent('local:selection-changed', { detail: sel }));
}

/** Build data path: flat vs hierarchical */
export function getLocalDataPath(
  baseFolder: string,
  selection: LocalSelection,
  subFolder: string,
  file: string
): string {
  const base = baseFolder.replace(/\/$/, '');
  return `${base}/companies/${selection.companyId}/${selection.subCompanyId}/${selection.seasonKey}/${subFolder}/${file}`;
}

/** Flat path (legacy) */
export function getLocalFlatPath(baseFolder: string, subFolder: string, file: string): string {
  const base = baseFolder.replace(/\/$/, '');
  return `${base}/${subFolder}/${file}`;
}

/** Sanitize name for folder path - replace invalid filesystem chars */
export function sanitizeFolderName(name: string): string {
  return String(name || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'default';
}

/** Build path using names: companies/{companyName}/{subCompanyName}/{seasonName}/ */
export function getLocalDataPathByName(
  baseFolder: string,
  companyName: string,
  subCompanyName: string,
  seasonName: string,
  subFolder: string,
  file: string
): string {
  const base = baseFolder.replace(/\/$/, '');
  const c = sanitizeFolderName(companyName);
  const s = sanitizeFolderName(subCompanyName);
  const se = sanitizeFolderName(seasonName);
  return `${base}/companies/${c}/${s}/${se}/${subFolder}/${file}`;
}

/** Check if folder uses hierarchical structure */
export function isHierarchicalLocalFolder(metaExists: boolean): boolean {
  return metaExists;
}

/** Default companies index for new local folder */
export function createDefaultCompaniesIndex(): LocalCompaniesIndex {
  return {
    companies: {
      main: {
        id: 'main',
        name: 'Main Company',
        subCompanies: [
          {
            id: 'main',
            name: 'Main Branch',
            seasons: [{ key: 'default', name: 'Default Season' }],
          },
        ],
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

/** ErpCompany format for UI (matches erp-company-selector) */
export type ErpCompanyFormat = {
  id: string;
  name: string;
  subCompanies: { id: string; name: string; seasons: { key: string; name: string }[] }[];
};

/** Normalize subCompanies: handle both Record and array formats for backward compat */
function normalizeSubCompanies(raw: unknown): LocalSubCompany[] {
  if (Array.isArray(raw)) return raw as LocalSubCompany[];
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, LocalSubCompany>).map(([id, s]) =>
      typeof s === 'object' && s ? { id: s.id || id, name: s.name || id, seasons: Array.isArray(s.seasons) ? s.seasons : [] } : { id, name: id, seasons: [] }
    );
  }
  return [];
}

/** Convert LocalCompaniesIndex to ErpCompany[] for UI dropdowns */
export function localCompaniesToErpFormat(index: LocalCompaniesIndex | null): ErpCompanyFormat[] {
  if (!index?.companies) return [];
  return Object.entries(index.companies).map(([id, c]) => {
    const rawSubs = (c as { subCompanies?: unknown }).subCompanies;
    const subCompanies = normalizeSubCompanies(rawSubs);
    return {
      id: c.id || id,
      name: c.name || id,
      subCompanies: subCompanies.map((s) => ({
        id: s.id,
        name: s.name,
        seasons: Array.isArray(s.seasons) ? s.seasons : [],
      })),
    };
  });
}

/** Default selection */
export function getDefaultSelection(): LocalSelection {
  return { ...DEFAULT_SELECTION };
}

/** Single source: [table, folder, file]. Order = load order in loadFromFolderToDexie. Export for use in load flow. */
export const LOCAL_EXCEL_MAPPING_ORDER: [string, string, string][] = [
  ['suppliers', 'Entry', 'suppliers.xlsx'],
  ['customers', 'Entry', 'customers.xlsx'],
  ['payments', 'Payments', 'supplier-payments.xlsx'],
  ['customerPayments', 'Payments', 'customer-payments.xlsx'],
  ['ledgerAccounts', 'Payments', 'ledger-accounts.xlsx'],
  ['ledgerEntries', 'Payments', 'ledger-entries.xlsx'],
  ['ledgerCashAccounts', 'Payments', 'ledger-cash-accounts.xlsx'],
  ['expenses', 'Payments', 'expenses.xlsx'],
  ['incomes', 'Payments', 'incomes.xlsx'],
  ['banks', 'CashAndBank', 'banks.xlsx'],
  ['bankBranches', 'CashAndBank', 'bank-branches.xlsx'],
  ['bankAccounts', 'CashAndBank', 'bank-accounts.xlsx'],
  ['supplierBankAccounts', 'CashAndBank', 'supplier-bank-accounts.xlsx'],
  ['mandiReports', 'Reports', 'mandi-reports.xlsx'],
  ['inventoryItems', 'Entry', 'inventory-items.xlsx'],
  // Cash & Bank: Loan Management & Fund (Capital) Transactions
  ['loans', 'CashAndBank', 'loans.xlsx'],
  ['fundTransactions', 'CashAndBank', 'fund-transactions.xlsx'],
  // Settings: Options, Firm/Company details, Categories, Accounts, Manufacturing
  ['options', 'Settings', 'options.xlsx'],
  ['settings', 'Settings', 'settings.xlsx'],
  ['incomeCategories', 'Settings', 'income-categories.xlsx'],
  ['expenseCategories', 'Settings', 'expense-categories.xlsx'],
  ['accounts', 'Settings', 'accounts.xlsx'],
  ['manufacturingCosting', 'Settings', 'manufacturing-costing.xlsx'],
  // Entry: Kanta Parchi, Customer Documents, Inventory Add
  ['kantaParchi', 'Entry', 'kanta-parchi.xlsx'],
  ['customerDocuments', 'Entry', 'customer-documents.xlsx'],
  ['inventoryAddEntries', 'Entry', 'inventory-add-entries.xlsx'],
];

/** Table → folder + file (for sync, save, path resolution). */
export const TABLE_TO_FILE: Record<string, { folder: string; file: string }> = Object.fromEntries(
  LOCAL_EXCEL_MAPPING_ORDER.map(([table, folder, file]) => [table, { folder, file }])
);

/** Subfolders in order of first appearance in mapping; Settings last (structure only, not synced). */
export const LOCAL_DATA_SUBFOLDERS: readonly string[] = (() => {
  const seen = new Set<string>();
  const list = LOCAL_EXCEL_MAPPING_ORDER.map(([, folder]) => folder).filter((f) => {
    if (seen.has(f)) return false;
    seen.add(f);
    return true;
  });
  if (!seen.has('Settings')) list.push('Settings');
  return list;
})();

/** Files per subfolder (derived from same mapping; Settings added for folder structure). */
export const LOCAL_DATA_FILES: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const [, folder, file] of LOCAL_EXCEL_MAPPING_ORDER) {
    if (!out[folder]) out[folder] = [];
    out[folder].push(file);
  }
  if (!out['Settings']) out['Settings'] = ['settings.xlsx'];
  return out;
})();
