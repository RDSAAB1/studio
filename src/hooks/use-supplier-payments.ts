
"use client";

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useSupplierData } from './use-supplier-data';
import { useSupplierPaymentsForm } from './use-supplier-payments-form';
import { processPaymentLogic, handleEditPaymentLogic as originalHandleEditPaymentLogic, handleDeletePaymentLogic } from '@/lib/payment-logic';
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
        form.resetPaymentForm(); 
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
                // Open the modal only after a selection is confirmed
                 if (!form.editingPayment) {
                    setTimeout(() => setIsOutstandingModalOpen(true), 100);
                 }
            }
        }
    };

    const processPayment = async () => {
        setIsProcessing(true);
        try {
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
    
    const handleDeletePayment = async (paymentToDelete: Payment, isEditing: boolean = false) => {
         try {
            await handleDeletePaymentLogic(paymentToDelete, isEditing); 
            if (!isEditing) {
                toast({ title: `Payment deleted successfully.`, variant: 'success', duration: 3000 });
            }
            if (form.editingPayment?.id === paymentToDelete.id) {
              form.resetPaymentForm();
            }
        } catch (error: any) {
            console.error("Error deleting payment:", error);
            toast({ title: "Failed to delete payment.", description: error.message, variant: "destructive" });
        }
    };
    
    const handleEditPayment = async (paymentToEdit: any) => {
        try {
            const contextForEdit = { ...data, ...form, ...cdHook, selectedEntries };
            await originalHandleEditPaymentLogic(paymentToEdit, contextForEdit, handleCustomerSelect);
            setActiveTab('processing');
            toast({ title: `Editing Payment ${paymentToEdit.paymentId || paymentToEdit.rtgsSrNo}`, description: "Details loaded. Make changes and re-save." });
        } catch (error: any) {
            toast({ title: "Cannot Edit", description: error.message, variant: "destructive" });
            form.setEditingPayment(null);
        }
    };

    const handlePaySelectedOutstanding = () => {
        if (form.editingPayment) {
            const {
                setPaymentId, setRtgsSrNo, setPaymentAmount, setPaymentType,
                setPaymentMethod, setSelectedAccountId, setCdEnabled, setCdAt,
                setCdPercent, setUtrNo, setCheckNo, setSixRNo, setSixRDate,
                setParchiNo, setRtgsQuantity, setRtgsRate, setRtgsAmount,
                setSupplierDetails, setBankDetails, setPaymentDate
            } = form;

            const paymentToEdit = form.editingPayment;
            setPaymentId(paymentToEdit.paymentId);
            setRtgsSrNo(paymentToEdit.rtgsSrNo || '');
            setPaymentAmount(paymentToEdit.amount);
            setPaymentType(paymentToEdit.type);
            setPaymentMethod(paymentToEdit.receiptType);
            setSelectedAccountId(paymentToEdit.bankAccountId || 'CashInHand');
            
            setCdEnabled(!!paymentToEdit.cdApplied);
            if (paymentToEdit.cdApplied && paymentToEdit.cdAmount && paymentToEdit.amount) {
                const baseForCd = paymentToEdit.type === 'Full' 
                    ? (paymentToEdit.paidFor || []).reduce((sum, pf) => sum + (data.suppliers.find((s: Customer) => s.srNo === pf.srNo)?.originalNetAmount || 0), 0)
                    : paymentToEdit.amount;
                if (baseForCd > 0) {
                    setCdPercent(Number(((paymentToEdit.cdAmount / baseForCd) * 100).toFixed(2)));
                }
                setCdAt(paymentToEdit.type === 'Full' ? 'on_full_amount' : 'partial_on_paid');
            }

            setUtrNo(paymentToEdit.utrNo || '');
            setCheckNo(paymentToEdit.checkNo || '');
            setSixRNo(paymentToEdit.sixRNo || '');
             if (paymentToEdit.sixRDate) {
                const sixRDateObj = new Date(paymentToEdit.sixRDate + "T00:00:00");
                setSixRDate(sixRDateObj);
            } else {
                setSixRDate(undefined);
            }
            setParchiNo(paymentToEdit.parchiNo || (paymentToEdit.paidFor || []).map(pf => pf.srNo).join(', '));
            setRtgsQuantity(paymentToEdit.quantity || 0);
            setRtgsRate(paymentToEdit.rate || 0);
            setRtgsAmount(paymentToEdit.rtgsAmount || 0);
            setSupplierDetails({
                name: paymentToEdit.supplierName || '', fatherName: paymentToEdit.supplierFatherName || '',
                address: paymentToEdit.supplierAddress || '', contact: ''
            });
            setBankDetails({
                acNo: paymentToEdit.bankAcNo || '', ifscCode: paymentToEdit.bankIfsc || '',
                bank: paymentToEdit.bankName || '', branch: paymentToEdit.bankBranch || '',
            });
            
            if (paymentToEdit.date) {
                const dateParts = paymentToEdit.date.split('-').map(Number);
                const utcDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
                setPaymentDate(utcDate);
            }
        }
        
        setIsOutstandingModalOpen(false);
    };

    const selectPaymentAmount = (option: { quantity: number; rate: number; calculatedAmount: number; amountRemaining: number; }) => {
        form.setRtgsQuantity(option.quantity);
        form.setRtgsRate(option.rate);
        form.setRtgsAmount(option.calculatedAmount);
        toast({ title: `Selected: ${option.quantity} Qtl @ ${option.rate}`});
    };
    

    return {
        ...data,
        ...form,
        ...cdHook,
        setCdPercent: cdHook.setCdPercent,
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
