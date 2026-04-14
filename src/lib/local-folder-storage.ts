/**
 * Local folder as data source — FILES are the database (source of truth).
 * - We never clear or delete data FROM the Excel files. We only read from them.
 * - Dexie (IndexedDB) is just an in-app cache. On read we replace that cache with file
 *   content so the app shows exactly what’s in the files. “Clear” is only on the cache,
 *   not on the files.
 * - Read: loadFromFolderToDexie() reads files → fills Dexie cache (replace cache = file content).
 * - Write (file-first): save = write to file (merge one record) then update Dexie. No Dexie→file overwrite.
 * - Full sync: loadFromFolderToDexie (on refresh). syncCollectionToFolder is no-op in local folder mode.
 *
 * Excel format (same for read and write):
 * - Row 1 = headers (column names = object keys).
 * - Nested objects/arrays are stored as JSON strings; read parses them back.
 * - EXCEL_COLUMN_ORDER in excel-ui-mapping.ts defines per-collection column order (Excel ↔ UI).
 *
 * Structure: Supports flat (legacy) and hierarchical (Company/Sub/Season)
 * - Flat: Folder/Entry/suppliers.xlsx
 * - Hierarchical: Folder/companies/{companyId}/{subCompanyId}/{seasonKey}/Entry/suppliers.xlsx
 */
import * as XLSX from 'xlsx';
import {
  getLocalErpSelection,
  setLocalErpSelection,
  getLocalDataPath,
  getLocalFlatPath,
  getLocalDataPathByName,
  sanitizeFolderName,
  type LocalCompaniesIndex,
  type LocalCompany,
  type LocalSelection,
  createDefaultCompaniesIndex,
  LOCAL_DATA_SUBFOLDERS,
  LOCAL_DATA_FILES,
  LOCAL_EXCEL_MAPPING_ORDER,
  TABLE_TO_FILE,
} from './local-mode-structure';
import type { Customer, Payment, CustomerPayment, LedgerAccount, LedgerEntry, LedgerCashAccount, MandiReport } from './definitions';

/** Lazy db access to avoid circular dependency (database <-> firestore <-> local-folder-storage) */
async function getDb() {
  const { db } = await import('./database');
  return db;
}
import { setDbInUseByFolderLoad } from './database';
import { chunkedBulkPut } from './chunked-operations';
import { recalculateLedgerBalances } from './folder-structure-export';
import { EXCEL_COLUMN_ORDER } from './excel-ui-mapping';

const STORAGE_KEY = 'bizsuite:localFolderPath';
const HIERARCHICAL_KEY = 'bizsuite:localUseHierarchical';

/** When true, we are loading from files → do NOT write to files. Writes only on explicit write (save payment, sync, etc.). */
let isLoadingFromFolder = false;

export function getLocalFolderPath(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setLocalFolderPath(path: string | null): void {
  if (typeof window === 'undefined') return;
  if (path) localStorage.setItem(STORAGE_KEY, path);
  else {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(HIERARCHICAL_KEY);
  }
}

export function isLocalFolderMode(): boolean {
  return !!getLocalFolderPath();
}

function getElectron() {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { electron?: {
    readFileFromFolder: (p: string) => Promise<string | null>;
    writeFileToFolder: (p: string, b: string) => Promise<{ success: boolean; error?: string }>;
    fileExists: (p: string) => Promise<boolean>;
    watchFolder?: (p: string) => Promise<{ ok: boolean }>;
    stopWatchFolder?: () => Promise<{ ok: boolean }>;
    closeExcelFilesInFolder?: (p: string) => Promise<{ ok: boolean; closed?: number }>;
  } }).electron;
}

// --- Serialize/Deserialize (same as folder-structure-export) ---
const serializeRecord = (r: Record<string, unknown>) => {
  const result: Record<string, unknown> = {};
  Object.entries(r).forEach(([key, value]) => {
    if (value === undefined) {
      result[key] = '';
      return;
    }
    if (Array.isArray(value) || (value !== null && typeof value === 'object' && !(value instanceof Date))) {
      try { result[key] = JSON.stringify(value); } catch { result[key] = String(value); }
    } else result[key] = value;
  });
  return result;
};

const parseMaybeJson = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
    try { return JSON.parse(t); } catch { return value; }
  }
  return value;
};

const deserializeRow = (row: Record<string, unknown>) => {
  const result: Record<string, unknown> = {};
  Object.entries(row).forEach(([key, value]) => { result[key] = parseMaybeJson(value); });
  return result;
};

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(buf as ArrayBuffer).toString('base64');
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function dedupeByIfscCode<T extends { ifscCode?: string; id?: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = (item.ifscCode || '').trim().toUpperCase() || (item.id || '');
    if (key) map.set(key, item);
  }
  return Array.from(map.values());
}

/** Normalize payment (or customerPayment) for Excel: plain objects, updatedAt as ISO string, paidFor fully serializable. Always reads paidFor from input so finalize-time detail is never lost. */
function normalizePaymentForExcel(p: Record<string, unknown>): Record<string, unknown> {
  const out = { ...p } as Record<string, unknown>;
  // Read paidFor from source explicitly (spread may miss non-enumerable); ensure we never drop finalize-time detail
  let pfRaw: unknown = (p as any).paidFor ?? out.paidFor;
  if (typeof pfRaw === 'string' && String(pfRaw).trim().startsWith('[')) {
    try {
      pfRaw = JSON.parse(pfRaw as string);
      out.paidFor = pfRaw;
    } catch {
      out.paidFor = [];
    }
  }
  const tsToIso = (u: unknown): string => {
    if (u == null) return '';
    if (typeof u === 'string') return u;
    if (u && typeof u === 'object' && 'seconds' in u && typeof (u as any).seconds === 'number') {
      const s = (u as { seconds: number; nanoseconds?: number }).seconds;
      const ns = (u as { seconds: number; nanoseconds?: number }).nanoseconds ?? 0;
      return new Date(s * 1000 + ns / 1e6).toISOString();
    }
    if (u instanceof Date) return u.toISOString();
    return String(u);
  };
  out.updatedAt = tsToIso(p.updatedAt);
  const pfArr = Array.isArray(pfRaw) ? pfRaw : Array.isArray(out.paidFor) ? out.paidFor : Array.isArray((p as any).paidFor) ? (p as any).paidFor : [];
  out.paidFor = Array.isArray(pfArr) && pfArr.length > 0
    ? (pfArr as any[]).map((item: any) => {
        const row = { ...item } as Record<string, unknown>;
        row.updatedAt = tsToIso(item?.updatedAt);
        return row;
      })
    : pfArr;
  return out;
}

