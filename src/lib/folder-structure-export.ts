/**
 * Menu-based folder structure for BizSuite data export/import.
 * Structure: Main folder > Menu folders > Excel files
 */

import * as XLSX from 'xlsx';
import {
  getAllSuppliers,
  getAllCustomers,
  getAllPayments,
  getAllCustomerPayments,
  fetchLedgerAccounts,
  fetchAllLedgerEntries,
  fetchLedgerCashAccounts,
  getAllIncomes,
  getAllExpenses,
  getAllBanks,
  getAllBankBranches,
  getAllBankAccounts,
  getAllSupplierBankAccounts,
  getAllInventoryItems,
  fetchMandiReports,
  bulkUpsertSuppliers,
  bulkUpsertCustomers,
  bulkUpsertPayments,
  bulkUpsertCustomerPayments,
  bulkUpsertLedgerAccounts,
  bulkUpsertLedgerEntries,
  bulkUpsertLedgerCashAccounts,
  bulkUpsertMandiReports,
} from './firestore';
import { getDocs } from 'firebase/firestore';
import { firestoreDB } from './firebase';
import { getTenantCollectionPath } from './tenancy';
import { collection } from 'firebase/firestore';
import { syncAllData } from './database';
import { LOCAL_DATA_FILES } from './local-mode-structure';
import type { Customer, Payment, CustomerPayment, LedgerAccount, LedgerEntry, LedgerCashAccount, MandiReport } from './definitions';
import { calculateSupplierEntry } from './utils';

export function recalculateLedgerBalances(entries: LedgerEntry[]): LedgerEntry[] {
  const grouped = new Map<string, LedgerEntry[]>();
  entries.forEach((entry) => {
    if (!entry.accountId) return;
    if (!grouped.has(entry.accountId)) grouped.set(entry.accountId, []);
    grouped.get(entry.accountId)!.push(entry);
  });
  const updated: LedgerEntry[] = [];
  grouped.forEach((accountEntries) => {
    accountEntries.sort((a, b) => {
      const dateCompare = (a.date || '').localeCompare(b.date || '');
      if (dateCompare !== 0) return dateCompare;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });
    let running = 0;
    accountEntries.forEach((entry) => {
      running = Math.round((running + entry.debit - entry.credit) * 100) / 100;
      entry.balance = running;
      entry.updatedAt = entry.updatedAt || new Date().toISOString();
      updated.push(entry);
    });
  });
  return updated;
}

// --- Folder structure (same as local-mode-structure so mapping stays in sync) ---
export const FOLDER_STRUCTURE = LOCAL_DATA_FILES;

// --- Serialize/Deserialize helpers ---
const serializeRecord = (record: Record<string, unknown>) => {
  const result: Record<string, unknown> = {};
  Object.entries(record).forEach(([key, value]) => {
    if (value === undefined) return;
    if (Array.isArray(value) || (value && typeof value === 'object')) {
      try {
        result[key] = JSON.stringify(value);
      } catch {
        result[key] = String(value);
      }
    } else {
      result[key] = value;
    }
  });
  return result;
};

const parseMaybeJson = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
};

const deserializeRow = (row: Record<string, unknown>) => {
  const result: Record<string, unknown> = {};
  Object.entries(row).forEach(([key, value]) => {
    result[key] = parseMaybeJson(value);
  });
  return result;
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const numeric = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(numeric) ? numeric : 0;
  }
  return 0;
};

const ensureId = (value: unknown): string => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

