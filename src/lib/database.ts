
import Dexie, { type Table } from 'dexie';
import type { Account, Customer, CustomerDocument, CustomerPayment, ExpenseCategory, FundTransaction, Holiday, IncomeCategory, InventoryAddEntry, InventoryItem, KantaParchi, LedgerAccount, LedgerEntry, Loan, MandiReport, ManufacturingCostingData, OptionItem, PayrollEntry, Payment, Project, ReceiptSettings, ReceiptFieldSettings, RtgsSettings, SyncTask, Transaction, Bank, BankBranch, BankAccount, Employee, AttendanceEntry, FormatSettings } from './definitions';
import { logError } from './error-logger';
import { chunkedBulkPut } from './chunked-operations';
import { getTenantCollectionPath, getStorageKeySuffix } from './tenancy';

// Helper function to handle errors silently (for sync fallback scenarios)
function handleSilentError(error: unknown, context: string): void {
  // Log error using error logging service
  logError(error, context, 'low');
}

const DEFAULT_RECEIPT_FIELDS: ReceiptFieldSettings = {
  date: true, name: true, contact: true, address: true, vehicleNo: true, term: true, rate: true,
  grossWeight: true, teirWeight: true, weight: true, amount: true, dueDate: true, kartaWeight: true,
  netAmount: true, srNo: true, variety: true, netWeight: true,
};

/** Load receipt settings from local IndexedDB (SQLite-only mode) */
export async function getReceiptSettingsFromLocal(): Promise<ReceiptSettings | null> {
  if (typeof window === 'undefined') return null;
  try {
    const d = getDb();
    const data = await d.settings.get('companyDetails') as Partial<ReceiptSettings> | undefined;
    if (!data) {
      return {
        companyName: 'JAGDAMBE RICE MILL',
        companyAddress1: 'Devkali Road, Banda, Shajahanpur',
        companyAddress2: 'Near Devkali, Uttar Pradesh',
        contactNo: '9555130735',
        gmail: 'JRMDofficial@gmail.com',
        fields: DEFAULT_RECEIPT_FIELDS,
      };
    }
    let defaultBank: BankAccount | undefined;
    if (data.defaultBankAccountId) {
      const acc = await d.bankAccounts.get(data.defaultBankAccountId);
      if (acc) defaultBank = acc as BankAccount;
    }
    return {
      companyName: data.companyName || 'JAGDAMBE RICE MILL',
      companyAddress1: data.companyAddress1 || 'Devkali Road, Banda, Shajahanpur',
      companyAddress2: data.companyAddress2 || 'Near Devkali, Uttar Pradesh',
      contactNo: data.contactNo || '9555130735',
      gmail: data.gmail || 'JRMDofficial@gmail.com',
      fields: { ...DEFAULT_RECEIPT_FIELDS, ...(data.fields || {}) },
      defaultBankAccountId: data.defaultBankAccountId,
      defaultBank: data.defaultBank ?? defaultBank,
      companyGstin: data.companyGstin,
      companyStateName: data.companyStateName,
      companyStateCode: data.companyStateCode,
      panNo: data.panNo,
    };
  } catch {
    return null;
  }
}

/** Get lastSync localStorage key with tenant suffix so data is never mixed across companies */
export function getLastSyncKey(collectionName: string): string {
  if (typeof window === 'undefined') return `lastSync:${collectionName}`;
  const suffix = getStorageKeySuffix();
  return `lastSync:${collectionName}${suffix ? `_${suffix}` : ''}`;
}

export class AppDatabase extends Dexie {
    suppliers!: Table<Customer>;
    customers!: Table<Customer>;
    payments!: Table<Payment>;
    customerPayments!: Table<CustomerPayment>;
    governmentFinalizedPayments!: Table<Payment>;
    transactions!: Table<Transaction>;
    options!: Table<OptionItem>;
    banks!: Table<Bank>;
    bankBranches!: Table<BankBranch>;
    bankAccounts!: Table<BankAccount>;
    supplierBankAccounts!: Table<BankAccount>;
    settings!: Table<RtgsSettings | ReceiptSettings | FormatSettings | Holiday>;
    projects!: Table<Project>;
    loans!: Table<Loan>;
    fundTransactions!: Table<FundTransaction>;
    employees!: Table<Employee>;
    payroll!: Table<PayrollEntry>;
    attendance!: Table<AttendanceEntry>;
    inventoryItems!: Table<InventoryItem>;
    ledgerAccounts!: Table<LedgerAccount>;
    ledgerEntries!: Table<LedgerEntry>;
    mandiReports!: Table<MandiReport>;
    syncQueue!: Table<SyncTask>;
    kantaParchi!: Table<KantaParchi>;
    manufacturingCosting!: Table<ManufacturingCostingData>; // Added
    incomeCategories!: Table<IncomeCategory>;
    expenseCategories!: Table<ExpenseCategory>;
    customerDocuments!: Table<CustomerDocument>; // Added
    accounts!: Table<Account>; // Added
    inventoryAddEntries!: Table<InventoryAddEntry>;

