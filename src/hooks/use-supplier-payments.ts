
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { generateReadableId } from '@/lib/utils';
import type { Payment, Expense, BankAccount } from '@/lib/definitions';
import { format } from 'date-fns';
import { useCashDiscount } from './use-cash-discount';
import { useSupplierPaymentsForm } from './use-supplier-payments-form';
import { processPaymentLogic, handleDeletePaymentLogic } from '@/lib/payment-logic';
import { useToast } from "@/hooks/use-toast";
import { useSupplierData } from './use-supplier-data';
import { toTitleCase } from "@/lib/utils";
import { addBank } from '@/lib/firestore';
import type { Customer } from "@/lib/definitions";


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
        if (!form.selectedCustomerKey) return [];
        const profile = data.customerSummaryMap.get(form.selectedCustomerKey);
        if (!profile || !Array.isArray(profile.allTransactions)) return [];
        return profile.allTransactions.filter((s: Customer) => form.selectedEntryIds.has(s.id));
    }, [multiSupplierMode, form.selectedCustomerKey, data.customerSummaryMap, form.selectedEntryIds, data.suppliers]);
    
    const totalOutstandingForSelected = useMemo(() => {
        if (form.editingPayment) {
            // EDIT MODE: Calculate the maximum amount this payment can be.
            // TEMPORARY REVERSAL: Add back the payment amount and CD from the payment being edited
            const editingPayment = form.editingPayment; // Store reference to avoid null checks
            return selectedEntries.reduce((sum, entry) => {
                const originalAmount = Number(entry.originalNetAmount) || 0;
                
                // Find all payments for this entry *except* the one being edited
                const otherPaymentsForThisEntry = (data.paymentHistory || [])
                    .filter(p => p.id !== editingPayment.id && p.paidFor?.some(pf => pf.srNo === entry.srNo));

                const otherPaymentsTotal = otherPaymentsForThisEntry.reduce((paymentSum, p) => {
                    const paidForThisDetail = p.paidFor!.find(pf => pf.srNo === entry.srNo)!;
                    return paymentSum + paidForThisDetail.amount + (p.cdAmount || 0);
                }, 0);

                // TEMPORARY REVERSAL: Add back the payment being edited to allow higher payment
                const editingPaymentForThisEntry = editingPayment.paidFor?.find(pf => pf.srNo === entry.srNo);
                const editingPaymentAmount = editingPaymentForThisEntry ? editingPaymentForThisEntry.amount : 0;
                const editingPaymentCD = editingPayment.cdAmount || 0;
                
                // Calculate proportion of CD for this entry
                const totalEditingPaymentAmount = editingPayment.paidFor?.reduce((sum, pf) => sum + pf.amount, 0) || 0;
                const cdProportionForThisEntry = totalEditingPaymentAmount > 0 ? editingPaymentAmount / totalEditingPaymentAmount : 0;
                const editingPaymentCDForThisEntry = editingPaymentCD * cdProportionForThisEntry;
                
                // Add back the payment amount and CD temporarily
                const temporaryReversalAmount = editingPaymentAmount + editingPaymentCDForThisEntry;

                return sum + (originalAmount - otherPaymentsTotal + temporaryReversalAmount);
            }, 0);
        }
        
        // NEW PAYMENT MODE (Supplier): Use current outstanding balance from entries (netAmount)
        const totalOutstanding = selectedEntries.reduce((sum, entry) => {
            const remaining = Number(entry.netAmount) || 0; // remaining outstanding per entry
            return sum + remaining;
        }, 0);

        return totalOutstanding;

    }, [selectedEntries, data.paymentHistory, form.editingPayment]);


    // Use useMemo to derive values instead of useState to avoid infinite loops
    const settleAmountDerived = useMemo(() => {
        // In Outsider mode, outstanding cap does not apply
        if (form.rtgsFor === 'Outsider') {
            return 0;
        }
        if (form.paymentType === 'Full') {
            return totalOutstandingForSelected;
        }
        // For Partial, this will be overridden by state
        return 0;
    }, [form.paymentType, form.rtgsFor, totalOutstandingForSelected]);

    const [settleAmountManual, setSettleAmountManual] = useState(0);
    const [toBePaidAmountManual, setToBePaidAmountManual] = useState(0);

    // In Outsider mode, allow manual settle amount even in Full mode (no outstanding limit)
    const settleAmount = (form.paymentType === 'Full' && form.rtgsFor !== 'Outsider') ? settleAmountDerived : settleAmountManual;

    // Removed heavy console logs to improve typing performance

    // For Partial payments, use toBePaidAmountManual as base for CD calculation
    // For Full payments, use settleAmount
    const baseAmountForCd = form.paymentType === 'Partial' ? toBePaidAmountManual : settleAmount;

    const { calculatedCdAmount, ...cdProps } = useCashDiscount({
        paymentType: form.paymentType,
        totalOutstanding: totalOutstandingForSelected,
        settleAmount: settleAmount,
        toBePaidAmount: baseAmountForCd, // Use toBePaidAmountManual for Partial, settleAmount for Full
        selectedEntries: selectedEntries,
        paymentDate: form.paymentDate,
        paymentHistory: data.paymentHistory,
        selectedCustomerKey: form.selectedCustomerKey, // Add missing selectedCustomerKey
        editingPayment: form.editingPayment, // Pass editing payment to exclude from CD calculations
    });
    
    // Derive toBePaid from settle - CD
    // For 'partial_on_paid' mode: CD is calculated on toBePaidAmount, but NOT deducted from it
    // CD is added to toBePaidAmount to get settle amount (done in useEffect at line 175)
    const finalToBePaid = useMemo(() => {
        if (form.paymentType === 'Full') {
            return Math.max(0, settleAmount - calculatedCdAmount);
        }
        // For Partial payment type: toBePaidAmount remains as entered (CD is NOT deducted)
        // Settle Amount = toBePaidAmount + CD (handled separately in useEffect)
        return toBePaidAmountManual;
    }, [form.paymentType, settleAmount, calculatedCdAmount, toBePaidAmountManual]);
    
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
    useEffect(() => {
        if (form.paymentType === 'Partial') {
            const newSettleAmount = toBePaidAmountManual + calculatedCdAmount;
            const roundedSettle = Math.round(newSettleAmount * 100) / 100;
            const currentSettle = Math.round(settleAmountManual * 100) / 100;
            
            if (roundedSettle !== currentSettle) {
                setSettleAmountManual(roundedSettle);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toBePaidAmountManual, calculatedCdAmount, form.paymentType]);

    // Auto-update Target Amount when To Be Paid changes in Full mode
    useEffect(() => {
        if (form.paymentType === 'Full') {
            form.setCalcTargetAmount(Math.round(finalToBePaid));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [finalToBePaid, form.paymentType]);

    // Auto-fill logic for parchi number (works in both new and edit mode)
    useEffect(() => {
        if (selectedEntries.length > 0) {
            // Always update parchiNo based on selected entries, even in edit mode
            const srNos = selectedEntries.map(e => e.srNo).join(', ');
            form.setParchiNo(srNos);
        } else if (!form.isBeingEdited) {
            // Only clear parchiNo for new payments if no entries selected
            form.setParchiNo('');
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
            // Popup selection removed
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
    
            setIsBeingEdited(true);
            setPaymentId(paymentData.paymentId);
            setRtgsSrNo(paymentData.rtgsSrNo || '');
            
            setPaymentType(paymentData.type);
            
            const isCdApplied = !!paymentData.cdApplied;
            cdProps.setCdEnabled(isCdApplied);
            if (isCdApplied && paymentData.cdAmount) {
                const totalPaidAmount = paymentData.amount + paymentData.cdAmount;
                if(totalPaidAmount > 0) {
                     cdProps.setCdPercent(Number(((paymentData.cdAmount / totalPaidAmount) * 100).toFixed(2)));
                } else {
                    cdProps.setCdPercent(0);
                }
            } else {
                 cdProps.setCdEnabled(false);
                 cdProps.setCdPercent(0);
            }

            handleToBePaidChange(paymentData.amount);
    
            setPaymentMethod(paymentData.receiptType as 'Cash'|'Online'|'RTGS');
            setSelectedAccountId(paymentData.bankAccountId || 'CashInHand');
            
            setUtrNo(paymentData.utrNo || '');
            setCheckNo(paymentData.checkNo || '');
            setSixRNo((paymentData as any).sixRNo || '');
            if ((paymentData as any).sixRDate) {
                const sixRDateObj = new Date((paymentData as any).sixRDate + "T00:00:00"); 
                setSixRDate(sixRDateObj);
            } else {
                setSixRDate(undefined);
            }
            setParchiNo(paymentData.parchiNo || (paymentData.paidFor || []).map(pf => pf.srNo).join(', '));
            
            setRtgsQuantity(paymentData.quantity || 0);
            setRtgsRate(paymentData.rate || 0);
            setRtgsAmount(paymentData.rtgsAmount || 0);
            
            // Preserve contact number from payment data or find from supplier entry
            let contactNumber = (paymentData as any).supplierContact || '';
            if (!contactNumber && paymentData.paidFor && paymentData.paidFor.length > 0) {
                const firstSrNo = paymentData.paidFor[0].srNo;
                const supplierEntry = data.suppliers.find(s => s.srNo === firstSrNo);
                if (supplierEntry && supplierEntry.contact) {
                    contactNumber = supplierEntry.contact;
                }
            }
            
            setSupplierDetails({
                name: paymentData.supplierName || '', fatherName: paymentData.supplierFatherName || '',
                address: paymentData.supplierAddress || '', contact: contactNumber
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
        setActiveTab('process');
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
        form.setPaymentType('Partial'); // Set to Partial first
        
        // For Partial mode, manually set the amounts
        setToBePaidAmountManual(option.calculatedAmount);
        setSettleAmountManual(option.calculatedAmount);
        form.setCalcTargetAmount(Math.round(option.calculatedAmount));
        
        toast({ title: `Selected: ${option.quantity} Qtl @ ${option.rate}`});
    };

    const processPayment = async () => {
        setIsProcessing(true);
        try {
            const result = await processPaymentLogic({ ...data, ...form, ...cdProps, calculatedCdAmount, selectedEntries, paymentAmount: toBePaidAmount, settleAmount, totalOutstandingForSelected });

            if (!result.success) {
                toast({ title: "Transaction Failed", description: result.message, variant: "destructive" });
                setIsProcessing(false);
                return;
            }

            toast({ title: `Payment processed successfully.`, variant: 'success' });
            // RTGS receipt dialog disabled - receipt window should not open automatically
            // if (form.paymentMethod === 'RTGS' && result.payment) {
            //     setRtgsReceiptData(result.payment);
            // }
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
    
    // Handle serial number search with auto-format
    const handleSerialNoSearch = useCallback((srNo: string) => {
        form.setSerialNoSearch(srNo);
    }, [form]);

    const handleSerialNoBlur = useCallback(() => {
        if (!form.serialNoSearch.trim()) return;

        // Auto-format: if only numbers, convert to S00XXX format
        let formattedSrNo = form.serialNoSearch.trim();
        if (/^\d+$/.test(formattedSrNo)) {
            formattedSrNo = `S${formattedSrNo.padStart(5, '0')}`;
            form.setSerialNoSearch(formattedSrNo);
        }

        // Find supplier with this serial number
        const supplier = data.suppliers.find(s => s.srNo.toLowerCase() === formattedSrNo.toLowerCase());
        if (supplier) {
            // Find the supplier key in the summary map
            for (const [key, summary] of data.customerSummaryMap.entries()) {
                if (summary.allTransactions?.some(t => t.srNo === supplier.srNo)) {
                    // Use handleCustomerSelect to auto-fill payee details
                    handleCustomerSelect(key);
                    // Auto-select this specific entry
                    const newSelection = new Set<string>();
                    newSelection.add(supplier.id);
                    form.setSelectedEntryIds(newSelection);
                    // Don't clear - keep the serial number visible
                    break;
                }
            }
        }
    }, [data.suppliers, data.customerSummaryMap, form, handleCustomerSelect]);

    return {
        ...data,
        ...form,
        ...cdProps,
        calculatedCdAmount,
        finalAmountToBePaid: finalToBePaid,
        settleAmount, handleSettleAmountChange,
        handleToBePaidChange,
        handleSerialNoSearch,
        handleSerialNoBlur,
        toBePaidAmount: finalToBePaid, // Add this for compatibility
        isProcessing,
        detailsSupplierEntry,
        setDetailsSupplierEntry,
        selectedPaymentForDetails,
        setSelectedPaymentForDetails,
        isBankSettingsOpen,
        setIsBankSettingsOpen,
        isOutstandingModalOpen,
        setIsOutstandingModalOpen,
        multiSupplierMode,
        setMultiSupplierMode,
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
