import type { Account, Customer, CustomerDocument, CustomerPayment, ExpenseCategory, FundTransaction, Holiday, IncomeCategory, InventoryAddEntry, InventoryItem, KantaParchi, LedgerAccount, LedgerEntry, Loan, MandiReport, ManufacturingCostingData, OptionItem, PayrollEntry, Payment, Project, ReceiptSettings, ReceiptFieldSettings, RtgsSettings, SyncTask, Transaction, Bank, BankBranch, BankAccount, Employee, AttendanceEntry, FormatSettings, Income, Expense, LedgerCashAccount } from './definitions';
import { getErpSelection } from '@/lib/tenancy';
import { logError } from './error-logger';
import Dexie, { type Table } from 'dexie';

// --- Global Event System for SQLite Change Notifications ---
let syncTimeout: any = null;
let uiNotifyTimeout: any = null;
const pendingUiTables = new Set<string>();

// --- Cross-Tab Sync via BroadcastChannel ---
const syncChannel = typeof window !== 'undefined' ? new BroadcastChannel('bizsuite_db_sync') : null;

if (syncChannel) {
    syncChannel.onmessage = (event) => {
        const { tableName, source } = event.data;
        // Trigger local events to refresh UI components
        notifyChange(tableName, 'external');
    };
}

export const notifyChange = (tableName: string, source?: string) => {
  if (typeof window !== 'undefined') {
    // 1. Dispatch granular event immediately for specific hooks
    window.dispatchEvent(new CustomEvent(`sqlite-change:${tableName}`, {
        detail: { source: source || 'internal' }
    }));

    // 2. Queue global UI refresh (debounced to prevent lag)
    pendingUiTables.add(tableName);
    if (uiNotifyTimeout) clearTimeout(uiNotifyTimeout);
    uiNotifyTimeout = setTimeout(() => {
        const tables = Array.from(pendingUiTables);
        pendingUiTables.clear();
        
        // Dispatch global event for listeners like useLiveQuery
        // We ALWAYS provide an object now to ensure 'source' metadata is never lost.
        const detail = { tables, source: source || 'internal' };
        
        window.dispatchEvent(new CustomEvent('sqlite-change', { detail }));
        
        // Compatibility with GlobalDataProvider
        tables.forEach(t => {
            window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { 
                detail: { collection: t, source: source || 'internal' } 
            }));
            
            // Legacy compatibility: dispatch individual table change events as strings too
            if (t !== 'all') {
                window.dispatchEvent(new CustomEvent('sqlite-change', { 
                    detail: { table: t, source: source || 'internal' } 
                }));
            }
        });
    }, 100); 
    
    // 3. Notify other tabs immediately via BroadcastChannel
    if (syncChannel && source !== 'external' && source !== 'sync' && tableName !== '_sync_log') {
        syncChannel.postMessage({ tableName, source: source || 'internal' });
    }

    // Special case: if transactions change, notify incomes and expenses too
    if (tableName === 'transactions') {
       notifyChange('incomes', source);
       notifyChange('expenses', source);
    }

    // Note: Post-Operation Sync Trigger removed. 
    // d1-sync.ts now listens to 'sqlite-change' directly for internal updates.
  }
};

/**
 * HELPER: Log a change for the D1 Sync engine (Web-only)
 * In Electron, this is handled by SQLite triggers. In Web, we must do it manually.
 */
export const logSyncChange = async (table: string, id: string, operation: 'upsert' | 'delete', data?: any) => {
    if (!isElectron && dexieDb && table !== '_sync_log' && table !== '_sync_meta') {
        try {
            await (dexieDb as any)._sync_log.put({
                id: `${table}:${id}`,
                collection: table,
                docId: id,
                operation: operation,
                data: operation === 'upsert' ? data : null,
                timestamp: Date.now()
            });
        } catch (e) {
            console.error('[Database] Failed to log sync change:', e);
        }
    }
};

const isElectron = typeof window !== 'undefined' && (window as any).electron !== undefined;

