"use client";

import { useState, useMemo, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { Payment, BankAccount } from "@/lib/definitions";
import { useSupplierPaymentsForm } from './use-supplier-payments-form';
import { processPaymentLogic, handleDeletePaymentLogic } from '@/lib/payment-logic';
import { format } from 'date-fns';

export const useOutsiderPayments = (data: any) => {
    const { toast } = useToast();

    const handleConflict = (message: string) => {
        toast({
            title: "ID Occupied",
            description: message,
            variant: "destructive",
        });
    };

    // Only use payment history, expenses, and bank accounts - no supplier data
    const form = useSupplierPaymentsForm(
        data?.paymentHistory || [], 
        [], // No expenses for outsider
        data?.bankAccounts || [], 
        handleConflict
    );

    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState<any | null>(null);
    const [isBankSettingsOpen, setIsBankSettingsOpen] = useState(false);
    const [rtgsReceiptData, setRtgsReceiptData] = useState<any | null>(null);
    const [activeTab, setActiveTab] = useState('process');

    const handleEditPayment = useCallback((payment: Payment) => {
        // For outsider, we can edit RTGS payments
        form.setEditingPayment(payment);
        form.setIsBeingEdited(true);
        form.setPaymentId(payment.paymentId || payment.rtgsSrNo || '');
        form.setRtgsSrNo(payment.rtgsSrNo || '');
        form.setPaymentType(payment.type || 'Full');
        form.setPaymentAmount(payment.amount || 0);
        form.setPaymentMethod('RTGS');
        form.setSelectedAccountId(payment.bankAccountId || '');
        form.setUtrNo(payment.utrNo || '');
        form.setCheckNo(payment.checkNo || '');
        form.setSixRNo((payment as any).sixRNo || '');
        if ((payment as any).sixRDate) {
            form.setSixRDate(new Date((payment as any).sixRDate));
        }
        form.setParchiNo(payment.parchiNo || '');
        form.setRtgsQuantity((payment as any).quantity || 0);
        form.setRtgsRate((payment as any).rate || 0);
        form.setRtgsAmount((payment as any).rtgsAmount || 0);
        form.setSupplierDetails({
            name: payment.supplierName || '',
            fatherName: payment.supplierFatherName || '',
            address: (payment as any).supplierAddress || '',
            contact: '',
        });
        form.setBankDetails({
            acNo: payment.bankAcNo || '',
            ifscCode: payment.bankIfsc || '',
            bank: payment.bankName || '',
            branch: payment.bankBranch || '',
        });
        if (payment.date) {
            form.setPaymentDate(new Date(payment.date));
        }
        setActiveTab('process');
    }, [form]);

    const handleDeletePayment = useCallback(async (payment: Payment) => {
        if (!confirm(`Are you sure you want to delete payment ${payment.paymentId || payment.rtgsSrNo}?`)) {
            return;
        }

        try {
            setIsProcessing(true);
            await handleDeletePaymentLogic({
                payment,
                isCustomer: false,
            });
            toast({
                title: "Payment Deleted",
                description: `Payment ${payment.paymentId || payment.rtgsSrNo} has been deleted.`,
            });
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to delete payment",
                variant: "destructive",
            });
        } finally {
            setIsProcessing(false);
        }
    }, [toast]);

    const handleProcessPayment = useCallback(async () => {
        if (!form.paymentId && !form.rtgsSrNo) {
            toast({
                title: "Error",
                description: "Please enter a Payment ID or RTGS Serial Number",
                variant: "destructive",
            });
            return;
        }

        if (form.rtgsAmount <= 0) {
            toast({
                title: "Error",
                description: "Please enter a valid RTGS amount",
                variant: "destructive",
            });
            return;
        }

        try {
            setIsProcessing(true);
            
            const result = await processPaymentLogic({
                selectedCustomerKey: 'OUTSIDER', // Always OUTSIDER for outsider payments
                selectedEntries: [],
                editingPayment: form.editingPayment,
                paymentAmount: form.rtgsAmount,
                paymentMethod: 'RTGS',
                selectedAccountId: form.selectedAccountId,
                cdEnabled: false,
                calculatedCdAmount: 0,
                settleAmount: form.rtgsAmount,
                totalOutstandingForSelected: 0,
                paymentType: form.paymentType,
                financialState: {
                    bankAccounts: data?.bankAccounts || [],
                },
                paymentId: form.rtgsSrNo || form.paymentId,
                rtgsSrNo: form.rtgsSrNo,
                paymentDate: form.paymentDate,
                utrNo: form.utrNo,
                checkNo: form.checkNo,
                sixRNo: form.sixRNo,
                sixRDate: form.sixRDate,
                parchiNo: form.parchiNo,
                rtgsQuantity: form.rtgsQuantity,
                rtgsRate: form.rtgsRate,
                rtgsAmount: form.rtgsAmount,
                supplierDetails: form.supplierDetails,
                bankDetails: form.bankDetails,
                isCustomer: false,
            });

            if (result.success) {
                toast({
                    title: "Payment Processed",
                    description: `RTGS payment ${form.rtgsSrNo || form.paymentId} has been ${form.editingPayment ? 'updated' : 'created'}.`,
                });
                form.resetPaymentForm();
                form.setEditingPayment(null);
                form.setIsBeingEdited(false);
            } else {
                toast({
                    title: "Error",
                    description: result.message || "Failed to process payment",
                    variant: "destructive",
                });
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to process payment",
                variant: "destructive",
            });
        } finally {
            setIsProcessing(false);
        }
    }, [form, data, toast]);

    return {
        suppliers: [],
        paymentHistory: data?.paymentHistory || [],
        customerSummaryMap: new Map(),
        selectedCustomerKey: null,
        selectedEntryIds: new Set(),
        handleCustomerSelect: () => {},
        handleEditPayment,
        handleDeletePayment,
        handleProcessPayment,
        calcTargetAmount: () => 0,
        minRate: 0,
        maxRate: 0,
        serialNoSearch: '',
        activeTab,
        setActiveTab,
        selectedEntries: [],
        setParchiNo: form.setParchiNo,
        isProcessing,
        selectedPaymentForDetails,
        setSelectedPaymentForDetails,
        isBankSettingsOpen,
        setIsBankSettingsOpen,
        rtgsReceiptData,
        setRtgsReceiptData,
        receiptSettings: data?.receiptSettings || null,
        isClient: data?.isClient || false,
        loading: data?.loading || false,
        ...form,
    };
};









