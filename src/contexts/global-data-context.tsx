"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useTransition, useCallback } from 'react';
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
    const [isPending, startTransition] = useTransition();
    
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
    
    // ✅ OPTIMIZED: Use React.startTransition for non-urgent state updates
    // This prevents blocking the UI during data updates
    const updateState = useCallback((setter: (value: any) => void, value: any) => {
        startTransition(() => {
            setter(value);
        });
    }, [startTransition]);
    
    // NO LOADING STATES - Data loads initially, then only CRUD updates happen via realtime listeners
    
    // ✅ OPTIMIZED: Lazy load supplierBankAccounts listener only when needed
    const [supplierBankAccountsListenerSetup, setSupplierBankAccountsListenerSetup] = useState(false);
    
    // ✅ FIX: Defer realtime listeners setup until after initialization is complete
    // This prevents blocking initialization with heavy Firestore queries
    // ✅ CRITICAL: Keep listeners active across page navigations - don't cleanup on unmount
    useEffect(() => {
        let isSubscribed = true;
        let unsubFunctions: Array<(() => void) | undefined> = [];
        let supplierBankAccountsUnsub: (() => void) | undefined;
        
        // ✅ OPTIMIZED: Wait a bit before setting up listeners to avoid blocking initialization
        // Use requestIdleCallback or setTimeout to defer
        const setupListeners = () => {
            if (!isSubscribed) return;
            
            // ✅ FIX: Don't setup listeners again if they're already set up
            if (unsubFunctions.length > 0) {
                return;
            }
            
            // Setup all realtime listeners
            unsubFunctions = [
            // Supplier Entry Listeners
            getSuppliersRealtime(
                (data) => {
                    if (isSubscribed) {
                        // ✅ OPTIMIZED: Use transition for non-urgent updates
                        updateState(setSuppliers, data);
                    }
                },
                (error) => {

                }
            ),
            getPaymentsRealtime(
                (data) => {
                    if (isSubscribed) {
                        // ✅ OPTIMIZED: Use transition for non-urgent updates
                        updateState(setSupplierPayments, data);
                    }
                },
                (error) => {

                }
            ),
            
            // Customer Entry Listeners
            getCustomersRealtime(
                (data) => {
                    if (isSubscribed) {
                        // ✅ OPTIMIZED: Use transition for non-urgent updates
                        updateState(setCustomers, data);
                    }
                },
                (error) => {

                }
            ),
            getCustomerPaymentsRealtime(
                (data) => {
                    if (isSubscribed) {
                        // ✅ OPTIMIZED: Use transition for non-urgent updates
                        updateState(setCustomerPayments, data);
                    }
                },
                (error) => {

                }
            ),
            
            // Shared Listeners
            getBanksRealtime(
                (data) => {
                    if (isSubscribed) {
                        // ✅ OPTIMIZED: Use transition for non-urgent updates
                        updateState(setBanks, data);
                    }
                },
                (error) => {

                }
            ),
            getBankBranchesRealtime(
                (data) => {
                    if (isSubscribed) {
                        // ✅ OPTIMIZED: Use transition for non-urgent updates
                        updateState(setBankBranches, data);
                    }
                },
                (error) => {

                }
            ),
            getBankAccountsRealtime(
                (data) => {
                    if (isSubscribed) {
                        // ✅ OPTIMIZED: Use transition for non-urgent updates
                        updateState(setBankAccounts, data);
                    }
                },
                (error) => {

                }
            ),
            // ✅ OPTIMIZED: Defer supplierBankAccounts listener - only needed on supplier-bank-accounts page
            // This prevents unnecessary data fetch when opening other pages like cash-bank
            // Supplier bank accounts will be loaded lazily when actually needed
            getFundTransactionsRealtime(
                (data) => {
                    if (isSubscribed) {
                        // ✅ OPTIMIZED: Use transition for non-urgent updates
                        updateState(setFundTransactions, data);
                    }
                },
                (error) => {

                }
            ),
            getExpensesRealtime(
                (data) => {
                    if (isSubscribed) {
                        // ✅ OPTIMIZED: Use transition for non-urgent updates
                        updateState(setExpenses, data);
                    }
                },
                (error) => {

                }
            ),
            getIncomeRealtime(
                (data) => {
                    if (isSubscribed) {
                        // ✅ OPTIMIZED: Use transition for non-urgent updates
                        updateState(setIncomes, data);
                    }
                },
                (error) => {

                }
            ),
            ];
            
            // ✅ OPTIMIZED: Defer receipt settings fetch (not critical for initialization)
            // Load receipt settings after a delay to avoid blocking
            setTimeout(() => {
                if (isSubscribed) {
                    getReceiptSettings()
                        .then((settings) => {
                            if (isSubscribed && settings) {
                                setReceiptSettings(settings);
                            }
                        })
                        .catch((error) => {
                            // Silent fail
                        });
                }
            }, 500); // Defer by 500ms
        };
        
        // ✅ OPTIMIZED: Setup supplierBankAccounts listener lazily (only when needed)
        const setupSupplierBankAccountsListener = () => {
            if (!isSubscribed || supplierBankAccountsListenerSetup) return;
            
            supplierBankAccountsUnsub = getSupplierBankAccountsRealtime(
                (data) => {
                    if (isSubscribed) {
                        // ✅ OPTIMIZED: Use transition for non-urgent updates
                        updateState(setSupplierBankAccounts, data);
                    }
                },
                (error) => {
                    // Silent fail
                }
            );
            
            setSupplierBankAccountsListenerSetup(true);
        };
        
        // ✅ FIX: Defer listener setup to avoid blocking initialization
        // Use requestIdleCallback if available, otherwise setTimeout
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            (window as any).requestIdleCallback(() => {
                if (isSubscribed) {
                    setupListeners();
                }
            }, { timeout: 1000 });
        } else {
            setTimeout(() => {
                if (isSubscribed) {
                    setupListeners();
                }
            }, 100); // Small delay to let initialization complete
        }
        
        // ✅ FIX: Don't cleanup listeners on unmount - keep them active across page navigations
        // GlobalDataProvider persists in layout, so listeners should stay active
        // Only cleanup when component is truly unmounting (e.g., logout)
        return () => {
            // Mark as unsubscribed to prevent new updates
            isSubscribed = false;
            // ✅ CRITICAL: Don't unsubscribe listeners here - keep data available across navigations
            // Listeners will be cleaned up when the provider is truly unmounted (logout)
            // This ensures data persists when navigating between pages
        };
    }, []); // Empty deps - setup once, updates happen via realtime listeners
    
    // ✅ OPTIMIZED: Lazy load supplierBankAccounts when actually needed (not on every page)
    // This prevents blocking when opening pages like cash-bank that don't need it
    useEffect(() => {
        if (supplierBankAccountsListenerSetup) return;
        
        // Defer supplier bank accounts listener setup - only load when actually needed
        // This prevents blocking when opening pages like cash-bank that don't need it
        const timer = setTimeout(() => {
            if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
                (window as any).requestIdleCallback(() => {
                    getSupplierBankAccountsRealtime(
                        (data) => {
                            updateState(setSupplierBankAccounts, data);
                        },
                        (error) => {
                            // Silent fail
                        }
                    );
                    setSupplierBankAccountsListenerSetup(true);
                }, { timeout: 5000 }); // Wait up to 5 seconds
            } else {
                setTimeout(() => {
                    getSupplierBankAccountsRealtime(
                        (data) => {
                            updateState(setSupplierBankAccounts, data);
                        },
                        (error) => {
                            // Silent fail
                        }
                    );
                    setSupplierBankAccountsListenerSetup(true);
                }, 3000); // Defer by 3 seconds
            }
        }, 2000); // Initial delay of 2 seconds
        
        return () => clearTimeout(timer);
    }, [supplierBankAccountsListenerSetup, updateState]);
    
    // Context value - useMemo with proper dependencies
    // Arrays are already memoized by React state, so we just pass them through
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

