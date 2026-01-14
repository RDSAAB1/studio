

"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { Customer, CustomerPayment, Payment, Transaction, IncomeCategory, ExpenseCategory, Project, FundTransaction, Loan, BankAccount } from './definitions';
import { format } from 'date-fns';

// --- Types ---

interface SupplierEntryState {
    formState: Customer;
    paymentHistory: Payment[];
}

interface CustomerEntryState {
    formState: Customer;
    paymentHistory: CustomerPayment[];
}

interface ExpenseTrackerState {
    formState: Partial<Transaction>;
    transactions: Transaction[];
    incomeCategories: IncomeCategory[];
    expenseCategories: ExpenseCategory[];
    projects: Project[];
}

interface CashBankState {
    fundTransactions: FundTransaction[];
    loans: Loan[];
    bankAccounts: BankAccount[];
    formState: Partial<Loan>;
}


interface StateStoreContextType {
    supplierEntry: SupplierEntryState;
    setSupplierEntry: React.Dispatch<React.SetStateAction<SupplierEntryState>>;
    customerEntry: CustomerEntryState;
    setCustomerEntry: React.Dispatch<React.SetStateAction<CustomerEntryState>>;
    expenseTracker: ExpenseTrackerState;
    setExpenseTracker: React.Dispatch<React.SetStateAction<ExpenseTrackerState>>;
    cashBank: CashBankState;
    setCashBank: React.Dispatch<React.SetStateAction<CashBankState>>;
}

// --- Initial States ---

const initialSupplierFormState: Customer = {
    id: "", srNo: 'S----', date: format(new Date(), 'yyyy-MM-dd'), term: '20', dueDate: format(new Date(), 'yyyy-MM-dd'), 
    name: '', so: '', address: '', contact: '', vehicleNo: '', variety: '', grossWeight: 0, teirWeight: 0,
    weight: 0, kartaPercentage: 1, kartaWeight: 0, kartaAmount: 0, netWeight: 0, rate: 0,
    labouryRate: 2, labouryAmount: 0, brokerageRate: 0, brokerageAmount: 0, kanta: 50, amount: 0, netAmount: 0, originalNetAmount: 0, barcode: '',
    receiptType: 'Cash', paymentType: 'Full', customerId: ''
};

const initialCustomerFormState: Customer = {
    id: "", srNo: 'C----', date: format(new Date(), 'yyyy-MM-dd'), term: '0', dueDate: format(new Date(), 'yyyy-MM-dd'),
    name: '', companyName: '', address: '', contact: '', gstin: '', stateName: '', stateCode: '', vehicleNo: '', variety: '', grossWeight: 0, teirWeight: 0,
    weight: 0, rate: 0, amount: 0, bags: 0, bagWeightKg: 0, bagRate: 0, bagAmount: 0,
    kanta: 0, brokerage: 0, brokerageRate: 0, brokerageAmount: 0, cd: 0, cdRate: 0, isBrokerageIncluded: false,
    netWeight: 0, originalNetAmount: 0, netAmount: 0, barcode: '',
    receiptType: 'Cash', paymentType: 'Full', customerId: '', so: '', kartaPercentage: 0, kartaWeight: 0, kartaAmount: 0, labouryRate: 0, labouryAmount: 0,
};

const initialExpenseTrackerFormState: Partial<Transaction> = {
    date: format(new Date(), 'yyyy-MM-dd'),
    transactionType: 'Expense',
    category: '',
    subCategory: '',
    amount: 0,
    payee: '',
    description: '',
    paymentMethod: 'Cash',
    status: 'Paid',
    expenseType: 'Business',
    isRecurring: false,
};

const initialCashBankFormState: Partial<Loan> = {
    loanName: "",
    loanType: "Product",
    lenderName: "",
    productName: "",
    totalAmount: 0,
    amountPaid: 0,
    emiAmount: 0,
    tenureMonths: 0,
    interestRate: 0,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    depositTo: "CashInHand",
};


// --- Contexts and Provider ---

