
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { generateReadableId } from '@/lib/utils';
import type { Payment, Expense, BankAccount } from '@/lib/definitions';
import { format } from 'date-fns';
import { useCashDiscount } from './use-cash-discount';
import { useSupplierPaymentsForm } from './use-supplier-payments-form';
import { processPaymentLogic, type ProcessPaymentContext, handleDeletePaymentLogic } from '@/lib/payment-logic';
import { useToast } from "@/hooks/use-toast";
import { useSupplierData } from './use-supplier-data';
import { addBank, getOptionsRealtime } from '@/lib/firestore';
import type { Customer, OptionItem } from "@/lib/definitions";
import { calculateOutstandingForEntry } from "@/lib/outstanding-calculator";
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
    const [selectedPaymentOption, setSelectedPaymentOption] = useState<{ quantity: number; rate: number; calculatedAmount: number; amountRemaining: number; bags?: number | null } | null>(null);
    const [centerNameOptions, setCenterNameOptions] = useState<OptionItem[]>([]);
    
    const selectedEntries = useMemo(() => {
        if (!Array.isArray(data.suppliers)) return [];
        const isEntrySelected = (entry: Customer) =>
            form.selectedEntryIds.has(entry.id) || (!!entry.srNo && form.selectedEntryIds.has(entry.srNo));
        if (multiSupplierMode) {
            return data.suppliers.filter(isEntrySelected);
        }
        
        // If selectedCustomerKey is set, use it
        if (form.selectedCustomerKey) {
            const profile = data.customerSummaryMap.get(form.selectedCustomerKey);
            if (profile && Array.isArray(profile.allTransactions)) {
                return profile.allTransactions.filter(isEntrySelected);
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
                    const matchingEntries = profile.allTransactions.filter(isEntrySelected);
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
            return data.suppliers.filter(isEntrySelected);
        }
        
        return [];
    }, [multiSupplierMode, form.selectedCustomerKey, data.customerSummaryMap, form.selectedEntryIds, data.suppliers]);
    
    // Use SAME calculation as outstanding table - so Full payment To Be Paid shows exact outstanding amount
    const totalOutstandingForSelected = useMemo(() => {
        const paymentHistory = data.paymentHistory || [];
        // Edit mode: exclude the payment being edited so we get correct "max payable" for this payment
        const historyToUse = form.editingPayment
            ? paymentHistory.filter((p: Payment) => p.id !== form.editingPayment!.id)
            : paymentHistory;

        return selectedEntries.reduce((sum, entry) => {
            const result = calculateOutstandingForEntry(entry, historyToUse);
            return sum + result.outstanding;
        }, 0);
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
        if (form.paymentType === 'Full') {
            return totalOutstandingForSelected;
        }
        // For Partial, this will be overridden by state
        return 0;
    }, [form.paymentType, totalOutstandingForSelected]);

    const [settleAmountManual, setSettleAmountManual] = useState(0);
    const [toBePaidAmountManual, setToBePaidAmountManual] = useState(0);
    const [toBePaidAmountDebounced, setToBePaidAmountDebounced] = useState(0);
    const toBePaidDebounceRef = useRef<NodeJS.Timeout | null>(null);
    
    // Initialize debounced value with manual value on mount
    useEffect(() => {
        setToBePaidAmountDebounced(toBePaidAmountManual);
    }, []); // Only on mount

    const settleAmount = (form.paymentType === 'Full') ? settleAmountDerived : settleAmountManual;

    // Removed heavy console logs to improve typing performance

    // For Partial payments, use debounced toBePaidAmount for CD calculation to prevent lag
    // For Full payments, use settleAmount
    const baseAmountForCd = form.paymentType === 'Partial' ? toBePaidAmountDebounced : settleAmount;

    // CD at finalize (concepts): (1) Only apply when cdEnabled. (2) Full: To Be Paid = settleAmount − CD; Partial: To Be Paid = user amount, settle = To Be Paid + CD. (3) effectiveCdAmount passed to processPaymentLogic so DB gets 0 CD when disabled. (4) paidFor[].amount = cash only, paidFor[].cdAmount = CD only; outstanding = original − paid − cd.
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
    
    // IMPORTANT: Only apply CD if cdEnabled is true
    const effectiveCdAmount = cdProps.cdEnabled ? calculatedCdAmount : 0;
    
    // To Be Paid amount is the actual payment amount that will be transferred
    // For Full payment: To Be Paid = settleAmount - CD (cash matches settlement minus discount)
    // For Partial payment: To Be Paid = toBePaidAmountManual (user entered amount)
    // Total settlement = To Be Paid + CD
    // Use immediate value for UI display (no lag), debounced value only for calculations
    const finalToBePaid = useMemo(() => {
        if (form.paymentType === 'Full') {
            // For Full payment: actual cash paid = settle amount - CD (only if CD is enabled)
            const adjustedToBePaid = settleAmount - effectiveCdAmount;
            return Math.max(0, Math.round(adjustedToBePaid * 100) / 100);
        }
        // For Partial payment type: toBePaidAmount remains as entered (CD is NOT deducted)
        // Use immediate value for responsive UI - calculations use debounced value
        return Math.max(0, Math.round(toBePaidAmountManual * 100) / 100);
    }, [form.paymentType, settleAmount, effectiveCdAmount, toBePaidAmountManual]);
    
    const finalAmountToPay = useMemo(() => {
        const base = finalToBePaid;
        if (form.paymentMethod === 'Ledger') {
            const extra = Number(form.extraAmount || 0);
            return Math.max(0, Math.round((base + extra) * 100) / 100);
        }
        return base;
    }, [finalToBePaid, form.paymentMethod, form.extraAmount]);
    
    const handleSettleAmountChange = (value: number) => {
        if (form.paymentType === 'Partial') {
            setSettleAmountManual(value);
        }
    };

    const handleToBePaidChange = (value: number) => {
        // Update immediately for UI responsiveness
        setToBePaidAmountManual(value);
        
        // Debounce heavy calculations to prevent lag
        if (toBePaidDebounceRef.current) {
            clearTimeout(toBePaidDebounceRef.current);
        }
        
        toBePaidDebounceRef.current = setTimeout(() => {
            // Update debounced value for CD calculations and settle amount
            setToBePaidAmountDebounced(value);
            
        }, 800); // 800ms delay - increased to significantly reduce lag
    };
    
    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (toBePaidDebounceRef.current) {
                clearTimeout(toBePaidDebounceRef.current);
            }
        };
    }, []);

    // Load centerNameOptions for Gov payments
    useEffect(() => {
        const unsubCenterNames = getOptionsRealtime('centerNames', setCenterNameOptions, (err) => {
            // Error fetching center names
        });
        return () => {
            unsubCenterNames();
        };
    }, []);

    // Auto-calculate settle amount for Partial payment type
    // IMPORTANT: Only add CD to settlement if CD is enabled
    // Use debounced value to prevent lag
    useEffect(() => {
        if (form.paymentType === 'Partial') {
            const newSettleAmount = toBePaidAmountDebounced + effectiveCdAmount;
            const roundedSettle = Math.round(newSettleAmount * 100) / 100;
            const currentSettle = Math.round(settleAmountManual * 100) / 100;
            
            if (roundedSettle !== currentSettle) {
                setSettleAmountManual(roundedSettle);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toBePaidAmountDebounced, effectiveCdAmount, form.paymentType]);

    // Auto-update To Be Paid amount when Gov Amount/Extra changes - full amount as-is (Normal + Extra)
    useEffect(() => {
        if (form.paymentMethod === 'Gov.') {
            const toBePaid = (form.govAmount || 0) + (form.govExtraAmount || 0);
            handleToBePaidChange(toBePaid);
        }
    }, [form.govAmount, form.govExtraAmount, form.paymentMethod]);

    // Auto-update Target Amount when To Be Paid changes in Full mode
    useEffect(() => {
        if (form.paymentType === 'Full') {
            // Target amount update removed
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
                if (form.paymentMethod === 'Ledger' && !form.isBeingEdited) {
                    form.setCheckNo(srNos);
                }
            }
        } else if (!form.isBeingEdited) {
            // Only clear parchiNo for new payments if no entries selected
            form.setParchiNo('');
        }
    }, [selectedEntries, form.setParchiNo, form.paymentMethod, form.isBeingEdited, form.setCheckNo]);
    
    // Also update parchiNo when selectedEntryIds changes directly (for supplier hub)
    // This ensures parchiNo updates immediately when entries are selected from table
    // Works for all payment methods: Cash, Online, RTGS
    useEffect(() => {
        if (form.selectedEntryIds.size > 0) {
            const isEntrySelected = (entry: Customer) =>
                form.selectedEntryIds.has(entry.id) || (!!entry.srNo && form.selectedEntryIds.has(entry.srNo));
            // Get selected entries based on current selectedEntryIds
            let entries: Customer[] = [];
            if (multiSupplierMode) {
                entries = (data.suppliers || []).filter(isEntrySelected);
            } else if (form.selectedCustomerKey) {
                const profile = data.customerSummaryMap.get(form.selectedCustomerKey);
                if (profile && Array.isArray(profile.allTransactions)) {
                    entries = profile.allTransactions.filter(isEntrySelected);
                }
            } else {
                // Fallback: search in all suppliers if customerKey is not set (for supplier hub)
                entries = (data.suppliers || []).filter(isEntrySelected);
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
            form.resetPaymentForm();
            handleSettleAmountChange(0);
            handleToBePaidChange(0);
        }
        // Do NOT auto-fill supplier/bank details when selecting supplier
        // Details should only fill when Payment ID is entered
        // Popup selection removed
    };
    
    const handlePaySelectedOutstanding = useCallback((paymentToEdit?: Payment) => {
        const paymentData = paymentToEdit || form.editingPayment;
        if (paymentData) {
            const {
                setPaymentId, setRtgsSrNo, setPaymentType,
                setPaymentMethod, setSelectedAccountId,
                setUtrNo, setCheckNo, setSixRNo, setSixRDate,
                setParchiNo, setRtgsQuantity, setRtgsRate, setRtgsAmount,
                setGovQuantity, setGovRate, setGovAmount,
                setSupplierDetails, setBankDetails, setPaymentDate, setIsBeingEdited,
                setDrCr, setExtraAmount, setNotes
            } = form;

            setIsBeingEdited(true);
            setPaymentId(paymentData.paymentId);
            setRtgsSrNo(paymentData.rtgsSrNo || '');
            
            setPaymentType(paymentData.type);
            
            // Set new fields
            
            const isCdApplied = !!paymentData.cdApplied && Number(paymentData.cdAmount) > 0;
            cdProps.setCdEnabled(isCdApplied);
            if (isCdApplied) {
                setCdAmount(Number(paymentData.cdAmount) || 0);
            } else {
                setCdAmount(0);
            }

            const receiptType = paymentData.receiptType as any;
            const absAmount = Math.abs(Number(paymentData.amount) || 0);
            if (receiptType === 'Ledger') {
                setDrCr(paymentData.amount < 0 ? 'Credit' : 'Debit');
                setExtraAmount(0);
                handleToBePaidChange(absAmount);
                setPaymentType('Partial');
            } else {
                setDrCr('Debit');
                setExtraAmount(0);
                handleToBePaidChange(absAmount);
            }
    
            setPaymentMethod(paymentData.receiptType as 'Cash'|'Online'|'Ledger'|'RTGS'|'Gov.');
            setSelectedAccountId(paymentData.bankAccountId || 'CashInHand');
            
            setUtrNo(paymentData.utrNo || '');
            setCheckNo(paymentData.checkNo || '');
            setNotes((paymentData as any).notes || '');
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
            
            // Load Gov. fields if payment type is Gov.
            if (paymentData.receiptType === 'Gov.') {
                setPaymentType('Partial');
                form.setGovQuantity((paymentData as any).govQuantity || 0);
                form.setGovRate((paymentData as any).govRate || 0);
                form.setGovAmount((paymentData as any).govAmount || 0);
                form.setGovExtraAmount((paymentData as any).govExtraAmount || 0);
                form.setCenterName((paymentData as any).centerName || '');
                
                // When editing, verify if extra amount needs to be loaded into calculation state
                // This logic ensures that if govExtraAmount is present, it's considered in the total amount calculation
                if ((paymentData as any).govExtraAmount > 0) {
                    // Trigger total update logic if needed
                }
            }
            
            // Preserve contact number from payment data or find from supplier entry
            let contactNumber = (paymentData as any).supplierContact || '';
            if (!contactNumber && paymentData.paidFor && paymentData.paidFor.length > 0) {
                const firstSrNo = paymentData.paidFor[0].srNo;
                const supplierEntry = data.suppliers.find(s => s.srNo === firstSrNo);
                if (supplierEntry && supplierEntry.contact) {
                    contactNumber = supplierEntry.contact;
                }
            }
            
            const pd = paymentData as any;
            setSupplierDetails({
                name: pd.supplierName || pd.supplierDetails?.name || '', fatherName: pd.supplierFatherName || pd.supplierDetails?.fatherName || '',
                address: pd.supplierAddress || pd.supplierDetails?.address || '', contact: contactNumber
            });
            setBankDetails({
                acNo: pd.bankAcNo || pd.bankDetails?.acNo || '',
                ifscCode: pd.bankIfsc || pd.bankDetails?.ifscCode || '',
                bank: pd.bankName || pd.bankDetails?.bank || '',
                branch: pd.bankBranch || pd.bankDetails?.branch || '',
            });
            
            if (paymentData.date) {
                const dateParts = paymentData.date.split('-').map(Number);
                const utcDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
                setPaymentDate(utcDate);
            }
        }
        
    }, [form, data.suppliers, cdProps]);

    const handleEditPayment = useCallback(async (paymentToEdit: Payment) => {
        if (isProcessing) return;

        if (!paymentToEdit || !paymentToEdit.id) {
            toast({ title: "Cannot Edit", description: "Payment is missing a valid ID.", variant: "destructive" });
            return;
        }

        form.setEditingPayment(paymentToEdit);
        setActiveTab('process');
        setIsProcessing(true);
        
        try {
            // First try to match by linked entry (most accurate)
            const firstSrNo = paymentToEdit.paidFor?.[0]?.srNo;
            let profileKey = null;

            if (firstSrNo) {
                const originalEntry = data.suppliers.find(s => s.srNo === firstSrNo);
                if (originalEntry) {
                     profileKey = originalEntry.id ? supplierIdToProfileKey.get(originalEntry.id) : null;
    
                     if (!profileKey) {
                        profileKey = fuzzyProfileMatcher(
                            originalEntry.name,
                            originalEntry.so || "",
                            originalEntry.address || ""
                        );
                    }
                }
            }
            
            // Fallback: if no valid entry found or no srNo, try matching by payment supplier details
            if (!profileKey && paymentToEdit.supplierName) {
                 profileKey = fuzzyProfileMatcher(
                    paymentToEdit.supplierName,
                    paymentToEdit.supplierFatherName || "",
                    paymentToEdit.supplierAddress || ""
                );
            }

            if (!profileKey) {
                 console.warn(`Could not find a matching supplier profile for ${paymentToEdit.supplierName || 'this payment'}.`);
                 toast({ 
                    title: "Supplier Profile Not Found", 
                    description: "Could not link this payment to an existing supplier profile. You can still edit the payment details, but outstanding entries will not be linked.", 
                    variant: "default" 
                 });
            }

            form.setSelectedCustomerKey(profileKey);
    
            // Select entries if they exist
            if (paymentToEdit.paidFor && paymentToEdit.paidFor.length > 0) {
                 const paidForIds = data.suppliers
                    .filter(s => paymentToEdit.paidFor?.some(pf => pf.srNo === s.srNo))
                    .map(s => s.id);
                 form.setSelectedEntryIds(new Set(paidForIds));
            } else {
                 form.setSelectedEntryIds(new Set());
            }
            
            handlePaySelectedOutstanding(paymentToEdit);
    
            toast({ title: `Editing Payment ${paymentToEdit.paymentId || paymentToEdit.rtgsSrNo}`, description: "Details loaded. Make changes and save." });
        } catch (error: any) {
            console.error("Edit error:", error);
            toast({ title: "Cannot Edit", description: error.message, variant: "destructive" });
            form.setEditingPayment(null);
            form.resetPaymentForm();
            handleSettleAmountChange(0);
            handleToBePaidChange(0);
        } finally {
            setIsProcessing(false);
        }
    }, [data.suppliers, data.customerSummaryMap, form, toast, handlePaySelectedOutstanding, supplierIdToProfileKey, fuzzyProfileMatcher]);
    

    const selectPaymentAmount = (option: { quantity: number; rate: number; calculatedAmount: number; amountRemaining: number; bags?: number | null }) => {
        // Store the full selected option for calculations
        setSelectedPaymentOption(option);
        
        // Ensure calculatedAmount is a whole number (no paise, divisible by 1)
        // Always round to nearest whole number for amount field
        const roundedAmount = Math.round(option.calculatedAmount);
        
        // Set RTGS fields if payment method is RTGS
        if (form.paymentMethod === 'RTGS') {
            form.setRtgsQuantity(option.quantity);
            form.setRtgsRate(option.rate);
            form.setRtgsAmount(roundedAmount);
        }
        // Set Gov. fields if payment method is Gov.
        if (form.paymentMethod === 'Gov.') {
            form.setGovQuantity(option.quantity);
            form.setGovRate(option.rate);
            const govExtra = form.govExtraAmount || 0;
            const govNormal = Math.max(0, roundedAmount - govExtra);
            form.setGovAmount(govNormal);
            form.setGovExtraAmount(govExtra);
            // To Be Paid = full amount as-is (Normal + Extra), not reduced
            setToBePaidAmountManual(roundedAmount);
            setSettleAmountManual(roundedAmount);
        } else {
            setToBePaidAmountManual(roundedAmount);
            setSettleAmountManual(roundedAmount);
        }
        form.setPaymentType('Partial'); // Set to Partial first
        // Don't change calcTargetAmount - keep original targeted amount
        // form.setCalcTargetAmount(roundedAmount);
        
        toast({ title: `Selected: ${option.quantity} Qtl @ ${option.rate}`});
    };

    const processPayment = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            // Balance check: selected "Payment From" must have enough balance (skip for Gov. – no from account)
            if (form.paymentMethod !== 'Gov.') {
                // Ledger Credit = charge (Income/Credit) — no actual cash/bank outflow.
                // Adjustment = no account movement.
                const isLedgerCredit = form.paymentMethod === 'Ledger' && form.drCr === 'Credit';
                const isAdjustment = form.selectedAccountId === 'Adjustment';
                if (!(isLedgerCredit || isAdjustment)) {
                    const balanceKey = form.paymentMethod === 'Cash'
                        ? (form.selectedAccountId || 'CashInHand')
                        : form.selectedAccountId;
                    if (!balanceKey && (form.paymentMethod === 'Online' || form.paymentMethod === 'RTGS' || form.paymentMethod === 'Ledger')) {
                        toast({ title: "Select account", description: "Please select Payment From account.", variant: "destructive" });
                        setIsProcessing(false);
                        return;
                    }
                    const balances = data.financialState?.balances;
                    const available = balances && balanceKey ? (balances.get(balanceKey) ?? 0) : 0;
                    if (available < finalAmountToPay) {
                        toast({ title: "Not enough balance", description: "Selected account does not have sufficient balance for this payment.", variant: "destructive" });
                        setIsProcessing(false);
                        return;
                    }
                }
            }

            // CD at finalize: only apply when cdEnabled; actual cash = finalAmountToPay, CD stored separately in paidFor[].cdAmount
            // effectiveCdAmount = 0 when CD disabled so distribution and DB get zero CD; cdAt/cdPercent/paymentHistory drive distribution mode
            const context: ProcessPaymentContext = {
                selectedCustomerKey: form.selectedCustomerKey,
                selectedEntries,
                notes: form.notes || '',
                paidForDetails:
                    form.paymentMethod === 'Gov.' && (form.govExtraAmount || 0) > 0
                        ? (() => {
                              // Gov Extra: put on first selected entry (extra paid separately, increases Total Amount in summary)
                              const firstSrNo = selectedEntries.length >= 1
                                  ? ((selectedEntries[0] as any)?.srNo || (selectedEntries[0] as any)?.entry?.srNo || '')
                                  : (form.parchiNo || '').split(/[,\s]+/)[0] || '';
                              const srNo = String(firstSrNo).trim();
                              if (!srNo) return undefined;
                              return [{ srNo, amount: 0, cdAmount: 0, extraAmount: form.govExtraAmount || 0 }];
                          })()
                        : form.paymentMethod !== 'Ledger' && (form.extraAmount || 0) > 0
                        ? (() => {
                              const srNo = String(
                                  form.parchiNo ||
                                      (selectedEntries.length === 1 ? (selectedEntries[0] as any)?.entry?.srNo : '') ||
                                      ''
                              ).trim();
                              if (!srNo) return undefined;
                              return [{ srNo, amount: 0, cdAmount: 0, extraAmount: form.extraAmount }];
                          })()
                        : undefined,
                editingPayment: form.editingPayment,
                finalAmountToPay: finalAmountToPay,
                paymentMethod: form.paymentMethod,
                selectedAccountId: form.selectedAccountId,
                cdEnabled: cdProps.cdEnabled,
                effectiveCdAmount: effectiveCdAmount,
                calculatedCdAmount: effectiveCdAmount,
                settleAmount,
                totalOutstandingForSelected,
                paymentType: form.paymentType,
                drCr: form.drCr,
                extraAmount: form.extraAmount,
                financialState: { ...(data.financialState as any), bankAccounts: data.bankAccounts },
                paymentId: form.paymentId,
                rtgsSrNo: form.paymentMethod === 'Gov.' ? '' : form.rtgsSrNo,
                paymentDate: form.paymentDate,
                utrNo: form.utrNo,
                checkNo: form.paymentMethod === 'Gov.' ? '' : form.checkNo,
                sixRNo: form.sixRNo,
                sixRDate: form.sixRDate,
                parchiNo: form.parchiNo,
                rtgsQuantity: form.rtgsQuantity,
                rtgsRate: form.rtgsRate,
                rtgsAmount: form.rtgsAmount,
                govQuantity: form.govQuantity,
                govRate: form.govRate,
                govAmount: form.govAmount,
                govExtraAmount: form.govExtraAmount,
                supplierDetails: form.supplierDetails,
                bankDetails: form.bankDetails,
                cdAt: cdProps.cdAt,
                cdPercent: cdProps.cdPercent ?? 2,
                paymentHistory: data.paymentHistory ?? [],
                isCustomer: false,
                centerName: form.centerName,
                suppliers: data.suppliers,
            };

            const result = await processPaymentLogic(context);

            if (!result.success) {
                toast({ title: "Transaction Failed", description: result.message, variant: "destructive" });
                setIsProcessing(false);
                return;
            }

            if (result.payment) {
                data.upsertSupplierPayment?.(result.payment);
            }

            toast({ title: `Payment processed successfully.`, variant: 'success' });
            // RTGS receipt dialog disabled - receipt window should not open automatically
            // if (form.paymentMethod === 'RTGS' && result.payment) {
            //     setRtgsReceiptData(result.payment);
            // }
            form.resetPaymentForm();
            handleSettleAmountChange(0); 
            handleToBePaidChange(0);
        } catch (error: any) {

            toast({ title: "Transaction Failed", description: error.message || "An unexpected error occurred.", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleDeletePayment = async (paymentToDelete: Payment) => {
        if (isProcessing) return;
        setIsProcessing(true);
         try {
            const id = paymentToDelete.id || paymentToDelete.paymentId;
            if (!id) {
                throw new Error("Payment is missing a valid ID.");
            }
            await handleDeletePaymentLogic({
                paymentId: id,
                paymentHistory: data.paymentHistory,
                suppliers: data.suppliers,
                expenses: data.expenses,
                incomes: data.incomes,
                isCustomer: false,
            }); 
            data.deleteSupplierPayment?.(id);
            toast({ title: `Payment deleted successfully.`, variant: 'success', duration: 3000 });
            if (form.editingPayment?.id === id || form.editingPayment?.paymentId === id) {
              form.resetPaymentForm();
              handleSettleAmountChange(0);
              handleToBePaidChange(0);
            }
        } catch (error: any) {

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

        // Do NOT auto-fill payment details when searching by serial number
        // Payment details should only fill when Payment ID is entered directly
        // Just find and select the supplier entry, don't auto-fill payment details

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
        data.suppliers,
        form,
        handleCustomerSelect,
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
        toBePaidAmount: finalAmountToPay,
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
        bankAccounts: data.bankAccounts,
        bankBranches: data.bankBranches,
        selectedPaymentOption,
        centerNameOptions,
        centerName: form.centerName,
        setCenterName: form.setCenterName,
    };
};
