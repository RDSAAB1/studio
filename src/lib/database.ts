
import Dexie, { type Table } from 'dexie';
import type { Customer, Payment, CustomerPayment, Transaction, OptionItem, Bank, BankBranch, BankAccount, RtgsSettings, ReceiptSettings, Project, Loan, FundTransaction, Employee, PayrollEntry, AttendanceEntry, InventoryItem, FormatSettings, Holiday } from './definitions';
import { getSuppliersRealtime, getPaymentsRealtime } from './firestore';

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
        super('bizsuiteDB');
        this.version(2).stores({
            suppliers: '&id, &srNo, name, contact, date, customerId',
            customers: '&id, &srNo, name, contact, date, customerId',
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
            await db.suppliers.bulkPut(suppliers);
            console.log(`Synced ${suppliers.length} suppliers.`);
        }
    }, (error) => console.error("Sync Error (Suppliers):", error));

    // Sync Payments
    getPaymentsRealtime(async (payments) => {
        if (payments.length > 0) {
            await db.payments.bulkPut(payments);
            console.log(`Synced ${payments.length} payments.`);
        }
    }, (error) => console.error("Sync Error (Payments):", error));

    // Add other sync functions here as needed
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