    constructor(dbName?: string) {
        super(dbName || 'bizsuiteDB_v2');
        this.version(1).stores({
            suppliers: '&id, &srNo, name, contact, date, customerId',
            customers: '++id, &srNo, name, contact, date, customerId',
            payments: '++id, paymentId, customerId, date',
            customerPayments: '++id, paymentId, customerId, date',
            transactions: '++id, transactionId, date, category, subCategory, type',
            options: '++id, type, name',
            banks: '&id, name',
            bankBranches: '++id, &ifscCode, bankName, branchName',
            bankAccounts: '++id, &accountNumber',
            settings: '&id',
            projects: '++id, name, startDate',
            loans: '++id, loanId, startDate',
            fundTransactions: '++id, date, type',
            employees: '++id, employeeId, name',
            payroll: '++id, employeeId, payPeriod',
            attendance: '&id, employeeId, date', 
            inventoryItems: '++id, sku, name',
            mandiReports: '&id, voucherNo, sellerName',
        });

        this.version(2).stores({
            suppliers: '&id, &srNo, name, contact, date, customerId',
            customers: '++id, &srNo, name, contact, date, customerId',
            payments: '++id, paymentId, customerId, date',
            customerPayments: '++id, paymentId, customerId, date',
            transactions: '++id, transactionId, date, category, subCategory, type',
            options: '++id, type, name',
            banks: '&id, name',
            bankBranches: '++id, &ifscCode, bankName, branchName',
            bankAccounts: '++id, &accountNumber',
            settings: '&id',
            projects: '++id, name, startDate',
            loans: '++id, loanId, startDate',
            fundTransactions: '++id, date, type',
            employees: '++id, employeeId, name',
            payroll: '++id, employeeId, payPeriod',
            attendance: '&id, employeeId, date', 
            inventoryItems: '++id, sku, name',
            ledgerAccounts: '&id, name',
            ledgerEntries: '&id, accountId, date',
            mandiReports: '&id, voucherNo, sellerName',
        });

        this.version(3).stores({
            suppliers: '&id, &srNo, name, contact, date, customerId',
            customers: '++id, &srNo, name, contact, date, customerId',
            payments: '++id, paymentId, customerId, date',
            customerPayments: '++id, paymentId, customerId, date',
            transactions: '++id, transactionId, date, category, subCategory, type',
            options: '++id, type, name',
            banks: '&id, name',
            bankBranches: '++id, &ifscCode, bankName, branchName',
            bankAccounts: '++id, &accountNumber',
            settings: '&id',
            projects: '++id, name, startDate',
            loans: '++id, loanId, startDate',
            fundTransactions: '++id, date, type',
            employees: '++id, employeeId, name',
            payroll: '++id, employeeId, payPeriod',
            attendance: '&id, employeeId, date', 
            inventoryItems: '++id, sku, name',
            ledgerAccounts: '&id, name',
            ledgerEntries: '&id, accountId, date',
            mandiReports: '&id, voucherNo, sellerName, purchaseDate',
            syncQueue: '++id, status, nextRetryAt, dedupeKey, type',
        });

        this.version(4).stores({
            suppliers: '&id, &srNo, name, contact, date, customerId',
            customers: '++id, &srNo, name, contact, date, customerId',
            payments: '++id, paymentId, customerId, date',
            customerPayments: '++id, paymentId, customerId, date',
            governmentFinalizedPayments: '++id, paymentId, customerId, date',
            transactions: '++id, transactionId, date, category, subCategory, type',
            options: '++id, type, name',
            banks: '&id, name',
            bankBranches: '++id, &ifscCode, bankName, branchName',
            bankAccounts: '++id, &accountNumber',
            settings: '&id',
            projects: '++id, name, startDate',
            loans: '++id, loanId, startDate',
            fundTransactions: '++id, date, type',
            employees: '++id, employeeId, name',
            payroll: '++id, employeeId, payPeriod',
            attendance: '&id, employeeId, date', 
            inventoryItems: '++id, sku, name',
            ledgerAccounts: '&id, name',
            ledgerEntries: '&id, accountId, date',
            mandiReports: '&id, voucherNo, sellerName, purchaseDate',
            syncQueue: '++id, status, nextRetryAt, dedupeKey, type',
        });

        this.version(5).stores({
            suppliers: '&id, &srNo, name, contact, date, customerId',
            customers: '++id, &srNo, name, contact, date, customerId',
            payments: '++id, paymentId, customerId, date',
            customerPayments: '++id, paymentId, customerId, date',
            governmentFinalizedPayments: '++id, paymentId, customerId, date',
            transactions: '++id, transactionId, date, category, subCategory, type',
            options: '++id, type, name',
            banks: '&id, name',
            bankBranches: '++id, &ifscCode, bankName, branchName',
            bankAccounts: '++id, &accountNumber',
            settings: '&id',
            projects: '++id, name, startDate',
            loans: '++id, loanId, startDate, date, srNo',
            fundTransactions: '++id, date, type',
            employees: '++id, employeeId, name',
            payroll: '++id, employeeId, payPeriod',
            attendance: '&id, employeeId, date', 
            inventoryItems: '++id, sku, name',
            ledgerAccounts: '&id, name, date, srNo',
            ledgerEntries: '&id, accountId, date',
            mandiReports: '&id, voucherNo, sellerName, purchaseDate',
            syncQueue: '++id, status, nextRetryAt, dedupeKey, type',
        });

        this.version(6).stores({
            suppliers: '&id, &srNo, name, contact, date, customerId',
            customers: '++id, &srNo, name, contact, date, customerId',
            payments: '++id, paymentId, customerId, date',
            customerPayments: '++id, paymentId, customerId, date',
            governmentFinalizedPayments: '++id, paymentId, customerId, date',
            transactions: '++id, transactionId, date, category, subCategory, type',
            options: '++id, type, name',
            banks: '&id, name',
            bankBranches: '++id, &ifscCode, bankName, branchName',
            bankAccounts: '++id, &accountNumber',
            settings: '&id',
            projects: '++id, name, startDate',
            loans: '++id, loanId, startDate, date, srNo',
            fundTransactions: '++id, date, type',
            employees: '++id, employeeId, name',
            payroll: '++id, employeeId, payPeriod',
            attendance: '&id, employeeId, date', 
            inventoryItems: '++id, sku, name',
            ledgerAccounts: '&id, name, date, srNo',
            ledgerEntries: '&id, accountId, date',
            mandiReports: '&id, voucherNo, sellerName, purchaseDate',
            syncQueue: '++id, status, nextRetryAt, dedupeKey, type',
            kantaParchi: '&id, srNo, date',
        });

        this.version(7).stores({
            manufacturingCosting: '&id',
        });

        this.version(8).stores({
            incomeCategories: '&id, name',
            expenseCategories: '&id, name',
        });

        this.version(9).stores({
            customerDocuments: '&id, documentSrNo, kantaParchiSrNo, date',
        });

        this.version(10).stores({
            accounts: '&id, name',
        });

        this.version(11).stores({
            supplierBankAccounts: '&id, accountNumber',
        });

        this.version(12).stores({
            bankAccounts: null,
            bankBranches: null,
        });

        this.version(13).stores({
            bankAccounts: '&id, accountNumber',
            bankBranches: '&id, &ifscCode, bankName, branchName',
        });

        this.version(14).stores({
            payments: '++id, paymentId, customerId, date',
            customerPayments: '++id, paymentId, customerId, date',
            governmentFinalizedPayments: '++id, paymentId, customerId, date',
        });

        this.version(15).stores({
            inventoryAddEntries: '&id, date, variety',
        });
    }
}

