
import Dexie, { type Table } from 'dexie';
import type { Customer, Payment, CustomerPayment, Transaction, OptionItem, Bank, BankBranch, BankAccount, RtgsSettings, ReceiptSettings, Project, Loan, FundTransaction, Employee, PayrollEntry, AttendanceEntry, InventoryItem, FormatSettings, Holiday, LedgerAccount, LedgerEntry, MandiReport, SyncTask } from './definitions';
import { getSuppliersRealtime, getPaymentsRealtime, getAllSuppliers, getAllPayments, getAllCustomers, getAllCustomerPayments, getAllIncomes, getAllExpenses } from './firestore';

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

// Hard sync: replace local IndexedDB with fresh Firestore data (all collections)
// This clears all lastSync times and forces a full sync from Firestore
export async function hardSyncAllData() {
    if (!db) return;
    
    try {
        console.log('🔄 Starting full sync from Firestore...');
        
        // ✅ Clear all lastSync times to force full sync on next realtime listener update
        if (typeof window !== 'undefined') {
            const syncKeys = [
                'lastSync:suppliers',
                'lastSync:customers',
                'lastSync:payments',
                'lastSync:customerPayments',
                'lastSync:incomes',
                'lastSync:expenses',
                'lastSync:projects',
                'lastSync:loans',
                'lastSync:fundTransactions',
            ];
            syncKeys.forEach(key => localStorage.removeItem(key));
            console.log('✅ Cleared all lastSync timestamps');
        }
        
        // ✅ Fetch all data from Firestore in parallel
        const [
            suppliers,
            customers,
            payments,
            customerPayments,
            incomes,
            expenses
        ] = await Promise.all([
            getAllSuppliers().catch(e => { console.warn('Failed to sync suppliers:', e); return []; }),
            getAllCustomers().catch(e => { console.warn('Failed to sync customers:', e); return []; }),
            getAllPayments().catch(e => { console.warn('Failed to sync payments:', e); return []; }),
            getAllCustomerPayments().catch(e => { console.warn('Failed to sync customerPayments:', e); return []; }),
            getAllIncomes().catch(e => { console.warn('Failed to sync incomes:', e); return []; }),
            getAllExpenses().catch(e => { console.warn('Failed to sync expenses:', e); return []; }),
        ]);
        
        // ✅ Update IndexedDB with fresh data
        await db.transaction('rw', db.suppliers, db.customers, db.payments, db.customerPayments, db.transactions, async () => {
            // Clear existing data
            await db.suppliers.clear();
            await db.customers.clear();
            await db.payments.clear();
            await db.customerPayments.clear();
            
            // Add fresh data
            if (suppliers?.length) {
                await db.suppliers.bulkAdd(suppliers);
                console.log(`✅ Synced ${suppliers.length} suppliers`);
            }
            if (customers?.length) {
                await db.customers.bulkAdd(customers);
                console.log(`✅ Synced ${customers.length} customers`);
            }
            if (payments?.length) {
                await db.payments.bulkAdd(payments);
                console.log(`✅ Synced ${payments.length} payments`);
            }
            if (customerPayments?.length) {
                await db.customerPayments.bulkAdd(customerPayments);
                console.log(`✅ Synced ${customerPayments.length} customer payments`);
            }
            
            // Handle incomes and expenses (stored in transactions table)
            if (incomes?.length || expenses?.length) {
                const allTransactions: Transaction[] = [
                    ...(incomes?.map(inc => ({ ...inc, type: 'income' } as Transaction)) || []),
                    ...(expenses?.map(exp => ({ ...exp, type: 'expense' } as Transaction)) || [])
                ];
                if (allTransactions.length > 0) {
                    // Clear only income/expense transactions
                    const existing = await db.transactions.where('type').anyOf(['income', 'expense']).toArray();
                    if (existing.length > 0) {
                        await db.transactions.bulkDelete(existing.map(t => t.id!));
                    }
                    await db.transactions.bulkAdd(allTransactions);
                    console.log(`✅ Synced ${incomes?.length || 0} incomes and ${expenses?.length || 0} expenses`);
                }
            }
        });
        
        // ✅ Update lastSync times after successful sync
        if (typeof window !== 'undefined') {
            const now = Date.now();
            localStorage.setItem('lastSync:suppliers', String(now));
            localStorage.setItem('lastSync:customers', String(now));
            localStorage.setItem('lastSync:payments', String(now));
            localStorage.setItem('lastSync:customerPayments', String(now));
            localStorage.setItem('lastSync:incomes', String(now));
            localStorage.setItem('lastSync:expenses', String(now));
        }
        
        console.log('✅ Full sync completed successfully');
    } catch (e) {
        console.error('❌ Hard sync failed:', e);
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
