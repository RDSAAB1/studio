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
    const [detailsSupplierEntry, setDetailsSupplierEntry] = useState<any | null>(null);
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
        const p = payment as any;
        form.setSupplierDetails({
            name: p.supplierName || p.supplierDetails?.name || '',
            fatherName: p.supplierFatherName || p.supplierDetails?.fatherName || '',
            address: p.supplierAddress || p.supplierDetails?.address || '',
            contact: '',
        });
        form.setBankDetails({
            acNo: p.bankAcNo || p.bankDetails?.acNo || '',
            ifscCode: p.bankIfsc || p.bankDetails?.ifscCode || '',
            bank: p.bankName || p.bankDetails?.bank || '',
            branch: p.bankBranch || p.bankDetails?.branch || '',
        });
        if (payment.date) {
            form.setPaymentDate(new Date(payment.date));
        }
        setActiveTab('process');
    }, [form]);

    const handleDeletePayment = useCallback(async (payment: Payment) => {
        const { confirm } = await import("@/lib/confirm-dialog");
        const confirmed = await confirm(`Are you sure you want to delete payment ${payment.paymentId || payment.rtgsSrNo || payment.id}?`, {
            title: "Confirm Delete",
            variant: "destructive",
            confirmText: "Delete",
        });
        if (!confirmed) {
            return;
        }

        try {
            setIsProcessing(true);
            // Get paymentId - for RTGS payments, id is usually rtgsSrNo or paymentId
            const paymentId = payment.id || payment.paymentId || payment.rtgsSrNo;
            
            if (!paymentId) {
                throw new Error("Payment ID is missing. Cannot delete payment.");
            }

            // Immediately remove from local state for instant UI feedback
            if (data?.removePaymentFromState) {
                data.removePaymentFromState(paymentId);
            }

            await handleDeletePaymentLogic({
                paymentId: paymentId,
                paymentHistory: data?.paymentHistory || [],
                suppliers: data?.suppliers || [],
                expenses: data?.expenses || [],
                incomes: (data as any)?.incomes || [],
                isCustomer: false,
            });
            
            toast({
                title: "Payment Deleted",
                description: `Payment ${payment.paymentId || payment.rtgsSrNo || payment.id} has been deleted.`,
            });
        } catch (error: any) {
            // If delete failed, the realtime listener will restore the payment
            // So we don't need to manually restore it here
            toast({
                title: "Error",
                description: error.message || "Failed to delete payment",
                variant: "destructive",
            });
        } finally {
            setIsProcessing(false);
        }
    }, [toast, data]);

    const handleProcessPayment = useCallback(async () => {
        if (isProcessing) return;

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
                finalAmountToPay: form.rtgsAmount,
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
        handleEditPayment,
        handleDeletePayment,
        processPayment: handleProcessPayment,
        activeTab,
        setActiveTab,
        selectedEntries: [],
        isProcessing,
        detailsSupplierEntry,
        setDetailsSupplierEntry,
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