// --- Dexie (IndexedDB) Instance for Web Fallback ---
class AppDexie extends Dexie {
  constructor() {
    super('BizSuiteDB');
    
    // Define schema for all tables
    // Note: SQLite uses 'id' as primary key for everything.
    const schema: Record<string, string> = {};
    const tables = [
      'suppliers', 'customers', 'payments', 'customerPayments', 'governmentFinalizedPayments',
      'transactions', 'options', 'banks', 'bankBranches', 'bankAccounts', 'supplierBankAccounts',
      'settings', 'projects', 'loans', 'fundTransactions', 'employees', 'payroll', 'attendance',
      'inventoryItems', 'ledgerAccounts', 'ledgerEntries', 'mandiReports', 'kantaParchi',
      'manufacturingCosting', 'incomeCategories', 'expenseCategories', 'customerDocuments',
      'accounts', 'inventoryAddEntries', 'incomes', 'expenses', 'expenseTemplates', 'ledgerCashAccounts',
      '_sync_log', '_sync_meta'
    ];
    
    // Upgrade schema to version 4 for contact indexing
    const commonIndexes = 'id, contact, srNo, paymentId, date, type, categoryId, subCompanyId, year';
    tables.forEach(table => {
      if (table === '_sync_log') {
        schema[table] = 'id, [collection+docId], operation, timestamp';
      } else if (table === '_sync_meta') {
        schema[table] = 'id, last_sync_timestamp';
      } else {
        schema[table] = commonIndexes;
      }
    });
    
    this.version(6).stores(schema);
    
    // Handle database blocking (multi-tab upgrade issues)
    this.on('blocked', () => {
        console.error('[Database] Upgrade BLOCKED. Please close all other tabs of this app!');
        if (typeof window !== 'undefined') {
            alert('Database upgrade is blocked by another tab. Please close all other tabs of this app (3000 and 3001) for saving to work.');
        }
    });

    this.on('versionchange', (event) => {
        console.warn('[Database] Database version changed in another tab. Reloading...');
        if (typeof window !== 'undefined') {
            window.location.reload();
        }
    });
  }
}

const dexieDb = typeof window !== 'undefined' ? new AppDexie() : null;

// --- Hybrid Table Proxy (SQLite or Dexie) ---
class HybridTable<T> {
  private dexieTable: Table<T, string> | null = null;

  constructor(public tableName: string) { 
    if (dexieDb) {
      this.dexieTable = (dexieDb as any)[tableName] as Table<T, string>;
    }
  }

  async toArray(): Promise<T[]> {
    if (typeof window === 'undefined') return [];
    if (isElectron) return (window as any).electron.sqliteAll(this.tableName);
    return this.dexieTable ? this.dexieTable.toArray() : [];
  }

  async count(): Promise<number> {
    if (typeof window === 'undefined') return 0;
    if (isElectron) return (window as any).electron.sqliteCount(this.tableName);
    return this.dexieTable ? this.dexieTable.count() : 0;
  }

  async get(id: string | number): Promise<T | undefined> {
    if (typeof window === 'undefined') return undefined;
    if (isElectron) return (window as any).electron.sqliteGet(this.tableName, String(id));
    return this.dexieTable ? this.dexieTable.get(String(id)) : undefined;
  }

  async put(item: T, source?: string): Promise<string> {
    if (typeof window === 'undefined') return '';
    
    // Ensure the item has an ID before saving
    if (!(item as any).id) {
        (item as any).id = String(Date.now());
    }

    // NEW: Auto-Tenancy Injection for internal saves
    if (source !== 'sync' && !this.tableName.startsWith('_')) {
        const erp = getErpSelection();
        if (erp) {
            if (!(item as any)._company_id) (item as any)._company_id = erp.companyId;
            if (!(item as any)._sub_company_id) (item as any)._sub_company_id = erp.subCompanyId;
            if (!(item as any)._year) (item as any)._year = erp.seasonKey;
        }
    }

    const id = (item as any).id;
    
    try {
        if (isElectron) {
            const options = { skipLog: source === 'sync' };
            const res = await (window as any).electron.sqlitePut(this.tableName, item as any, options);
            if (!res?.success) throw new Error(res?.error || 'SQLite put failed');
        } else if (this.dexieTable) {
            await this.dexieTable.put(item);
            // MANUALLY Log change for D1 Sync (Web only)
            if (source !== 'sync') await logSyncChange(this.tableName, id, 'upsert', item);
        }
        
        notifyChange(this.tableName, source);
        console.log(`[Database] Saved to ${this.tableName}:`, id);
        return id;
    } catch (error: any) {
        console.error(`[Database] Error saving to ${this.tableName}:`, error);
        throw error;
    }
  }