// Per-company/tenant IndexedDB: each context gets its own DB so data stays local and we don't re-fetch from Firebase on next visit.
function getDbName(): string {
  const suffix = getStorageKeySuffix();
  // Bump name to force a clean IndexedDB when schema changes (SQLite is source of truth).
  return suffix ? `bizsuiteDB_v3_${suffix}` : 'bizsuiteDB_v3';
}

let dbInstance: AppDatabase | null = null;
let lastDbName = '';

export function getDb(): AppDatabase {
  if (typeof window === 'undefined') {
    throw new Error('Database is only available on the client');
  }
  const name = getDbName();
  if (dbInstance && lastDbName === name) return dbInstance;
  if (dbInstance) {
    const old = dbInstance;
    dbInstance = null;
    lastDbName = '';
    if (typeof setTimeout !== 'undefined') {
      setTimeout(() => { try { old.close(); } catch { /* ignore */ } }, 0);
    } else {
      try { old.close(); } catch { /* ignore */ }
    }
  }
  lastDbName = name;
  dbInstance = new AppDatabase(name);
  return dbInstance;
}

// Invalidate DB reference when company/tenant changes so next access opens the new context's DB.
// Do not close while folder load is in progress (avoids DatabaseClosedError). Defer close so in-flight ops can finish.
const DB_CLOSE_DEFER_MS = 2500;
let dbInUseByFolderLoad = false;
let pendingInvalidation = false;
let closeTimeoutId: ReturnType<typeof setTimeout> | null = null;

