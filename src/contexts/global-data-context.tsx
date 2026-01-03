"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { 
    getSuppliersRealtime, 
    getPaymentsRealtime, 
    getCustomersRealtime, 
    getCustomerPaymentsRealtime,
    getBanksRealtime,
    getBankAccountsRealtime,
    getSupplierBankAccountsRealtime,
    getFundTransactionsRealtime,
    getExpensesRealtime,
    getIncomeRealtime,
    getBankBranchesRealtime,
    getReceiptSettings
} from "@/lib/firestore";
import type { 
    Customer, 
    Payment, 
    CustomerPayment, 
    Bank, 
    BankAccount, 
    FundTransaction, 
    Income, 
    Expense, 
    ReceiptSettings, 
    BankBranch 
} from "@/lib/definitions";

// Global Data Context Type
interface GlobalDataContextType {
    // Supplier Entry Data
    suppliers: Customer[];
    supplierPayments: Payment[];
    paymentHistory: Payment[]; // Alias for supplierPayments (backward compatibility)
    
    // Customer Entry Data
    customers: Customer[];
    customerPayments: CustomerPayment[];
    
    // Shared Data
    banks: Bank[];
    bankBranches: BankBranch[];
    bankAccounts: BankAccount[];
    supplierBankAccounts: BankAccount[];
    fundTransactions: FundTransaction[];
    incomes: Income[];
    expenses: Expense[];
    receiptSettings: ReceiptSettings | null;
    
    // No loading states needed - data loads initially, then just CRUD updates
}

// Create Context
const GlobalDataContext = createContext<GlobalDataContextType | undefined>(undefined);

// Provider Component
export const GlobalDataProvider = ({ children }: { children: ReactNode }) => {
    
    // Supplier Entry State
    const [suppliers, setSuppliers] = useState<Customer[]>([]);
    const [supplierPayments, setSupplierPayments] = useState<Payment[]>([]);
    
    // Customer Entry State
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
    
    // Shared State
    const [banks, setBanks] = useState<Bank[]>([]);
    const [bankBranches, setBankBranches] = useState<BankBranch[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [supplierBankAccounts, setSupplierBankAccounts] = useState<BankAccount[]>([]);
    const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>([]);
    const [incomes, setIncomes] = useState<Income[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
    
    // NO LOADING STATES - Data loads initially, then only CRUD updates happen via realtime listeners
    
    // Setup all realtime listeners IMMEDIATELY - data loads initially, then just CRUD updates
    useEffect(() => {
        let isSubscribed = true;
        
        // Setup all realtime listeners
        const unsubFunctions = [
            // Supplier Entry Listeners
            getSuppliersRealtime(
                (data) => {
                    if (isSubscribed) {
                        // Instant update - no transitions, immediate state update
                        setSuppliers(data);
                    }
                },
                (error) => {

                }
            ),
            getPaymentsRealtime(
                (data) => {
                    if (isSubscribed) {
                        // Instant update
                        setSupplierPayments(data);
                    }
                },
                (error) => {

                }
            ),
            
            // Customer Entry Listeners
            getCustomersRealtime(
                (data) => {
                    if (isSubscribed) {
                        // Instant update
                        setCustomers(data);
                    }
                },
                (error) => {

                }
            ),
            getCustomerPaymentsRealtime(
                (data) => {
                    if (isSubscribed) {
                        // Instant update
                        setCustomerPayments(data);
                    }
                },
                (error) => {

                }
            ),
            
            // Shared Listeners
            getBanksRealtime(
                (data) => {
                    if (isSubscribed) {
                        setBanks(data);
                    }
                },
                (error) => {

                }
            ),
            getBankBranchesRealtime(
                (data) => {
                    if (isSubscribed) {
                        setBankBranches(data);
                    }
                },
                (error) => {

                }
            ),
            getBankAccountsRealtime(
                (data) => {
                    if (isSubscribed) {
                        setBankAccounts(data);
                    }
                },
                (error) => {

                }
            ),
            getSupplierBankAccountsRealtime(
                (data) => {
                    if (isSubscribed) {
                        setSupplierBankAccounts(data);
                    }
                },
                (error) => {

                }
            ),
            getFundTransactionsRealtime(
                (data) => {
                    if (isSubscribed) {
                        setFundTransactions(data);
                    }
                },
                (error) => {

                }
            ),
            getExpensesRealtime(
                (data) => {
                    if (isSubscribed) {
                        setExpenses(data);
                    }
                },
                (error) => {

                }
            ),
            getIncomeRealtime(
                (data) => {
                    if (isSubscribed) {
                        setIncomes(data);
                    }
                },
                (error) => {

                }
            ),
        ];
        
        // Load receipt settings (non-blocking, instant UI)
        getReceiptSettings()
            .then((settings) => {
                if (isSubscribed && settings) {
                    setReceiptSettings(settings);
                }
            })
            .catch((error) => {

            });
        
        // Cleanup function
        return () => {
            isSubscribed = false;
            unsubFunctions.forEach(unsub => {
                if (typeof unsub === 'function') {
                    unsub();
                }
            });
        };
    }, []); // Empty deps - setup once, updates happen via realtime listeners
    
    // Context value
    const contextValue: GlobalDataContextType = useMemo(() => ({
        // Supplier Entry Data
        suppliers,
        supplierPayments,
        paymentHistory: supplierPayments, // Alias for backward compatibility
        
        // Customer Entry Data
        customers,
        customerPayments,
        
        // Shared Data
        banks,
        bankBranches,
        bankAccounts,
        supplierBankAccounts,
        fundTransactions,
        incomes,
        expenses,
        receiptSettings,
    }), [
        suppliers,
        supplierPayments,
        customers,
        customerPayments,
        banks,
        bankBranches,
        bankAccounts,
        supplierBankAccounts,
        fundTransactions,
        incomes,
        expenses,
        receiptSettings,
    ]);
    
    return (
        <GlobalDataContext.Provider value={contextValue}>
            {children}
        </GlobalDataContext.Provider>
    );
};

// Hook to use global data
export const useGlobalData = (): GlobalDataContextType => {
    const context = useContext(GlobalDataContext);
    if (context === undefined) {
        throw new Error('useGlobalData must be used within a GlobalDataProvider');
    }
    return context;
};

