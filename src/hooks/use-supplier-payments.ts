
"use client";

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useSupplierData } from './use-supplier-data';
import { useSupplierPaymentsForm } from './use-supplier-payments-form';
import { processPaymentLogic, handleDeletePaymentLogic } from '@/lib/payment-logic';
import { toTitleCase } from '@/lib/utils';
import { addBank } from '@/lib/firestore';
import type { Customer, Payment } from '@/lib/definitions';
import { useCashDiscount } from './use-cash-discount';


export const useSupplierPayments = () => {
    const { toast } = useToast();
    const data = useSupplierData();

    const handleConflict = (message: string) => {
        toast({
            title: "ID Occupied",
            description: message,
            variant: "destructive",
        });
    };

    const form = useSupplierPaymentsForm(data.paymentHistory, data.expenses, data.bankAccounts, handleConflict);

    const [isProcessing, setIsProcessing] = useState(false);
    const [detailsSupplierEntry, setDetailsSupplierEntry] = useState<any | null>(null);
    const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState<any | null>(null);
    const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);
    const [isBankSettingsOpen, setIsBankSettingsOpen] = useState(false);
    const [rtgsReceiptData, setRtgsReceiptData] = useState<any | null>(null);
    const [activeTab, setActiveTab] = useState('processing');
    
    const selectedEntries = useMemo(() => {
        if (!form.selectedEntryIds) return [];
        const safeSuppliers = Array.isArray(data.suppliers) ? data.suppliers : [];
        return safeSuppliers.filter((s: Customer) => form.selectedEntryIds.has(s.id));
    }, [data.suppliers, form.selectedEntryIds]);
    
    const cdHook = useCashDiscount({
        paymentAmount: form.paymentAmount,
        paymentType: form.paymentType,
        selectedEntries: selectedEntries,
        paymentHistory: data.paymentHistory,
        paymentDate: form.paymentDate,
    });


    const handleCustomerSelect = (key: string | null) => {
        form.setSelectedCustomerKey(key);
        if (!form.editingPayment) {
            form.resetPaymentForm();
        }
        if (key) {
            const customerData = data.customerSummaryMap.get(key);
            if (customerData) {
                form.setSupplierDetails({
                    name: customerData.name || '',
                    fatherName: customerData.so || '',
                    address: customerData.address || '',
                    contact: customerData.contact || ''
                });
                form.setBankDetails({
                    acNo: customerData.acNo || '',
                    ifscCode: customerData.ifscCode || '',
                    bank: customerData.bank || '',
                    branch: customerData.branch || '',
                });
                 if (!form.editingPayment) {
                    setTimeout(() => setIsOutstandingModalOpen(true), 100);
                 }
            }
        }
    };

    const processPayment = async () => {
        setIsProcessing(true);
        try {
            // The processPaymentLogic now internally handles editing vs new payment.
            // We've removed the explicit check for editingPayment here to avoid the confirmation dialog on every update.
            const result = await processPaymentLogic({ ...data, ...form, ...cdHook, selectedEntries });

            if (!result.success) {
                toast({ title: "Transaction Failed", description: result.message, variant: "destructive" });
                setIsProcessing(false);
                return;
            }

            toast({ title: `Payment processed successfully.`, variant: 'success' });
            if (form.paymentMethod === 'RTGS' && result.payment) {
                setRtgsReceiptData(result.payment);
            }
            form.resetPaymentForm(form.rtgsFor === 'Outsider');
        } catch (error: any) {
            console.error("Error processing payment:", error);
            toast({ title: "Transaction Failed", description: error.message || "An unexpected error occurred.", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleDeletePayment = async (paymentToDelete: Payment) => {
        setIsProcessing(true);
         try {
            await handleDeletePaymentLogic(paymentToDelete.id, data.paymentHistory); 
            toast({ title: `Payment deleted successfully.`, variant: 'success', duration: 3000 });
            if (form.editingPayment?.id === paymentToDelete.id) {
              form.resetPaymentForm();
            }
        } catch (error: any) {
            console.error("Error deleting payment:", error);
            toast({ title: "Failed to delete payment.", description: error.message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handlePaySelectedOutstanding = useCallback((paymentToEdit?: Payment) => {
        const paymentData = paymentToEdit || form.editingPayment;
        if (paymentData) {
            const {
                setPaymentId, setRtgsSrNo, setPaymentAmount, setPaymentType,
                setPaymentMethod, setSelectedAccountId, setCdEnabled, setCdAt,
                setCdPercent, setUtrNo, setCheckNo, setSixRNo, setSixRDate,
                setParchiNo, setRtgsQuantity, setRtgsRate, setRtgsAmount,
                setSupplierDetails, setBankDetails, setPaymentDate
            } = form;
    
            setPaymentId(paymentData.paymentId);
            setRtgsSrNo(paymentData.rtgsSrNo || '');
            setPaymentAmount(paymentData.amount);
            setPaymentType(paymentData.type);
            setPaymentMethod(paymentData.receiptType as 'Cash'|'Online'|'RTGS');
            setSelectedAccountId(paymentData.bankAccountId || 'CashInHand');
            
            setCdEnabled(!!paymentData.cdApplied);
            if (paymentData.cdApplied && paymentData.cdAmount && paymentData.amount) {
                const baseForCd = paymentData.type === 'Full' 
                    ? (paymentData.paidFor || []).reduce((sum, pf) => sum + (data.suppliers.find((s: Customer) => s.srNo === pf.srNo)?.originalNetAmount || 0), 0)
                    : paymentData.amount;
                if (baseForCd > 0) {
                    setCdPercent(Number(((paymentData.cdAmount / baseForCd) * 100).toFixed(2)));
                } else {
                    setCdPercent(0);
                }
                setCdAt(paymentData.type === 'Full' ? 'on_full_amount' : 'partial_on_paid');
            } else {
                 setCdEnabled(false);
                 setCdPercent(0);
            }
    
            setUtrNo(paymentData.utrNo || '');
            setCheckNo(paymentData.checkNo || '');
            setSixRNo(paymentData.sixRNo || '');
            if (paymentData.sixRDate) {
                const sixRDateObj = new Date(paymentData.sixRDate + "T00:00:00"); 
                setSixRDate(sixRDateObj);
            } else {
                setSixRDate(undefined);
            }
            setParchiNo(paymentData.parchiNo || (paymentData.paidFor || []).map(pf => pf.srNo).join(', '));
            
            setRtgsQuantity(paymentData.quantity || 0);
            setRtgsRate(paymentData.rate || 0);
            setRtgsAmount(paymentData.rtgsAmount || 0);
            
            setSupplierDetails({
                name: paymentData.supplierName || '', fatherName: paymentData.supplierFatherName || '',
                address: paymentData.supplierAddress || '', contact: '' // contact not stored in payment
            });
            setBankDetails({
                acNo: paymentData.bankAcNo || '', ifscCode: paymentData.bankIfsc || '',
                bank: paymentData.bankName || '', branch: paymentData.bankBranch || '',
            });
            
            if (paymentData.date) {
                const dateParts = paymentData.date.split('-').map(Number);
                const utcDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
                setPaymentDate(utcDate);
            }
        }
        
        setIsOutstandingModalOpen(false);
    }, [form, data.suppliers]);

    const handleEditPayment = useCallback(async (paymentToEdit: Payment) => {
        if (!paymentToEdit.id) {
            toast({ title: "Cannot Edit", description: "Payment is missing a valid ID.", variant: "destructive" });
            return;
        }
    
        setIsProcessing(true);
        form.setEditingPayment(paymentToEdit);
        setActiveTab('processing');
    
        try {
            await handleDeletePaymentLogic(paymentToEdit.id, data.paymentHistory, true);
    
            await new Promise(resolve => setTimeout(resolve, 300));
    
            let profileKey: string | undefined;
    
            if (paymentToEdit.rtgsFor === 'Outsider') {
                form.setRtgsFor('Outsider');
            } else {
                form.setRtgsFor('Supplier');
                const firstSrNo = paymentToEdit.paidFor?.[0]?.srNo;
                if (!firstSrNo) {
                    throw new Error("Payment has no associated entries to identify the supplier.");
                }
    
                const originalEntry = data.suppliers.find(s => s.srNo === firstSrNo);
                if (!originalEntry) {
                    throw new Error(`Supplier entry for SR# ${firstSrNo} not found.`);
                }
    
                profileKey = Array.from(data.customerSummaryMap.keys()).find(key => {
                    const summary = data.customerSummaryMap.get(key);
                    return toTitleCase(summary?.name || '') === toTitleCase(originalEntry.name) && toTitleCase(summary?.so || '') === toTitleCase(originalEntry.so);
                });
    
                if (!profileKey) {
                    throw new Error(`Could not find a matching supplier profile for ${originalEntry.name}.`);
                }
    
                form.setSelectedCustomerKey(profileKey);
    
                const paidForIds = data.suppliers
                    .filter(s => paymentToEdit.paidFor?.some(pf => pf.srNo === s.srNo))
                    .map(s => s.id);
                form.setSelectedEntryIds(new Set(paidForIds));
            }
    
            handlePaySelectedOutstanding(paymentToEdit);
    
            toast({ title: `Editing Payment ${paymentToEdit.paymentId || paymentToEdit.rtgsSrNo}`, description: "Details loaded. Make changes and save." });
    
        } catch (error: any) {
            console.error("Edit setup failed:", error);
            toast({ title: "Cannot Edit", description: error.message, variant: "destructive" });
            form.setEditingPayment(null); // Clear editing state on error
        } finally {
            setIsProcessing(false);
        }
    }, [data.paymentHistory, data.suppliers, data.customerSummaryMap, form, toast, handlePaySelectedOutstanding]);


    const selectPaymentAmount = (option: { quantity: number; rate: number; calculatedAmount: number; amountRemaining: number; }) => {
        form.setRtgsQuantity(option.quantity);
        form.setRtgsRate(option.rate);
        form.setRtgsAmount(option.calculatedAmount);
        toast({ title: `Selected: ${option.quantity} Qtl @ ${option.rate}`});
    };
    
    return {
        ...data,
        ...form,
        cdEnabled: cdHook.cdEnabled,
        setCdEnabled: cdHook.setCdEnabled,
        cdPercent: cdHook.cdPercent,
        setCdPercent: cdHook.setCdPercent,
        cdAt: cdHook.cdAt,
        setCdAt: cdHook.setCdAt,
        calculatedCdAmount: cdHook.calculatedCdAmount,
        isProcessing,
        detailsSupplierEntry,
        setDetailsSupplierEntry,
        selectedPaymentForDetails,
        setSelectedPaymentForDetails,
        isOutstandingModalOpen,
        setIsOutstandingModalOpen,
        isBankSettingsOpen,
        setIsBankSettingsOpen,
        rtgsReceiptData,
        setRtgsReceiptData,
        activeTab, setActiveTab,
        processPayment,
        handleEditPayment,
        handleDeletePayment,
        handleCustomerSelect,
        handlePaySelectedOutstanding,
        selectPaymentAmount,
        addBank: async (name: string) => { await addBank(name); toast({title: 'Bank Added', variant: 'success'}); },
        onConflict: handleConflict,
        selectedEntries
    };
};