export function setDbInUseByFolderLoad(inUse: boolean): void {
  dbInUseByFolderLoad = inUse;
  if (!inUse && pendingInvalidation && typeof window !== 'undefined') {
    pendingInvalidation = false;
    scheduleDbClose();
  }
}

function runPendingDbClose(): void {
  if (dbInstance) {
    try { dbInstance.close(); } catch { /* ignore */ }
    dbInstance = null;
    lastDbName = '';
  }
  if (closeTimeoutId != null) {
    clearTimeout(closeTimeoutId);
    closeTimeoutId = null;
  }
}

function scheduleDbClose(): void {
  if (closeTimeoutId != null) clearTimeout(closeTimeoutId);
  closeTimeoutId = setTimeout(() => {
    closeTimeoutId = null;
    if (dbInUseByFolderLoad) {
      pendingInvalidation = true;
      return;
    }
    runPendingDbClose();
  }, DB_CLOSE_DEFER_MS);
}

if (typeof window !== 'undefined') {
  const invalidateDb = () => {
    if (dbInUseByFolderLoad) {
      pendingInvalidation = true;
      return;
    }
    scheduleDbClose();
  };
  window.addEventListener('erp:selection-changed', invalidateDb);
  window.addEventListener('tenant:changed', invalidateDb);
}

// SQLite only: source of truth. Dexie is cache; all writes mirror to SQLite.
const SQLITE_SYNC_TABLES = [
  'suppliers', 'customers', 'payments', 'customerPayments', 'governmentFinalizedPayments',
  'ledgerAccounts', 'ledgerEntries', 'banks', 'bankBranches', 'bankAccounts', 'supplierBankAccounts',
  'loans', 'fundTransactions', 'mandiReports', 'employees', 'payroll', 'attendance',
  'inventoryItems', 'inventoryAddEntries', 'kantaParchi', 'customerDocuments',
  'projects', 'options', 'settings', 'incomeCategories', 'expenseCategories', 'accounts',
  'manufacturingCosting', 'transactions',
];

function wrapTableForSqliteSync(table: unknown, tableName: string): unknown {
  if (!table || typeof table !== 'object') return table;
  const t = table as Record<string, unknown>;
  let sqlitePut: ((tn: string, r: Record<string, unknown>) => Promise<{ success: boolean }>) | null = null;
  let sqliteDelete: ((tn: string, id: string) => Promise<{ success: boolean }>) | null = null;
  let sqliteBulkPut: ((tn: string, rows: unknown[]) => Promise<{ success: boolean }>) | null = null;
  import('./sqlite-storage').then((m) => {
    sqlitePut = m.sqlitePut;
    sqliteDelete = m.sqliteDelete;
    sqliteBulkPut = m.sqliteBulkPut;
  });
  return new Proxy(table, {
    get(target, prop: string) {
      const orig = (target as Record<string, unknown>)[prop];
      if (prop === 'put' && typeof orig === 'function') {
        return async (row: unknown) => {
          const out = await (orig as (this: unknown, r: unknown) => Promise<unknown>).call(target, row);
          // During SQLite->Dexie load (folder switch / refresh), we must NOT mirror writes back to SQLite,
          // otherwise old Dexie state can leak into a newly selected empty DB.
          if (!dbInUseByFolderLoad && row && typeof row === 'object' && sqlitePut) {
            sqlitePut!(tableName, row as Record<string, unknown>).catch(() => {});
          }
          return out;
        };
      }
      if (prop === 'bulkPut' && typeof orig === 'function') {
        return async (rows: unknown) => {
          const arr = Array.isArray(rows) ? rows : [rows];
          const out = await (orig as (this: unknown, r: unknown[]) => Promise<unknown>).call(target, arr);
          if (!dbInUseByFolderLoad && sqliteBulkPut && arr.length) {
            sqliteBulkPut!(tableName, arr).catch(() => {});
          }
          return out;
        };
      }
      if (prop === 'delete' && typeof orig === 'function') {
        return async (key: unknown) => {
          const id = typeof key === 'string' ? key : (key && typeof key === 'object' && 'id' in key) ? String((key as { id: unknown }).id) : String(key);
          await (orig as (this: unknown, k: unknown) => Promise<void>).call(target, key);
          if (!dbInUseByFolderLoad && sqliteDelete) {
            sqliteDelete!(tableName, id).catch(() => {});
          }
        };
      }
      return typeof orig === 'function' ? orig.bind(target) : orig;
    },
  });
}

