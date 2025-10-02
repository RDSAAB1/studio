
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
                 setTimeout(() => setIsOutstandingModalOpen(true), 100);
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
            await originalHandleEditPaymentLogic(paymentToEdit, { ...data, ...form, ...cdHook }, handleCustomerSelect);
            setActiveTab('processing');
            toast({ title: `Editing Payment ${paymentToEdit.paymentId || paymentToEdit.rtgsSrNo}`, description: "Details loaded. Make changes and re-save." });
        } catch (error: any) {
            toast({ title: "Cannot Edit", description: error.message, variant: "destructive" });
            form.setEditingPayment(null);
        }
    };

    const handlePaySelectedOutstanding = () => {
        if (form.selectedEntryIds.size === 0) {
            toast({ title: "No Entries Selected.", variant: "destructive" });
            return;
        }
        
        const srNos = Array.from(form.selectedEntryIds).map(id => {
            const entry = data.suppliers.find((s: Customer) => s.id === id);
            return entry ? entry.srNo : '';
        }).filter(Boolean);
        
        form.setParchiNo(srNos.join(', '));
        
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