// --- Normalizers (same as migrations page) ---
const normalizeSupplier = (raw: Record<string, unknown>): Customer => {
  const base = { ...raw } as Record<string, unknown>;
  base.id = ensureId(base.id);
  if (!base.srNo && typeof base.paymentId === 'string') base.srNo = base.paymentId;
  base.grossWeight = toNumber(base.grossWeight);
  base.teirWeight = toNumber(base.teirWeight);
  base.kartaPercentage = Number(base.kartaPercentage) || 0;
  base.rate = Number(base.rate) || 0;
  base.labouryRate = Number(base.labouryRate) || 0;
  base.kanta = Number(base.kanta) || 0;
  const computed = calculateSupplierEntry({
    grossWeight: base.grossWeight as number,
    teirWeight: base.teirWeight as number,
    kartaPercentage: base.kartaPercentage as number,
    rate: base.rate as number,
    labouryRate: base.labouryRate as number,
    kanta: base.kanta as number,
  });
  base.weight = computed.weight;
  base.kartaWeight = computed.kartaWeight;
  base.kartaAmount = computed.kartaAmount;
  base.netWeight = computed.netWeight;
  base.amount = computed.amount;
  base.labouryAmount = computed.labouryAmount;
  base.originalNetAmount = computed.originalNetAmount;
  base.netAmount = computed.netAmount;
  if (!base.date) base.date = new Date().toISOString().split('T')[0];
  if (!base.dueDate) base.dueDate = base.date;
  return base as Customer;
};

const normalizePayment = (raw: Record<string, unknown>): Payment => {
  const base = { ...raw } as Record<string, unknown>;
  base.id = ensureId(base.id || base.paymentId);
  base.amount = toNumber(base.amount);
  if (base.cdAmount !== undefined) base.cdAmount = toNumber(base.cdAmount);
  if (base.quantity !== undefined) base.quantity = toNumber(base.quantity);
  if (base.rate !== undefined) base.rate = toNumber(base.rate);
  if (base.rtgsAmount !== undefined) base.rtgsAmount = toNumber(base.rtgsAmount);
  if (!Array.isArray(base.paidFor)) base.paidFor = [];
  return base as Payment;
};

const normalizeCustomerPayment = (raw: Record<string, unknown>): CustomerPayment => {
  const base = { ...raw } as Record<string, unknown>;
  base.id = ensureId(base.id || base.paymentId);
  base.amount = toNumber(base.amount);
  if (!Array.isArray(base.paidFor)) base.paidFor = [];
  return base as CustomerPayment;
};

const normalizeLedgerAccount = (raw: Record<string, unknown>): LedgerAccount => {
  const base = { ...raw } as Record<string, unknown>;
  base.id = ensureId(base.id);
  base.name = (base.name as string) || 'Account';
  base.createdAt = (base.createdAt as string) || new Date().toISOString();
  base.updatedAt = (base.updatedAt as string) || base.createdAt;
  return base as LedgerAccount;
};

const normalizeLedgerEntry = (raw: Record<string, unknown>): LedgerEntry => {
  const base = { ...raw } as Record<string, unknown>;
  base.id = ensureId(base.id);
  base.accountId = (base.accountId as string) || '';
  base.date = (base.date as string) || new Date().toISOString().split('T')[0];
  base.particulars = (base.particulars as string) || '-';
  base.debit = toNumber(base.debit);
  base.credit = toNumber(base.credit);
  base.balance = toNumber(base.balance);
  base.createdAt = (base.createdAt as string) || new Date().toISOString();
  base.updatedAt = (base.updatedAt as string) || base.createdAt;
  return base as LedgerEntry;
};

const normalizeLedgerCashAccount = (raw: Record<string, unknown>): LedgerCashAccount => {
  const base = { ...raw } as Record<string, unknown>;
  base.id = ensureId(base.id);
  base.name = (base.name as string) || 'Cash Account';
  const noteGroupsRaw = base.noteGroups && typeof base.noteGroups === 'object' ? base.noteGroups : {};
  const normalizedNoteGroups: Record<string, number[]> = {};
  Object.entries(noteGroupsRaw as Record<string, unknown>).forEach(([key, value]) => {
    normalizedNoteGroups[key] = Array.isArray(value) ? value.map(toNumber) : [];
  });
  base.noteGroups = normalizedNoteGroups;
  base.createdAt = (base.createdAt as string) || new Date().toISOString();
  base.updatedAt = (base.updatedAt as string) || base.createdAt;
  return base as LedgerCashAccount;
};