// EXCEL_COLUMN_ORDER from excel-ui-mapping.ts (Excel ↔ UI single source)
function dataToExcelBase64(data: Record<string, unknown>[], collectionName?: string): string {
  if (collectionName === 'payments' || collectionName === 'customerPayments') {
    return paymentsToExcelWorkbookBase64(data as Record<string, unknown>[], collectionName);
  }
  const order = collectionName && EXCEL_COLUMN_ORDER[collectionName];
  const rows = order
    ? data.map((r) => {
        const extraKeys = Object.keys(r).filter((k) => !order.includes(k));
        const keysInOrder = [...order, ...extraKeys];
        const row: Record<string, unknown> = {};
        keysInOrder.forEach((key) => { row[key] = r[key] ?? ''; });
        return serializeRecord(row);
      })
    : data.map(serializeRecord);
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : []);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Data');
  return toBase64(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

/** New Excel format for payments: Sheet "Payments" (main) + Sheet "PaidFor" (one row per receipt link). Handles paidFor detail reliably. */
function paymentsToExcelWorkbookBase64(
  payments: Record<string, unknown>[],
  collectionName: 'payments' | 'customerPayments'
): string {
  const order = EXCEL_COLUMN_ORDER[collectionName] || [];
  const paidForOrder = EXCEL_COLUMN_ORDER.paidFor || [];
  const normalized = payments.map((p) => normalizePaymentForExcel(p));
  const paymentRows = normalized.map((p) => {
    const { paidFor: _pf, ...rest } = p as Record<string, unknown> & { paidFor?: unknown };
    const row: Record<string, unknown> = {};
    [...order, ...Object.keys(rest).filter((k) => !order.includes(k))].forEach((key) => {
      if (key !== 'paidFor') row[key] = rest[key] ?? '';
    });
    return serializeRecord(row);
  });
  const paidForRows: Record<string, unknown>[] = [];
  for (const p of normalized) {
    const paymentId = String((p as any).paymentId || (p as any).id || '').trim();
    let items: any[] = [];
    const rawPf = (p as any).paidFor;
    if (Array.isArray(rawPf) && rawPf.length) items = rawPf;
    else if (typeof rawPf === 'string' && rawPf.trim().startsWith('[')) {
      try { items = JSON.parse(rawPf); } catch { items = []; }
    }
    for (const item of items) {
      const row: Record<string, unknown> = { paymentId, ...item };
      const out: Record<string, unknown> = {};
      [...paidForOrder, ...Object.keys(row).filter((k) => !paidForOrder.includes(k))].forEach((key) => {
        out[key] = row[key] ?? '';
      });
      const u = (item as any)?.updatedAt;
      if (u && typeof u === 'object' && 'seconds' in u) {
        const s = (u as { seconds: number; nanoseconds?: number }).seconds;
        const ns = (u as { seconds: number; nanoseconds?: number }).nanoseconds ?? 0;
        out.updatedAt = new Date(s * 1000 + ns / 1e6).toISOString();
      } else if (typeof u === 'string') out.updatedAt = u;
      paidForRows.push(serializeRecord(out));
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paymentRows.length ? paymentRows : [{}]), 'Payments');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paidForRows.length ? paidForRows : [{}]), 'PaidFor');
  return toBase64(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

/** Read payments Excel: 2-sheet (Payments + PaidFor) or legacy single-sheet with paidFor JSON column. */
function excelWorkbookToPayments(base64: string): Record<string, unknown>[] {
  if (!base64) return [];
  const wb = XLSX.read(fromBase64(base64), { type: 'array' });
  const paymentsSheet = wb.Sheets['Payments'] || wb.Sheets[wb.SheetNames[0]];
  if (!paymentsSheet) return [];
  const payments = XLSX.utils.sheet_to_json<Record<string, unknown>>(paymentsSheet, { defval: '' }).map(deserializeRow);
  const paidForSheet = wb.Sheets['PaidFor'];
  if (paidForSheet) {
    const paidForRows = XLSX.utils.sheet_to_json<Record<string, unknown> & { paymentId?: string }>(paidForSheet, { defval: '' }).map(deserializeRow);
    const byPaymentId = new Map<string, Record<string, unknown>[]>();
    for (const row of paidForRows) {
      const pid = String(row?.paymentId || '').trim();
      if (!pid) continue;
      if (!byPaymentId.has(pid)) byPaymentId.set(pid, []);
      const { paymentId: _p, ...detail } = row;
      byPaymentId.get(pid)!.push(detail);
    }
    for (const p of payments) {
      const pid = String((p as any).paymentId || (p as any).id || '').trim();
      (p as any).paidFor = byPaymentId.get(pid) || [];
    }
  } else {
    for (const p of payments) {
      const pf = (p as any).paidFor;
      if (typeof pf === 'string' && (pf.startsWith('[') || pf.startsWith('{'))) {
        try { (p as any).paidFor = JSON.parse(pf); } catch { (p as any).paidFor = []; }
      } else if (!Array.isArray(pf)) (p as any).paidFor = [];
    }
  }
  return payments;
}

function excelBase64ToData(base64: string, collectionName?: string): Record<string, unknown>[] {
  if (collectionName === 'payments' || collectionName === 'customerPayments') {
    return excelWorkbookToPayments(base64);
  }
  if (!base64) return [];
  const wb = XLSX.read(fromBase64(base64), { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' }).map(deserializeRow);
}

function excelBase64ToDataLegacy(base64: string): Record<string, unknown>[] {
  if (!base64) return [];
  const wb = XLSX.read(fromBase64(base64), { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' }).map(deserializeRow);
}

// --- Meta: companies, selection ---
export async function readLocalMetaJson<T>(folderPath: string, file: string): Promise<T | null> {
  const electron = getElectron();
  if (!electron?.readFileFromFolder) return null;
  const p = `${folderPath.replace(/\/$/, '')}/_meta/${file}`;
  const exists = await electron.fileExists(p);
  if (!exists) return null;
  const b64 = await electron.readFileFromFolder(p);
  if (!b64) return null;
  try {
    const json = atob(b64);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export async function writeLocalMetaJson(folderPath: string, file: string, data: unknown): Promise<boolean> {
  const electron = getElectron();
  if (!electron?.writeFileToFolder) return false;
  const p = `${folderPath.replace(/\/$/, '')}/_meta/${file}`;
  const json = JSON.stringify(data, null, 2);
  const b64 = typeof Buffer !== 'undefined'
    ? Buffer.from(json, 'utf8').toString('base64')
    : btoa(unescape(encodeURIComponent(json)));
  const res = await electron.writeFileToFolder(p, b64);
  return res?.success ?? false;
}

export async function ensureLocalMetaStructure(folderPath: string): Promise<{ created: boolean }> {
  const companies = await readLocalMetaJson<LocalCompaniesIndex>(folderPath, 'companies.json');
  if (companies) return { created: false };
  const defaultIndex = createDefaultCompaniesIndex();
  const ok = await writeLocalMetaJson(folderPath, 'companies.json', defaultIndex);
  if (ok) {
    const sel = getLocalErpSelection() ?? { companyId: 'main', subCompanyId: 'main', seasonKey: 'default' };
    await writeLocalMetaJson(folderPath, 'selection.json', sel);
  }
  return { created: ok };
}

export async function getLocalCompaniesFromFolder(folderPath: string): Promise<LocalCompaniesIndex | null> {
  return readLocalMetaJson<LocalCompaniesIndex>(folderPath, 'companies.json');
}

export async function saveLocalSelectionToFolder(folderPath: string, selection: LocalSelection): Promise<boolean> {
  setLocalErpSelection(selection);
  return writeLocalMetaJson(folderPath, 'selection.json', selection);
}

/** Create new company structure: companies/{companyName}/{subCompanyName}/{seasonName}/ + _meta */
export async function createCompanyStructure(
  folderPath: string,
  companyName: string,
  subCompanyName: string,
  seasonName: string
): Promise<{ success: boolean; error?: string }> {
  const electron = getElectron();
  if (!electron?.writeFileToFolder) {
    return { success: false, error: 'Electron required. Run: npm run electron:dev' };
  }
  const base = folderPath.replace(/\/$/, '');
  const cId = sanitizeFolderName(companyName) || 'company';
  const sId = sanitizeFolderName(subCompanyName) || 'main';
  const seKey = sanitizeFolderName(seasonName) || 'default';

  try {
    let index = await readLocalMetaJson<LocalCompaniesIndex>(folderPath, 'companies.json');
    if (!index) {
      index = { companies: {}, updatedAt: new Date().toISOString() };
    }
    const existing = index.companies[cId];
    const subCompanies = existing?.subCompanies ? normalizeSubCompaniesArray(existing.subCompanies) : [];
    const subExists = subCompanies.some((s) => (s.id || s.name) === sId);
    if (!subExists) {
      subCompanies.push({
        id: sId,
        name: subCompanyName.trim() || sId,
        seasons: [{ key: seKey, name: seasonName.trim() || seKey }],
      });
    } else {
      const sub = subCompanies.find((s) => (s.id || s.name) === sId);
      if (sub) {
        const seasonExists = (sub.seasons || []).some((se) => (se.key || se.name) === seKey);
        if (!seasonExists) {
          sub.seasons = sub.seasons || [];
          sub.seasons.push({ key: seKey, name: seasonName.trim() || seKey });
        }
      }
    }
    const companyEntry = {
      id: cId,
      name: companyName.trim() || cId,
      subCompanies,
    };
    index.companies[cId] = companyEntry as LocalCompany;
    index.updatedAt = new Date().toISOString();
    await writeLocalMetaJson(folderPath, 'companies.json', index);

    const selection: LocalSelection = { companyId: cId, subCompanyId: sId, seasonKey: seKey };
    await writeLocalMetaJson(folderPath, 'selection.json', selection);
    setLocalErpSelection(selection);

    const emptyB64 = dataToExcelBase64([]);
    for (const subFolder of LOCAL_DATA_SUBFOLDERS) {
      const files = LOCAL_DATA_FILES[subFolder] || [];
      for (const file of files) {
        const p = getLocalDataPathByName(base, companyName, subCompanyName, seasonName, subFolder, file);
        await electron.writeFileToFolder(p, emptyB64);
      }
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function normalizeSubCompaniesArray(raw: unknown): { id: string; name: string; seasons: { key: string; name: string }[] }[] {
  if (Array.isArray(raw)) return raw as { id: string; name: string; seasons: { key: string; name: string }[] }[];
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, { id?: string; name?: string; seasons?: { key: string; name: string }[] }>).map(([id, s]) => ({
      id: s?.id || id,
      name: s?.name || id,
      seasons: Array.isArray(s?.seasons) ? s.seasons : [],
    }));
  }
  return [];
}

// --- Load from folder into Dexie ---
export async function loadFromFolderToDexie(folderPath: string): Promise<{ success: boolean; loaded: number; error?: string }> {
  const electron = getElectron();
  if (!electron?.readFileFromFolder) {
    return { success: false, loaded: 0, error: 'Electron folder API not available.' };
  }
  const db = await getDb();
  if (!db) return { success: false, loaded: 0, error: 'Database not initialized.' };

  isLoadingFromFolder = true;
  setDbInUseByFolderLoad(true);
  const selectionFromFolder = await readLocalMetaJson<LocalSelection>(folderPath, 'selection.json');
  const useHierarchical = !!selectionFromFolder;
  const selection = selectionFromFolder ?? getLocalErpSelection() ?? { companyId: 'main', subCompanyId: 'main', seasonKey: 'default' };
  if (selectionFromFolder) setLocalErpSelection(selectionFromFolder);
  // Do NOT dispatch erp:selection-changed here — it closes the DB and causes DatabaseClosedError before we finish writing.
  // We'll dispatch after all DB writes are done (see end of this function).
  if (typeof window !== 'undefined') {
    if (useHierarchical) localStorage.setItem(HIERARCHICAL_KEY, '1');
    else localStorage.removeItem(HIERARCHICAL_KEY);
  }

  const read = async (tableName: string, folder: string, file: string): Promise<Record<string, unknown>[]> => {
    const p = useHierarchical
      ? getLocalDataPath(folderPath, selection, folder, file)
      : getLocalFlatPath(folderPath, folder, file);
    const exists = await electron!.fileExists(p);
    if (!exists) return [];
    const b64 = await electron!.readFileFromFolder(p);
    return b64 ? excelBase64ToData(b64, tableName as 'payments' | 'customerPayments' | undefined) : [];
  };

  let loaded = 0;
  try {
    const reads: Record<string, unknown>[][] = [];
    for (const [table, folder, file] of LOCAL_EXCEL_MAPPING_ORDER) {
      reads.push(await read(table, folder, file));
    }
    const [
      suppliers, customers, supplierPayments, customerPayments,
      ledgerAccounts, ledgerEntries, ledgerCashAccounts, expenses, incomes,
      banks, bankBranches, bankAccounts, supplierBankAccounts,
      mandiReports, inventoryItems,
      loans, fundTransactions, options, settings,
      incomeCategories, expenseCategories, accounts, manufacturingCosting,
      kantaParchi, customerDocuments, inventoryAddEntries,
    ] = reads;

    const notify = (collection: string) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection } }));
      }
    };

    // Replace app cache (Dexie) with file content. We never clear or change the Excel files.
    // Only when file returned data: clear Dexie table and put file rows. If file empty/missing, leave cache as is.
    const putOrSkip = async <T extends { id: string }>(table: { clear: () => Promise<void> }, data: T[]): Promise<number> => {
      if (!data?.length) return 0;
      await table.clear();
      await chunkedBulkPut(table as any, data, 100);
      return data.length;
    };
    if (db.suppliers) { loaded += await putOrSkip(db.suppliers, suppliers as Customer[]); notify('suppliers'); }
    if (db.customers) { loaded += await putOrSkip(db.customers, customers as Customer[]); notify('customers'); }
    if (db.payments) { loaded += await putOrSkip(db.payments, supplierPayments as Payment[]); notify('payments'); }
    if (db.customerPayments) { loaded += await putOrSkip(db.customerPayments, customerPayments as CustomerPayment[]); notify('customerPayments'); }
    if (db.ledgerAccounts) { loaded += await putOrSkip(db.ledgerAccounts, ledgerAccounts as LedgerAccount[]); }
    if (db.ledgerEntries && ledgerEntries.length) {
      const recalc = recalculateLedgerBalances(ledgerEntries as LedgerEntry[]);
      await db.ledgerEntries.clear();
      await chunkedBulkPut(db.ledgerEntries, recalc, 100);
      loaded += recalc.length;
    }
    if (typeof window !== 'undefined' && (ledgerCashAccounts?.length ?? 0) > 0) {
      localStorage.setItem('ledgerCashAccountsCache', JSON.stringify(ledgerCashAccounts || []));
      localStorage.setItem('ledgerCashAccountsLastSynced', String(Date.now()));
      loaded += (ledgerCashAccounts || []).length;
    }
    if (db.banks) { loaded += await putOrSkip(db.banks, banks as any); notify('banks'); }
    if (db.bankBranches && bankBranches.length) {
      const uniqueBranches = dedupeByIfscCode(bankBranches as { ifscCode?: string; id?: string }[]);
      await db.bankBranches.clear();
      const normalizedBranches = uniqueBranches.map((b) => ({
        ...b,
        id: String(b.id || b.ifscCode || '').trim() || `branch-${Math.random().toString(36).slice(2, 11)}`,
      }));
      await chunkedBulkPut(db.bankBranches, normalizedBranches, 100);
      loaded += normalizedBranches.length;
      notify('bankBranches');
    } else if (db.bankBranches) notify('bankBranches');
    if (db.bankAccounts) { loaded += await putOrSkip(db.bankAccounts, bankAccounts as any); notify('bankAccounts'); }
    if (db.supplierBankAccounts) { loaded += await putOrSkip(db.supplierBankAccounts, supplierBankAccounts as any); notify('supplierBankAccounts'); }
    if (db.mandiReports) { loaded += await putOrSkip(db.mandiReports, mandiReports as MandiReport[]); }
    if (db.inventoryItems) { loaded += await putOrSkip(db.inventoryItems, inventoryItems as any); notify('inventoryItems'); }
    if (db.loans) { loaded += await putOrSkip(db.loans, loans as any); notify('loans'); }
    if (db.fundTransactions) { loaded += await putOrSkip(db.fundTransactions, fundTransactions as any); notify('fundTransactions'); }
    if (db.options) { loaded += await putOrSkip(db.options, options as any); notify('options'); }
    if (db.settings && Array.isArray(settings) && settings.length > 0) {
      await db.settings.clear();
      await chunkedBulkPut(db.settings, settings as any, 100);
      loaded += settings.length;
      notify('settings');
    }
    if (db.incomeCategories) { loaded += await putOrSkip(db.incomeCategories, incomeCategories as any); notify('incomeCategories'); }
    if (db.expenseCategories) { loaded += await putOrSkip(db.expenseCategories, expenseCategories as any); notify('expenseCategories'); }
    if (db.accounts) { loaded += await putOrSkip(db.accounts, accounts as any); notify('accounts'); }
    if (db.manufacturingCosting) { loaded += await putOrSkip(db.manufacturingCosting, manufacturingCosting as any); notify('manufacturingCosting'); }
    if (db.kantaParchi) { loaded += await putOrSkip(db.kantaParchi, kantaParchi as any); notify('kantaParchi'); }
    if (db.customerDocuments) { loaded += await putOrSkip(db.customerDocuments, customerDocuments as any); notify('customerDocuments'); }
    if (db.inventoryAddEntries) { loaded += await putOrSkip(db.inventoryAddEntries, inventoryAddEntries as any); notify('inventoryAddEntries'); }

    // Expenses/Incomes go to transactions
    const txExpenses: Record<string, unknown>[] = (expenses || []).map((r: any) => ({ ...r, type: 'Expense' }));
    const txIncomes: Record<string, unknown>[] = (incomes || []).map((r: any) => ({ ...r, type: 'Income' }));
    const allTx: Record<string, unknown>[] = [...txExpenses, ...txIncomes];

    if (db.transactions && allTx.length) {
      await db.transactions.clear();
      await chunkedBulkPut(db.transactions, allTx as any, 100);
      loaded += allTx.length;
    }
    notify('incomes');
    notify('expenses');

    if (typeof window !== 'undefined') {
      // After all DB writes: notify selection so UI updates (doing this earlier would close DB and cause DatabaseClosedError)
      localStorage.setItem('erpSelection', JSON.stringify(selection));
      window.dispatchEvent(new CustomEvent('erp:selection-changed', { detail: selection }));
      // Guaranteed UI refresh after folder load (so supplier payments / payments file data shows)
      window.dispatchEvent(new CustomEvent('local:data-ready'));
    }
    return { success: true, loaded };
  } catch (e) {
    return { success: false, loaded: 0, error: e instanceof Error ? e.message : String(e) };
  } finally {
    isLoadingFromFolder = false;
    setDbInUseByFolderLoad(false);
  }
}

// --- File path <-> table mapping (TABLE_TO_FILE from local-mode-structure) ---
// Full reference: docs/LOCAL_EXCEL_FORMAT.md (konsi file, kaise map, kaise data)
const RELATIVE_PATH_TO_TABLE: Record<string, string> = {};
Object.entries(TABLE_TO_FILE).forEach(([table, { folder, file }]) => {
  const flat = `${folder}/${file}`.toLowerCase();
  RELATIVE_PATH_TO_TABLE[flat] = table;
  RELATIVE_PATH_TO_TABLE[`${folder}\\${file}`.toLowerCase()] = table;
  RELATIVE_PATH_TO_TABLE[`${folder}/${file}`.toLowerCase()] = table;
});
function getTableFromRelativePath(relativePath: string): string | null {
  const key = relativePath.replace(/\\/g, '/').toLowerCase();
  if (RELATIVE_PATH_TO_TABLE[key]) return RELATIVE_PATH_TO_TABLE[key];
  const match = key.match(/companies\/[^/]+\/[^/]+\/[^/]+\/(.+)$/);
  if (match) return RELATIVE_PATH_TO_TABLE[match[1].toLowerCase()] ?? null;
  return null;
}

// Reload single file when Excel saves (file watcher) — read only, no write back
async function reloadSingleFileFromFolder(folderPath: string, relativePath: string): Promise<void> {
  const tableName = getTableFromRelativePath(relativePath);
  if (!tableName) return;
  const db = await getDb();
  if (!db) return;
  const electron = getElectron();
  if (!electron?.readFileFromFolder) return;
  const fullPath = `${folderPath}/${relativePath}`.replace(/\\/g, '/');
  const b64 = await electron.readFileFromFolder(fullPath);
  const data = b64 ? excelBase64ToData(b64, tableName as 'payments' | 'customerPayments' | undefined) : [];

  isLoadingFromFolder = true;
  setDbInUseByFolderLoad(true);
  try {
  if (tableName === 'expenses' || tableName === 'incomes') {
    const all = (await db.transactions.toArray()) as Record<string, unknown>[];
    const others = all.filter((r) => r.type !== (tableName === 'expenses' ? 'Expense' : 'Income'));
    const merged = tableName === 'expenses'
      ? [...others, ...data.map((r) => ({ ...r, type: 'Expense' }))]
      : [...others, ...data.map((r) => ({ ...r, type: 'Income' }))];
    if (db.transactions) {
      await db.transactions.clear();
      if (merged.length) await chunkedBulkPut(db.transactions, merged as any, 100);
    }
    ['incomes', 'expenses'].forEach((c) => {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: c } }));
    });
    return;
  }

  const table = (db as unknown as Record<string, { clear: () => Promise<void>; bulkPut?: (d: unknown[]) => Promise<void> }>)[tableName];
  if (!table?.clear) return;
  await table.clear();
  if (data.length) {
    if (tableName === 'ledgerEntries') {
      const recalc = recalculateLedgerBalances(data as LedgerEntry[]);
      await chunkedBulkPut(db.ledgerEntries, recalc, 100);
    } else if (tableName === 'bankBranches') {
      const unique = dedupeByIfscCode(data as { ifscCode?: string; id?: string }[]);
      const normalized = unique.map((b) => ({
        ...b,
        id: String(b.id || b.ifscCode || '').trim() || `branch-${Math.random().toString(36).slice(2, 11)}`,
      }));
      await chunkedBulkPut(db.bankBranches, normalized, 100);
    } else if (tableName === 'ledgerCashAccounts') {
      if (typeof window !== 'undefined') {
        localStorage.setItem('ledgerCashAccountsCache', JSON.stringify(data));
        localStorage.setItem('ledgerCashAccountsLastSynced', String(Date.now()));
      }
    } else {
      await chunkedBulkPut(table as any, data as any, 100);
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: tableName } }));
  }
  } finally {
    isLoadingFromFolder = false;
    setDbInUseByFolderLoad(false);
  }
}

