
import Dexie, { type Table } from 'dexie';
import type { Customer, Payment, CustomerPayment, Transaction, OptionItem, Bank, BankBranch, BankAccount, RtgsSettings, ReceiptSettings, Project, Loan, FundTransaction, Employee, PayrollEntry, AttendanceEntry, InventoryItem, FormatSettings, Holiday } from './definitions';

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
        this.version(1).stores({
            suppliers: '++id, srNo, name, contact, date, customerId',
            customers: '++id, srNo, name, contact, date, customerId',
            payments: '++id, paymentId, customerId, date',
            customerPayments: '++id, paymentId, customerId, date',
            transactions: '++id, transactionId, date, category, subCategory, type',
            options: '++id, type, name',
            banks: '&id, name',
            bankBranches: '&id, bankName, branchName, ifscCode',
            bankAccounts: '++id, accountNumber',
            settings: '&id',
            projects: '++id, name, startDate',
            loans: '++id, loanId, startDate',
            fundTransactions: '++id, date, type',
            employees: '++id, employeeId, name',
            payroll: '++id, employeeId, payPeriod',
            attendance: '++id, &compoundId, employeeId, date', // compoundId would be `employeeId-date`
            inventoryItems: '++id, sku, name',
        });
    }
}

export const db = new AppDatabase();

// Wrapper functions for data operations

// Suppliers
export const addSupplierToLocalDB = async (supplier: Customer) => await db.suppliers.put(supplier);
export const updateSupplierInLocalDB = async (id: string, updates: Partial<Customer>) => await db.suppliers.update(id, updates);
export const deleteSupplierFromLocalDB = async (id: string) => await db.suppliers.delete(id);
export const bulkDeleteSuppliersFromLocalDB = async (ids: string[]) => await db.suppliers.bulkDelete(ids);

// Payments
export const addPaymentToLocalDB = async (payment: Payment) => await db.payments.put(payment);
export const deletePaymentFromLocalDB = async (id: string) => await db.payments.delete(id);
export const bulkDeletePaymentsFromLocalDB = async (ids: string[]) => await db.payments.bulkDelete(ids);

// Generic function to clear all data from all tables
export async function clearAllLocalData() {
    await Promise.all(db.tables.map(table => table.clear()));
}