  async bulkPut(items: T[], source?: string): Promise<string[]> {
    if (typeof window === 'undefined') return [];
    if (items.length === 0) return [];

    // Ensure all items have IDs and Tenancy
    const erp = source !== 'sync' && !this.tableName.startsWith('_') ? getErpSelection() : null;
    
    items.forEach((item: any) => {
        // Special case: _sync_log does NOT have an 'id' column in SQLite schema
        if (!item.id && this.tableName !== '_sync_log') {
            item.id = String(Math.random().toString(36).substr(2, 9));
        }
        
        if (erp) {
            if (!item._company_id) item._company_id = erp.companyId;
            if (!item._sub_company_id) item._sub_company_id = erp.subCompanyId;
            if (!item._year) item._year = erp.seasonKey;
        }
    });
    
    try {
        if (isElectron) {
            const options = { skipLog: source === 'sync' };
            if (this.tableName === '_sync_log') {
                console.log(`[Database] Manual Sync Log Push:`, items);
            }
            const res = await (window as any).electron.sqliteBulkPut(this.tableName, items, options);
            if (!res?.success) {
                console.error(`[Database] SQLite bulkPut FAILED for ${this.tableName}:`, res?.error, items[0]);
                throw new Error(res?.error || 'SQLite bulkPut failed');
            }
        } else if (this.dexieTable) {
            await this.dexieTable.bulkPut(items);
            // MANUALLY Log changes for D1 Sync (Web only)
            if (source !== 'sync') {
                for (const item of items) {
                    await logSyncChange(this.tableName, (item as any).id, 'upsert', item);
                }
            }
        }
        
        notifyChange(this.tableName, source);
        return items.map((i: any) => i.id);
    } catch (error: any) {
        console.error(`[Database] Error in bulkPut for ${this.tableName}:`, error);
        throw error;
    }
  }

  async bulkDelete(ids: (string | number)[], source?: string): Promise<void> {
    if (typeof window === 'undefined') return;
    if (ids.length === 0) return;
    
    const stringIds = ids.map(id => String(id).trim()).filter(Boolean);
    if (stringIds.length === 0) return;

    try {
        if (isElectron) {
            const options = { skipLog: source === 'sync' };
            const res = await (window as any).electron.sqliteBulkDelete(this.tableName, stringIds, options);
            if (!res?.success) throw new Error(res?.error || 'SQLite bulkDelete failed');
        } else if (this.dexieTable) {
            await this.dexieTable.bulkDelete(stringIds);
            // MANUALLY Log deletions for D1 Sync (Web only)
            if (source !== 'sync') {
                for (const id of stringIds) {
                    await logSyncChange(this.tableName, id, 'delete');
                }
            }
        }
        
        notifyChange(this.tableName, source);
    } catch (error: any) {
        console.error(`[Database] Error in bulkDelete for ${this.tableName}:`, error);
        throw error;
    }
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
    const trimmedId = String(id).trim();
    if (!trimmedId) return;

    if (isElectron) {
      const res = await (window as any).electron.sqliteDelete(this.tableName, trimmedId);
      if (!res?.success) throw new Error(res?.error || 'SQLite delete failed');
    } else if (this.dexieTable) {
      // Using a transaction to ensure both delete and log happen together
      await dexieDb?.transaction('rw', [this.tableName, '_sync_log'], async () => {
        await this.dexieTable?.delete(trimmedId);
        await logSyncChange(this.tableName, trimmedId, 'delete');
      });
    }
    
    notifyChange(this.tableName);
  }