// Pending writes when Excel has file open - retry every 5s
const pendingWrites = new Set<string>();
let retryInterval: ReturnType<typeof setInterval> | null = null;

function startRetryLoop() {
  if (retryInterval) return;
  retryInterval = setInterval(async () => {
    if (pendingWrites.size === 0) return;
    const tables = Array.from(pendingWrites);
    for (const tableName of tables) {
      const ok = await syncCollectionToFolder(tableName);
      if (ok) pendingWrites.delete(tableName);
    }
  }, 5000);
}

// --- Save table from Dexie to folder ---
export async function saveTableToFolder(folderPath: string, tableName: string, data: Record<string, unknown>[]): Promise<boolean> {
  const electron = getElectron();
  if (!electron?.writeFileToFolder) return false;
  const m = TABLE_TO_FILE[tableName];
  if (!m) return false;
  const useHierarchical = typeof window !== 'undefined' && localStorage.getItem(HIERARCHICAL_KEY) === '1';
  const selection = getLocalErpSelection() ?? { companyId: 'main', subCompanyId: 'main', seasonKey: 'default' };
  const filePath = useHierarchical
    ? getLocalDataPath(folderPath, selection, m.folder, m.file)
    : `${folderPath.replace(/\/$/, '')}/${m.folder}/${m.file}`;

  // Safeguard: Dexie khali hone par Excel ko kabhi khali mat likho — bina delete k bulk rows gum ho jaati hain
  if (data.length === 0 && electron.fileExists) {
    try {
      const exists = await electron.fileExists(filePath);
      if (exists) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('folder:write-skipped', {
            detail: { reason: 'empty_cache_skip', tableName, message: 'Empty Dexie — file not overwritten (sab entries bach jaati hain)' },
          }));
        }
        return true;
      }
    } catch {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('folder:write-skipped', { detail: { reason: 'read_failed_keep_file', tableName } }));
      }
      return true;
    }
  }

  const res = await electron.writeFileToFolder(filePath, dataToExcelBase64(data, tableName));
  if (res?.success) {
    pendingWrites.delete(tableName);
    return true;
  }
  if (res?.error === 'file_locked') {
    pendingWrites.add(tableName);
    startRetryLoop();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('folder:write-failed', { detail: { reason: 'file_locked', tableName } }));
    }
  }
  return false;
}

