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
import { logError } from "@/lib/error-logger";
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
                const payments = await db.payments.orderBy('date').reverse().toArray();
                updateState(setSupplierPayments, payments as Payment[]);
                return;
            }

            if (collection === 'banks') {
                const data = await db.banks.toArray();
                updateState(setBanks, data);
                return;
            }
            if (collection === 'bankBranches') {
                const data = await db.bankBranches.toArray();
                updateState(setBankBranches, data);
                return;
            }
            if (collection === 'bankAccounts') {
                const data = await db.bankAccounts.toArray();
                updateState(setBankAccounts, data);
                return;
            }
            if (collection === 'fundTransactions') {
                const data = await db.fundTransactions.orderBy('date').reverse().toArray();
                updateState(setFundTransactions, data);
                return;
            }
            if (collection === 'incomes' && db.transactions) {
                const data = await db.transactions.where('type').equals('Income').toArray();
                data.sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
                updateState(setIncomes, data);
                return;
            }
            if (collection === 'expenses' && db.transactions) {
                const data = await db.transactions.where('type').equals('Expense').toArray();
                data.sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
                updateState(setExpenses, data);
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
        const unsubFunctions: Array<(() => void) | undefined> = [];
        const staggerTimers: number[] = [];
        let supplierBankAccountsUnsub: (() => void) | undefined;
        
        const cleanupListeners = () => {
            staggerTimers.forEach((t) => clearTimeout(t));
            staggerTimers.length = 0;
            unsubFunctions.forEach((unsub) => { try { unsub?.(); } catch {} });
            unsubFunctions.length = 0;
        };
        
        const setupListeners = () => {
            if (!isSubscribed) return;
            
            // Cleanup existing listeners before re-setting up (needed when company changes)
            cleanupListeners();
            
            // Collection name for IndexedDB refresh on fetch error (some map to same table)
            const createErrorHandler = (collectionName: string) => (error: Error) => {
                logError(error, `Data fetch failed: ${collectionName}`, 'medium', { collection: collectionName });
                // Trigger IndexedDB refresh so user sees cached data if any
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: collectionName } }));
                }
            };
            
            // Stagger listener setup (150ms apart) to reduce Firestore concurrency and avoid intermittent fetch failures
            const listeners: Array<{ delay: number; setup: () => (() => void) | undefined }> = [
                { delay: 0, setup: () => getSuppliersRealtime((d) => isSubscribed && updateState(setSuppliers, d), createErrorHandler('suppliers')) },
                { delay: 150, setup: () => getPaymentsRealtime((d) => isSubscribed && updateState(setSupplierPayments, d), createErrorHandler('payments')) },
                { delay: 300, setup: () => getCustomersRealtime((d) => isSubscribed && updateState(setCustomers, d), createErrorHandler('customers')) },
                { delay: 450, setup: () => getCustomerPaymentsRealtime((d) => isSubscribed && updateState(setCustomerPayments, d), createErrorHandler('customerPayments')) },
                { delay: 600, setup: () => getBanksRealtime((d) => isSubscribed && updateState(setBanks, d), createErrorHandler('banks')) },
                { delay: 750, setup: () => getBankBranchesRealtime((d) => isSubscribed && updateState(setBankBranches, d), createErrorHandler('bankBranches')) },
                { delay: 900, setup: () => getBankAccountsRealtime((d) => isSubscribed && updateState(setBankAccounts, d), createErrorHandler('bankAccounts')) },
                { delay: 1050, setup: () => getFundTransactionsRealtime((d) => isSubscribed && updateState(setFundTransactions, d), createErrorHandler('fundTransactions')) },
                { delay: 1200, setup: () => getExpensesRealtime((d) => isSubscribed && updateState(setExpenses, d), createErrorHandler('expenses')) },
                { delay: 1350, setup: () => getIncomeRealtime((d) => isSubscribed && updateState(setIncomes, d), createErrorHandler('incomes')) },
            ];
            
            listeners.forEach(({ delay, setup }) => {
                const timer = window.setTimeout(() => {
                    if (!isSubscribed) return;
                    const unsub = setup();
                    if (unsub) unsubFunctions.push(unsub);
                }, delay);
                staggerTimers.push(timer);
            });
            
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
        
        // Start listener setup soon so data fetch is reliable (retry inside listener handles transient failures)
        const runSetup = () => {
            if (isSubscribed) setupListeners();
        };
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            (window as any).requestIdleCallback(runSetup, { timeout: 150 });
        } else {
            setTimeout(runSetup, 50);
        }
        
        // ✅ Re-setup listeners when company/tenant changes (skipReload case)
        const onCompanyChanged = () => {
            if (!isSubscribed) return;
            refreshTenantFirestoreBindings();
            setupListeners();
        };
        const onRefreshRequested = () => {
            if (isSubscribed) {
                refreshTenantFirestoreBindings();
                setupListeners();
            }
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('erp:selection-changed', onCompanyChanged);
            window.addEventListener('data:refresh-requested', onRefreshRequested);
        }
        
        return () => {
            isSubscribed = false;
            if (typeof window !== 'undefined') {
                window.removeEventListener('erp:selection-changed', onCompanyChanged);
                window.removeEventListener('data:refresh-requested', onRefreshRequested);
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