  async update(id: string | number, changes: Partial<T>): Promise<number> {
    const item = await this.get(id);
    if (!item) return 0;
    await this.put({ ...item, ...changes });
    return 1;
  }

  async clear(): Promise<void> {
    if (isElectron) {
      console.warn(`Table.clear() called for ${this.tableName} - restricted in SQLite mode`);
    } else if (this.dexieTable) {
      await this.dexieTable.clear();
    }
  }

  limit(n: number) {
    return this.createCollection(this.toArray()).limit(n);
  }

  offset(n: number) {
    return this.createCollection(this.toArray()).offset(n);
  }

  private createCollection(dataPromise: Promise<T[]>, queryOptions: any = {}) {
    const table = this;
    return {
      toArray: () => dataPromise,
      first: async () => (await dataPromise)[0],
      count: async () => (await dataPromise).length, // Note: this counts the filtered/sliced result
      limit: (n: number) => {
        const newOptions = { ...queryOptions, limit: n };
        if (isElectron) {
          return this.createCollection((window as any).electron.sqliteQuery(this.tableName, newOptions), newOptions);
        }
        return this.createCollection(dataPromise.then(d => d.slice(0, n)), newOptions);
      },
      offset: (n: number) => {
        const newOptions = { ...queryOptions, offset: n };
        if (isElectron) {
          return this.createCollection((window as any).electron.sqliteQuery(this.tableName, newOptions), newOptions);
        }
        return this.createCollection(dataPromise.then(d => d.slice(n)), newOptions);
      },
      orderBy: (field: string) => {
        // Simple client-side sort for Dexie fallback, SQL handles it via queryOptions
        const newOptions = { ...queryOptions, orderBy: field };
        if (isElectron) {
           return this.createCollection((window as any).electron.sqliteQuery(this.tableName, newOptions), newOptions);
        }
        return this.createCollection(dataPromise.then(d => {
           return [...d].sort((a: any, b: any) => (a[field] > b[field] ? 1 : -1));
        }), newOptions);
      },
      filter: (cb: (item: T) => boolean) => this.createCollection(dataPromise.then(d => d.filter(cb)), queryOptions),
      delete: async () => {
        const all = await dataPromise;
        if (all.length > 0) {
          const ids = all.map((item: any) => (item as any).id).filter(Boolean);
          await table.bulkDelete(ids);
        }
      }
    };
  }

  where(field: string) {
    return {
      equals: (value: any) => {
        const queryOptions = { where: { [field]: value } };
        if (isElectron) {
          return this.createCollection((window as any).electron.sqliteQuery(this.tableName, queryOptions), queryOptions);
        }
        // Dexie fallback
        return this.createCollection(
          this.dexieTable ? this.dexieTable.where(field).equals(value).toArray() : Promise.resolve([])
        );
      },
      anyOf: (values: any[]) => {
        if (isElectron) {
           return this.createCollection(this.toArray().then(all => {
             const set = new Set(values);
             return all.filter((item: any) => set.has(item[field]));
           }));
        }
        return this.createCollection(
          this.dexieTable ? this.dexieTable.where(field).anyOf(values).toArray() : Promise.resolve([])
        );
      },
      startsWith: (prefix: string) => {
        if (isElectron) {
          return this.createCollection(this.toArray().then(all =>
            all.filter((item: any) => String(item[field]).startsWith(prefix))
          ));
        }
        return this.createCollection(
          this.dexieTable ? this.dexieTable.where(field).startsWith(prefix).toArray() : Promise.resolve([])
        );
      }
    };
  }

  orderBy(field: string) {
    const queryOptions = { orderBy: field };
    if (isElectron) {
      return {
        ...this.createCollection((window as any).electron.sqliteQuery(this.tableName, queryOptions), queryOptions),
        reverse: () => {
          const revOptions = { ...queryOptions, reverse: true };
          return this.createCollection((window as any).electron.sqliteQuery(this.tableName, revOptions), revOptions);
        }
      };
    }
    // Dexie fallback
    const promise = this.dexieTable ? this.dexieTable.orderBy(field).toArray() : Promise.resolve([]);
    return {
      ...this.createCollection(promise, queryOptions),
      reverse: () => {
        const revPromise = this.dexieTable ? this.dexieTable.orderBy(field).reverse().toArray() : Promise.resolve([]);
        return this.createCollection(revPromise, { ...queryOptions, reverse: true });
      }
    };
  }
}