/** Call after loan or fund-transaction add/update/delete so CashAndBank folder files are written. */
export async function syncLoansAndFundTransactionsToFolder(): Promise<void> {
  if (!isLocalFolderMode()) return;
  await syncCollectionToFolder('loans').catch(() => {});
  await syncCollectionToFolder('fundTransactions').catch(() => {});
}

/** File-first: write ledger cash accounts from localStorage cache to Excel. Use when ledger page creates/updates/deletes cash accounts. */
export async function writeLedgerCashAccountsToFolder(): Promise<boolean> {
  if (!isLocalFolderMode()) return false;
  const path = getLocalFolderPath();
  if (!path) return false;
  const cached = typeof window !== 'undefined' ? localStorage.getItem('ledgerCashAccountsCache') : null;
  const data: Record<string, unknown>[] = cached ? (JSON.parse(cached) as Record<string, unknown>[]) : [];
  return saveTableToFolder(path, 'ledgerCashAccounts', data);
}

/** Write a single payment to Excel file: read file → merge this payment → write. Guarantees payment is in file. */
export async function writePaymentToFolderFile(
  collectionName: 'payments' | 'customerPayments',
  payment: Record<string, unknown>
): Promise<boolean> {
  if (!isLocalFolderMode()) return false;
  const path = getLocalFolderPath();
  if (!path) return false;
  const electron = getElectron();
  if (!electron?.readFileFromFolder || !electron?.writeFileToFolder || !electron?.fileExists) return false;
  const m = TABLE_TO_FILE[collectionName];
  if (!m) return false;
  const useHierarchical = typeof window !== 'undefined' && localStorage.getItem(HIERARCHICAL_KEY) === '1';
  const selection = getLocalErpSelection() ?? { companyId: 'main', subCompanyId: 'main', seasonKey: 'default' };
  const filePath = useHierarchical
    ? getLocalDataPath(path, selection, m.folder, m.file)
    : `${path.replace(/\/$/, '')}/${m.folder}/${m.file}`;
  try {
    let existing: Record<string, unknown>[] = [];
    const exists = await electron.fileExists(filePath);
    if (exists) {
      const b64 = await electron.readFileFromFolder(filePath);
      if (b64) existing = excelWorkbookToPayments(b64);
    }
    const payId = String(payment?.paymentId || payment?.id || '').trim();
    const merged = existing.filter((r: any) => String(r?.paymentId || r?.id || '').trim() !== payId);
    // Ensure paidFor is always an array so PaidFor sheet gets rows (finalize-time detail)
    let pf = (payment as any)?.paidFor;
    if (typeof pf === 'string' && String(pf).trim().startsWith('[')) {
      try { pf = JSON.parse(pf); } catch { pf = []; }
    }
    if (!Array.isArray(pf)) pf = [];
    const paymentWithPaidFor = { ...payment, paidFor: pf };
    merged.push(normalizePaymentForExcel(paymentWithPaidFor));
    const res = await electron.writeFileToFolder(filePath, dataToExcelBase64(merged, collectionName));
    return res?.success ?? false;
  } catch {
    return false;
  }
}

