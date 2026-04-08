"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useTransition, useCallback, useRef } from 'react';
import { db, syncAllData, getReceiptSettingsFromLocal } from "@/lib/database";
import { logError } from "@/lib/error-logger";
import { isSqliteMode } from "@/lib/sqlite-storage";
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
    upsertSupplierPayment: (payment: Payment) => void;
    deleteSupplierPayment: (paymentId: string) => void;
    upsertCustomerPayment: (payment: CustomerPayment) => void;
    deleteCustomerPayment: (paymentId: string) => void;
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

    const normalizePaymentKey = useCallback((p: any) => String(p?.paymentId || p?.id || p?.rtgsSrNo || '').trim(), []);

    const normalizeSupplierKey = useCallback((s: any) => {
        if (!s) return '';
        const id = (s as any).id;
        const srNo = (s as any).srNo;
        // Prioritize ID (the stable primary key) over srNo (which can be edited)
        return String(id || srNo || '').trim();
    }, []);

    const upsertPaymentInList = useCallback(
        <T extends { id?: unknown; paymentId?: unknown; rtgsSrNo?: unknown }>(prev: T[], payment: T) => {
            const key = normalizePaymentKey(payment);
            if (!key) return prev;

            const idx = prev.findIndex((p) => normalizePaymentKey(p) === key);
            if (idx === -1) return [payment, ...prev];

            const next = prev.slice();
            next[idx] = payment;
            return next;
        },
        [normalizePaymentKey]
    );

    const removePaymentFromList = useCallback(
        <T extends { id?: unknown; paymentId?: unknown; rtgsSrNo?: unknown }>(prev: T[], key: string) => {
            if (!key) return prev;
            return prev.filter((p) => normalizePaymentKey(p) !== key);
        },
        [normalizePaymentKey]
    );

    const upsertSupplierInList = useCallback(
        <T extends { id?: unknown; srNo?: unknown }>(prev: T[], supplier: T) => {
            const key = normalizeSupplierKey(supplier);
            if (!key) return prev;
            const idx = prev.findIndex((s) => normalizeSupplierKey(s) === key);
            if (idx === -1) return [supplier, ...prev];
            const next = prev.slice();
            next[idx] = supplier;
            return next;
        },
        [normalizeSupplierKey]
    );

    const removeSupplierFromList = useCallback(
        <T extends { id?: unknown; srNo?: unknown }>(prev: T[], key: string) => {
            if (!key) return prev;
            return prev.filter((s) => normalizeSupplierKey(s) !== key);
        },
        [normalizeSupplierKey]
    );

    const upsertSupplierPayment = useCallback(
        (payment: Payment) => {
            startTransition(() => {
                setSupplierPayments((prev) => upsertPaymentInList(prev, payment));
            });
        },
        [startTransition, upsertPaymentInList]
    );

    const deleteSupplierPayment = useCallback(
        (paymentId: string) => {
            const key = String(paymentId || '').trim();
            if (!key) return;
            startTransition(() => {
                setSupplierPayments((prev) => removePaymentFromList(prev, key));
            });
        },
        [startTransition, removePaymentFromList]
    );

    const upsertCustomerPayment = useCallback(
        (payment: CustomerPayment) => {
            startTransition(() => {
                setCustomerPayments((prev) => upsertPaymentInList(prev, payment as any));
            });
        },
        [startTransition, upsertPaymentInList]
    );

    const deleteCustomerPayment = useCallback(
        (paymentId: string) => {
            const key = String(paymentId || '').trim();
            if (!key) return;
            startTransition(() => {
                setCustomerPayments((prev) => removePaymentFromList(prev as any, key) as any);
            });
        },
        [startTransition, removePaymentFromList]
    );
    
    const refreshDebounceRef = useRef<Record<string, number>>({});
    const refreshIdleRef = useRef<number | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // SQLite mode: trigger load
        if (isSqliteMode()) {
            void syncAllData();
        }

        const isDbClosedError = (e: unknown) =>
            (e && typeof e === 'object' && ((e as Error).name === 'DatabaseClosedError' || String((e as Error).message || '').includes('Database has been closed')));

        const refresh = async (collection: string, retry = false) => {
            if (!db) return;
            try {
                if (collection === 'suppliers') {
                    const data = await db.suppliers.orderBy('srNo').reverse().limit(1000).toArray();
                    updateState(setSuppliers, data);
                    return;
                }
                if (collection === 'customers') {
                    const data = await db.customers.orderBy('srNo').reverse().limit(1000).toArray();
                    updateState(setCustomers, data);
                    return;
                }
                if (collection === 'customerPayments') {
                    const data = await db.customerPayments.orderBy('date').reverse().limit(1000).toArray();
                    updateState(setCustomerPayments, data);
                    return;
                }
                if (collection === 'payments' || collection === 'governmentFinalizedPayments') {
                    const payments = await db.payments.orderBy('date').reverse().limit(1000).toArray();
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
                if (collection === 'supplierBankAccounts') {
                    const data = await db.supplierBankAccounts.toArray();
                    updateState(setSupplierBankAccounts, data);
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
                if (collection === 'transactions' && db.transactions) {
                    // Update both incomes and expenses when transactions change
                    const incomesData = await db.transactions.where('type').equals('Income').toArray();
                    incomesData.sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
                    updateState(setIncomes, incomesData);
                    
                    const expensesData = await db.transactions.where('type').equals('Expense').toArray();
                    expensesData.sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
                    updateState(setExpenses, expensesData);
                    return;
                }
            } catch (e) {
                if (isDbClosedError(e) && !retry) {
                    void refresh(collection, true);
                    return;
                }
                logError(e, `global-data refresh ${collection}`, 'low');
            }
        };

        const scheduleRefresh = (collection: string) => {
            const prev = refreshDebounceRef.current[collection];
            if (prev) clearTimeout(prev);
            refreshDebounceRef.current[collection] = window.setTimeout(() => {
                delete refreshDebounceRef.current[collection];
                const doRefresh = () => void refresh(collection);
                if (typeof (window as any).requestIdleCallback === 'function') {
                    refreshIdleRef.current = (window as any).requestIdleCallback(doRefresh, { timeout: 300 });
                } else {
                    doRefresh();
                }
            }, 120);
        };

        const onCollectionChanged = (event: Event) => {
            const detail = (event as CustomEvent).detail as { collection?: string } | undefined;
            const collection = detail?.collection;
            if (!collection) return;

            scheduleRefresh(collection);
        };

        const onPaymentUpdated = (event: Event) => {
            const detail = (event as CustomEvent).detail as { collection?: string; payment?: unknown } | undefined;
            const collection = detail?.collection;
            const payment = detail?.payment;
            if (!collection || !payment) return;

            if (collection === 'customerPayments') {
                upsertCustomerPayment(payment as any);
                return;
            }
            if (collection === 'payments' || collection === 'governmentFinalizedPayments') {
                upsertSupplierPayment(payment as any);
            }
        };

        const onPaymentDeleted = (event: Event) => {
            const detail = (event as CustomEvent).detail as {
                id?: string;
                payment?: unknown;
                isCustomer?: boolean;
            } | undefined;
            const keyFromPayment = normalizePaymentKey(detail?.payment);
            const key = keyFromPayment || String(detail?.id || '').trim();
            if (!key) return;

            if (detail?.isCustomer) {
                deleteCustomerPayment(key);
                return;
            }
            deleteSupplierPayment(key);
        };

        const onSupplierUpdated = (event: Event) => {
            const detail = (event as CustomEvent).detail as { supplier?: unknown } | undefined;
            const supplier = detail?.supplier;
            if (!supplier) return;
            startTransition(() => {
                setSuppliers((prev) => upsertSupplierInList(prev, supplier as any));
            });
        };

        const onSupplierDeleted = (event: Event) => {
            const detail = (event as CustomEvent).detail as { id?: string; srNo?: string; supplier?: unknown } | undefined;
            const fromSupplier = detail?.supplier ? normalizeSupplierKey(detail.supplier) : '';
            const key = fromSupplier || String(detail?.srNo || detail?.id || '').trim();
            if (!key) return;
            startTransition(() => {
                setSuppliers((prev) => removeSupplierFromList(prev as any, key) as any);
            });
        };

        const onLocalDataReady = () => {
            if (!isSqliteMode()) return;
            ['payments', 'suppliers', 'customers', 'customerPayments', 'banks', 'bankBranches', 'bankAccounts', 'supplierBankAccounts', 'incomes', 'expenses', 'fundTransactions'].forEach((c) => void refresh(c));
        };

        window.addEventListener('indexeddb:collection:changed', onCollectionChanged);
        window.addEventListener('indexeddb:payment:updated', onPaymentUpdated);
        window.addEventListener('indexeddb:payment:deleted', onPaymentDeleted);
        window.addEventListener('indexeddb:supplier:updated', onSupplierUpdated);
        window.addEventListener('indexeddb:supplier:deleted', onSupplierDeleted);
        window.addEventListener('local:data-ready', onLocalDataReady);

        return () => {
            Object.values(refreshDebounceRef.current).forEach((t) => clearTimeout(t));
            refreshDebounceRef.current = {};
            if (refreshIdleRef.current != null && typeof (window as any).cancelIdleCallback === 'function') {
                (window as any).cancelIdleCallback(refreshIdleRef.current);
            }
            window.removeEventListener('indexeddb:collection:changed', onCollectionChanged);
            window.removeEventListener('indexeddb:payment:updated', onPaymentUpdated);
            window.removeEventListener('indexeddb:payment:deleted', onPaymentDeleted);
            window.removeEventListener('indexeddb:supplier:updated', onSupplierUpdated);
            window.removeEventListener('indexeddb:supplier:deleted', onSupplierDeleted);
            window.removeEventListener('local:data-ready', onLocalDataReady);
        };
    }, [
        updateState,
        normalizePaymentKey,
        upsertCustomerPayment,
        upsertSupplierPayment,
        deleteCustomerPayment,
        deleteSupplierPayment,
    ]);

    // NO LOADING STATES - Data loads initially, then only CRUD updates happen via realtime listeners
    
    // SQLite-only: load data from IndexedDB (populated by syncAllData) and receipt settings from local
    useEffect(() => {
        let isSubscribed = true;
        const staggerTimers: number[] = [];

        const runSetup = () => {
            if (!isSubscribed) return;
            if (!isSqliteMode()) return;
            // Fallback: refresh all from IndexedDB after sync (events may have been missed)
            const fallbackTimer = window.setTimeout(async () => {
                if (!isSubscribed || !db) return;
                const collections = ['suppliers', 'customers', 'payments', 'customerPayments', 'banks', 'bankBranches', 'bankAccounts', 'supplierBankAccounts', 'fundTransactions', 'incomes', 'expenses'];
                for (const c of collections) {
                    try {
                        if (c === 'suppliers') { const d = await db.suppliers.orderBy('srNo').reverse().limit(1000).toArray(); updateState(setSuppliers, d); }
                        else if (c === 'customers') { const d = await db.customers.orderBy('srNo').reverse().limit(1000).toArray(); updateState(setCustomers, d); }
                        else if (c === 'customerPayments') { const d = await db.customerPayments.orderBy('date').reverse().limit(1000).toArray(); updateState(setCustomerPayments, d); }
                        else if (c === 'payments') { const d = await db.payments.orderBy('date').reverse().limit(1000).toArray(); updateState(setSupplierPayments, d); }
                        else if (c === 'banks') { const d = await db.banks.toArray(); updateState(setBanks, d); }
                        else if (c === 'bankBranches') { const d = await db.bankBranches.toArray(); updateState(setBankBranches, d); }
                        else if (c === 'bankAccounts') { const d = await db.bankAccounts.toArray(); updateState(setBankAccounts, d); }
                        else if (c === 'supplierBankAccounts') { const d = await db.supplierBankAccounts.toArray(); updateState(setSupplierBankAccounts, d); }
                        else if (c === 'fundTransactions') { const d = await db.fundTransactions.orderBy('date').reverse().toArray(); updateState(setFundTransactions, d); }
                        else if (c === 'incomes' && db.transactions) { const d = await db.transactions.where('type').equals('Income').toArray(); (d as any).sort((a: any, b: any) => (b.date || '').localeCompare(a.date || '')); updateState(setIncomes, d); }
                        else if (c === 'expenses' && db.transactions) { const d = await db.transactions.where('type').equals('Expense').toArray(); (d as any).sort((a: any, b: any) => (b.date || '').localeCompare(a.date || '')); updateState(setExpenses, d); }
                    } catch {}
                }
                // Load receipt settings from local IndexedDB
                getReceiptSettingsFromLocal().then((settings) => {
                    if (isSubscribed && settings) setReceiptSettings(settings);
                });
            }, 2500);
            staggerTimers.push(fallbackTimer);
        };
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            (window as any).requestIdleCallback(runSetup, { timeout: 150 });
        } else {
            setTimeout(runSetup, 50);
        }

        const onCompanyChanged = () => {
            if (!isSubscribed) return;
            if (isSqliteMode()) void syncAllData();
        };
        const onRefreshRequested = () => {
            if (isSubscribed && isSqliteMode()) void syncAllData();
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
            staggerTimers.forEach((t) => clearTimeout(t));
        };
    }, [updateState]);
    
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
        upsertSupplierPayment,
        deleteSupplierPayment,
        upsertCustomerPayment,
        deleteCustomerPayment,
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
        upsertSupplierPayment,
        deleteSupplierPayment,
        upsertCustomerPayment,
        deleteCustomerPayment,
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
