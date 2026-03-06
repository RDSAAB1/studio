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
    getReceiptSettings,
    refreshTenantFirestoreBindings
} from "@/lib/firestore";
import { db } from "@/lib/database";
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
    
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const mergePayments = (regular: Payment[], gov: Payment[]) => {
            const uniquePayments = new Map<string, Payment>();

            const getPaymentKey = (p: Payment) => {
                const key = String((p as any).paymentId || (p as any).id || '').trim();
                return key || null;
            };

            const getPaymentTime = (p: Payment) => {
                const updatedAt = (p as any).updatedAt;
                const updatedAtMs =
                    updatedAt && typeof updatedAt === 'object' && typeof (updatedAt as any).toMillis === 'function'
                        ? (updatedAt as any).toMillis()
                        : (updatedAt ? new Date(updatedAt as any).getTime() : 0);
                const dateMs = p.date ? new Date(p.date).getTime() : 0;
                return Math.max(updatedAtMs || 0, dateMs || 0);
            };

            [...regular, ...gov].forEach((p) => {
                const key = getPaymentKey(p);
                if (!key) return;

                const existing = uniquePayments.get(key);
                if (!existing) {
                    uniquePayments.set(key, p);
                    return;
                }

                if (getPaymentTime(p) >= getPaymentTime(existing)) {
                    uniquePayments.set(key, p);
                }
            });

            return Array.from(uniquePayments.values()).sort((a, b) => {
                const dateA = a.date ? new Date(a.date).getTime() : 0;
                const dateB = b.date ? new Date(b.date).getTime() : 0;
                return dateB - dateA;
            });
        };

        const refresh = async (collection: string) => {
            if (!db) return;

            if (collection === 'suppliers') {
                const data = await db.suppliers.orderBy('srNo').reverse().toArray();
                updateState(setSuppliers, data);
                return;
            }

            if (collection === 'customers') {
                const data = await db.customers.orderBy('srNo').reverse().toArray();
                updateState(setCustomers, data);
                return;
            }

            if (collection === 'customerPayments') {
                const data = await db.customerPayments.orderBy('date').reverse().toArray();
                updateState(setCustomerPayments, data);
                return;
            }

            if (collection === 'payments' || collection === 'governmentFinalizedPayments') {
                const regularPayments = await db.payments.orderBy('date').reverse().toArray();
                const govPayments = (await db.governmentFinalizedPayments.orderBy('date').reverse().toArray()).map((p: any) => ({
                    ...p,
                    receiptType: 'Gov.',
                })) as Payment[];
                updateState(setSupplierPayments, mergePayments(regularPayments as Payment[], govPayments));
                return;
            }
        };

        const onCollectionChanged = (event: Event) => {
            const detail = (event as CustomEvent).detail as { collection?: string } | undefined;
            const collection = detail?.collection;
            if (!collection) return;
            void refresh(collection);
        };

        const onPaymentUpdated = (event: Event) => {
            const detail = (event as CustomEvent).detail as { collection?: string } | undefined;
            const collection = detail?.collection;
            if (!collection) return;
            void refresh(collection);
        };

        const onPaymentDeleted = (event: Event) => {
            const detail = (event as CustomEvent).detail as { collection?: string } | undefined;
            const collection = detail?.collection;
            if (!collection) return;
            void refresh(collection);
        };

        window.addEventListener('indexeddb:collection:changed', onCollectionChanged);
        window.addEventListener('indexeddb:payment:updated', onPaymentUpdated);
        window.addEventListener('indexeddb:payment:deleted', onPaymentDeleted);

        return () => {
            window.removeEventListener('indexeddb:collection:changed', onCollectionChanged);
            window.removeEventListener('indexeddb:payment:updated', onPaymentUpdated);
            window.removeEventListener('indexeddb:payment:deleted', onPaymentDeleted);
        };
    }, [updateState]);

    // NO LOADING STATES - Data loads initially, then only CRUD updates happen via realtime listeners
    
    // ✅ OPTIMIZED: Lazy load supplierBankAccounts listener only when needed
    const [supplierBankAccountsListenerSetup, setSupplierBankAccountsListenerSetup] = useState(false);
    
    // ✅ FIX: Defer realtime listeners setup until after initialization is complete
    // This prevents blocking initialization with heavy Firestore queries
    // ✅ CRITICAL: Re-setup listeners when company/tenant changes (erp:selection-changed) so we fetch correct company data
    useEffect(() => {
        let isSubscribed = true;
        let unsubFunctions: Array<(() => void) | undefined> = [];
        let supplierBankAccountsUnsub: (() => void) | undefined;
        
        const cleanupListeners = () => {
            unsubFunctions.forEach((unsub) => { try { unsub?.(); } catch {} });
            unsubFunctions = [];
        };
        
        const setupListeners = () => {
            if (!isSubscribed) return;
            
            // Cleanup existing listeners before re-setting up (needed when company changes)
            cleanupListeners();
            
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
        const runSetup = () => {
            if (isSubscribed) setupListeners();
        };
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            (window as any).requestIdleCallback(runSetup, { timeout: 1000 });
        } else {
            setTimeout(runSetup, 100);
        }
        
        // ✅ Re-setup listeners when company/tenant changes (skipReload case)
        const onCompanyChanged = () => {
            if (!isSubscribed) return;
            refreshTenantFirestoreBindings();
            setupListeners();
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('erp:selection-changed', onCompanyChanged);
        }
        
        return () => {
            isSubscribed = false;
            if (typeof window !== 'undefined') {
                window.removeEventListener('erp:selection-changed', onCompanyChanged);
            }
            cleanupListeners();
        };
    }, []); // Empty deps - setup once, company change handled via event
    
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