/** File-first: read file → merge one record (by key) → write. For single-sheet tables (suppliers, customers, etc.). Not for payments. */
export async function mergeRecordToFolderFile(
  tableName: string,
  record: Record<string, unknown>,
  keyField: string = 'id'
): Promise<boolean> {
  if (!isLocalFolderMode() || tableName === 'payments' || tableName === 'customerPayments') return false;
  const path = getLocalFolderPath();
  if (!path) return false;
  const electron = getElectron();
  if (!electron?.readFileFromFolder || !electron?.writeFileToFolder || !electron?.fileExists) return false;
  const m = TABLE_TO_FILE[tableName];
  if (!m) return false;
  const useHierarchical = typeof window !== 'undefined' && localStorage.getItem(HIERARCHICAL_KEY) === '1';
  const selection = getLocalErpSelection() ?? { companyId: 'main', subCompanyId: 'main', seasonKey: 'default' };
  const filePath = useHierarchical
    ? getLocalDataPath(path, selection, m.folder, m.file)
    : `${path.replace(/\/$/, '')}/${m.folder}/${m.file}`;
  try {
    let data: Record<string, unknown>[] = [];
    const exists = await electron.fileExists(filePath);
    if (exists) {
      const b64 = await electron.readFileFromFolder(filePath);
      if (b64) data = excelBase64ToData(b64) as Record<string, unknown>[];
    }
    const keyVal = String(record[keyField] ?? '').trim();
    const merged = data.filter((r: Record<string, unknown>) => String(r[keyField] ?? '').trim() !== keyVal);
    merged.push(record);
    const res = await electron.writeFileToFolder(filePath, dataToExcelBase64(merged, tableName));
    return res?.success ?? false;
  } catch {
    return false;
  }
}