const SupplierEntryContext = createContext<StateStoreContextType | undefined>(undefined);
const CustomerEntryContext = createContext<StateStoreContextType | undefined>(undefined);
const ExpenseTrackerContext = createContext<StateStoreContextType | undefined>(undefined);
const CashBankContext = createContext<StateStoreContextType | undefined>(undefined);
const StateStoreContext = createContext<StateStoreContextType | undefined>(undefined);

export const StateProvider = ({ children }: { children: ReactNode }) => {
    const [supplierEntry, setSupplierEntry] = useState<SupplierEntryState>({
        formState: initialSupplierFormState,
        paymentHistory: [],
    });
    const [customerEntry, setCustomerEntry] = useState<CustomerEntryState>({
        formState: initialCustomerFormState,
        paymentHistory: [],
    });
    const [expenseTracker, setExpenseTracker] = useState<ExpenseTrackerState>({
        formState: initialExpenseTrackerFormState,
        transactions: [],
        incomeCategories: [],
        expenseCategories: [],
        projects: [],
    });
    const [cashBank, setCashBank] = useState<CashBankState>({
        fundTransactions: [],
        loans: [],
        bankAccounts: [],
        formState: initialCashBankFormState,
    });

    const contextValue = {
        supplierEntry, setSupplierEntry,
        customerEntry, setCustomerEntry,
        expenseTracker, setExpenseTracker,
        cashBank, setCashBank
    };

    return (
        <StateStoreContext.Provider value={contextValue}>
            {children}
        </StateStoreContext.Provider>
    );
};


// --- Hooks ---

export const useStateStore = () => {
    const context = useContext(StateStoreContext);
    if (context === undefined) {
        throw new Error('useStateStore must be used within a StateProvider');
    }
    return context;
};

export const useSupplierEntryState = () => {
    const context = useStateStore();
    return {
        ...context.supplierEntry,
        setFormState: (updater: (prev: Customer) => Customer) => 
            context.setSupplierEntry(prev => ({ ...prev, formState: updater(prev.formState) })),
        setPaymentHistory: (history: Payment[]) =>
            context.setSupplierEntry(prev => ({ ...prev, paymentHistory: history })),
    };
};

export const useCustomerEntryState = () => {
    const context = useStateStore();
    return {
        ...context.customerEntry,
        setFormState: (updater: (prev: Customer) => Customer) =>
            context.setCustomerEntry(prev => ({ ...prev, formState: updater(prev.formState) })),
        setPaymentHistory: (history: CustomerPayment[]) =>
            context.setCustomerEntry(prev => ({ ...prev, paymentHistory: history })),
    };
};

export const useExpenseTrackerState = () => {
    const context = useStateStore();
    return {
        ...context.expenseTracker,
        setFormState: (updater: (prev: Partial<Transaction>) => Partial<Transaction>) =>
            context.setExpenseTracker(prev => ({ ...prev, formState: updater(prev.formState) })),
        setTransactions: (transactions: Transaction[]) =>
            context.setExpenseTracker(prev => ({ ...prev, transactions })),
        setIncomeCategories: (categories: IncomeCategory[]) =>
            context.setExpenseTracker(prev => ({ ...prev, incomeCategories: categories })),
        setExpenseCategories: (categories: ExpenseCategory[]) =>
            context.setExpenseTracker(prev => ({ ...prev, expenseCategories: categories })),
        setProjects: (projects: Project[]) =>
            context.setExpenseTracker(prev => ({ ...prev, projects })),
    };
};

export const useCashBankState = () => {
    const context = useStateStore();
    return {
        ...context.cashBank,
        setFormState: (updater: (prev: Partial<Loan>) => Partial<Loan>) =>
            context.setCashBank(prev => ({ ...prev, formState: updater(prev.formState) })),
        setFundTransactions: (transactions: FundTransaction[]) =>
            context.setCashBank(prev => ({...prev, fundTransactions: transactions})),
        setLoans: (loans: Loan[]) =>
            context.setCashBank(prev => ({...prev, loans})),
        setBankAccounts: (accounts: BankAccount[]) =>
            context.setCashBank(prev => ({...prev, bankAccounts: accounts})),
    };
};
