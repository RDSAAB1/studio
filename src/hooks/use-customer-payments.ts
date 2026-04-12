"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { generateReadableId } from '@/lib/utils';
import type { Payment, Expense, BankAccount } from '@/lib/definitions';
import { format } from 'date-fns';
import { useCashDiscount } from './use-cash-discount';
import { useSupplierPaymentsForm } from './use-supplier-payments-form';
import { processPaymentLogic, handleDeletePaymentLogic } from '@/lib/payment-logic';
import { useToast } from "@/hooks/use-toast";
import { useCustomerData } from './use-customer-data';
import { calculateOutstandingForEntry, calculateGlobalSimulation } from "@/lib/outstanding-calculator";
import type { Customer } from "@/lib/definitions";

export const useCustomerPayments = () => {
    const { toast } = useToast();
    const data = useCustomerData();

    const handleConflict = (message: string) => {
        toast({
            title: "ID Occupied",
            description: message,
            variant: "destructive",
        });
    };

    // Use the same form hook but with customer payment history
    const form = useSupplierPaymentsForm(data.paymentHistory, data.expenses, data.bankAccounts, handleConflict, 'customer');
    const {
        serialNoSearch,
        setParchiNo,
        parchiNo,
        minRate: formMinRate,
        maxRate: formMaxRate,
        selectedCustomerKey,
        selectedEntryIds,
        ...formRest
    } = form;

    const [isProcessing, setIsProcessing] = useState(false);
    const [multiSupplierMode, setMultiSupplierMode] = useState(false);
    const [detailsSupplierEntry, setDetailsSupplierEntry] = useState<any | null>(null);
    const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState<any | null>(null);
    const [isBankSettingsOpen, setIsBankSettingsOpen] = useState(false);
    const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);
    const [rtgsReceiptData, setRtgsReceiptData] = useState<any | null>(null);
    const [activeTab, setActiveTab] = useState('process');
    
    const selectedEntries = useMemo(() => {
        if (!Array.isArray(data.suppliers)) return [];
        const isEntrySelected = (entry: Customer) =>
            form.selectedEntryIds.has(entry.id) || (!!entry.srNo && form.selectedEntryIds.has(entry.srNo));
        if (multiSupplierMode) {
            return data.suppliers.filter(isEntrySelected);
        }
        
        // If selectedCustomerKey is set, use it
        if (form.selectedCustomerKey) {
            const profile = data.customerSummaryMap.get(form.selectedCustomerKey);
            if (profile && Array.isArray(profile.allTransactions)) {
                return profile.allTransactions.filter(isEntrySelected);
            }
        }
        
        // Fallback: If no customerKey but entries are selected
        if (form.selectedEntryIds.size > 0) {
            let foundEntries: Customer[] = [];
            for (const [key, profile] of data.customerSummaryMap.entries()) {
                if (profile && Array.isArray(profile.allTransactions)) {
                    const matchingEntries = profile.allTransactions.filter(isEntrySelected);
                    if (matchingEntries.length > 0) {
                        foundEntries = [...foundEntries, ...matchingEntries];
                    }
                }
            }
            
            if (foundEntries.length > 0) {
                return foundEntries;
            }
            
            return data.suppliers.filter(isEntrySelected);
        }
        
        return [];
    }, [multiSupplierMode, form.selectedCustomerKey, data.customerSummaryMap, form.selectedEntryIds, data.suppliers]);
    
    const totalOutstandingForSelected = useMemo(() => {
        if (!selectedEntries || selectedEntries.length === 0) return 0;
        const paymentHistory = data.paymentHistory || [];
        const historyToUse = form.editingPayment
            ? paymentHistory.filter(p => p.id !== form.editingPayment!.id)
            : paymentHistory;

        // Use group-wide simulation for accuracy
        const profile = form.selectedCustomerKey ? data.customerSummaryMap.get(form.selectedCustomerKey) : null;
        if (profile && Array.isArray(profile.allTransactions) && profile.allTransactions.length > 0) {
            const resMap = calculateGlobalSimulation(profile.allTransactions, historyToUse);
            return selectedEntries.reduce((sum, entry) => {
                const sr = String(entry.srNo || "").toLowerCase();
                const res = resMap.get(sr);
                return sum + (res?.outstanding ?? 0);
            }, 0);
        }

        return selectedEntries.reduce((sum, entry) => {
            const { outstanding } = calculateOutstandingForEntry(entry, historyToUse);
            return sum + outstanding;
        }, 0);
    }, [selectedEntries, form.editingPayment, data.paymentHistory, form.selectedCustomerKey, data.customerSummaryMap]);

    // Use useMemo to derive values instead of useState to avoid infinite loops
    const settleAmountDerived = useMemo(() => {
        if (form.paymentType === 'Full') {
            return totalOutstandingForSelected;
        }
        // For Partial, this will be overridden by state
        return 0;
    }, [form.paymentType, totalOutstandingForSelected]);

    const [settleAmountManual, setSettleAmountManual] = useState(0);
    const [toBePaidAmountManual, setToBePaidAmountManual] = useState(0);

    const settleAmount = (form.paymentType === 'Full') ? settleAmountDerived : settleAmountManual;

    // For Partial payments, use toBePaidAmountManual as base for CD calculation
    // For Full payments, use settleAmount
    const baseAmountForCd = form.paymentType === 'Partial' ? toBePaidAmountManual : settleAmount;

    const { calculatedCdAmount, setCdAmount, ...cdProps } = useCashDiscount({
        paymentType: form.paymentType,
        totalOutstanding: totalOutstandingForSelected,
        settleAmount: settleAmount,
        toBePaidAmount: baseAmountForCd, // Use toBePaidAmountManual for Partial, settleAmount for Full
        selectedEntries: selectedEntries,
        paymentDate: form.paymentDate,
        paymentHistory: data.paymentHistory,
        selectedCustomerKey: form.selectedCustomerKey,
        editingPayment: form.editingPayment, // Pass editing payment to exclude from CD calculations
    });
    
    // IMPORTANT: Only apply CD if cdEnabled is true
    const effectiveCdAmount = cdProps.cdEnabled ? calculatedCdAmount : 0;
    
    // To Be Paid amount is the actual payment amount that will be transferred
    // For Full payment: To Be Paid = settleAmount - CD (cash matches settlement minus discount)
    // For Partial payment: To Be Paid = toBePaidAmountManual (user entered amount)
    // Total settlement = To Be Paid + CD
    const finalToBePaid = useMemo(() => {
        if (form.paymentType === 'Full') {
            // For Full payment: actual cash paid = settle amount - CD (only if CD is enabled)
            const adjustedToBePaid = settleAmount - effectiveCdAmount;
            return Math.max(0, Math.round(adjustedToBePaid * 100) / 100);
        }
        // For Partial payment type: toBePaidAmount remains as entered (CD is NOT deducted)
        // Settle Amount = toBePaidAmount + CD (handled separately in useEffect)
        return Math.max(0, Math.round(toBePaidAmountManual * 100) / 100);
    }, [form.paymentType, settleAmount, effectiveCdAmount, toBePaidAmountManual]);
    
    // Use finalToBePaid as the actual toBePaidAmount
    const toBePaidAmount = finalToBePaid;
    
    const handleSettleAmountChange = (value: number) => {
        if (form.paymentType === 'Partial') {
            setSettleAmountManual(value);
        }
    };

    const handleToBePaidChange = (value: number) => {
        setToBePaidAmountManual(value);
    };

    // Auto-calculate settle amount for Partial payment type
    // IMPORTANT: Only add CD to settlement if CD is enabled
    useEffect(() => {
        if (form.paymentType === 'Partial') {
            const newSettleAmount = toBePaidAmountManual + effectiveCdAmount;
            const roundedSettle = Math.round(newSettleAmount * 100) / 100;
            const currentSettle = Math.round(settleAmountManual * 100) / 100;
            
            if (roundedSettle !== currentSettle) {
                setSettleAmountManual(roundedSettle);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toBePaidAmountManual, effectiveCdAmount, form.paymentType]);

    // Auto-update Target Amount when To Be Paid changes in Full mode
    useEffect(() => {
        if (form.paymentType === 'Full') {
            // form.setCalcTargetAmount(Math.round(finalToBePaid)); // Removed
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [finalToBePaid, form.paymentType]);

    // Reset amounts when payment type changes (if not editing)
    useEffect(() => {
        if (!form.isBeingEdited) {
            if (form.paymentType === 'Full') {
                setToBePaidAmountManual(0);
                setSettleAmountManual(0);
            } else {
                setToBePaidAmountManual(0);
                setSettleAmountManual(0);
            }
        }
    }, [form.paymentType, form.isBeingEdited]);

    // Update parchiNo when selectedEntries changes
    useEffect(() => {
        if (selectedEntries.length > 0) {
            // Always update parchiNo based on selected entries, even in edit mode
            const srNos = selectedEntries.map(e => e.srNo).filter(Boolean).join(', ');
            if (srNos) {
                form.setParchiNo(srNos);
            }
        } else if (!form.isBeingEdited) {
            // Only clear parchiNo for new payments if no entries selected
            form.setParchiNo('');
        }
    }, [selectedEntries, form.setParchiNo, form.isBeingEdited]);
    
    // Also update parchiNo when selectedEntryIds changes directly (for immediate updates when entries are selected from table)
    // This ensures parchiNo updates immediately when entries are selected from table
    // Works for all payment methods: Cash, Online, RTGS
    useEffect(() => {
        if (form.selectedEntryIds.size > 0) {
            const isEntrySelected = (entry: Customer) =>
                form.selectedEntryIds.has(entry.id) || (!!entry.srNo && form.selectedEntryIds.has(entry.srNo));
            // Get selected entries based on current selectedEntryIds
            let entries: Customer[] = [];
            if (multiSupplierMode) {
                entries = (data.suppliers || []).filter(isEntrySelected);
            } else if (form.selectedCustomerKey) {
                const profile = data.customerSummaryMap.get(form.selectedCustomerKey);
                if (profile && Array.isArray(profile.allTransactions)) {
                    entries = profile.allTransactions.filter(isEntrySelected);
                }
            } else {
                // Fallback: search in all suppliers if customerKey is not set
                entries = (data.suppliers || []).filter(isEntrySelected);
            }
            
            if (entries.length > 0) {
                const srNos = entries.map(e => e.srNo).filter(Boolean).join(', ');
                if (srNos) {
                    // Always update parchiNo regardless of current value to ensure it's synced
                    form.setParchiNo(srNos);
                }
            }
        } else if (!form.isBeingEdited && form.parchiNo) {
            // Clear parchiNo when no entries selected (only for new payments)
            form.setParchiNo('');
        }
    }, [form.selectedEntryIds, multiSupplierMode, form.selectedCustomerKey, data.customerSummaryMap, data.suppliers, form.parchiNo, form.setParchiNo, form.isBeingEdited]);

    const handleCustomerSelect = useCallback((key: string | null) => {
        form.setSelectedCustomerKey(key);
        form.setSelectedEntryIds(new Set());
        form.setPaymentAmount(0);
        form.setEditingPayment(null);
    }, [form]);

    const handleProcessPayment = useCallback(async () => {
        if (isProcessing) return;

        if (selectedEntries.length === 0) {
            toast({ title: "No entries selected", variant: "destructive" });
            return;
        }

        // Balance check: selected "Payment From" must have enough balance (skip for Gov.)
        if (form.paymentMethod !== 'Gov.') {
            const balanceKey = form.paymentMethod === 'Cash'
                ? (form.selectedAccountId || 'CashInHand')
                : form.selectedAccountId;
            if (!balanceKey && (form.paymentMethod === 'Online' || form.paymentMethod === 'RTGS' || form.paymentMethod === 'Ledger')) {
                toast({ title: "Select account", description: "Please select Payment From account.", variant: "destructive" });
                return;
            }
            const balances = data.financialState?.balances;
            const available = balances && balanceKey ? (balances.get(balanceKey) ?? 0) : 0;
            if (available < toBePaidAmount) {
                toast({ title: "Not enough balance", description: "Selected account does not have sufficient balance for this payment.", variant: "destructive" });
                return;
            }
        }

        setIsProcessing(true);
        try {
            // Build SR No to Net Amount map for accurate proportional legacy splitting
            const netAmountMap = new Map<string, number>();
            (data.suppliers || []).forEach(s => {
                const srNo = String(s.srNo || '').trim().toLowerCase();
                if (srNo) {
                    netAmountMap.set(srNo, Number(s.originalNetAmount || s.netAmount || 0));
                }
            });

            const historyToUse = form.editingPayment
                ? (data.paymentHistory || []).filter(p => p.id !== form.editingPayment!.id)
                : (data.paymentHistory || []);

            // Build entry outstandings for breakdown calculation
            const profile = form.selectedCustomerKey ? data.customerSummaryMap.get(form.selectedCustomerKey) : null;
            let groupResMap = new Map();
            if (profile && Array.isArray(profile.allTransactions) && profile.allTransactions.length > 0) {
                groupResMap = calculateGlobalSimulation(profile.allTransactions, historyToUse, netAmountMap);
            }

            const entryOutstandings = selectedEntries.map(entry => {
                const sr = String(entry.srNo || "").toLowerCase();
                const res = groupResMap.get(sr);
                const outstanding = res ? res.outstanding : calculateOutstandingForEntry(entry, historyToUse, netAmountMap).outstanding;
                
                return {
                    entry,
                    outstanding: outstanding,
                    originalOutstanding: outstanding,
                    originalAmount: (res ? res.adjustedOriginal : null) || Number(entry.netAmount) || 0
                };
            });

            const result = await processPaymentLogic({ 
                ...data, 
                ...form, 
                ...cdProps, 
                calculatedCdAmount: effectiveCdAmount, 
                selectedEntries, 
                entryOutstandings,
                finalAmountToPay: toBePaidAmount, 
                settleAmount, 
                totalOutstandingForSelected,
                isCustomer: true, // Mark as customer payment
            });

            if (!result.success) {
                toast({ title: "Transaction Failed", description: result.message, variant: "destructive" });
                setIsProcessing(false);
                return;
            }

            toast({ title: "Payment processed successfully", variant: "success" });
            form.resetPaymentForm();
            handleSettleAmountChange(0);
            handleToBePaidChange(0);
        } catch (error) {

            toast({ title: "Failed to process payment", description: (error as Error).message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    }, [selectedEntries, form, data, toast, cdProps, effectiveCdAmount, toBePaidAmount, settleAmount, totalOutstandingForSelected, handleSettleAmountChange, handleToBePaidChange]);

    const handleEditPayment = useCallback((payment: Payment) => {
        form.setEditingPayment(payment);
        form.setPaymentType(payment.type || 'Full');
        form.setPaymentMethod(payment.receiptType === 'RTGS' ? 'RTGS' : payment.receiptType === 'Online' ? 'Online' : 'Cash');
        form.setSelectedAccountId(payment.bankAccountId || 'CashInHand');
        
        // Set payment amounts based on payment type
        if (payment.type === 'Full') {
            // For Full payment, set settle amount and calculate toBePaid
            const settleAmt = payment.amount + (payment.cdAmount || 0);
            handleSettleAmountChange(settleAmt);
            handleToBePaidChange(payment.amount);
        } else {
            // For Partial payment, set both amounts
            const settleAmt = payment.amount + (payment.cdAmount || 0);
            handleSettleAmountChange(settleAmt);
            handleToBePaidChange(payment.amount);
        }
        
        if (payment.customerId) {
            form.setSelectedCustomerKey(payment.customerId);
        }
        
        if (payment.paidFor && payment.paidFor.length > 0) {
            const srNos = payment.paidFor.map(pf => pf.srNo);
            const entryIds = new Set<string>();
            data.suppliers.forEach(entry => {
                if (srNos.includes(entry.srNo)) {
                    entryIds.add(entry.id);
                }
            });
            form.setSelectedEntryIds(entryIds);
        }
    }, [form, data, handleSettleAmountChange, handleToBePaidChange]);

    const handleDeletePayment = useCallback(async (paymentOrId: Payment | string) => {
        try {
            const paymentId = typeof paymentOrId === "string" ? paymentOrId : (paymentOrId?.id || paymentOrId?.paymentId);
            if (!paymentId) {
                toast({ title: "Failed to delete", description: "Payment ID is missing", variant: "destructive" });
                return;
            }
            await handleDeletePaymentLogic({
                paymentId,
                paymentHistory: data.paymentHistory,
                suppliers: data.suppliers,
                expenses: data.expenses,
                incomes: data.incomes,
                isCustomer: true,
            });
            toast({ title: "Payment deleted successfully", variant: "success" });
        } catch (error) {
            toast({ title: "Failed to delete payment", description: (error as Error).message, variant: "destructive" });
        }
    }, [data, toast]);

    return {
        suppliers: data.suppliers,
        paymentHistory: data.paymentHistory,
        customerSummaryMap: data.customerSummaryMap,
        selectedCustomerKey,
        selectedEntryIds,
        handleCustomerSelect,
        handleEditPayment,
        handleDeletePayment,
        minRate: formMinRate,
        maxRate: formMaxRate,
        serialNoSearch: serialNoSearch || '',
        activeTab,
        setActiveTab,
        selectedEntries,
        totalOutstandingForSelected,
        isProcessing,
        financialState: data.financialState,
        bankAccounts: data.bankAccounts,
        bankBranches: data.bankBranches,
        settleAmount,
        handleSettleAmountChange,
        finalAmountToBePaid: toBePaidAmount,
        handleToBePaidChange,
        processPayment: handleProcessPayment,
        ...formRest,
        ...cdProps, // Spread CD props
        calculatedCdAmount: effectiveCdAmount,
        setCdAmount,
        // Explicitly set these after spread to ensure they're available
        setParchiNo,
        parchiNo,
    };
};
