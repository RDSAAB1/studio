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
        if (multiSupplierMode) {
            return data.suppliers.filter((s: Customer) => form.selectedEntryIds.has(s.id));
        }
        
        // If selectedCustomerKey is set, use it
        if (form.selectedCustomerKey) {
            const profile = data.customerSummaryMap.get(form.selectedCustomerKey);
            if (profile && Array.isArray(profile.allTransactions)) {
                return profile.allTransactions.filter((s: Customer) => form.selectedEntryIds.has(s.id));
            }
        }
        
        // Fallback: If no customerKey but entries are selected
        if (form.selectedEntryIds.size > 0) {
            let foundEntries: Customer[] = [];
            for (const [key, profile] of data.customerSummaryMap.entries()) {
                if (profile && Array.isArray(profile.allTransactions)) {
                    const matchingEntries = profile.allTransactions.filter((s: Customer) => form.selectedEntryIds.has(s.id));
                    if (matchingEntries.length > 0) {
                        foundEntries = [...foundEntries, ...matchingEntries];
                    }
                }
            }
            
            if (foundEntries.length > 0) {
                return foundEntries;
            }
            
            return data.suppliers.filter((s: Customer) => form.selectedEntryIds.has(s.id));
        }
        
        return [];
    }, [multiSupplierMode, form.selectedCustomerKey, data.customerSummaryMap, form.selectedEntryIds, data.suppliers]);
    
    const totalOutstandingForSelected = useMemo(() => {
        if (form.editingPayment) {
            const editingPayment = form.editingPayment;
            return selectedEntries.reduce((sum, entry) => {
                const originalAmount = Number(entry.originalNetAmount || entry.netAmount) || 0;
                
                const otherPaymentsForThisEntry = (data.paymentHistory || [])
                    .filter(p => p.id !== editingPayment.id && p.paidFor?.some(pf => pf.srNo === entry.srNo));

                let totalPaidForEntry = 0;
                let totalCdForEntry = 0;

                otherPaymentsForThisEntry.forEach(payment => {
                    const paidForThisPurchase = payment.paidFor!.find(pf => pf.srNo === entry.srNo);
                    if (paidForThisPurchase) {
                        totalPaidForEntry += Number(paidForThisPurchase.amount || 0);
                        
                        if ('cdAmount' in paidForThisPurchase && paidForThisPurchase.cdAmount !== undefined && paidForThisPurchase.cdAmount !== null) {
                            totalCdForEntry += Number(paidForThisPurchase.cdAmount || 0);
                        } else if (payment.cdAmount && payment.paidFor && payment.paidFor.length > 0) {
                            const totalPaidForInPayment = payment.paidFor.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0);
                            if (totalPaidForInPayment > 0) {
                                const proportion = Number(paidForThisPurchase.amount || 0) / totalPaidForInPayment;
                                totalCdForEntry += Math.round(payment.cdAmount * proportion * 100) / 100;
                            }
                        }
                    }
                });

                const currentOutstanding = originalAmount - totalPaidForEntry - totalCdForEntry;
                return sum + Math.max(0, currentOutstanding);
            }, 0);
        }
        
        // NEW PAYMENT MODE (Customer): Calculate outstanding from payment history
        const totalOutstanding = selectedEntries.reduce((sum, entry) => {
            if ('outstandingForEntry' in entry && entry.outstandingForEntry !== undefined) {
                return sum + Number(entry.outstandingForEntry || 0);
            }
            
            const originalAmount = Number(entry.originalNetAmount || entry.netAmount) || 0;
            const entrySrNo = entry.srNo?.toLowerCase();
            if (!entrySrNo) return sum;
            
            const paymentsForEntry = (data.paymentHistory || []).filter((p: Payment) => 
                p.paidFor?.some(pf => (pf.srNo || "").toLowerCase() === entrySrNo)
            );
            
            let totalPaidForEntry = 0;
            let totalCdForEntry = 0;
            
            paymentsForEntry.forEach((payment: Payment) => {
                const paidForEntry = payment.paidFor?.find(pf => (pf.srNo || "").toLowerCase() === entrySrNo);
                if (paidForEntry) {
                    totalPaidForEntry += Number(paidForEntry.amount || 0);
                    
                    if ('cdAmount' in paidForEntry && paidForEntry.cdAmount !== undefined && paidForEntry.cdAmount !== null) {
                        totalCdForEntry += Number(paidForEntry.cdAmount || 0);
                    } else if (payment.cdAmount && payment.paidFor && payment.paidFor.length > 0) {
                        const totalPaidForInPayment = payment.paidFor.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0);
                        if (totalPaidForInPayment > 0) {
                            const proportion = Number(paidForEntry.amount || 0) / totalPaidForInPayment;
                            totalCdForEntry += Math.round(payment.cdAmount * proportion * 100) / 100;
                        }
                    }
                }
            });
            
            const outstanding = originalAmount - totalPaidForEntry - totalCdForEntry;
            return sum + Math.max(0, outstanding);
        }, 0);
        
        return totalOutstanding;
    }, [selectedEntries, form.editingPayment, data.paymentHistory]);

    const calcTargetAmount = useCallback(() => {
        return totalOutstandingForSelected;
    }, [totalOutstandingForSelected]);

    const minRate = useMemo(() => {
        if (selectedEntries.length === 0) return 0;
        const rates = selectedEntries.map(e => Number(e.rate || 0)).filter(r => r > 0);
        return rates.length > 0 ? Math.min(...rates) : 0;
    }, [selectedEntries]);

    const maxRate = useMemo(() => {
        if (selectedEntries.length === 0) return 0;
        const rates = selectedEntries.map(e => Number(e.rate || 0)).filter(r => r > 0);
        return rates.length > 0 ? Math.max(...rates) : 0;
    }, [selectedEntries]);

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
        form.setCalcTargetAmount(Math.round(value));
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
            form.setCalcTargetAmount(Math.round(finalToBePaid));
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
            // Get selected entries based on current selectedEntryIds
            let entries: Customer[] = [];
            if (multiSupplierMode) {
                entries = (data.suppliers || []).filter((s: Customer) => form.selectedEntryIds.has(s.id));
            } else if (form.selectedCustomerKey) {
                const profile = data.customerSummaryMap.get(form.selectedCustomerKey);
                if (profile && Array.isArray(profile.allTransactions)) {
                    entries = profile.allTransactions.filter((s: Customer) => form.selectedEntryIds.has(s.id));
                }
            } else {
                // Fallback: search in all suppliers if customerKey is not set
                entries = (data.suppliers || []).filter((s: Customer) => form.selectedEntryIds.has(s.id));
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
        if (selectedEntries.length === 0) {
            toast({ title: "No entries selected", variant: "destructive" });
            return;
        }

        setIsProcessing(true);
        try {
            const result = await processPaymentLogic({ 
                ...data, 
                ...form, 
                ...cdProps, 
                calculatedCdAmount: effectiveCdAmount, 
                selectedEntries, 
                paymentAmount: toBePaidAmount, 
                settleAmount, 
                totalOutstandingForSelected,
                isCustomer: true // Mark as customer payment
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
            console.error("Error processing payment:", error);
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

    const handleDeletePayment = useCallback(async (paymentId: string) => {
        try {
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
            console.error("Error deleting payment:", error);
            toast({ title: "Failed to delete payment", description: (error as Error).message, variant: "destructive" });
        }
    }, [data, toast]);

    return {
        suppliers: data.suppliers,
        paymentHistory: data.paymentHistory,
        customerSummaryMap: data.customerSummaryMap,
        selectedCustomerKey: form.selectedCustomerKey,
        selectedEntryIds: form.selectedEntryIds,
        handleCustomerSelect,
        handleEditPayment,
        handleDeletePayment,
        calcTargetAmount,
        minRate,
        maxRate,
        serialNoSearch: form.serialNoSearch || '',
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
        ...form, // Spread form first to get all form properties
        ...cdProps, // Spread CD props
        calculatedCdAmount: effectiveCdAmount,
        // Explicitly set these after spread to ensure they're available
        setParchiNo: form.setParchiNo,
        parchiNo: form.parchiNo,
    };
};

