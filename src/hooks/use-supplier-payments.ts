
"use client";

import { useState, useCallback, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useSupplierData } from './use-supplier-data';
import { usePaymentCalculations } from './use-payment-calculations';
import { useSupplierPaymentsForm } from './use-supplier-payments-form';
import { processPaymentLogic, handleEditPaymentLogic, handleDeletePaymentLogic } from '@/lib/payment-logic';
import { toTitleCase } from '@/lib/utils';
import { addBank } from '@/lib/firestore';

export const useSupplierPayments = () => {
    const { toast } = useToast();
    const data = useSupplierData();
    const form = useSupplierPaymentsForm(data.paymentHistory, data.expenses);
    const calculations = usePaymentCalculations(data, form);

    const [isProcessing, setIsProcessing] = useState(false);
    const [detailsSupplierEntry, setDetailsSupplierEntry] = useState<any | null>(null);
    const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState<any | null>(null);
    const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);
    const [isBankSettingsOpen, setIsBankSettingsOpen] = useState(false);
    const [rtgsReceiptData, setRtgsReceiptData] = useState<any | null>(null);

    const handleCustomerSelect = (key: string | null) => {
        form.setSelectedCustomerKey(key);
        if (key) {
            const customerData = calculations.customerSummaryMap.get(key);
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
            }
        }
        form.resetPaymentForm();
    };

    const processPayment = async () => {
        setIsProcessing(true);
        try {
            const finalPaymentData = await processPaymentLogic({ ...data, ...form, ...calculations });
            toast({ title: `Payment processed successfully.`, variant: 'success' });
            if (form.paymentMethod === 'RTGS' && finalPaymentData) {
                setRtgsReceiptData(finalPaymentData);
            }
            form.resetPaymentForm(form.rtgsFor === 'Outsider');
        } catch (error: any) {
            console.error("Error processing payment:", error);
            toast({ title: "Transaction Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleEditPayment = async (paymentToEdit: any) => {
        try {
            await handleEditPaymentLogic(paymentToEdit, { ...data, ...form });
            toast({ title: `Editing Payment ${paymentToEdit.paymentId}`, description: "Details loaded. Make changes and re-save." });
        } catch (error: any) {
            toast({ title: "Cannot Edit", description: error.message, variant: "destructive" });
            form.setEditingPayment(null);
        }
    };

    const handleDeletePayment = async (paymentIdToDelete: string, isEditing: boolean = false) => {
         try {
            await handleDeletePaymentLogic(paymentIdToDelete, data.paymentHistory);
            if (!isEditing) {
                toast({ title: `Payment deleted successfully.`, variant: 'success', duration: 3000 });
            }
            if (form.editingPayment?.id === paymentIdToDelete) {
              form.resetPaymentForm();
            }
        } catch (error: any) {
            console.error("Error deleting payment:", error);
            toast({ title: "Failed to delete payment.", description: error.message, variant: "destructive" });
        }
    };

    const handlePaySelectedOutstanding = () => {
        if (form.selectedEntryIds.size === 0) {
            toast({ title: "No Entries Selected.", variant: "destructive" });
            return;
        }
        setIsOutstandingModalOpen(false);
    };

    return {
        ...data,
        ...form,
        ...calculations,
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
        processPayment,
        handleEditPayment,
        handleDeletePayment,
        handleCustomerSelect,
        handlePaySelectedOutstanding,
        addBank: async (name: string) => { await addBank(name); toast({title: 'Bank Added', variant: 'success'}); }
    };
};