// Proxy: SQLite mode = mirror writes to SQLite.
const dbProxy = typeof window !== 'undefined'
  ? new Proxy({} as AppDatabase, {
      get(_, prop: string) {
        const target = getDb() as unknown as Record<string, unknown>;
        const value = target[prop];
        const tableLike = value && typeof value === 'object' && typeof (value as { put?: unknown }).put === 'function';
        const inSqliteMode = typeof window !== 'undefined' && localStorage.getItem('bizsuite:sqliteMode') === '1';
        if (inSqliteMode && SQLITE_SYNC_TABLES.includes(prop) && tableLike) {
          return wrapTableForSqliteSync(value, prop);
        }
        return value;
      },
    })
  : (undefined as unknown as AppDatabase);

// Export the db instance. Server gets undefined; client gets proxy to current context DB.
const db = dbProxy;
export { db };


// --- Synchronization Logic ---
// SQLite only: load from SQLite into Dexie.
let sqliteLoadInFlight: Promise<void> | null = null;
export async function syncAllData() {
    if (!db) return;
    const { isSqliteMode, loadFromSqliteToDexie } = await import('./sqlite-storage');
    if (!isSqliteMode()) return;
    if (sqliteLoadInFlight) return sqliteLoadInFlight;
    sqliteLoadInFlight = (async () => {
        try {
            await loadFromSqliteToDexie();
        } catch (e) {
            handleSilentError(e, 'syncAllData - loadFromSqliteToDexie');
        } finally {
            sqliteLoadInFlight = null;
        }
    })();
    return sqliteLoadInFlight;
}

// Sync collection info type
export interface SyncCollectionInfo {
  collectionName: string;
  displayName: string;
  totalInFirestore: number;
  fetched: number;
  sent: number;
  status: 'pending' | 'syncing' | 'success' | 'error';
  error?: string;
}

// Comprehensive sync function that returns detailed information
export async function syncAllDataWithDetails(
  selectedCollections?: string[],
  onProgress?: (collections: SyncCollectionInfo[]) => void
): Promise<SyncCollectionInfo[]> {
  if (!db) return [];

  // SQLite only
  const { isSqliteMode } = await import('./sqlite-storage');
  if (!isSqliteMode()) return [];
  const localOnlyConfigs = [
      { name: 'suppliers', displayName: 'Suppliers', localTable: () => db.suppliers },
      { name: 'customers', displayName: 'Customers', localTable: () => db.customers },
      { name: 'payments', displayName: 'Payments', localTable: () => db.payments },
      { name: 'customerPayments', displayName: 'Customer Payments', localTable: () => db.customerPayments },
      { name: 'banks', displayName: 'Banks', localTable: () => db.banks },
      { name: 'bankBranches', displayName: 'Bank Branches', localTable: () => db.bankBranches },
      { name: 'bankAccounts', displayName: 'Bank Accounts', localTable: () => db.bankAccounts },
      { name: 'supplierBankAccounts', displayName: 'Supplier Bank Accounts', localTable: () => db.supplierBankAccounts },
      { name: 'fundTransactions', displayName: 'Fund Transactions', localTable: () => db.fundTransactions },
      { name: 'projects', displayName: 'Projects', localTable: () => db.projects },
      { name: 'loans', displayName: 'Loans', localTable: () => db.loans },
      { name: 'mandiReports', displayName: 'Mandi Reports', localTable: () => db.mandiReports },
      { name: 'employees', displayName: 'Employees', localTable: () => db.employees },
      { name: 'payroll', displayName: 'Payroll', localTable: () => db.payroll },
      { name: 'attendance', displayName: 'Attendance', localTable: () => db.attendance },
      { name: 'inventoryItems', displayName: 'Inventory Items', localTable: () => db.inventoryItems },
      { name: 'ledgerAccounts', displayName: 'Ledger Accounts', localTable: () => db.ledgerAccounts },
      { name: 'ledgerEntries', displayName: 'Ledger Entries', localTable: () => db.ledgerEntries },
    ];
  const filter = selectedCollections
    ? (c: { name: string }) => selectedCollections.includes(c.name)
    : () => true;
  const configs = localOnlyConfigs.filter(filter);
  const collections: SyncCollectionInfo[] = [];
  for (const config of configs) {
    try {
      const table = config.localTable();
      const count = table ? await table.count().catch(() => 0) : 0;
      collections.push({
        collectionName: config.name,
        displayName: config.displayName,
        totalInFirestore: count,
        fetched: count,
        sent: count,
        status: 'success',
      });
      if (onProgress) onProgress([...collections]);
    } catch {
      collections.push({
        collectionName: config.name,
        displayName: config.displayName,
        totalInFirestore: 0,
        fetched: 0,
        sent: 0,
        status: 'error',
        error: 'Read failed',
      });
    }
  }
  return collections;
}