// --- SQLite Database Mock ---
export class AppDatabase {
  suppliers = new HybridTable<Customer>('suppliers');
  customers = new HybridTable<Customer>('customers');
  payments = new HybridTable<Payment>('payments');
  customerPayments = new HybridTable<CustomerPayment>('customerPayments');
  governmentFinalizedPayments = new HybridTable<Payment>('governmentFinalizedPayments');
  transactions = new HybridTable<Transaction>('transactions');
  options = new HybridTable<OptionItem>('options');
  banks = new HybridTable<Bank>('banks');
  bankBranches = new HybridTable<BankBranch>('bankBranches');
  bankAccounts = new HybridTable<BankAccount>('bankAccounts');
  supplierBankAccounts = new HybridTable<BankAccount>('supplierBankAccounts');
  settings = new HybridTable<RtgsSettings | ReceiptSettings | FormatSettings | Holiday>('settings');
  projects = new HybridTable<Project>('projects');
  loans = new HybridTable<Loan>('loans');
  fundTransactions = new HybridTable<FundTransaction>('fundTransactions');
  employees = new HybridTable<Employee>('employees');
  payroll = new HybridTable<PayrollEntry>('payroll');
  attendance = new HybridTable<AttendanceEntry>('attendance');
  inventoryItems = new HybridTable<InventoryItem>('inventoryItems');
  ledgerAccounts = new HybridTable<LedgerAccount>('ledgerAccounts');
  ledgerEntries = new HybridTable<LedgerEntry>('ledgerEntries');
  mandiReports = new HybridTable<MandiReport>('mandiReports');
  kantaParchi = new HybridTable<KantaParchi>('kantaParchi');
  manufacturingCosting = new HybridTable<ManufacturingCostingData>('manufacturingCosting');
  incomeCategories = new HybridTable<IncomeCategory>('incomeCategories');
  expenseCategories = new HybridTable<ExpenseCategory>('expenseCategories');
  customerDocuments = new HybridTable<CustomerDocument>('customerDocuments');
  accounts = new HybridTable<Account>('accounts');
  inventoryAddEntries = new HybridTable<InventoryAddEntry>('inventoryAddEntries');
  incomes = new HybridTable<Income>('incomes');
  expenses = new HybridTable<Expense>('expenses');
  expenseTemplates = new HybridTable<any>('expenseTemplates');
  ledgerCashAccounts = new HybridTable<LedgerCashAccount>('ledgerCashAccounts');
  _sync_log = new HybridTable<any>('_sync_log');
  _sync_meta = new HybridTable<any>('_sync_meta');

  // Dexie boilerplate mocks
  transaction(mode: string, ...args: any[]) { const cb = args.pop(); return cb(); }
  close() { }
  table(name: string) { return (this as any)[name]; }
  get tables() { return Object.keys(this).filter(k => (this as any)[k] instanceof HybridTable).map(k => (this as any)[k]); }
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

    // Base defaults
    const baseSettings: ReceiptSettings = {
      companyName: data?.companyName || 'JAGDAMBE RICE MILL',
      companyAddress1: data?.companyAddress1 || 'Devkali Road, Banda, Shajahanpur',
      companyAddress2: data?.companyAddress2 || 'Near Devkali, Uttar Pradesh',
      contactNo: data?.contactNo || '9555130735',
      gmail: data?.gmail || 'JRMDofficial@gmail.com',
      fields: { ...DEFAULT_RECEIPT_FIELDS, ...(data?.fields || {}) },
      companyGstin: data?.companyGstin || '',
      companyStateName: data?.companyStateName || '',
      companyStateCode: data?.companyStateCode || '',
      panNo: data?.panNo || '',
      defaultBankAccountId: data?.defaultBankAccountId,
      bankHeaderLine1: data?.bankHeaderLine1 || '',
      bankHeaderLine2: data?.bankHeaderLine2 || '',
      bankHeaderLine3: data?.bankHeaderLine3 || '',
    };