const normalizeMandiReport = (raw: Record<string, unknown>): MandiReport => {
  const base = { ...raw } as Record<string, unknown>;
  base.id = ensureId(base.id);
  base.quantityQtl = toNumber(base.quantityQtl);
  base.ratePerQtl = toNumber(base.ratePerQtl);
  base.grossAmount = toNumber(base.grossAmount);
  base.netAmount = toNumber(base.netAmount);
  base.mandiFee = toNumber(base.mandiFee);
  base.developmentCess = toNumber(base.developmentCess);
  base.totalCharges = toNumber(base.totalCharges);
  base.paymentAmount = toNumber(base.paymentAmount);
  return base as MandiReport;
};

// --- Export: Fetch all data from Firestore ---
export async function fetchAllDataForExport() {
  const [
    suppliers,
    customers,
    supplierPayments,
    customerPayments,
    ledgerAccounts,
    ledgerEntries,
    ledgerCashAccounts,
    incomes,
    expenses,
    banks,
    bankBranches,
    bankAccounts,
    supplierBankAccounts,
    inventoryItems,
    mandiReports,
  ] = await Promise.all([
    getAllSuppliers(),
    getAllCustomers(),
    getAllPayments(),
    getAllCustomerPayments(),
    fetchLedgerAccounts(),
    fetchAllLedgerEntries(),
    fetchLedgerCashAccounts(),
    getAllIncomes(),
    getAllExpenses(),
    getAllBanks(),
    getAllBankBranches(),
    getAllBankAccounts(),
    getAllSupplierBankAccounts(),
    getAllInventoryItems(),
    fetchMandiReports(),
  ]);

  // Settings: fetch all docs from settings collection
  const settingsCol = collection(firestoreDB, ...getTenantCollectionPath('settings'));
  const settingsSnap = await getDocs(settingsCol);
  const settingsDocs = settingsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return {
    Entry: {
      suppliers: suppliers as unknown as Record<string, unknown>[],
      customers: customers as unknown as Record<string, unknown>[],
      'inventory-items': inventoryItems as unknown as Record<string, unknown>[],
    },
    Payments: {
      'supplier-payments': supplierPayments as unknown as Record<string, unknown>[],
      'customer-payments': customerPayments as unknown as Record<string, unknown>[],
      'ledger-accounts': ledgerAccounts as unknown as Record<string, unknown>[],
      'ledger-entries': ledgerEntries as unknown as Record<string, unknown>[],
      'ledger-cash-accounts': ledgerCashAccounts as unknown as Record<string, unknown>[],
      expenses: expenses as unknown as Record<string, unknown>[],
      incomes: incomes as unknown as Record<string, unknown>[],
    },
    CashAndBank: {
      banks: banks as unknown as Record<string, unknown>[],
      'bank-branches': bankBranches as unknown as Record<string, unknown>[],
      'bank-accounts': bankAccounts as unknown as Record<string, unknown>[],
      'supplier-bank-accounts': supplierBankAccounts as unknown as Record<string, unknown>[],
    },
    Reports: {
      'mandi-reports': mandiReports as unknown as Record<string, unknown>[],
    },
    Settings: {
      settings: settingsDocs,
    },
  };
}

// --- Base64 helpers (browser + Node) ---
function toBase64(buf: ArrayBuffer | Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buf as ArrayBuffer).toString('base64');
  }
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

// --- Convert data to Excel buffer (base64) ---
function dataToExcelBase64(data: Record<string, unknown>[]): string {
  if (!data.length) return '';
  const sheet = XLSX.utils.json_to_sheet(data.map((r) => serializeRecord(r as Record<string, unknown>)));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Data');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return toBase64(buf);
}