async function _syncAllDataWithDetailsFirestore(
  _selectedCollections?: string[],
  _onProgress?: (collections: SyncCollectionInfo[]) => void
): Promise<SyncCollectionInfo[]> {
  return [];
}

// Hard sync: reload from SQLite
export async function hardSyncAllData() {
    await syncAllData();
}

export async function ensureFirstFullSync() {
    if (typeof window === 'undefined') return;
    const suffix = getStorageKeySuffix();
    const flagKey = `firstFullSyncDone${suffix ? `_${suffix}` : ''}`;
    const flag = localStorage.getItem(flagKey);
    if (flag === 'true') return;
    await hardSyncAllData();
    localStorage.setItem(flagKey, 'true');
    localStorage.setItem(`firstFullSyncAt${suffix ? `_${suffix}` : ''}`, String(Date.now()));
}

export interface SyncCountRow {
    collection: string;
    indexeddb: number;
    firestore: number;
}

export async function getSyncCounts(): Promise<SyncCountRow[]> {
    if (!db) return [];
    const rows: SyncCountRow[] = [];
    const suppliersIndexed = await db.suppliers.count().catch(() => 0);
    const customersIndexed = await db.customers.count().catch(() => 0);
    const paymentsIndexed = await db.payments.count().catch(() => 0);
    const govPaymentsIndexed = await db.governmentFinalizedPayments.count().catch(() => 0);
    const customerPaymentsIndexed = await db.customerPayments.count().catch(() => 0);
    const incomesIndexed = await db.transactions.where('type').equals('Income').count().catch(() => 0);
    const expensesIndexed = await db.transactions.where('type').equals('Expense').count().catch(() => 0);
    const fundTransactionsIndexed = await db.fundTransactions.count().catch(() => 0);
    rows.push({ collection: 'suppliers', indexeddb: suppliersIndexed, firestore: 0 });
    rows.push({ collection: 'customers', indexeddb: customersIndexed, firestore: 0 });
    rows.push({ collection: 'payments', indexeddb: paymentsIndexed + govPaymentsIndexed, firestore: 0 });
    rows.push({ collection: 'customerPayments', indexeddb: customerPaymentsIndexed, firestore: 0 });
    rows.push({ collection: 'incomes', indexeddb: incomesIndexed, firestore: 0 });
    rows.push({ collection: 'expenses', indexeddb: expensesIndexed, firestore: 0 });
    rows.push({ collection: 'fundTransactions', indexeddb: fundTransactionsIndexed, firestore: 0 });
    return rows;
}


// --- Local DB Helper Functions ---
export async function updateSupplierInLocalDB(id: string, data: Partial<Customer>) {
    if (db) {
        await db.suppliers.update(id, data);
    }
}

export async function deletePaymentFromLocalDB(paymentId: string) {
    if (!db) return;
    await db.payments.delete(paymentId as any);
    await db.payments.where('paymentId').equals(paymentId).delete();
    await db.governmentFinalizedPayments.delete(paymentId as any);
    await db.governmentFinalizedPayments.where('paymentId').equals(paymentId).delete();
}


// Generic function to clear all data from all tables
export async function clearAllLocalData() {
    if (db) {
        await Promise.all(db.tables.map(table => table.clear()));
    }
}