/** File-first: remove payments by paymentId from Excel file (Payments + PaidFor sheets). */
export async function removePaymentsFromFolderFile(
  collectionName: 'payments' | 'customerPayments',
  paymentIds: string[]
): Promise<boolean> {
  if (!isLocalFolderMode() || !paymentIds.length) return false;
  const path = getLocalFolderPath();
  if (!path) return false;
  const electron = getElectron();
  if (!electron?.readFileFromFolder || !electron?.writeFileToFolder || !electron?.fileExists) return false;
  const m = TABLE_TO_FILE[collectionName];
  if (!m) return false;
  const useHierarchical = typeof window !== 'undefined' && localStorage.getItem(HIERARCHICAL_KEY) === '1';
  const selection = getLocalErpSelection() ?? { companyId: 'main', subCompanyId: 'main', seasonKey: 'default' };
  const filePath = useHierarchical
    ? getLocalDataPath(path, selection, m.folder, m.file)
    : `${path.replace(/\/$/, '')}/${m.folder}/${m.file}`;
  const idSet = new Set(paymentIds.map((id) => String(id).trim()).filter(Boolean));
  if (idSet.size === 0) return true;
  try {
    let existing: Record<string, unknown>[] = [];
    const exists = await electron.fileExists(filePath);
    if (exists) {
      const b64 = await electron.readFileFromFolder(filePath);
      if (b64) existing = excelWorkbookToPayments(b64);
    }
    const merged = existing.filter(
      (r: Record<string, unknown>) => !idSet.has(String((r as any).paymentId ?? (r as any).id ?? '').trim())
    );
    const res = await electron.writeFileToFolder(filePath, dataToExcelBase64(merged, collectionName));
    return res?.success ?? false;
  } catch {
    return false;
  }
}

