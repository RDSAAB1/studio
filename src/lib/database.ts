
import type { Account, Customer, CustomerDocument, CustomerPayment, ExpenseCategory, FundTransaction, Holiday, IncomeCategory, InventoryAddEntry, InventoryItem, KantaParchi, LedgerAccount, LedgerEntry, Loan, MandiReport, ManufacturingCostingData, OptionItem, PayrollEntry, Payment, Project, ReceiptSettings, ReceiptFieldSettings, RtgsSettings, SyncTask, Transaction, Bank, BankBranch, BankAccount, Employee, AttendanceEntry, FormatSettings, Income, Expense, LedgerCashAccount } from './definitions';
import { logError } from './error-logger';

// --- Global Event System for SQLite Change Notifications ---
const notifyChange = (tableName: string) => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sqlite-change', { detail: tableName }));
        window.dispatchEvent(new CustomEvent(`sqlite-change:${tableName}`));
        // Compatibility with GlobalDataProvider (Phase 2 refresh logic)
        window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: tableName } }));
    }
};

// --- SQLite Table Proxy ---
class SQLiteTable<T> {
  constructor(public tableName: string) {}

  async toArray(): Promise<T[]> {
    if (typeof window === 'undefined') return [];
    return window.electron.sqliteAll(this.tableName);
  }

  async get(id: string | number): Promise<T | undefined> {
    if (typeof window === 'undefined') return undefined;
    return window.electron.sqliteGet(this.tableName, String(id));
  }

  async put(item: T): Promise<string> {
    if (typeof window === 'undefined') return '';
    const res = await window.electron.sqlitePut(this.tableName, item as any);
    if (!res?.success) throw new Error(res?.error || 'SQLite put failed');
    notifyChange(this.tableName);
    return (item as any).id || '';
  }

  async bulkPut(items: T[]): Promise<string[]> {
    if (typeof window === 'undefined') return [];
    if (items.length === 0) return [];
    const res = await window.electron.sqliteBulkPut(this.tableName, items);
    if (!res?.success) throw new Error(res?.error || 'SQLite bulkPut failed');
    notifyChange(this.tableName);
    return items.map((i: any) => i.id);
  }

  async bulkDelete(ids: (string | number)[]): Promise<void> {
    if (typeof window === 'undefined') return;
    if (ids.length === 0) return;
    for (const id of ids) {
      await window.electron.sqliteDelete(this.tableName, String(id));
    }
    notifyChange(this.tableName);
  }

  async bulkUpdate(updates: { id?: string | number; key?: string | number; changes: Partial<T> }[]): Promise<number> {
    if (typeof window === 'undefined') return 0;
    let count = 0;
    for (const update of updates) {
      const id = update.id || update.key;
      if (!id) continue;
      const item = await this.get(id);
      if (item) {
        await this.put({ ...item, ...update.changes });
        count++;
      }
    }
    return count;
  }

  async delete(id: string | number): Promise<void> {
    if (typeof window === 'undefined') return;
    const res = await window.electron.sqliteDelete(this.tableName, String(id));
    if (!res?.success) throw new Error(res?.error || 'SQLite delete failed');
    notifyChange(this.tableName);
  }

  async update(id: string | number, changes: Partial<T>): Promise<number> {
    const item = await this.get(id);
    if (!item) return 0;
    await this.put({ ...item, ...changes });
    return 1;
  }

  async clear(): Promise<void> {
    console.warn(`Table.clear() called for ${this.tableName} - restricted in SQLite mode`);
  }

  async count(): Promise<number> {
    const all = await this.toArray();
    return all.length;
  }

  private createCollection(dataPromise: Promise<T[]>) {
    const table = this;
    return {
      toArray: () => dataPromise,
      first: async () => (await dataPromise)[0],
      count: async () => (await dataPromise).length,
      limit: (n: number) => this.createCollection(dataPromise.then(d => d.slice(0, n))),
      offset: (n: number) => this.createCollection(dataPromise.then(d => d.slice(n))),
      filter: (cb: (item: T) => boolean) => this.createCollection(dataPromise.then(d => d.filter(cb))),
      delete: async () => {
          const all = await dataPromise;
          for (const item of all) {
              await table.delete((item as any).id);
          }
      }
    };
  }

  where(field: string) {
    return {
      equals: (value: any) => this.createCollection(this.toArray().then(all => all.filter((item: any) => item[field] === value))),
      anyOf: (values: any[]) => {
          const set = new Set(values);
          return this.createCollection(this.toArray().then(all => all.filter((item: any) => set.has(item[field]))));
      },
      startsWith: (prefix: string) => this.createCollection(this.toArray().then(all => all.filter((item: any) => String(item[field]).startsWith(prefix))))
    };
  }

