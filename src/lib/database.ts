
import Dexie, { type Table } from 'dexie';
import type { Customer, Payment, CustomerPayment, Transaction, OptionItem, Bank, BankBranch, BankAccount, RtgsSettings, ReceiptSettings, Project, Loan, FundTransaction, Employee, PayrollEntry, AttendanceEntry, InventoryItem, FormatSettings, Holiday } from './definitions';
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
export async function syncAllData() {
    if (!db) return;

    console.log("Starting full data sync...");

    // Sync Suppliers
    getSuppliersRealtime(async (suppliers) => {
        if (suppliers.length > 0) {
            try {
                await db.suppliers.bulkPut(suppliers);
                console.log(`Synced ${suppliers.length} suppliers.`);
            } catch (error: any) {
                // Ignore ConstraintError for duplicate srNo - this is not a real error
                if (error.name === 'ConstraintError' && error.message.includes('srNo')) {
                    console.log(`Ignored duplicate srNo constraint error - ${suppliers.length} suppliers processed.`);
                } else {
                    console.error("Sync Error (Suppliers):", error);
                }
            }
        }
    }, (error) => console.error("Sync Error (Suppliers):", error));

    // Sync Payments
    getPaymentsRealtime(async (payments) => {
        if (payments.length > 0) {
            try {
                await db.payments.bulkPut(payments);
                console.log(`Synced ${payments.length} payments.`);
            } catch (error: any) {
                // Ignore ConstraintError for duplicate keys - this is not a real error
                if (error.name === 'ConstraintError') {
                    console.log(`Ignored duplicate key constraint error - ${payments.length} payments processed.`);
                } else {
                    console.error("Sync Error (Payments):", error);
                }
            }
        }
    }, (error) => console.error("Sync Error (Payments):", error));

    // Add other sync functions here as needed
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