/** File-first: read file → remove record by key → write. For single-sheet tables. */
export async function removeRecordFromFolderFile(
  tableName: string,
  keyValue: string,
  keyField: string = 'id'
): Promise<boolean> {
  if (!isLocalFolderMode() || tableName === 'payments' || tableName === 'customerPayments') return false;
  const path = getLocalFolderPath();
  if (!path) return false;
  const electron = getElectron();
  if (!electron?.readFileFromFolder || !electron?.writeFileToFolder || !electron?.fileExists) return false;
  const m = TABLE_TO_FILE[tableName];
  if (!m) return false;
  const useHierarchical = typeof window !== 'undefined' && localStorage.getItem(HIERARCHICAL_KEY) === '1';
  const selection = getLocalErpSelection() ?? { companyId: 'main', subCompanyId: 'main', seasonKey: 'default' };
  const filePath = useHierarchical
    ? getLocalDataPath(path, selection, m.folder, m.file)
    : `${path.replace(/\/$/, '')}/${m.folder}/${m.file}`;
  try {
    let data: Record<string, unknown>[] = [];
    const exists = await electron.fileExists(filePath);
    if (exists) {
      const b64 = await electron.readFileFromFolder(filePath);
      if (b64) data = excelBase64ToData(b64) as Record<string, unknown>[];
    }
    const filtered = data.filter((r: Record<string, unknown>) => String(r[keyField] ?? '').trim() !== String(keyValue).trim());
    if (filtered.length === 0) return true; // nothing to remove or already gone; do not overwrite file with empty
    const res = await electron.writeFileToFolder(filePath, dataToExcelBase64(filtered, tableName));
    return res?.success ?? false;
  } catch {
    return false;
  }
}

