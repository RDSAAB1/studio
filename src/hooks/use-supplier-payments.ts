
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
import { addBank } from '@/lib/firestore';
import type { Customer } from "@/lib/definitions";
import { fuzzyMatchProfiles, type SupplierProfile as FuzzySupplierProfile } from "@/app/sales/supplier-profile/utils/fuzzy-matching";

const normalizeProfileField = (value: unknown): string => {
    if (value === null || value === undefined) {
        return "";
    }
    return String(value).replace(/\s+/g, " ").trim();
};

const toFuzzyProfile = (source: any): FuzzySupplierProfile => ({
    name: normalizeProfileField(source?.name),
    fatherName: normalizeProfileField(source?.fatherName ?? source?.so),
    address: normalizeProfileField(source?.address),
    contact: normalizeProfileField(source?.contact),
    srNo: normalizeProfileField(source?.srNo),
});


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
        
        // If selectedCustomerKey is set, use it
        if (form.selectedCustomerKey) {
            const profile = data.customerSummaryMap.get(form.selectedCustomerKey);
            if (profile && Array.isArray(profile.allTransactions)) {
                return profile.allTransactions.filter((s: Customer) => form.selectedEntryIds.has(s.id));
            }
        }
        
        // Fallback: If no customerKey but entries are selected, try to find them in summary map first
        // This handles the Supplier Hub case where entries are selected but customerKey might not be set
        // Priority: Try to get entries from summary map (with outstandingForEntry) before falling back to raw suppliers
        if (form.selectedEntryIds.size > 0) {
            // First, try to find entries in any profile in the summary map
            let foundEntries: Customer[] = [];
            for (const [key, profile] of data.customerSummaryMap.entries()) {
                if (profile && Array.isArray(profile.allTransactions)) {
                    const matchingEntries = profile.allTransactions.filter((s: Customer) => form.selectedEntryIds.has(s.id));
                    if (matchingEntries.length > 0) {
                        foundEntries = [...foundEntries, ...matchingEntries];
                    }
                }
            }
            
            // If found in summary map, return those (they have outstandingForEntry)
            if (foundEntries.length > 0) {
                return foundEntries;
            }
            
            // Fallback to raw suppliers if not found in summary map
            return data.suppliers.filter((s: Customer) => form.selectedEntryIds.has(s.id));
        }
        
        return [];
    }, [multiSupplierMode, form.selectedCustomerKey, data.customerSummaryMap, form.selectedEntryIds, data.suppliers]);
    
    const totalOutstandingForSelected = useMemo(() => {
        if (form.editingPayment) {
            // EDIT MODE: Calculate the maximum amount this payment can be.
            // Use the SAME logic as use-supplier-summary to ensure consistency
            const editingPayment = form.editingPayment; // Store reference to avoid null checks
            return selectedEntries.reduce((sum, entry) => {
                const originalAmount = Number(entry.originalNetAmount) || 0;
                
                // Find all payments for this entry *except* the one being edited
                const otherPaymentsForThisEntry = (data.paymentHistory || [])
                    .filter(p => p.id !== editingPayment.id && p.paidFor?.some(pf => pf.srNo === entry.srNo));

                // Use SAME logic as use-supplier-summary: Calculate totalPaid and totalCd separately
                let totalPaidForEntry = 0;
                let totalCdForEntry = 0;

                otherPaymentsForThisEntry.forEach(payment => {
                    const paidForThisPurchase = payment.paidFor!.find(pf => pf.srNo === entry.srNo);
                    if (paidForThisPurchase) {
                        // Direct database value - no calculation
                        totalPaidForEntry += Number(paidForThisPurchase.amount || 0);
                        
                        // CD amount calculation: First check if directly stored in paidFor (new format), else calculate proportionally
                        if ('cdAmount' in paidForThisPurchase && paidForThisPurchase.cdAmount !== undefined && paidForThisPurchase.cdAmount !== null) {
                            // New format: CD amount directly stored in paidFor
                            totalCdForEntry += Number(paidForThisPurchase.cdAmount || 0);
                        } else if (payment.cdAmount && payment.paidFor && payment.paidFor.length > 0) {
                            // Old format: Calculate proportionally from payment.cdAmount
                            const totalPaidForInPayment = payment.paidFor.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0);
                            if (totalPaidForInPayment > 0) {
                                const proportion = Number(paidForThisPurchase.amount || 0) / totalPaidForInPayment;
                                totalCdForEntry += Math.round(payment.cdAmount * proportion * 100) / 100;
                            }
                        }
                    }
                });

                // Calculate outstanding using SAME formula as use-supplier-summary
                // Outstanding = Original - (Total Paid + Total CD)
                const currentOutstanding = originalAmount - totalPaidForEntry - totalCdForEntry;
                return sum + Math.max(0, currentOutstanding);
            }, 0);
        }
        
        // NEW PAYMENT MODE (Supplier): Use SAME logic as use-supplier-summary
        // Calculate outstanding from payment history to ensure consistency
        const totalOutstanding = selectedEntries.reduce((sum, entry) => {
            // Use outstandingForEntry if available (from use-supplier-summary), otherwise calculate
            if ('outstandingForEntry' in entry && entry.outstandingForEntry !== undefined) {
                return sum + Number(entry.outstandingForEntry || 0);
            }
            
            // Fallback: Calculate using same logic as use-supplier-summary
            const originalAmount = Number(entry.originalNetAmount) || 0;
            const paymentsForEntry = (data.paymentHistory || []).filter(p => 
                p.paidFor?.some(pf => pf.srNo === entry.srNo)
            );
            
            let totalPaidForEntry = 0;
            let totalCdForEntry = 0;
            
            paymentsForEntry.forEach(payment => {
                const paidForThisPurchase = payment.paidFor!.find(pf => pf.srNo === entry.srNo);
                if (paidForThisPurchase) {
                    totalPaidForEntry += Number(paidForThisPurchase.amount || 0);
                    
                    // CD amount calculation: Same as use-supplier-summary
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
            
            // Outstanding = Original - (Paid + CD) - SAME formula as use-supplier-summary
            const outstanding = originalAmount - totalPaidForEntry - totalCdForEntry;
            return sum + Math.max(0, Math.round(outstanding * 100) / 100);
        }, 0);

        return totalOutstanding;

    }, [selectedEntries, data.paymentHistory, form.editingPayment]);

    const supplierIdToProfileKey = useMemo(() => {
        const map = new Map<string, string>();
        data.customerSummaryMap.forEach((summary: any, key: string) => {
            const supplierIds: string[] = Array.isArray(summary?.supplierIds) ? summary.supplierIds : [];
            if (supplierIds.length) {
                supplierIds.forEach((id) => {
                    if (id) {
                        map.set(id, key);
                    }
                });
            }
        });
        return map;
    }, [data.customerSummaryMap]);

    const fuzzyProfileMatcher = useCallback(
        (targetName: string, targetFatherName: string, targetAddress?: string | null) => {
            const targetProfile = toFuzzyProfile({
                name: targetName,
                fatherName: targetFatherName,
                address: targetAddress,
            });

            if (!targetProfile.name) {
                return null;
            }

            const entries: Array<[string, any]> = [];
            if (data.customerSummaryMap && typeof data.customerSummaryMap.forEach === "function") {
                data.customerSummaryMap.forEach((value: any, key: string) => {
                    entries.push([key, value]);
                });
            }

            let bestKey: string | null = null;
            let bestDifference = Number.POSITIVE_INFINITY;

            for (const [key, summary] of entries) {
                const candidateProfile = toFuzzyProfile(summary);
                if (!candidateProfile.name) {
                    continue;
                }

                const match = fuzzyMatchProfiles(targetProfile, candidateProfile);
                if (!match.isMatch) {
                    continue;
                }

                if (match.totalDifference < bestDifference) {
                    bestDifference = match.totalDifference;
                    bestKey = key;
                    if (bestDifference === 0) {
                        break;
                    }
                }
            }

            return bestKey;
        },
        [data.customerSummaryMap]
    );

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

    const { calculatedCdAmount, setCdAmount, ...cdProps } = useCashDiscount({
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
    
    // To Be Paid amount is the actual payment amount that will be transferred
    // For Full payment: To Be Paid = settleAmount - CD (cash matches settlement minus discount)
    // For Partial payment: To Be Paid = toBePaidAmountManual (user entered amount)
    // Total settlement = To Be Paid + CD
    const finalToBePaid = useMemo(() => {
        if (form.paymentType === 'Full') {
            // For Full payment: actual cash paid = settle amount - CD
            const adjustedToBePaid = settleAmount - calculatedCdAmount;
            return Math.max(0, Math.round(adjustedToBePaid * 100) / 100);
        }
        // For Partial payment type: toBePaidAmount remains as entered (CD is NOT deducted)
        // Settle Amount = toBePaidAmount + CD (handled separately in useEffect)
        return Math.max(0, Math.round(toBePaidAmountManual * 100) / 100);
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
            const srNos = selectedEntries.map(e => e.srNo).filter(Boolean).join(', ');
            if (srNos) {
                form.setParchiNo(srNos);
            }
        } else if (!form.isBeingEdited) {
            // Only clear parchiNo for new payments if no entries selected
            form.setParchiNo('');
        }
    }, [selectedEntries, form.setParchiNo, form.isBeingEdited]);
    
    // Also update parchiNo when selectedEntryIds changes directly (for supplier hub)
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
                // Fallback: search in all suppliers if customerKey is not set (for supplier hub)
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
            
            const isCdApplied = !!paymentData.cdApplied && Number(paymentData.cdAmount) > 0;
            cdProps.setCdEnabled(isCdApplied);
            if (isCdApplied) {
                setCdAmount(Number(paymentData.cdAmount) || 0);
            } else {
                setCdAmount(0);
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

            const profileKeyFromId = originalEntry.id ? supplierIdToProfileKey.get(originalEntry.id) : null;
            let profileKey = profileKeyFromId;

            if (!profileKey) {
                profileKey = fuzzyProfileMatcher(
                    originalEntry.name,
                    originalEntry.so || "",
                    originalEntry.address || ""
                );
            }

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
        const rawValue = form.serialNoSearch.trim();
        if (!rawValue) return;

        let formattedSrNo = rawValue.toUpperCase().replace(/\s+/g, '');
        const numericPartFromS = formattedSrNo.startsWith('S')
            ? formattedSrNo.slice(1)
            : formattedSrNo;

        if (/^\d+$/.test(numericPartFromS)) {
            formattedSrNo = `S${numericPartFromS.padStart(5, '0')}`;
        }

        form.setSerialNoSearch(formattedSrNo);
        const normalizedSrNo = formattedSrNo.toLowerCase();

        const findLatestPayment = (payments: Payment[]) => {
            return payments.reduce<Payment | null>((latest, current) => {
                const currentMeta = current as any;
                const latestMeta = latest as any;
                const currentTimestamp = new Date(
                    currentMeta?.updatedAt || currentMeta?.createdAt || current.date || ''
                ).getTime();
                const latestTimestamp = latest
                    ? new Date(
                          latestMeta?.updatedAt || latestMeta?.createdAt || latest?.date || ''
                      ).getTime()
                    : Number.NEGATIVE_INFINITY;
                return currentTimestamp > latestTimestamp ? current : latest;
            }, null);
        };

        const matchingPayments = data.paymentHistory.filter(
            (payment) =>
                payment.paidFor?.some(
                    (pf) => (pf.srNo || '').toLowerCase() === normalizedSrNo
                )
        );

        let paymentToEdit: Payment | null = null;
        if (matchingPayments.length) {
            const sameMethod = matchingPayments.filter(
                (payment) =>
                    (payment.receiptType || '').toLowerCase() === form.paymentMethod.toLowerCase()
            );
            paymentToEdit = findLatestPayment(sameMethod.length ? sameMethod : matchingPayments);
        }

        if (
            paymentToEdit &&
            (!form.editingPayment || form.editingPayment.id !== paymentToEdit.id)
        ) {
            handleEditPayment(paymentToEdit);
            return;
        }

        const supplier = data.suppliers.find(
            (s) => (s.srNo || '').toLowerCase() === normalizedSrNo
        );
        if (!supplier) {
            return;
        }

        for (const [key, summary] of data.customerSummaryMap.entries()) {
            if (
                summary.allTransactions?.some(
                    (transaction) => (transaction.srNo || '').toLowerCase() === normalizedSrNo
                )
            ) {
                handleCustomerSelect(key);
                const newSelection = new Set<string>();
                newSelection.add(supplier.id);
                form.setSelectedEntryIds(newSelection);
                form.setParchiNo(formattedSrNo);
                break;
            }
        }
    }, [
        data.customerSummaryMap,
        data.paymentHistory,
        data.suppliers,
        form,
        handleCustomerSelect,
        handleEditPayment,
    ]);

    return {
        ...data,
        ...form,
        ...cdProps,
        calculatedCdAmount,
        setCdAmount,
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
        totalOutstandingForSelected,
        selectedEntryIds: form.selectedEntryIds,
        setSelectedEntryIds: form.setSelectedEntryIds,
        setParchiNo: form.setParchiNo,
        parchiNo: form.parchiNo,
    };
};
