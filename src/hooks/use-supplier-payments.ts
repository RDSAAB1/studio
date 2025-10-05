
"use client";

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useSupplierData } from './use-supplier-data';
import { useSupplierPaymentsForm } from './use-supplier-payments-form';
import { processPaymentLogic, handleDeletePaymentLogic } from '@/lib/payment-logic';
import { toTitleCase } from "@/lib/utils";
import { addBank } from '@/lib/firestore';
import type { Customer, Payment } from "@/lib/definitions";
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
    const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);
    const [rtgsReceiptData, setRtgsReceiptData] = useState<any | null>(null);
    const [activeTab, setActiveTab] = useState('processing');
    
    const selectedEntries = useMemo(() => {
        const safeSuppliers = Array.isArray(data.suppliers) ? data.suppliers : [];
        return safeSuppliers.filter((s: Customer) => form.selectedEntryIds.has(s.id));
    }, [data.suppliers, form.selectedEntryIds]);
    
     const totalOutstandingForSelected = useMemo(() => {
        // When editing, exclude the payment being edited from the calculation
        const paymentHistoryToConsider = form.editingPayment
            ? data.paymentHistory.filter((p: Payment) => p.id !== form.editingPayment.id)
            : data.paymentHistory;

        return selectedEntries.reduce((sum, entry) => {
            const paymentsForThisEntry = paymentHistoryToConsider.filter((p: Payment) =>
                p.paidFor?.some(pf => pf.srNo === entry.srNo)
            );
            
            let totalPaidForEntry = 0;
            let totalCdForEntry = 0;

            paymentsForThisEntry.forEach(p => {
                const paidForThisDetail = p.paidFor!.find(pf => pf.srNo === entry.srNo)!;
                
                let cdForThisPortion = 0;
                if (p.cdApplied && p.cdAmount && p.paidFor && p.paidFor.length > 0) {
                    const totalAmountInPayment = p.paidFor.reduce((s, pf) => s + pf.amount, 0);
                    if (totalAmountInPayment > 0) {
                        const proportion = paidForThisDetail.amount / totalAmountInPayment;
                        cdForThisPortion = p.cdAmount * proportion;
                    }
                }
                
                totalCdForEntry += cdForThisPortion;
                totalPaidForEntry += (paidForThisDetail.amount - cdForThisPortion);
            });

            const currentOutstanding = (entry.originalNetAmount || 0) - totalPaidForEntry - totalCdForEntry;
            return sum + (currentOutstanding > 0 ? currentOutstanding : 0);
        }, 0);
    }, [selectedEntries, data.paymentHistory, form.editingPayment]);

    const [settleAmount, setSettleAmount] = useState(0);
    const [toBePaidAmount, setToBePaidAmount] = useState(0);

    const cdHook = useCashDiscount({
        paymentType: form.paymentType,
        totalOutstanding: totalOutstandingForSelected,
        settleAmount: settleAmount,
        paymentDate: form.paymentDate,
        selectedEntries: selectedEntries,
        toBePaidAmount: toBePaidAmount,
    });

    const { calculatedCdAmount, ...cdProps } = cdHook;
    
    const handleSettleAmountChange = (value: number) => {
        setSettleAmount(value);
    };

    const handleToBePaidChange = (value: number) => {
        setToBePaidAmount(value);
        form.setCalcTargetAmount(Math.round(value)); // Update target amount
    };

    useEffect(() => {
        if (form.paymentType === 'Full') {
            const newSettleAmount = totalOutstandingForSelected;
            handleSettleAmountChange(newSettleAmount);
        } else { // Partial
             if (totalOutstandingForSelected > 0 && toBePaidAmount === 0 && !form.isBeingEdited) {
                handleSettleAmountChange(totalOutstandingForSelected);
                handleToBePaidChange(totalOutstandingForSelected);
             }
        }
    }, [totalOutstandingForSelected, form.paymentType, toBePaidAmount, form.isBeingEdited]);


    useEffect(() => {
        if (form.paymentType === 'Full' && !form.isBeingEdited) {
            const newToBePaid = settleAmount - calculatedCdAmount;
            handleToBePaidChange(newToBePaid);
        }
    }, [settleAmount, calculatedCdAmount, form.paymentType, form.isBeingEdited]);

    useEffect(() => {
        if (form.paymentType === 'Partial' && !form.isBeingEdited) {
            const newSettle = toBePaidAmount + calculatedCdAmount;
            handleSettleAmountChange(newSettle);
        }
    }, [toBePaidAmount, calculatedCdAmount, form.paymentType, form.isBeingEdited]);

    
    // Auto-fill logic for parchi number
    useEffect(() => {
        if (!form.isBeingEdited) {
            const srNos = selectedEntries.map(e => e.srNo).join(', ');
            form.setParchiNo(srNos);
        }
    }, [selectedEntries, form.setParchiNo, form.isBeingEdited]);


    const handleCustomerSelect = (key: string | null) => {
        form.setSelectedCustomerKey(key);
        if (!form.editingPayment) {
            form.resetPaymentForm(form.rtgsFor === 'Outsider');
            handleSettleAmountChange(0);
            handleToBePaidChange(0);
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
    
    const handlePaySelectedOutstanding = useCallback((paymentToEdit?: Payment) => {
        const paymentData = paymentToEdit || form.editingPayment;
        if (paymentData) {
            const {
                setPaymentId, setRtgsSrNo, setPaymentType,
                setPaymentMethod, setSelectedAccountId,
                setUtrNo, setCheckNo, setSixRNo, setSixRDate,
                setParchiNo, setRtgsQuantity, setRtgsRate, setRtgsAmount,
                setSupplierDetails, setBankDetails, setPaymentDate, setIsBeingEdited
            } = form;
    
            setIsBeingEdited(true); // Signal that we are in edit mode
            setPaymentId(paymentData.paymentId);
            setRtgsSrNo(paymentData.rtgsSrNo || '');
            
            setPaymentType(paymentData.type);
            handleToBePaidChange(paymentData.amount);
            handleSettleAmountChange(paymentData.amount + (paymentData.cdAmount || 0));
            
            setPaymentMethod(paymentData.receiptType as 'Cash'|'Online'|'RTGS');
            setSelectedAccountId(paymentData.bankAccountId || 'CashInHand');
            
            const isCdApplied = !!paymentData.cdApplied;
            cdProps.setCdEnabled(isCdApplied);
            if (isCdApplied && paymentData.cdAmount) {
                const baseAmountForCd = paymentData.type === 'Full' 
                    ? paymentData.amount + paymentData.cdAmount 
                    : paymentData.amount;
                if(baseAmountForCd > 0) {
                     cdProps.setCdPercent(Number(((paymentData.cdAmount / baseAmountForCd) * 100).toFixed(2)));
                } else {
                    cdProps.setCdPercent(0);
                }
            } else {
                 cdProps.setCdEnabled(false);
                 cdProps.setCdPercent(0);
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
        
    }, [form, data.suppliers, cdProps]);

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
                 handleSettleAmountChange(0);
                 handleToBePaidChange(0);
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
            handleSettleAmountChange(0);
            handleToBePaidChange(0);
        } finally {
            setIsProcessing(false);
        }
    }, [data.suppliers, data.customerSummaryMap, form, toast, handlePaySelectedOutstanding]);
    

    const selectPaymentAmount = (option: { quantity: number; rate: number; calculatedAmount: number; amountRemaining: number; }) => {
        form.setRtgsQuantity(option.quantity);
        form.setRtgsRate(option.rate);
        form.setRtgsAmount(option.calculatedAmount);
        form.setPaymentType('Partial');
        handleToBePaidChange(option.calculatedAmount);
        toast({ title: `Selected: ${option.quantity} Qtl @ ${option.rate}`});
    };

    const processPayment = async () => {
        setIsProcessing(true);
        try {
            const result = await processPaymentLogic({ ...data, ...form, ...cdProps, calculatedCdAmount, selectedEntries, paymentAmount: toBePaidAmount, settleAmount });

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
            handleSettleAmountChange(0); 
            handleToBePaidChange(0);
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
              handleSettleAmountChange(0);
              handleToBePaidChange(0);
            }
        } catch (error: any) {
            console.error("Error deleting payment:", error);
            toast({ title: "Failed to delete payment.", description: error.message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };
    
    return {
        ...data,
        ...form,
        ...cdProps,
        calculatedCdAmount,
        finalAmountToBePaid: toBePaidAmount,
        settleAmount, handleSettleAmountChange,
        handleToBePaidChange,
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