// --- Export to folder (Electron) ---
export async function exportToFolder(basePath: string): Promise<{ success: boolean; filesWritten: number; error?: string }> {
  const electron = typeof window !== 'undefined' ? (window as unknown as { electron?: { writeFileToFolder: (p: string, b: string) => Promise<{ success: boolean }> } }).electron : undefined;
  if (!electron?.writeFileToFolder) {
    return { success: false, filesWritten: 0, error: 'Electron folder API not available. Run in Electron desktop app.' };
  }

  const data = await fetchAllDataForExport();
  let filesWritten = 0;

  const path = (folder: string, file: string) => `${basePath}/${folder}/${file}`;

  // Entry
  await electron.writeFileToFolder(path('Entry', 'suppliers.xlsx'), dataToExcelBase64(data.Entry.suppliers));
  filesWritten++;
  await electron.writeFileToFolder(path('Entry', 'customers.xlsx'), dataToExcelBase64(data.Entry.customers));
  filesWritten++;
  await electron.writeFileToFolder(path('Entry', 'inventory-items.xlsx'), dataToExcelBase64(data.Entry['inventory-items']));
  filesWritten++;

  // Payments
  await electron.writeFileToFolder(path('Payments', 'supplier-payments.xlsx'), dataToExcelBase64(data.Payments['supplier-payments']));
  filesWritten++;
  await electron.writeFileToFolder(path('Payments', 'customer-payments.xlsx'), dataToExcelBase64(data.Payments['customer-payments']));
  filesWritten++;
  await electron.writeFileToFolder(path('Payments', 'ledger-accounts.xlsx'), dataToExcelBase64(data.Payments['ledger-accounts']));
  filesWritten++;
  await electron.writeFileToFolder(path('Payments', 'ledger-entries.xlsx'), dataToExcelBase64(data.Payments['ledger-entries']));
  filesWritten++;
  await electron.writeFileToFolder(path('Payments', 'ledger-cash-accounts.xlsx'), dataToExcelBase64(data.Payments['ledger-cash-accounts']));
  filesWritten++;
  await electron.writeFileToFolder(path('Payments', 'expenses.xlsx'), dataToExcelBase64(data.Payments.expenses));
  filesWritten++;
  await electron.writeFileToFolder(path('Payments', 'incomes.xlsx'), dataToExcelBase64(data.Payments.incomes));
  filesWritten++;

  // CashAndBank
  await electron.writeFileToFolder(path('CashAndBank', 'banks.xlsx'), dataToExcelBase64(data.CashAndBank.banks));
  filesWritten++;
  await electron.writeFileToFolder(path('CashAndBank', 'bank-branches.xlsx'), dataToExcelBase64(data.CashAndBank['bank-branches']));
  filesWritten++;
  await electron.writeFileToFolder(path('CashAndBank', 'bank-accounts.xlsx'), dataToExcelBase64(data.CashAndBank['bank-accounts']));
  filesWritten++;
  await electron.writeFileToFolder(path('CashAndBank', 'supplier-bank-accounts.xlsx'), dataToExcelBase64(data.CashAndBank['supplier-bank-accounts']));
  filesWritten++;

  // Reports
  await electron.writeFileToFolder(path('Reports', 'mandi-reports.xlsx'), dataToExcelBase64(data.Reports['mandi-reports']));
  filesWritten++;

  // Settings
  await electron.writeFileToFolder(path('Settings', 'settings.xlsx'), dataToExcelBase64(data.Settings.settings as Record<string, unknown>[]));
  filesWritten++;

  return { success: true, filesWritten };
}

// --- Read Excel from base64 ---
function excelBase64ToData(base64: string): Record<string, unknown>[] {
  if (!base64) return [];
  const buf = fromBase64(base64);
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return rows.map(deserializeRow);
}

