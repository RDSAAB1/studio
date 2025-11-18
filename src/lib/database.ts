
import Dexie, { type Table } from 'dexie';
import type { Customer, Payment, CustomerPayment, Transaction, OptionItem, Bank, BankBranch, BankAccount, RtgsSettings, ReceiptSettings, Project, Loan, FundTransaction, Employee, PayrollEntry, AttendanceEntry, InventoryItem, FormatSettings, Holiday, LedgerAccount, LedgerEntry, MandiReport, SyncTask } from './definitions';
import { getSuppliersRealtime, getPaymentsRealtime, getAllSuppliers, getAllPayments } from './firestore';

export class AppDatabase extends Dexie {
    suppliers!: Table<Customer>;
    customers!: Table<Customer>;
    payments!: Table<Payment>;
    customerPayments!: Table<CustomerPayment>;
    transactions!: Table<Transaction>;
    options!: Table<OptionItem>;
    banks!: Table<Bank>;
    bankBranches!: Table<BankBranch>;
    bankAccounts!: Table<BankAccount>;
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
    
    constructor() {
        super('bizsuiteDB_v2');
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
            mandiReports: '&id, voucherNo, sellerName',
            syncQueue: '++id, status, nextRetryAt, dedupeKey, type',
        });
    }
}

// Conditionally create the database instance only on the client-side
let db: AppDatabase;
if (typeof window !== 'undefined') {
  db = new AppDatabase();
}

// Export the db instance. It will be undefined on the server.
export { db };


// --- Synchronization Logic ---
// ✅ UPDATED: Use incremental sync from local-first-sync instead of reading entire collections
export async function syncAllData() {
    if (!db) return;

    console.log("Starting incremental data sync...");

    // ✅ Use incremental sync from local-first-sync manager
    // This will only sync changed documents, not entire collections
    try {
        const { forceSyncFromFirestore } = await import('./local-first-sync');
        await forceSyncFromFirestore();
        console.log("✅ Incremental sync completed - only changed documents synced");
    } catch (error) {
        console.error("Sync Error:", error);
        // Fallback to old method if local-first-sync fails (only for first time)
        console.warn("Falling back to full sync (first time only)...");
        
        // First sync - get all (only once)
        getSuppliersRealtime(async (suppliers) => {
            if (suppliers.length > 0 && db) {
                try {
                    await db.suppliers.bulkPut(suppliers);
                    console.log(`Synced ${suppliers.length} suppliers (first sync).`);
                    // Save last sync time
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('lastSync:suppliers', String(Date.now()));
                    }
                } catch (error: any) {
                    console.error("Sync Error (Suppliers):", error);
                }
            }
        }, (error) => console.error("Sync Error (Suppliers):", error));

        getPaymentsRealtime(async (payments) => {
            if (payments.length > 0 && db) {
                try {
                    await db.payments.bulkPut(payments);
                    console.log(`Synced ${payments.length} payments (first sync).`);
                    // Save last sync time
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('lastSync:payments', String(Date.now()));
                    }
                } catch (error: any) {
                    console.error("Sync Error (Payments):", error);
                }
            }
        }, (error) => console.error("Sync Error (Payments):", error));
    }
}

// Hard sync: replace local IndexedDB with fresh Firestore data (suppliers, payments)
export async function hardSyncAllData() {
    if (!db) return;
    try {
        const [suppliers, payments] = await Promise.all([
            getAllSuppliers(),
            getAllPayments(),
        ]);
        await db.transaction('rw', db.suppliers, db.payments, async () => {
            await db.suppliers.clear();
            await db.payments.clear();
            if (suppliers?.length) await db.suppliers.bulkAdd(suppliers);
            if (payments?.length) await db.payments.bulkAdd(payments);
        });
    } catch (e) {
        console.error('Hard sync failed:', e);
        throw e;
    }
}


// --- Local DB Helper Functions ---
export async function updateSupplierInLocalDB(id: string, data: Partial<Customer>) {
    if (db) {
        await db.suppliers.update(id, data);
    }
}

export async function deletePaymentFromLocalDB(paymentId: string) {
    if (db) {
        await db.payments.delete(paymentId);
    }
}


// Generic function to clear all data from all tables
export async function clearAllLocalData() {
    if (db) {
        await Promise.all(db.tables.map(table => table.clear()));
    }
}