    if (data?.defaultBankAccountId) {
      const acc = await d.bankAccounts.get(data.defaultBankAccountId);
      if (acc) {
        baseSettings.defaultBank = acc as BankAccount;
      }
    }

    return baseSettings;
  } catch (err) {
    console.error('[SQLite] Failed to load receipt settings:', err);
    return null;
  }
}

// Real sync functions for SQLite mode (manually trigger UI-wide refresh)
export async function syncAllData() {
  notifyChange('all');
  return Promise.resolve();
}
export async function hardSyncAllData() {
  notifyChange('all');
  return Promise.resolve();
}
export async function ensureFirstFullSync() { return Promise.resolve(); }
export function setDbInUseByFolderLoad(inUse: boolean) { /* no-op */ }

export async function getSyncCounts(): Promise<any[]> {
  const rows = [];
  const tables = [
    'suppliers', 'customers', 'payments', 'customerPayments', 'banks', 'employees',
    'incomeCategories', 'expenseCategories', 'incomes', 'expenses'
  ];
  for (const t of tables) {
    const count = await (db as any)[t].count().catch(() => 0);
    rows.push({ collection: t, indexeddb: count, firestore: 0 });
  }
  return rows;
}

export async function clearAllLocalData(mode: 'UNIT' | 'SEASON' = 'UNIT') {
  if (isElectron) {
    try {
      console.log(`[Database] Clearing local tables for ${mode} switch...`);
      const res = await (window as any).electron.sqliteClearAllTables({
        mode,
        keep: ['_sync_log'] // Always keep pending changes to prevent data loss
      });
      if (!res?.success) throw new Error(res?.error || 'Failed to clear tables');
      notifyChange('all');
    } catch (e) {
      console.error("[Database] Reset failed:", e);
      throw e;
    }
  } else if (dexieDb) {
    // For Web fallback (Dexie): Mirror the Electron behavior
    try {
      console.log(`[Database:Web] Clearing local tables for ${mode} switch...`);
      
      const tablesToClear = mode === 'SEASON' 
        ? ['payments', 'customerPayments', 'governmentFinalizedPayments', 'ledgerEntries', 
           'ledgerCashAccounts', 'incomes', 'expenses', 'transactions', 'fundTransactions',
           'mandiReports', 'payroll', 'attendance', 'inventoryAddEntries', 'kantaParchi', 
           'customerDocuments', 'manufacturingCosting', 'suppliers', 'customers']
        : dexieDb.tables.filter(t => !['_sync_log', 'companies'].includes(t.name)).map(t => t.name);

      await dexieDb.transaction('rw', [...tablesToClear, '_sync_meta'], async () => {
        await Promise.all(tablesToClear.map(t => dexieDb.table(t).clear()));
        
        if (mode === 'UNIT') {
          await dexieDb.table('_sync_meta').clear();
        } else if (mode === 'SEASON') {
            // For SEASON mode, also clear the sync metadata for the tables we just wiped
            // so that when we switch back to this season (or another), it re-pulls from 0.
            const erp = getErpSelection();
            if (erp?.seasonKey) {
                for (const t of tablesToClear) {
                    const scopedMetaId = `${t}:${erp.companyId}:${erp.subCompanyId}:${erp.seasonKey}`;
                    await dexieDb.table('_sync_meta').delete(scopedMetaId);
                }
            } else {
                // Fallback: clear all metadata for these tables if we don't have a season key
                for (const t of tablesToClear) {
                    await dexieDb.table('_sync_meta').where('id').startsWith(`${t}:`).delete();
                }
            }
        }
      });
      
      notifyChange('all');
    } catch (e) {
      console.error("[Database:Web] Reset failed:", e);
      throw e;
    }
  }
}
