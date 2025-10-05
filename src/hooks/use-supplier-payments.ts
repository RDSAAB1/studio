
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
    const [isBankSettingsOpen, setIsBankSettingsOpen] = useState(false);
    const [rtgsReceiptData, setRtgsReceiptData] = useState<any | null>(null);
    const [activeTab, setActiveTab] = useState('processing');
    const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);
    
    const selectedEntries = useMemo(() => {
        if (!form.selectedEntryIds) return [];
        const safeSuppliers = Array.isArray(data.suppliers) ? data.suppliers : [];
        return safeSuppliers.filter((s: Customer) => form.selectedEntryIds.has(s.id));
    }, [data.suppliers, form.selectedEntryIds]);
    
    const totalOutstandingForSelected = useMemo(() => {
        return selectedEntries.reduce((sum, e) => sum + (Number(e.netAmount) || 0), 0);
    }, [selectedEntries]);

    const cdHook = useCashDiscount({
        totalOutstanding: totalOutstandingForSelected,
        paymentType: form.paymentType,
        settleAmount: form.paymentAmount,
        selectedEntries: selectedEntries,
        paymentDate: form.paymentDate,
    });
    
    const finalAmountToBePaid = useMemo(() => {
        return (form.paymentAmount || 0) - (cdHook.calculatedCdAmount || 0);
    }, [form.paymentAmount, cdHook.calculatedCdAmount]);

    const finalAmountToSettle = useMemo(() => {
        return form.paymentAmount;
    }, [form.paymentAmount]);

    // Auto-fill logic for 'Full' payment and parchi number
    useEffect(() => {
        const srNos = selectedEntries.map(e => e.srNo).join(', ');
        form.setParchiNo(srNos);

        if (form.paymentType === 'Full' && !form.isBeingEdited) {
            form.setPaymentAmount(totalOutstandingForSelected || 0);
        }
    }, [form.paymentType, form.isBeingEdited, totalOutstandingForSelected, selectedEntries, form.setParchiNo, form.setPaymentAmount]);

    // Smart auto-correction logic for partial payments
    useEffect(() => {
        const { paymentAmount, setPaymentAmount } = form;

        if (paymentAmount > totalOutstandingForSelected + 0.01) { // Add tolerance
             const adjustedPaymentAmount = totalOutstandingForSelected;
             if (Math.abs(paymentAmount - adjustedPaymentAmount) > 0.01) {
                 setPaymentAmount(adjustedPaymentAmount);
                 toast({
                    title: "Payment Adjusted",
                    description: "Settle Amount cannot exceed Outstanding. It has been adjusted.",
                    variant: "default"
                 });
             }
        }
    }, [form, totalOutstandingForSelected, toast]);

    const handleToBePaidChange = useCallback((toBePaidValue: number) => {
        const { cdEnabled, cdPercent, cdAt } = cdHook;
        const { setPaymentAmount } = form;

        if (cdEnabled && cdPercent > 0) {
            let newSettleAmount = toBePaidValue;
            if (cdAt === 'partial_on_paid') {
                 if (cdPercent < 100) {
                    newSettleAmount = toBePaidValue / (1 - (cdPercent / 100));
                 }
            } else if (cdAt === 'on_unpaid_amount') {
                 newSettleAmount = (toBePaidValue + totalOutstandingForSelected * (cdPercent / 100)) / (1 + (cdPercent / 100));
            } else if (cdAt === 'on_full_amount') {
                 const fullCd = totalOutstandingForSelected * (cdPercent / 100);
                 newSettleAmount = toBePaidValue + fullCd;
            }
            setPaymentAmount(Math.round(newSettleAmount));
        } else {
            setPaymentAmount(toBePaidValue);
        }
    }, [cdHook, form, totalOutstandingForSelected]);


    const handleCustomerSelect = (key: string | null) => {
        form.setSelectedCustomerKey(key);
        if (!form.editingPayment) {
            form.resetPaymentForm(form.rtgsFor === 'Outsider');
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
            }
             if (form.rtgsFor === 'Supplier') {
                 setIsOutstandingModalOpen(true);
            }
        }
    };

    const processPayment = async () => {
        setIsProcessing(true);
        try {
            const paymentData = {
                ...form,
                paymentAmount: form.paymentAmount,
                cdAmount: cdHook.calculatedCdAmount,
                cdApplied: cdHook.cdEnabled
            };
            
            const result = await processPaymentLogic({ ...data, ...paymentData, selectedEntries });

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
            await handleDeletePaymentLogic(paymentToDelete, data.suppliers); 
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
                setPaymentMethod, setSelectedAccountId,
                setUtrNo, setCheckNo, setSixRNo, setSixRDate,
                setParchiNo, setRtgsQuantity, setRtgsRate, setRtgsAmount,
                setSupplierDetails, setBankDetails, setPaymentDate, setIsBeingEdited
            } = form;

            const { setCdEnabled, setCdPercent, setCdAt } = cdHook;
    
            setIsBeingEdited(true); // Signal that we are in edit mode
            setPaymentId(paymentData.paymentId);
            setRtgsSrNo(paymentData.rtgsSrNo || '');
            
            setPaymentAmount(paymentData.amount + (paymentData.cdAmount || 0)); // Set payable amount to total settled amount
            
            setPaymentType(paymentData.type);
            setPaymentMethod(paymentData.receiptType as 'Cash'|'Online'|'RTGS');
            setSelectedAccountId(paymentData.bankAccountId || 'CashInHand');
            
            const isCdApplied = !!paymentData.cdApplied;
            setCdEnabled(isCdApplied);
            if (isCdApplied && paymentData.cdAmount) {
                const totalSettledInPayment = paymentData.amount + (paymentData.cdAmount || 0);
                if(totalSettledInPayment > 0) {
                     setCdPercent(Number(((paymentData.cdAmount / totalSettledInPayment) * 100).toFixed(2)));
                } else {
                    setCdPercent(0);
                }
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
                address: paymentData.supplierAddress || '', contact: ''
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
        
    }, [form, data.suppliers, cdHook]);

    const handleEditPayment = useCallback(async (paymentToEdit: Payment) => {
        if (!paymentToEdit || !paymentToEdit.id) {
            toast({ title: "Cannot Edit", description: "Payment is missing a valid ID.", variant: "destructive" });
            return;
        }

        form.setEditingPayment(paymentToEdit);
        setActiveTab('processing');
        setIsProcessing(true);
        
        try {
            const firstSrNo = paymentToEdit.paidFor?.[0]?.srNo;
            if (form.rtgsFor === 'Supplier' && !firstSrNo) {
                 toast({ title: "Cannot Edit", description: "This payment is not linked to any supplier entry.", variant: "destructive" });
                 form.resetPaymentForm();
                 setIsProcessing(false);
                 return;
            }
            
            if (form.rtgsFor === 'Outsider') {
                handlePaySelectedOutstanding(paymentToEdit);
                toast({ title: `Editing Payment ${paymentToEdit.paymentId || paymentToEdit.rtgsSrNo}`, description: "Details loaded. Make changes and save." });
                setIsProcessing(false);
                return;
            }
            
            const originalEntry = data.suppliers.find(s => s.srNo === firstSrNo);
            if (!originalEntry) {
                throw new Error(`Supplier entry for SR# ${firstSrNo} not found.`);
            }
    
            const profileKey = Array.from(data.customerSummaryMap.keys()).find(key => {
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
            
            handlePaySelectedOutstanding(paymentToEdit);
    
            toast({ title: `Editing Payment ${paymentToEdit.paymentId || paymentToEdit.rtgsSrNo}`, description: "Details loaded. Make changes and save." });
        } catch (error: any) {
            console.error("Edit setup failed:", error);
            toast({ title: "Cannot Edit", description: error.message, variant: "destructive" });
            form.setEditingPayment(null);
            form.resetPaymentForm();
        } finally {
            setIsProcessing(false);
        }
    }, [data.suppliers, data.customerSummaryMap, form, toast, handlePaySelectedOutstanding]);
    

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
        finalAmountToBePaid,
        handleToBePaidChange,
        finalAmountToSettle,
        isProcessing,
        detailsSupplierEntry,
        setDetailsSupplierEntry,
        selectedPaymentForDetails,
        setSelectedPaymentForDetails,
        isBankSettingsOpen,
        setIsBankSettingsOpen,
        isOutstandingModalOpen,
        setIsOutstandingModalOpen,
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
        selectedEntries,
        totalOutstandingForSelected
    };
};