  filter(cb: (item: T) => boolean) {
      return this.createCollection(this.toArray().then(all => all.filter(cb)));
  }

  orderBy(field: string) {
      const data = this.toArray().then(all => all.sort((a: any, b: any) => (String(a[field]) > String(b[field]) ? 1 : -1)));
      return {
          ...this.createCollection(data),
          reverse: () => this.createCollection(data.then(all => [...all].reverse()))
      };
  }
}


// --- SQLite Database Mock ---
export class AppDatabase {
    suppliers = new SQLiteTable<Customer>('suppliers');
    customers = new SQLiteTable<Customer>('customers');
    payments = new SQLiteTable<Payment>('payments');
    customerPayments = new SQLiteTable<CustomerPayment>('customerPayments');
    governmentFinalizedPayments = new SQLiteTable<Payment>('governmentFinalizedPayments');
    transactions = new SQLiteTable<Transaction>('transactions');
    options = new SQLiteTable<OptionItem>('options');
    banks = new SQLiteTable<Bank>('banks');
    bankBranches = new SQLiteTable<BankBranch>('bankBranches');
    bankAccounts = new SQLiteTable<BankAccount>('bankAccounts');
    supplierBankAccounts = new SQLiteTable<BankAccount>('supplierBankAccounts');
    settings = new SQLiteTable<RtgsSettings | ReceiptSettings | FormatSettings | Holiday>('settings');
    projects = new SQLiteTable<Project>('projects');
    loans = new SQLiteTable<Loan>('loans');
    fundTransactions = new SQLiteTable<FundTransaction>('fundTransactions');
    employees = new SQLiteTable<Employee>('employees');
    payroll = new SQLiteTable<PayrollEntry>('payroll');
    attendance = new SQLiteTable<AttendanceEntry>('attendance');
    inventoryItems = new SQLiteTable<InventoryItem>('inventoryItems');
    ledgerAccounts = new SQLiteTable<LedgerAccount>('ledgerAccounts');
    ledgerEntries = new SQLiteTable<LedgerEntry>('ledgerEntries');
    mandiReports = new SQLiteTable<MandiReport>('mandiReports');
    kantaParchi = new SQLiteTable<KantaParchi>('kantaParchi');
    manufacturingCosting = new SQLiteTable<ManufacturingCostingData>('manufacturingCosting');
    incomeCategories = new SQLiteTable<IncomeCategory>('incomeCategories');
    expenseCategories = new SQLiteTable<ExpenseCategory>('expenseCategories');
    customerDocuments = new SQLiteTable<CustomerDocument>('customerDocuments');
    accounts = new SQLiteTable<Account>('accounts');
    inventoryAddEntries = new SQLiteTable<InventoryAddEntry>('inventoryAddEntries');
    incomes = new SQLiteTable<Income>('incomes');
    expenses = new SQLiteTable<Expense>('expenses');
    expenseTemplates = new SQLiteTable<any>('expenseTemplates');
    ledgerCashAccounts = new SQLiteTable<LedgerCashAccount>('ledgerCashAccounts');

    // Dexie boilerplate mocks
    transaction(mode: string, ...args: any[]) { const cb = args.pop(); return cb(); }
    close() {}
    table(name: string) { return (this as any)[name]; }
    get tables() { return Object.keys(this).filter(k => (this as any)[k] instanceof SQLiteTable).map(k => (this as any)[k]); }
}

const db = new AppDatabase();
export { db };

export function getDb(): AppDatabase {
    return db;
}

// --- Helper Functions (Updated for SQLite Only) ---

const DEFAULT_RECEIPT_FIELDS: ReceiptFieldSettings = {
  date: true, name: true, contact: true, address: true, vehicleNo: true, term: true, rate: true,
  grossWeight: true, teirWeight: true, weight: true, amount: true, dueDate: true, kartaWeight: true,
  netAmount: true, srNo: true, variety: true, netWeight: true,
};

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

// Dummy sync functions to avoid breaking imports
export async function syncAllData() { return Promise.resolve(); }
export async function hardSyncAllData() { return Promise.resolve(); }
export async function ensureFirstFullSync() { return Promise.resolve(); }
export function setDbInUseByFolderLoad(inUse: boolean) { /* no-op */ }

export async function getSyncCounts(): Promise<any[]> {
    const rows = [];
    const tables = ['suppliers', 'customers', 'payments', 'customerPayments', 'banks', 'employees'];
    for (const t of tables) {
        const count = await (db as any)[t].count().catch(() => 0);
        rows.push({ collection: t, indexeddb: count, firestore: 0 });
    }
    return rows;
}

export async function clearAllLocalData() {
    console.warn("clearAllLocalData restricted in SQLite mode");
}