// --- Import from folder (Electron) ---
export async function importFromFolder(basePath: string): Promise<{ success: boolean; summary: string[]; errors: string[] }> {
  const electron = typeof window !== 'undefined' ? (window as unknown as { electron?: { readFileFromFolder: (p: string) => Promise<string | null>; fileExists: (p: string) => Promise<boolean> } }).electron : undefined;
  if (!electron?.readFileFromFolder) {
    return { success: false, summary: [], errors: ['Electron folder API not available. Run in Electron desktop app.'] };
  }

  const summary: string[] = [];
  const errors: string[] = [];

  const readFile = async (folder: string, file: string): Promise<Record<string, unknown>[]> => {
    const p = `${basePath}/${folder}/${file}`;
    const exists = await electron!.fileExists(p);
    if (!exists) return [];
    const b64 = await electron!.readFileFromFolder(p);
    return b64 ? excelBase64ToData(b64) : [];
  };

  try {
    // Entry
    const supplierRows = await readFile('Entry', 'suppliers.xlsx');
    if (supplierRows.length) {
      try {
        const suppliers = supplierRows.map((r) => normalizeSupplier(r));
        await bulkUpsertSuppliers(suppliers);
        summary.push(`${suppliers.length} suppliers`);
      } catch (e) {
        errors.push(`Suppliers: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const customerRows = await readFile('Entry', 'customers.xlsx');
    if (customerRows.length) {
      try {
        const customers = customerRows.map((r) => normalizeSupplier(r) as unknown as Customer);
        await bulkUpsertCustomers(customers);
        summary.push(`${customers.length} customers`);
      } catch (e) {
        errors.push(`Customers: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Payments
    const supplierPaymentRows = await readFile('Payments', 'supplier-payments.xlsx');
    if (supplierPaymentRows.length) {
      try {
        const payments = supplierPaymentRows.map((r) => normalizePayment(r));
        await bulkUpsertPayments(payments);
        summary.push(`${payments.length} supplier payments`);
      } catch (e) {
        errors.push(`Supplier payments: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const customerPaymentRows = await readFile('Payments', 'customer-payments.xlsx');
    if (customerPaymentRows.length) {
      try {
        const payments = customerPaymentRows.map((r) => normalizeCustomerPayment(r));
        await bulkUpsertCustomerPayments(payments);
        summary.push(`${payments.length} customer payments`);
      } catch (e) {
        errors.push(`Customer payments: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const ledgerAccountRows = await readFile('Payments', 'ledger-accounts.xlsx');
    if (ledgerAccountRows.length) {
      try {
        const accounts = ledgerAccountRows.map((r) => normalizeLedgerAccount(r));
        await bulkUpsertLedgerAccounts(accounts);
        summary.push(`${accounts.length} ledger accounts`);
      } catch (e) {
        errors.push(`Ledger accounts: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const ledgerEntryRows = await readFile('Payments', 'ledger-entries.xlsx');
    if (ledgerEntryRows.length) {
      try {
        const entries = ledgerEntryRows.map((r) => normalizeLedgerEntry(r));
        const recalculated = recalculateLedgerBalances(entries);
        await bulkUpsertLedgerEntries(recalculated);
        summary.push(`${recalculated.length} ledger entries`);
      } catch (e) {
        errors.push(`Ledger entries: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const ledgerCashAccountRows = await readFile('Payments', 'ledger-cash-accounts.xlsx');
    if (ledgerCashAccountRows.length) {
      try {
        const cashAccounts = ledgerCashAccountRows.map((r) => normalizeLedgerCashAccount(r));
        await bulkUpsertLedgerCashAccounts(cashAccounts);
        summary.push(`${cashAccounts.length} ledger cash accounts`);
      } catch (e) {
        errors.push(`Ledger cash accounts: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const mandiReportRows = await readFile('Reports', 'mandi-reports.xlsx');
    if (mandiReportRows.length) {
      try {
        const reports = mandiReportRows.map((r) => normalizeMandiReport(r));
        await bulkUpsertMandiReports(reports);
        summary.push(`${reports.length} mandi reports`);
      } catch (e) {
        errors.push(`Mandi reports: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (summary.length) {
      await syncAllData();
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  return { success: errors.length === 0, summary, errors };
}