// --- Sync Dexie → file: DISABLED in local folder mode so file is never overwritten. Full sync = loadFromFolderToDexie (refresh). ---
export async function syncCollectionToFolder(collectionName: string): Promise<boolean> {
  if (isLoadingFromFolder) return true;
  // File = source of truth: do not overwrite file from Dexie. Callers should use file-first save or full refresh.
  if (isLocalFolderMode()) return true;
  const path = getLocalFolderPath();
  if (!path) return false;
  const db = await getDb();
  if (!db) return false;

  try {
    let data: Record<string, unknown>[] = [];
    if (collectionName === 'payments' || collectionName === 'customerPayments') {
      const { getDb: getRawDb } = await import('./database');
      const rawDb = getRawDb() as { payments?: { toArray: () => Promise<unknown[]> }; customerPayments?: { toArray: () => Promise<unknown[]> } };
      const table = collectionName === 'payments' ? rawDb.payments : rawDb.customerPayments;
      if (table) {
        const raw = await table.toArray();
        data = raw.map((row: any) => {
          const copy = { ...row } as Record<string, unknown>;
          if (Array.isArray(row?.paidFor) && row.paidFor.length > 0) {
            copy.paidFor = JSON.parse(JSON.stringify(row.paidFor));
          } else {
            copy.paidFor = row?.paidFor ?? [];
          }
          return copy;
        }) as Record<string, unknown>[];
      }
      if (data.length === 0) {
        const fallbackTable = collectionName === 'payments' ? (db as any).payments : (db as any).customerPayments;
        if (fallbackTable) {
          const raw = await fallbackTable.toArray();
          data = raw.map((row: any) => {
            const copy = { ...row } as Record<string, unknown>;
            copy.paidFor = Array.isArray(row?.paidFor) ? JSON.parse(JSON.stringify(row.paidFor)) : (row?.paidFor ?? []);
            return copy;
          }) as Record<string, unknown>[];
        }
      }
      const mergePf = (row: Record<string, unknown>) => {
        let pf = row.paidFor;
        if (typeof pf === 'string' && pf.trim().startsWith('[')) {
          try { pf = JSON.parse(pf); } catch { pf = []; }
        }
        if (!Array.isArray(pf)) pf = [];
        return { ...row, paidFor: pf };
      };
      data = data.map(mergePf);
      const electron = getElectron();
      const m = TABLE_TO_FILE[collectionName];
      if (m && electron?.readFileFromFolder && electron?.fileExists) {
        const useHierarchical = typeof window !== 'undefined' && localStorage.getItem(HIERARCHICAL_KEY) === '1';
        const selection = getLocalErpSelection() ?? { companyId: 'main', subCompanyId: 'main', seasonKey: 'default' };
        const filePath = useHierarchical
          ? getLocalDataPath(path, selection, m.folder, m.file)
          : `${path.replace(/\/$/, '')}/${m.folder}/${m.file}`;
        const exists = await electron.fileExists(filePath);
        if (exists) {
          const b64 = await electron.readFileFromFolder(filePath);
          if (b64) {
            const fromFile = excelWorkbookToPayments(b64);
            const byPid = new Map(fromFile.map((x: any) => [String(x.paymentId || x.id || '').trim(), x]));
            data = data.map((row: any) => {
              const pid = String(row.paymentId || row.id || '').trim();
              const fileRow = byPid.get(pid);
              const hasPf = Array.isArray(row.paidFor) && row.paidFor.length > 0;
              const filePf = fileRow && Array.isArray(fileRow.paidFor) && fileRow.paidFor.length > 0;
              if (!hasPf && filePf) return { ...row, paidFor: fileRow.paidFor };
              return row;
            });
          }
        }
      }
    }
    if (collectionName === 'suppliers') data = (await db.suppliers.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'customers') data = (await db.customers.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'payments' && data.length === 0) data = (await (db as any).payments.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'customerPayments' && data.length === 0) data = (await (db as any).customerPayments.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'ledgerAccounts') data = (await db.ledgerAccounts.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'ledgerEntries') data = (await db.ledgerEntries.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'ledgerCashAccounts') {
      const cached = typeof window !== 'undefined' ? localStorage.getItem('ledgerCashAccountsCache') : null;
      data = cached ? (JSON.parse(cached) as Record<string, unknown>[]) : [];
    }
    else if (collectionName === 'banks') data = (await db.banks.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'bankBranches') data = (await db.bankBranches.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'bankAccounts') data = (await db.bankAccounts.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'supplierBankAccounts') data = (await db.supplierBankAccounts.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'mandiReports') data = (await db.mandiReports.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'inventoryItems') data = (await db.inventoryItems.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'loans') data = (await db.loans.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'fundTransactions') data = (await db.fundTransactions.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'options') data = (await db.options.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'settings') data = (await db.settings.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'incomeCategories') data = (await db.incomeCategories.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'expenseCategories') data = (await db.expenseCategories.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'accounts') data = (await db.accounts.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'manufacturingCosting') data = (await db.manufacturingCosting.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'kantaParchi') data = (await db.kantaParchi.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'customerDocuments') data = (await db.customerDocuments.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'inventoryAddEntries') data = (await db.inventoryAddEntries.toArray()) as unknown as Record<string, unknown>[];
    else if (collectionName === 'transactions') {
      const all = (await db.transactions.toArray()) as unknown as Record<string, unknown>[];
      const expenses = all.filter((r) => r.type === 'Expense');
      const incomes = all.filter((r) => r.type === 'Income');
      const p = getLocalFolderPath();
      if (!p) return false;
      await saveTableToFolder(p, 'expenses', expenses);
      await saveTableToFolder(p, 'incomes', incomes);
      return true;
    }
    else return false;

    if (collectionName === 'ledgerEntries') {
      const recalc = recalculateLedgerBalances(data as LedgerEntry[]);
      return saveTableToFolder(path, collectionName, recalc as unknown as Record<string, unknown>[]);
    }
    return saveTableToFolder(path, collectionName, data);
  } catch {
    return false;
  }
}

// --- File watcher: Excel edits -> sync to app ---
let fileChangeDebounce: ReturnType<typeof setTimeout> | null = null;

export function initFolderWatcher(): void {
  if (typeof window === 'undefined') return;
  const folderPath = getLocalFolderPath();
  if (!folderPath) return;
  const electron = getElectron();
  if (!electron?.watchFolder) return;

  // Close only software's Excel files (not entire Excel) so we can read/write
  void electron.closeExcelFilesInFolder?.(folderPath);

  electron.watchFolder(folderPath).then((res) => {
    if (!res?.ok) return;
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail as { filePath?: string; relativePath?: string };
      const key = `${d.relativePath || ''}`;
      if (!key) return;
      if (fileChangeDebounce) clearTimeout(fileChangeDebounce);
      fileChangeDebounce = setTimeout(async () => {
        fileChangeDebounce = null;
        await reloadSingleFileFromFolder(folderPath, d.relativePath!);
      }, 600);
    };
    window.addEventListener('folder:file-changed', handler);
  }).catch(() => {
    // Handler not registered (browser mode) or Electron not ready - ignore
  });
}
