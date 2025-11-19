'use client';

import { collection, doc, getDocs, query, runTransaction, where, addDoc, deleteDoc, limit, updateDoc, getDoc, DocumentReference, WriteBatch, Timestamp } from 'firebase/firestore';
import { firestoreDB } from "@/lib/firebase";
import { toTitleCase, formatCurrency, generateReadableId } from "@/lib/utils";
import type { Customer, Payment, PaidFor, Expense, Income, RtgsSettings, BankAccount } from "@/lib/definitions";
import { format } from 'date-fns';
import { db } from './database';

const suppliersCollection = collection(firestoreDB, "suppliers");
const expensesCollection = collection(firestoreDB, "expenses");
const incomesCollection = collection(firestoreDB, "incomes");
const paymentsCollection = collection(firestoreDB, "payments");
const settingsCollection = collection(firestoreDB, "settings");
const bankAccountsCollection = collection(firestoreDB, "bankAccounts");


interface ProcessPaymentResult {
    success: boolean;
    message?: string;
    payment?: Payment;
}

export const processPaymentLogic = async (context: any): Promise<ProcessPaymentResult> => {
    const {
        rtgsFor, selectedCustomerKey, selectedEntries: incomingSelectedEntries, editingPayment,
        paymentAmount, paymentMethod, selectedAccountId,
        cdEnabled, calculatedCdAmount, settleAmount, totalOutstandingForSelected,
        paymentType, financialState, bankAccounts, paymentId, rtgsSrNo,
        paymentDate, utrNo, checkNo, sixRNo, sixRDate, parchiNo,
        rtgsQuantity, rtgsRate, rtgsAmount, supplierDetails, bankDetails,
        cdAt, // CD mode: 'partial_on_paid', 'on_unpaid_amount', 'on_full_amount', etc.
    } = context;


    if (rtgsFor === 'Supplier' && !selectedCustomerKey) {
        return { success: false, message: "No supplier selected" };
    }
    
    // Build selected entries for edit mode if not provided
    let selectedEntries = incomingSelectedEntries || [];
    if (rtgsFor === 'Supplier' && (!selectedEntries || selectedEntries.length === 0) && editingPayment?.paidFor?.length) {
        const suppliers: Customer[] = Array.isArray((context as any).suppliers) ? (context as any).suppliers : [];
        selectedEntries = editingPayment.paidFor
            .map((pf: any) => suppliers.find(s => s.srNo === pf.srNo))
            .filter(Boolean) as Customer[];
    }

    if (rtgsFor === 'Supplier' && (!selectedEntries || selectedEntries.length === 0)) {
        if (paymentMethod !== 'RTGS') {
            return { success: false, message: "Please select entries to pay" };
        } else if (rtgsAmount <= 0) {
             return { success: false, message: "Please enter an amount for RTGS payment" };
        }
    }

    // finalAmountToPay = "To Be Paid" amount (actual payment amount, WITHOUT CD)
    // settleAmount = "To Be Paid" + CD (total settlement amount, for validation/display only)
    const finalAmountToPay = rtgsFor === 'Outsider' ? rtgsAmount : paymentAmount;
    
    const accountIdForPayment = paymentMethod === 'Cash' ? 'CashInHand' : selectedAccountId;
    
    if (paymentMethod === 'RTGS' && !accountIdForPayment) {
        return { success: false, message: "Please select an account to pay from for RTGS." };
    }
    
    // VALIDATION: Check if settlement amount (to be paid + CD) exceeds total outstanding (skip for Outsider mode or negative outstanding)
    // Allow payments even if outstanding is 0 or negative (for overpayment scenarios)
    if (rtgsFor !== 'Outsider' && totalOutstandingForSelected > 0 && settleAmount > totalOutstandingForSelected + 0.01) { // Add a small tolerance for floating point issues
        return { success: false, message: `Settlement amount (${formatCurrency(settleAmount)}) cannot exceed the total outstanding (${formatCurrency(totalOutstandingForSelected)}) for the selected entries.` };
    }

    // Total to settle = actual payment amount + CD (for validation only, not saved)
    const totalToSettle = finalAmountToPay + calculatedCdAmount;

    if (finalAmountToPay <= 0 && calculatedCdAmount <= 0) {
        return { success: false, message: "Payment and CD amount cannot both be zero." };
    }

    let finalPaymentData: Payment | null = null;
    try {
    await runTransaction(firestoreDB, async (transaction) => {
        
        if (editingPayment?.id) {
            const oldPaymentRef = doc(firestoreDB, "payments", editingPayment.id);
            const oldPaymentDoc = await transaction.get(oldPaymentRef);

            if(oldPaymentDoc.exists()) {
                transaction.delete(oldPaymentRef);
            }
        }

        let paidForDetails: PaidFor[] = [];
        if (rtgsFor === 'Supplier' && selectedEntries && selectedEntries.length > 0) {
            /**
             * ============================================================
             * MULTI-PURCHASE PAYMENT DISTRIBUTION LOGIC
             * ============================================================
             * 
             * STEP 1: Calculate Current Outstanding for Each Purchase
             * - Restore outstanding if editing (add back previous payment + CD)
             * - Outstanding = Original Amount - All Previous Payments - All Previous CD
             * 
             * STEP 2: Check CD Eligibility
             * - CD can only be applied to purchases that haven't received CD before
             * - Track which purchases already received CD from previous payments
             * 
             * STEP 3: Distribute CD (if enabled)
             * - CD reduces outstanding first
             * - Distribution based on CD mode:
             *   * on_full_amount: Proportional to original amount
             *   * partial_on_paid: Based on paid amount
             *   * on_unpaid_amount: Based on outstanding amount
             * 
             * STEP 4: Distribute Paid Amount (Sequential)
             * - Sort purchases by outstanding (ascending - least first)
             * - Complete each purchase fully before moving to next
             * - Rule: Sabse kam outstanding wali purchase pehle complete
             * 
             * STEP 5: Calculate Settle Amount
             * - Settle Amount = Paid Amount + CD Amount
             * 
             * STEP 6: Update Outstanding
             * - New Outstanding = Current Outstanding - Paid Amount - CD Amount
             * - This will be reflected in the table
             */
            
            // ============================================================
            // STEP 1: Calculate Current Outstanding for Each Purchase
            // ============================================================
            // IMPORTANT: Use SAME logic as use-supplier-summary to ensure consistency
            // Outstanding = Original Amount - (Total Paid + Total CD)
            const paymentHistory: Payment[] = (context as any).paymentHistory || [];
            
            const entryOutstandings = selectedEntries.map(entry => {
                const originalAmount = Number(entry.originalNetAmount) || 0;
                
                // IMPORTANT: Use outstandingForEntry from use-supplier-summary if available
                // This is already calculated correctly and matches what's shown in the UI
                // outstandingForEntry = Original Amount - (All Previous Paid + All Previous CD)
                const outstandingFromSummary = (entry as any).outstandingForEntry !== undefined 
                    ? Number((entry as any).outstandingForEntry) 
                    : (entry.netAmount !== undefined ? Number(entry.netAmount) : null);
                
                console.log(`STEP 1 - Calculating outstanding for ${entry.srNo}:`, {
                    srNo: entry.srNo,
                    originalNetAmount: originalAmount,
                    outstandingForEntry: (entry as any).outstandingForEntry,
                    netAmount: entry.netAmount,
                    outstandingFromSummary: outstandingFromSummary
                });
                
                // Get all payments for this entry (excluding the one being edited if in edit mode)
                const allPaymentsForEntry = paymentHistory.filter(p => 
                    p.paidFor?.some(pf => pf.srNo === entry.srNo) && 
                    (!editingPayment || p.id !== editingPayment.id)
                );
                
                console.log(`STEP 1 - Found ${allPaymentsForEntry.length} previous payments for ${entry.srNo}`);
                
                // Calculate total paid and CD using SAME logic as use-supplier-summary
                let totalPaidForEntry = 0;
                let totalCdForEntry = 0;
                let totalPaidWithoutCdForEntry = 0;
                
                allPaymentsForEntry.forEach((payment, idx) => {
                    const paidForThisPurchase = payment.paidFor!.find(pf => pf.srNo === entry.srNo);
                    if (paidForThisPurchase) {
                        const paidAmount = Number(paidForThisPurchase.amount || 0);
                        totalPaidForEntry += paidAmount;
                        
                        // CD amount calculation: First check if directly stored in paidFor (new format), else calculate proportionally
                        let cdAmount = 0;
                        if ('cdAmount' in paidForThisPurchase && paidForThisPurchase.cdAmount !== undefined && paidForThisPurchase.cdAmount !== null) {
                            // New format: CD amount directly stored in paidFor
                            cdAmount = Number(paidForThisPurchase.cdAmount || 0);
                            totalCdForEntry += cdAmount;
                        } else if (payment.cdAmount && payment.paidFor && payment.paidFor.length > 0) {
                            // Old format: Calculate proportionally from payment.cdAmount
                            const totalPaidForInPayment = payment.paidFor.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0);
                            if (totalPaidForInPayment > 0) {
                                const proportion = paidAmount / totalPaidForInPayment;
                                cdAmount = Math.round(payment.cdAmount * proportion * 100) / 100;
                                totalCdForEntry += cdAmount;
                            }
                        }
                        
                        // Track amount paid without CD for this entry
                        if (cdAmount <= 0.01) {
                            totalPaidWithoutCdForEntry += paidAmount;
                        }
                        
                        console.log(`STEP 1 - Payment ${idx + 1} for ${entry.srNo}:`, {
                            paymentId: payment.paymentId,
                            paidAmount,
                            cdAmount,
                            totalPaidSoFar: totalPaidForEntry,
                            totalCdSoFar: totalCdForEntry
                        });
                    }
                });
                
                // If editing, add back the payment being edited temporarily
                let previousPaidAmount = 0;
                let previousCdAmount = 0;
                
                if (editingPayment) {
                    const previousPaidFor = editingPayment.paidFor?.find((pf: any) => pf.srNo === entry.srNo);
                    if (previousPaidFor) {
                        previousPaidAmount = Number(previousPaidFor.amount || 0);
                        
                        // Get CD amount for this entry from editing payment
                        if ('cdAmount' in previousPaidFor && previousPaidFor.cdAmount !== undefined && previousPaidFor.cdAmount !== null) {
                    previousCdAmount = Number(previousPaidFor.cdAmount || 0);
                        } else if (editingPayment.cdAmount && editingPayment.paidFor && editingPayment.paidFor.length > 0) {
                            // Old format: Calculate proportionally
                            const totalEditingPaymentAmount = editingPayment.paidFor.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0);
                            if (totalEditingPaymentAmount > 0) {
                                const proportion = previousPaidAmount / totalEditingPaymentAmount;
                                previousCdAmount = Math.round(editingPayment.cdAmount * proportion * 100) / 100;
                            }
                        }
                        
                        if (previousCdAmount <= 0.01) {
                            totalPaidWithoutCdForEntry += previousPaidAmount;
                        }
                        
                        console.log(`STEP 1 - Editing payment for ${entry.srNo}:`, {
                            previousPaidAmount,
                            previousCdAmount,
                            note: 'Will be added back temporarily'
                        });
                    }
                }
                
                // Calculate outstanding using SAME formula as use-supplier-summary
                // Outstanding = Original - (Total Paid + Total CD)
                // If editing, add back the editing payment temporarily
                const currentOutstanding = originalAmount - totalPaidForEntry - totalCdForEntry;
                const outstanding = currentOutstanding + previousPaidAmount + previousCdAmount;
                
                // IMPORTANT: Use outstandingFromSummary if available (from use-supplier-summary)
                // This ensures we use the SAME outstanding that's shown in the UI
                // If editing, add back the editing payment temporarily
                let finalOutstanding = outstanding;
                if (outstandingFromSummary !== null && !editingPayment) {
                    // Use the outstanding from summary (already calculated correctly)
                    finalOutstanding = outstandingFromSummary;
                    console.log(`STEP 1 - Using outstandingFromSummary for ${entry.srNo}:`, {
                        outstandingFromSummary,
                        calculatedOutstanding: outstanding,
                        match: Math.abs(outstandingFromSummary - outstanding) < 0.01 ? 'MATCH' : 'MISMATCH',
                        difference: outstandingFromSummary - outstanding
                    });
                } else if (editingPayment) {
                    // If editing, add back the editing payment to outstandingFromSummary
                    if (outstandingFromSummary !== null) {
                        finalOutstanding = outstandingFromSummary + previousPaidAmount + previousCdAmount;
                        console.log(`STEP 1 - Editing mode: Adding back payment for ${entry.srNo}:`, {
                            outstandingFromSummary,
                            previousPaidAmount,
                            previousCdAmount,
                            finalOutstanding
                        });
                    }
                }
                
                // IMPORTANT: originalOutstanding should be the CURRENT outstanding (before new payment)
                // This is what we'll use for capacity calculation
                const originalOutstanding = Math.max(0, Math.round(finalOutstanding * 100) / 100);
                
                console.log(`STEP 1 - Final calculation for ${entry.srNo}:`, {
                    originalAmount: originalAmount,
                    totalPaidForEntry: totalPaidForEntry,
                    totalCdForEntry: totalCdForEntry,
                    totalPaidWithoutCd: Math.max(0, Math.round(totalPaidWithoutCdForEntry * 100) / 100),
                    currentOutstanding: currentOutstanding,
                    previousPaidAmount: previousPaidAmount,
                    previousCdAmount: previousCdAmount,
                    outstanding: outstanding,
                    outstandingFromSummary: outstandingFromSummary,
                    finalOutstanding: finalOutstanding,
                    originalOutstanding: originalOutstanding,
                    formula: outstandingFromSummary !== null 
                        ? `Using outstandingFromSummary (${outstandingFromSummary}) + Editing Payment (${previousPaidAmount} + ${previousCdAmount}) = Current Outstanding (${originalOutstanding})`
                        : `Original Amount (${originalAmount}) - Previous Paid (${totalPaidForEntry}) - Previous CD (${totalCdForEntry}) + Editing Paid (${previousPaidAmount}) + Editing CD (${previousCdAmount}) = Current Outstanding (${originalOutstanding})`,
                    note: 'originalOutstanding = Current outstanding before new payment (this is the capacity)'
                });
                
                return { 
                    entry, 
                    outstanding: originalOutstanding, // Current outstanding (will be updated after CD allocation)
                    originalOutstanding: originalOutstanding, // Keep original for reference (this is the capacity)
                    originalAmount: originalAmount, // Original net amount from database
                    totalPaidForEntry,
                    totalCdForEntry,
                    totalPaidWithoutCd: Math.max(0, Math.round(totalPaidWithoutCdForEntry * 100) / 100)
                };
            });
            
            // ============================================================
            // STEP 2: Check CD Eligibility - Which purchases can receive CD?
            // ============================================================
            const totalCdReceivedByEntry: { [srNo: string]: number } = {};
            
            // Calculate total CD already received by each purchase from all previous payments
            for (const entry of selectedEntries) {
                let totalCdForEntry = 0;
                
                for (const payment of paymentHistory) {
                    // Skip current editing payment
                    if (editingPayment && payment.id === editingPayment.id) continue;
                    
                    const paidForThisEntry = payment.paidFor?.find((pf: any) => pf.srNo === entry.srNo);
                    if (paidForThisEntry) {
                        // New format: CD stored directly in paidFor
                        if ('cdAmount' in paidForThisEntry && paidForThisEntry.cdAmount) {
                            totalCdForEntry += Number(paidForThisEntry.cdAmount || 0);
                        } 
                        // Old format: Calculate proportionally
                        else if (payment.cdApplied && payment.cdAmount && payment.paidFor?.length > 0) {
                            const totalPaidForInPayment = payment.paidFor.reduce((sum: number, pf: any) => sum + (pf.amount || 0), 0);
                            if (totalPaidForInPayment > 0) {
                                const proportion = (paidForThisEntry.amount || 0) / totalPaidForInPayment;
                                totalCdForEntry += Math.round(payment.cdAmount * proportion * 100) / 100;
                            }
                        }
                    }
                }
                
                totalCdReceivedByEntry[entry.srNo] = totalCdForEntry;
            }
            
            // ============================================================
            // STEP 3: Distribute CD (if enabled)
            // ============================================================
            const cdToDistribute = cdEnabled && calculatedCdAmount ? Math.round(calculatedCdAmount * 100) / 100 : 0;
            const cdAllocations: { [srNo: string]: number } = {};
            
            // Initialize all CD allocations to 0
            for (const { entry } of entryOutstandings) {
                cdAllocations[entry.srNo] = 0;
            }
            
            // CD Distribution Rules:
            // 1. CD can only be applied to purchases that haven't received CD before
            // 2. CD reduces outstanding first (before paid amount)
            // 3. Distribution method depends on cdAt mode
            // 4. CD MUST be distributed even if payment amount is 0 (for CD-only payments)
            
            // Debug: Log CD distribution start
            if (cdEnabled && calculatedCdAmount) {
                console.log('CD Distribution Start:', {
                    cdEnabled,
                    calculatedCdAmount,
                    cdToDistribute,
                    totalEntries: entryOutstandings.length,
                    entriesWithOutstanding: entryOutstandings.filter(eo => eo.outstanding > 0).length
                });
            }
            
            if (cdToDistribute > 0) {
                // Get eligible entries (those that haven't received CD before and have outstanding)
                const eligibleEntries = entryOutstandings.filter(eo => {
                    const previousCd = totalCdReceivedByEntry[eo.entry.srNo] || 0;
                    return previousCd === 0 && eo.outstanding > 0;
                });
                
                // If no eligible entries, distribute to ALL entries with outstanding (ignore previous CD rule)
                // This ensures CD always distributes when enabled
                const entriesToUse = eligibleEntries.length > 0 
                    ? eligibleEntries 
                    : entryOutstandings.filter(eo => eo.outstanding > 0);
                
                console.log('CD Distribution - Entries to use:', {
                    eligibleCount: eligibleEntries.length,
                    totalToUse: entriesToUse.length,
                    entriesToUse: entriesToUse.map(eo => ({
                        srNo: eo.entry.srNo,
                        outstanding: eo.outstanding,
                        previousCd: totalCdReceivedByEntry[eo.entry.srNo] || 0
                    }))
                });
                
                if (entriesToUse.length > 0) {
                    // Determine CD distribution method based on cdAt mode
                    const useOriginalAmountForDistribution = cdAt === 'on_full_amount' || cdAt === 'proportional_cd';
                
                if (useOriginalAmountForDistribution) {
                        // Mode: on_full_amount or proportional_cd
                        // CD distributed proportionally based on ORIGINAL AMOUNT (not current outstanding)
                        // IMPORTANT: CD is calculated on original amount, but cannot exceed current outstanding
                        // If CD > outstanding, the excess will be redistributed to other purchases
                        const totalOriginalAmountForEligible = entriesToUse.reduce((sum, eo) => 
                            sum + (eo.entry.originalNetAmount || eo.originalAmount || 0), 0);
                        
                        if (totalOriginalAmountForEligible > 0) {
                            let totalAllocated = 0;
                            
                            // First pass: Calculate CD based on original amount (proportional)
                            const calculatedCdByOriginal: { [srNo: string]: number } = {};
                            for (const eo of entriesToUse) {
                                // Only skip if we have eligible entries AND this entry has previous CD
                                // If no eligible entries, distribute to all (ignore previous CD)
                                const previousCd = totalCdReceivedByEntry[eo.entry.srNo] || 0;
                                if (eligibleEntries.length > 0 && previousCd > 0) {
                                    continue; // Skip this entry
                                }
                                
                                const originalAmount = eo.entry.originalNetAmount || eo.originalAmount || 0;
                                if (originalAmount > 0 && eo.outstanding > 0) {
                                    const proportion = originalAmount / totalOriginalAmountForEligible;
                                    const exactCd = cdToDistribute * proportion;
                                    const roundedCd = Math.round(exactCd * 100) / 100;
                                    // Store calculated CD based on original amount
                                    calculatedCdByOriginal[eo.entry.srNo] = roundedCd;
                                }
                            }
                            
                            // Second pass: Allocate CD, but limit to outstanding (to prevent negative)
                            // Excess CD will be redistributed
                            const excessCd: { [srNo: string]: number } = {};
                            for (const eo of entriesToUse) {
                                const calculatedCd = calculatedCdByOriginal[eo.entry.srNo] || 0;
                                if (calculatedCd > 0) {
                                    // CD based on original amount, but cannot exceed outstanding
                                    const maxAllowedCd = Math.max(0, eo.outstanding);
                                    const finalCd = Math.min(calculatedCd, maxAllowedCd);
                                    cdAllocations[eo.entry.srNo] = finalCd;
                                    totalAllocated += finalCd;
                                    
                                    // Track excess CD that couldn't be allocated
                                    if (calculatedCd > maxAllowedCd) {
                                        excessCd[eo.entry.srNo] = calculatedCd - maxAllowedCd;
                                    }
                                    
                                    console.log(`CD Allocated to ${eo.entry.srNo} (on_full_amount mode):`, {
                                        originalAmount: eo.entry.originalNetAmount || eo.originalAmount || 0,
                                        calculatedCdBasedOnOriginal: calculatedCd,
                                        currentOutstanding: eo.outstanding,
                                        maxAllowedCd,
                                        finalCd: cdAllocations[eo.entry.srNo],
                                        excessCd: excessCd[eo.entry.srNo] || 0,
                                        outstandingAfterCd: eo.outstanding - cdAllocations[eo.entry.srNo],
                                        status: (eo.outstanding - cdAllocations[eo.entry.srNo]) >= 0 ? 'OK' : 'NEGATIVE!'
                                    });
                                }
                            }
                            
                            // Third pass: Redistribute excess CD to other purchases that have capacity
                            const totalExcessCd = Object.values(excessCd).reduce((sum, excess) => sum + excess, 0);
                            let remainingCdToDistribute = cdToDistribute - totalAllocated;
                            
                            if (remainingCdToDistribute > 0.01) {
                                console.log('Redistributing excess CD:', {
                                    totalExcessCd,
                                    remainingCdToDistribute,
                                    totalAllocated
                                });
                                
                                // Sort entries by outstanding (descending) to fill purchases with most capacity first
                                const sortedEntriesForRedistribution = [...entriesToUse]
                                    .filter(eo => {
                        const previousCd = totalCdReceivedByEntry[eo.entry.srNo] || 0;
                                        if (eligibleEntries.length > 0 && previousCd > 0) {
                                            return false; // Skip entries with previous CD
                                        }
                                        const currentCd = cdAllocations[eo.entry.srNo] || 0;
                                        const outstandingAfterCurrentCd = eo.outstanding - currentCd;
                                        return outstandingAfterCurrentCd > 0.01; // Only entries with remaining capacity
                                    })
                                    .sort((a, b) => {
                                        const aCapacity = a.outstanding - (cdAllocations[a.entry.srNo] || 0);
                                        const bCapacity = b.outstanding - (cdAllocations[b.entry.srNo] || 0);
                                        return bCapacity - aCapacity; // Descending
                                    });
                                
                                for (const eo of sortedEntriesForRedistribution) {
                                    if (remainingCdToDistribute <= 0.01) break;
                                    
                                    const currentCd = cdAllocations[eo.entry.srNo] || 0;
                                    const maxAllowedCd = Math.max(0, eo.outstanding);
                                    const remainingCapacity = maxAllowedCd - currentCd;
                                    
                                    if (remainingCapacity > 0.01) {
                                        const additionalCd = Math.min(
                                            Math.round(remainingCdToDistribute * 100) / 100,
                                            remainingCapacity
                                        );
                                        cdAllocations[eo.entry.srNo] = currentCd + additionalCd;
                                        totalAllocated += additionalCd;
                                        remainingCdToDistribute -= additionalCd;
                                        
                                        console.log(`Redistributed excess CD to ${eo.entry.srNo}:`, {
                                            additionalCd,
                                            oldCd: currentCd,
                                            newCd: cdAllocations[eo.entry.srNo],
                                            remainingCapacity,
                                            remainingCdToDistribute
                                        });
                                    }
                                }
                            }
                            
                            // Final check: Handle any remaining rounding difference
                            let roundingDiff = cdToDistribute - totalAllocated;
                    if (Math.abs(roundingDiff) >= 0.01) {
                                // Sort by outstanding (descending) to adjust rounding
                                const sortedEntries = [...entriesToUse].sort((a, b) => b.outstanding - a.outstanding);
                                for (const eo of sortedEntries) {
                            if (Math.abs(roundingDiff) < 0.01) break;
                                    const currentCd = cdAllocations[eo.entry.srNo] || 0;
                                    // CRITICAL: Max allowed = Outstanding - Current CD (to prevent negative outstanding)
                                    const maxAllowed = Math.max(0, eo.outstanding - currentCd);
                                    if (maxAllowed > 0) {
                                        const adjustment = Math.min(maxAllowed, Math.abs(roundingDiff)) * (roundingDiff > 0 ? 1 : -1);
                                        const newCd = Math.round((currentCd + adjustment) * 100) / 100;
                                        
                                        // Verify: Outstanding after adjustment should be >= 0
                                        const outstandingAfterAdjustment = eo.outstanding - newCd;
                                        if (outstandingAfterAdjustment >= -0.01) {
                                            cdAllocations[eo.entry.srNo] = newCd;
                                    roundingDiff -= adjustment;
                                        } else {
                                            // Adjust to maximum allowed (outstanding)
                                            cdAllocations[eo.entry.srNo] = Math.max(0, eo.outstanding);
                                            roundingDiff -= (cdAllocations[eo.entry.srNo] - currentCd);
                                        }
                                    }
                                }
                            }
                            
                            console.log('Final CD Distribution (on_full_amount mode):', {
                                totalCdToDistribute: cdToDistribute,
                                totalAllocated,
                                roundingDiff,
                                allocations: Object.entries(cdAllocations).map(([srNo, cd]) => ({
                                    srNo,
                                    cd,
                                    originalAmount: entriesToUse.find(eo => eo.entry.srNo === srNo)?.entry.originalNetAmount || 0,
                                    outstanding: entriesToUse.find(eo => eo.entry.srNo === srNo)?.outstanding || 0
                                }))
                            });
                    }
                } else {
                        // Mode: partial_on_paid or on_unpaid_amount
                        // CD distributed based on outstanding or paid amount
                        let totalBaseAmount = 0;
                        
                        // Calculate total base amount for CD distribution
                        if (cdAt === 'on_unpaid_amount') {
                            // CD on unpaid amount: use outstanding
                            totalBaseAmount = entriesToUse.reduce((sum, eo) => {
                                const previousCd = totalCdReceivedByEntry[eo.entry.srNo] || 0;
                                // Only count entries that haven't received CD (if we have eligible entries)
                                if (eligibleEntries.length > 0 && previousCd > 0) {
                                    return sum;
                                }
                                return sum + eo.outstanding;
                            }, 0);
                        } else if (cdAt === 'partial_on_paid') {
                            // CD on paid amount: will use paid amount (calculated after payment distribution)
                            // For now, use outstanding as approximation
                            totalBaseAmount = entriesToUse.reduce((sum, eo) => {
                                const previousCd = totalCdReceivedByEntry[eo.entry.srNo] || 0;
                                if (eligibleEntries.length > 0 && previousCd > 0) {
                                    return sum;
                                }
                                return sum + eo.outstanding;
                            }, 0);
                        } else if (cdAt === 'on_previously_paid_no_cd') {
                            totalBaseAmount = entriesToUse.reduce((sum, eo) => {
                                const previousCd = totalCdReceivedByEntry[eo.entry.srNo] || 0;
                                if (eligibleEntries.length > 0 && previousCd > 0) {
                                    return sum;
                                }
                                const paidWithoutCd = eo.totalPaidWithoutCd || 0;
                                return paidWithoutCd > 0 ? sum + paidWithoutCd : sum;
                            }, 0);
                        }
                        
                        if (totalBaseAmount > 0) {
                            let totalAllocated = 0;
                            
                            // Allocate CD proportionally based on base amount
                            for (const eo of entriesToUse) {
                                // Only skip if we have eligible entries AND this entry has previous CD
                                const previousCd = totalCdReceivedByEntry[eo.entry.srNo] || 0;
                                if (eligibleEntries.length > 0 && previousCd > 0) {
                                    continue; // Skip this entry
                                }
                                
                                let baseAmount = 0;
                                if (cdAt === 'on_unpaid_amount') {
                                    baseAmount = eo.outstanding;
                                } else if (cdAt === 'partial_on_paid') {
                                    // Will recalculate after payment distribution
                                    baseAmount = eo.outstanding; // Temporary
                                } else if (cdAt === 'on_previously_paid_no_cd') {
                                    baseAmount = eo.totalPaidWithoutCd || 0;
                                }
                                
                                if (baseAmount > 0 && eo.outstanding > 0) {
                                    const proportion = baseAmount / totalBaseAmount;
                                    const exactCd = cdToDistribute * proportion;
                                    const roundedCd = Math.round(exactCd * 100) / 100;
                                    // CRITICAL: CD should not exceed outstanding (to prevent negative outstanding)
                                    const finalCd = Math.min(roundedCd, eo.outstanding);
                                    cdAllocations[eo.entry.srNo] = finalCd;
                                    totalAllocated += finalCd;
                                    
                                    // Verify: Outstanding after CD should be >= 0
                                    const outstandingAfterCd = eo.outstanding - finalCd;
                                    if (outstandingAfterCd < -0.01) {
                                        console.warn(`CD Allocation Warning for ${eo.entry.srNo}: Outstanding would become negative, adjusting CD`);
                                        cdAllocations[eo.entry.srNo] = Math.max(0, eo.outstanding);
                                        totalAllocated = totalAllocated - finalCd + cdAllocations[eo.entry.srNo];
                                    }
                                    
                                    console.log(`CD Allocated to ${eo.entry.srNo}:`, {
                                        baseAmount,
                                        proportion: (proportion * 100).toFixed(2) + '%',
                                        exactCd,
                                        roundedCd,
                                        finalCd: cdAllocations[eo.entry.srNo],
                                        outstanding: eo.outstanding,
                                        outstandingAfterCd: eo.outstanding - cdAllocations[eo.entry.srNo],
                                        status: (eo.outstanding - cdAllocations[eo.entry.srNo]) >= 0 ? 'OK' : 'NEGATIVE!'
                                    });
                                }
                            }
                            
                            // Handle rounding difference
                            let roundingDiff = cdToDistribute - totalAllocated;
                            if (Math.abs(roundingDiff) >= 0.01) {
                                const sortedEntries = [...entriesToUse].sort((a, b) => b.outstanding - a.outstanding);
                                for (const eo of sortedEntries) {
                                    if (Math.abs(roundingDiff) < 0.01) break;
                                    const currentCd = cdAllocations[eo.entry.srNo] || 0;
                                    // CRITICAL: Max allowed = Outstanding - Current CD (to prevent negative outstanding)
                                    const maxAllowed = Math.max(0, eo.outstanding - currentCd);
                                    if (maxAllowed > 0) {
                                        const adjustment = Math.min(maxAllowed, Math.abs(roundingDiff)) * (roundingDiff > 0 ? 1 : -1);
                                        const newCd = Math.round((currentCd + adjustment) * 100) / 100;
                                        
                                        // Verify: Outstanding after adjustment should be >= 0
                                        const outstandingAfterAdjustment = eo.outstanding - newCd;
                                        if (outstandingAfterAdjustment >= -0.01) {
                                            cdAllocations[eo.entry.srNo] = newCd;
                                            roundingDiff -= adjustment;
                                        } else {
                                            // Adjust to maximum allowed (outstanding)
                                            cdAllocations[eo.entry.srNo] = Math.max(0, eo.outstanding);
                                            roundingDiff -= (cdAllocations[eo.entry.srNo] - currentCd);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            // Update outstanding after CD distribution (CD reduces outstanding first)
            // IMPORTANT: Keep originalOutstanding unchanged, only update outstanding
            for (const eo of entryOutstandings) {
                const cdAmount = cdAllocations[eo.entry.srNo] || 0;
                // Update outstanding after CD (for payment distribution)
                eo.outstanding = Math.max(0, (eo.originalOutstanding || eo.outstanding) - cdAmount);
                // Keep originalOutstanding unchanged
                if (!eo.originalOutstanding) {
                    eo.originalOutstanding = eo.outstanding + cdAmount;
                }
            }
            
            // Step 2: Distribute paid amount (To Be Paid amount) sequentially
            // Rule: Complete the purchase with least outstanding first, then move to next with least outstanding
            // IMPORTANT: paidFor.amount is the actual payment amount (To Be Paid), NOT (outstanding - CD)
            // CD is separate and stored in cdAmount field
            let amountToDistribute = Math.round(finalAmountToPay * 100) / 100;
            
            console.log('=== PAYMENT DISTRIBUTION START ===');
            console.log('Total amount to distribute:', amountToDistribute);
            console.log('Entry outstandings BEFORE payment distribution:', entryOutstandings.map(eo => {
                const originalOutstanding = eo.originalOutstanding || eo.outstanding;
                const cdAllocated = cdAllocations[eo.entry.srNo] || 0;
                const outstandingAfterCd = eo.outstanding; // Already updated after CD
                const capacity = outstandingAfterCd; // Capacity = Outstanding after CD
                
                return {
                    srNo: eo.entry.srNo,
                    originalAmount: eo.originalAmount,
                    originalOutstanding: originalOutstanding,
                    cdAllocated: cdAllocated,
                    outstandingAfterCd: outstandingAfterCd,
                    capacity: capacity, // Capacity = Outstanding after CD (this is the maximum we can pay)
                    formula: `Original Outstanding (${originalOutstanding}) - CD (${cdAllocated}) = Capacity (${capacity})`
                };
            }));
            
            // Sort entries by outstanding amount (ascending - least outstanding first)
            // IMPORTANT: eo.outstanding is already updated after CD allocation
            const sortedEntriesForPayment = entryOutstandings
                .filter(eo => {
                    const outstandingAfterCd = Math.max(0, eo.outstanding); // Already updated after CD
                    return outstandingAfterCd > 0.01; // Only entries with capacity > 0
                })
                .sort((a, b) => {
                    const outstandingA = Math.max(0, a.outstanding); // Already updated after CD
                    const outstandingB = Math.max(0, b.outstanding); // Already updated after CD
                    // Sort by outstanding after CD (ascending - least first)
                    if (Math.abs(outstandingA - outstandingB) < 0.01) {
                        // If outstanding is same, maintain original order
                        return 0;
                    }
                    return outstandingA - outstandingB;
                });
            
            console.log('Sorted entries for payment (by outstanding after CD, ascending):', sortedEntriesForPayment.map(eo => {
                const originalOutstanding = eo.originalOutstanding || eo.outstanding;
                const cdAllocated = cdAllocations[eo.entry.srNo] || 0;
                const outstandingAfterCd = eo.outstanding; // Already updated after CD
                const capacity = outstandingAfterCd; // Capacity = Outstanding after CD
                
                return {
                    srNo: eo.entry.srNo,
                    originalOutstanding: originalOutstanding,
                    cdAllocated: cdAllocated,
                    outstandingAfterCd: outstandingAfterCd,
                    capacity: capacity,
                    formula: `Original Outstanding (${originalOutstanding}) - CD (${cdAllocated}) = Capacity (${capacity})`
                };
            }));
            
            // Sequential distribution: complete each purchase fully before moving to next
            const roundedPayments: { [srNo: string]: number } = {};
            
            // Initialize all payments to 0
            for (const { entry } of entryOutstandings) {
                roundedPayments[entry.srNo] = 0;
            }
            
            // Distribute sequentially
            for (const eo of sortedEntriesForPayment) {
                const { entry, outstanding } = eo;
                if (amountToDistribute <= 0.01) break;
                
                // Capacity = Outstanding after CD (this is the maximum we can pay)
                // IMPORTANT: eo.outstanding is already updated after CD allocation
                const cdAllocated = cdAllocations[entry.srNo] || 0;
                const outstandingAfterCd = Math.max(0, outstanding); // Already updated after CD
                const capacity = outstandingAfterCd; // Capacity = how much we can pay
                
                if (capacity > 0.01) {
                    // Pay the minimum of: remaining amount to distribute OR full capacity for this entry
                    const paymentForThisEntry = Math.min(amountToDistribute, capacity);
                    roundedPayments[entry.srNo] = Math.round(paymentForThisEntry * 100) / 100;
                    amountToDistribute = Math.round((amountToDistribute - paymentForThisEntry) * 100) / 100;
                    
                    const originalOutstanding = eo.originalOutstanding || outstanding;
                    console.log(`Payment allocated to ${entry.srNo}:`, {
                        originalOutstanding: originalOutstanding,
                        outstanding: outstanding,
                        cdAllocated: cdAllocated,
                        outstandingAfterCd: outstandingAfterCd,
                        capacity: capacity,
                        paymentAllocated: roundedPayments[entry.srNo],
                        remainingToDistribute: amountToDistribute,
                        outstandingAfterPayment: outstandingAfterCd - roundedPayments[entry.srNo],
                        formula: `Original Outstanding (${originalOutstanding}) - CD (${cdAllocated}) - Payment (${roundedPayments[entry.srNo]}) = Final Outstanding (${outstandingAfterCd - roundedPayments[entry.srNo]})`
                    });
                }
            }
            
            console.log('Payment distribution summary:', {
                totalToDistribute: finalAmountToPay,
                totalDistributed: Object.values(roundedPayments).reduce((sum, amt) => sum + amt, 0),
                remaining: amountToDistribute,
                payments: Object.entries(roundedPayments).map(([srNo, amt]) => {
                    const eo = entryOutstandings.find(eo => eo.entry.srNo === srNo);
                    if (eo) {
                        const originalOutstanding = eo.originalOutstanding || eo.outstanding;
                        const cdAllocated = cdAllocations[srNo] || 0;
                        const outstandingAfterCd = eo.outstanding; // Already updated after CD
                        const outstandingAfterPayment = outstandingAfterCd - amt;
                        
                        return {
                            srNo,
                            amount: amt,
                            originalOutstanding: originalOutstanding,
                            cdAllocated: cdAllocated,
                            outstandingAfterCd: outstandingAfterCd,
                            outstandingAfterPayment: outstandingAfterPayment,
                            capacity: outstandingAfterCd,
                            formula: `Original Outstanding (${originalOutstanding}) - CD (${cdAllocated}) - Payment (${amt}) = Final Outstanding (${outstandingAfterPayment})`
                        };
                    }
                    return { srNo, amount: amt, error: 'Entry not found' };
                })
            });
            
            // Handle any remaining amount due to rounding (distribute to entries with capacity)
            if (amountToDistribute > 0.01) {
                console.log('Remaining amount to distribute after sequential payment:', amountToDistribute);
                // Find entries that still have capacity and distribute remaining amount
                for (const eo of sortedEntriesForPayment) {
                    const { entry, outstanding } = eo;
                    if (amountToDistribute <= 0.01) break;
                    
                    // IMPORTANT: eo.outstanding is already updated after CD allocation
                    const outstandingAfterCd = Math.max(0, outstanding); // Already updated after CD
                    const alreadyPaid = roundedPayments[entry.srNo] || 0;
                    const remainingCapacity = outstandingAfterCd - alreadyPaid; // Remaining capacity = Outstanding after CD - Already paid
                    
                    if (remainingCapacity > 0.01) {
                        const additionalPayment = Math.min(amountToDistribute, remainingCapacity);
                        roundedPayments[entry.srNo] = Math.round((roundedPayments[entry.srNo] || 0) + additionalPayment) * 100 / 100;
                        amountToDistribute = Math.round((amountToDistribute - additionalPayment) * 100) / 100;
                        
                        console.log(`Additional payment allocated to ${entry.srNo}:`, {
                            outstandingAfterCd,
                            alreadyPaid,
                            remainingCapacity,
                            additionalPayment,
                            newTotalPaid: roundedPayments[entry.srNo],
                            remainingToDistribute: amountToDistribute
                        });
                    }
                }
                
                if (amountToDistribute > 0.01) {
                    console.warn(`WARNING: Could not distribute all amount. Remaining: ${amountToDistribute}. This means total payment exceeds total capacity.`);
                }
            }
            
            // ============================================================
            // STEP 4: Create paidForDetails with payment amounts
            // ============================================================
            // IMPORTANT: Include entries even if only CD is present (no payment)
            // Settlement Amount = Paid Amount + CD Amount
            for (const { entry } of entryOutstandings) {
                const paymentForThisEntry = roundedPayments[entry.srNo] || 0;
                const cdForThisEntry = Math.round((cdAllocations[entry.srNo] || 0) * 100) / 100;
                
                // Include entry if it has payment OR CD (CD-only payments are valid)
                if (paymentForThisEntry > 0 || cdForThisEntry > 0) {
                    paidForDetails.push({
                        srNo: entry.srNo,
                        amount: paymentForThisEntry, // Actual payment amount (To Be Paid)
                        cdAmount: cdForThisEntry, // CD amount (separate)
                    });
                }
            }
            
            // Verify: Total CD distributed should match cdToDistribute
            const totalCdDistributed = paidForDetails.reduce((sum, pf) => sum + (pf.cdAmount || 0), 0);
            const cdDistributionDiff = cdToDistribute - totalCdDistributed;
            
            // Log CD distribution summary
            if (cdToDistribute > 0) {
                console.log('CD Distribution Summary:', {
                    cdToDistribute,
                    totalCdDistributed,
                    diff: cdDistributionDiff,
                    paidForDetails: paidForDetails.map(pf => ({
                        srNo: pf.srNo,
                        amount: pf.amount,
                        cdAmount: pf.cdAmount
                    }))
                });
            }
            
            // If there's a significant difference in CD distribution, log warning
            if (Math.abs(cdDistributionDiff) >= 0.01 && cdToDistribute > 0) {
                console.warn(`CD Distribution Warning: Expected CD ${cdToDistribute}, distributed ${totalCdDistributed}, diff: ${cdDistributionDiff}`);
            }
            
            // ============================================================
            // STEP 5: Finalize CD Distribution (Recalculate for partial_on_paid mode)
            // ============================================================
            // For partial_on_paid mode: CD should be based on ACTUAL PAID AMOUNTS (not settled amounts)
            // IMPORTANT: paidFor.amount is the actual payment amount (To Be Paid), NOT settle amount
            // Settle Amount = Paid Amount + CD Amount
            // CD should be calculated on Paid Amount only
            if (cdToDistribute > 0 && paidForDetails.length > 0 && cdAt === 'partial_on_paid') {
                console.log('Finalize Step: Recalculating CD for partial_on_paid mode');
                
                // Recalculate CD based on ACTUAL PAID AMOUNTS (not settled amounts)
                // paidFor.amount is already the actual paid amount (To Be Paid), not settle amount
                const totalPaidAmount = paidForDetails.reduce((sum, pf) => sum + pf.amount, 0);
                
                console.log('Finalize - Total ACTUAL paid amount (not settle):', totalPaidAmount);
                console.log('Finalize - Total CD to distribute:', cdToDistribute);
                console.log('Finalize - Expected CD%:', ((cdToDistribute / totalPaidAmount) * 100).toFixed(2) + '%');
                
                if (totalPaidAmount > 0) {
                    // Get eligible entries (those without previous CD)
                    // IMPORTANT: Use actual paid amount (pf.amount), not settle amount
                    const eligiblePaidFor = paidForDetails.filter(pf => {
                    const previousCd = totalCdReceivedByEntry[pf.srNo] || 0;
                        // Only entries with actual payment amount > 0 (not settle amount)
                        return previousCd === 0 && pf.amount > 0;
                    });
                    
                    console.log('Finalize - Eligible entries:', eligiblePaidFor.length);
                    
                    // Calculate total ACTUAL paid amount for eligible entries (not settle amount)
                    const totalPaidForEligible = eligiblePaidFor.reduce((sum, pf) => sum + pf.amount, 0);
                    
                    console.log('Finalize - Total ACTUAL paid for eligible (not settle):', totalPaidForEligible);
                    
                    if (totalPaidForEligible > 0) {
                        let totalRecalculated = 0;
                        const recalculatedCd: { [srNo: string]: number } = {};
                        
                        // Get original outstanding before CD was applied (add back CD that was already allocated)
                        const getOriginalOutstanding = (srNo: string) => {
                            const eo = entryOutstandings.find(e => e.entry.srNo === srNo);
                            if (eo) {
                                // Current outstanding + CD already allocated = original outstanding before CD
                                const currentCd = cdAllocations[srNo] || 0;
                                return eo.outstanding + currentCd;
                            }
                            return 0;
                        };
                        
                        // Distribute CD sequentially - skip purchases where CD would cause negative outstanding
                        // Rule: Don't reduce CD, just skip purchases that would go negative and move to next
                        let remainingCd = cdToDistribute;
                        
                        // Sort eligible purchases by outstanding (ascending - least first) for sequential distribution
                        const sortedEligible = [...eligiblePaidFor].sort((a, b) => {
                            const outstandingA = getOriginalOutstanding(a.srNo);
                            const outstandingB = getOriginalOutstanding(b.srNo);
                            return outstandingA - outstandingB; // Least outstanding first
                        });
                        
                        // First pass: Calculate proportional CD for each purchase
                        // IMPORTANT: Only purchases that are eligible for CD will get CD
                        const proportionalCd: { [srNo: string]: number } = {};
                        for (const paidFor of sortedEligible) {
                            const actualPaidAmount = paidFor.amount;
                            const proportion = actualPaidAmount / totalPaidForEligible;
                            const exactCd = cdToDistribute * proportion;
                            proportionalCd[paidFor.srNo] = Math.round(exactCd * 100) / 100;
                        }
                        
                        // Identify which purchases will receive CD (CD > 0)
                        const purchasesWithCd = sortedEligible.filter(pf => (proportionalCd[pf.srNo] || 0) > 0.01);
                        const purchasesWithoutCd = sortedEligible.filter(pf => (proportionalCd[pf.srNo] || 0) <= 0.01);
                        
                        console.log('Finalize - Purchases with CD:', purchasesWithCd.map(pf => pf.srNo));
                        console.log('Finalize - Purchases without CD:', purchasesWithoutCd.map(pf => pf.srNo));
                        
                        // Second pass: Distribute CD and adjust paid amounts iteratively
                        // Rule: If a purchase would go negative, adjust previous purchases to make it work
                        // Iterative approach: Keep adjusting until all purchases are valid
                        const paidAmountAdjustments: { [srNo: string]: number } = {};
                        
                        // Initialize all paid amounts
                        for (const paidFor of sortedEligible) {
                            paidAmountAdjustments[paidFor.srNo] = paidFor.amount;
                        }
                        
                        // Iterative adjustment: Keep adjusting until all purchases are valid
                        let maxIterations = 10; // Safety limit
                        let iteration = 0;
                        let allValid = false;
                        
                        while (!allValid && iteration < maxIterations) {
                            iteration++;
                            console.log(`Finalize - Iteration ${iteration}: Checking all purchases`);
                            
                            allValid = true;
                            const adjustmentsThisIteration: { [srNo: string]: number } = {};
                            
                            // Check each purchase sequentially
                            // IMPORTANT: Check ALL purchases - even those without CD
                            // If outstanding would go negative (with or without CD), reduce paid amount
                            console.log(`Finalize - Iteration ${iteration}: Checking ${sortedEligible.length} purchases for negative outstanding`);
                            
                            for (let i = 0; i < sortedEligible.length; i++) {
                                const paidFor = sortedEligible[i];
                                const originalOutstanding = getOriginalOutstanding(paidFor.srNo);
                                const currentPaidAmount = paidAmountAdjustments[paidFor.srNo] || paidFor.amount;
                                const proposedCd = proportionalCd[paidFor.srNo] || 0;
                                
                                // Capacity = Original Outstanding - Proposed CD (this is the maximum we can pay)
                                const capacity = originalOutstanding - proposedCd;
                                
                                // Check if this purchase would go negative (with or without CD)
                                const outstandingAfter = originalOutstanding - currentPaidAmount - proposedCd;
                                
                                console.log(`Finalize - Iteration ${iteration}: Checking ${paidFor.srNo}:`, {
                                    originalOutstanding,
                                    currentPaidAmount,
                                    proposedCd,
                                    capacity,
                                    outstandingAfter,
                                    wouldGoNegative: outstandingAfter < -0.01,
                                    status: outstandingAfter < -0.01 ? 'NEGATIVE - NEEDS ADJUSTMENT' : 'OK'
                                });
                                
                                if (outstandingAfter < -0.01) {
                                    // This purchase would go negative - MUST reduce paid amount
                                    // This applies to BOTH purchases with CD and without CD
                                    allValid = false;
                                    
                                    // Calculate how much we need to reduce from this purchase
                                    const excess = Math.abs(outstandingAfter);
                                    const newPaidAmount = Math.max(0, currentPaidAmount - excess);
                                    adjustmentsThisIteration[paidFor.srNo] = newPaidAmount - currentPaidAmount;
                                    paidAmountAdjustments[paidFor.srNo] = newPaidAmount;
                                    
                                    const hasCd = proposedCd > 0.01;
                                    
                                    console.log(`Finalize - Iteration ${iteration}: ${paidFor.srNo} would go negative (CD: ${hasCd ? 'YES' : 'NO'}), reducing paid amount:`, {
                                        currentPaidAmount,
                                        newPaidAmount,
                                        excess,
                                        proposedCd,
                                        originalOutstanding,
                                        newOutstanding: originalOutstanding - newPaidAmount - proposedCd,
                                        hasCd: hasCd
                                    });
                                    
                                    // Redistribute the reduced amount
                                    // IMPORTANT: Redistribute only to purchases that are receiving CD (have capacity)
                                    // Goal: Keep total paid amount = ₹2000 (user's intended amount)
                                    const reduction = currentPaidAmount - newPaidAmount;
                                    if (reduction > 0.01) {
                                        let remainingToRedistribute = reduction;
                                        
                                        // Helper function to redistribute to a purchase
                                        const redistributeToPurchase = (targetPaidFor: typeof paidFor, sourceSrNo: string) => {
                                            if (remainingToRedistribute <= 0.01) return;
                                            
                                            const targetOutstanding = getOriginalOutstanding(targetPaidFor.srNo);
                                            const targetPaid = paidAmountAdjustments[targetPaidFor.srNo] || targetPaidFor.amount;
                                            const targetCd = proportionalCd[targetPaidFor.srNo] || 0;
                                            const targetOutstandingAfter = targetOutstanding - targetPaid - targetCd;
                                            
                                            // Check if this purchase has capacity (outstanding > 0) and is receiving CD
                                            if (targetOutstandingAfter > 0.01 && targetCd > 0.01) {
                                                const capacity = targetOutstandingAfter;
                                                const additionalPaid = Math.min(
                                                    Math.round(remainingToRedistribute * 100) / 100,
                                                    capacity
                                                );
                                                
                                                const newTargetPaid = targetPaid + additionalPaid;
                                                paidAmountAdjustments[targetPaidFor.srNo] = newTargetPaid;
                                                remainingToRedistribute -= additionalPaid;
                                                
                                                console.log(`Finalize - Iteration ${iteration}: Redistributed from ${sourceSrNo} to ${targetPaidFor.srNo} (with CD):`, {
                                                    from: sourceSrNo,
                                                    to: targetPaidFor.srNo,
                                                    amount: additionalPaid,
                                                    oldPaid: targetPaid,
                                                    newPaid: newTargetPaid,
                                                    capacity,
                                                    remainingToRedistribute,
                                                    status: 'REDISTRIBUTED'
                                                });
                                            }
                                        };
                                        
                                        // Step 1: Try to redistribute to PREVIOUS purchases (closest first: B, then A)
                                        if (i > 0) {
                                            const previousPurchasesWithCd = sortedEligible.slice(0, i)
                                                .reverse()
                                                .filter(pf => (proportionalCd[pf.srNo] || 0) > 0.01);
                                            
                                            for (const prevPaidFor of previousPurchasesWithCd) {
                                                if (remainingToRedistribute <= 0.01) break;
                                                redistributeToPurchase(prevPaidFor, paidFor.srNo);
                                            }
                                        }
                                        
                                        // Step 2: If still remaining, redistribute to NEXT purchases (closest first)
                                        if (remainingToRedistribute > 0.01 && i < sortedEligible.length - 1) {
                                            const nextPurchasesWithCd = sortedEligible.slice(i + 1)
                                                .filter(pf => (proportionalCd[pf.srNo] || 0) > 0.01);
                                            
                                            for (const nextPaidFor of nextPurchasesWithCd) {
                                                if (remainingToRedistribute <= 0.01) break;
                                                redistributeToPurchase(nextPaidFor, paidFor.srNo);
                                            }
                                        }
                                        
                                        // Step 3: If still remaining, try ALL other purchases (not just previous/next)
                                        // This ensures we use the full ₹2000 paid amount
                                        if (remainingToRedistribute > 0.01) {
                                            const allOtherPurchasesWithCd = sortedEligible
                                                .filter((pf, idx) => idx !== i && (proportionalCd[pf.srNo] || 0) > 0.01)
                                                .sort((a, b) => {
                                                    // Sort by capacity (descending) to fill purchases with most capacity first
                                                    const aOutstanding = getOriginalOutstanding(a.srNo);
                                                    const aPaid = paidAmountAdjustments[a.srNo] || a.amount;
                                                    const aCd = proportionalCd[a.srNo] || 0;
                                                    const aCapacity = aOutstanding - aPaid - aCd;
                                                    
                                                    const bOutstanding = getOriginalOutstanding(b.srNo);
                                                    const bPaid = paidAmountAdjustments[b.srNo] || b.amount;
                                                    const bCd = proportionalCd[b.srNo] || 0;
                                                    const bCapacity = bOutstanding - bPaid - bCd;
                                                    
                                                    return bCapacity - aCapacity; // Descending
                                                });
                                            
                                            for (const otherPaidFor of allOtherPurchasesWithCd) {
                                                if (remainingToRedistribute <= 0.01) break;
                                                redistributeToPurchase(otherPaidFor, paidFor.srNo);
                                            }
                                        }
                                        
                                        // Final check: If still remaining, log warning
                                        if (remainingToRedistribute > 0.01) {
                                            console.warn(`Finalize - Iteration ${iteration}: Could not redistribute all amount from ${paidFor.srNo}. Remaining: ${remainingToRedistribute}. This means total paid amount will be less than intended.`);
                                        }
                            }
                        } else {
                                    // This purchase is valid (won't go negative)
                                    recalculatedCd[paidFor.srNo] = proposedCd;
                                }
                            }
                            
                            // Update all CD allocations
                            for (const paidFor of sortedEligible) {
                                recalculatedCd[paidFor.srNo] = proportionalCd[paidFor.srNo] || 0;
                            }
                            
                            if (allValid) {
                                console.log(`Finalize - All purchases valid after ${iteration} iterations`);
                                
                                // Final summary of all purchases
                                console.log('Finalize - Final Summary of All Purchases:', sortedEligible.map(pf => {
                                    const originalOutstanding = getOriginalOutstanding(pf.srNo);
                                    const finalPaidAmount = paidAmountAdjustments[pf.srNo] || pf.amount;
                                    const finalCd = proportionalCd[pf.srNo] || 0;
                                    const finalOutstanding = originalOutstanding - finalPaidAmount - finalCd;
                                    
                                    return {
                                        srNo: pf.srNo,
                                        originalOutstanding,
                                        paidAmount: finalPaidAmount,
                                        cdAmount: finalCd,
                                        settleAmount: finalPaidAmount + finalCd,
                                        finalOutstanding,
                                        capacity: originalOutstanding - finalCd,
                                        status: finalOutstanding < -0.01 ? 'NEGATIVE!' : finalOutstanding > 0.01 ? 'OUTSTANDING' : 'SETTLED'
                                    };
                                }));
                            }
                        }
                        
                        if (!allValid) {
                            console.warn(`Finalize - Warning: Could not make all purchases valid after ${maxIterations} iterations`);
                            
                            // Show final state even if not all valid
                            console.log('Finalize - Final State (Some may be negative):', sortedEligible.map(pf => {
                                const originalOutstanding = getOriginalOutstanding(pf.srNo);
                                const finalPaidAmount = paidAmountAdjustments[pf.srNo] || pf.amount;
                                const finalCd = proportionalCd[pf.srNo] || 0;
                                const finalOutstanding = originalOutstanding - finalPaidAmount - finalCd;
                                
                                return {
                                    srNo: pf.srNo,
                                    originalOutstanding,
                                    paidAmount: finalPaidAmount,
                                    cdAmount: finalCd,
                                    settleAmount: finalPaidAmount + finalCd,
                                    finalOutstanding,
                                    capacity: originalOutstanding - finalCd,
                                    status: finalOutstanding < -0.01 ? 'NEGATIVE!' : finalOutstanding > 0.01 ? 'OUTSTANDING' : 'SETTLED'
                                };
                            }));
                        }
                        
                        // Third pass: Distribute remaining CD to eligible purchases
                        let totalAllocated = Object.values(recalculatedCd).reduce((sum, cd) => sum + cd, 0);
                        let remainingCdAfterFirstPass = cdToDistribute - totalAllocated;
                        
                        console.log('Finalize - Remaining CD after first pass:', remainingCdAfterFirstPass);
                        
                        if (remainingCdAfterFirstPass > 0.01) {
                            // Distribute remaining CD to purchases that can accept it
                            const eligibleForRemaining = sortedEligible.filter(pf => {
                                const originalOutstanding = getOriginalOutstanding(pf.srNo);
                                const currentCd = recalculatedCd[pf.srNo] || 0;
                                const currentPaidAmount = paidAmountAdjustments[pf.srNo] || pf.amount;
                                const outstandingAfter = originalOutstanding - currentPaidAmount - currentCd;
                                return outstandingAfter > 0.01; // Can accept more CD
                            });
                            
                            // Calculate total paid amount for eligible purchases (use adjusted amounts)
                            const totalPaidForRemaining = eligibleForRemaining.reduce((sum, pf) => 
                                sum + (paidAmountAdjustments[pf.srNo] || pf.amount), 0);
                            
                            if (totalPaidForRemaining > 0) {
                                for (const paidFor of eligibleForRemaining) {
                                    if (remainingCdAfterFirstPass <= 0.01) break;
                                    
                                    const originalOutstanding = getOriginalOutstanding(paidFor.srNo);
                                    const currentCd = recalculatedCd[paidFor.srNo] || 0;
                                    const currentPaidAmount = paidAmountAdjustments[paidFor.srNo] || paidFor.amount;
                                    const maxAdditionalCd = originalOutstanding - currentPaidAmount - currentCd;
                                    
                                    if (maxAdditionalCd > 0.01) {
                                        const proportion = (paidAmountAdjustments[paidFor.srNo] || paidFor.amount) / totalPaidForRemaining;
                                        const additionalCd = Math.min(
                                            Math.round(remainingCdAfterFirstPass * proportion * 100) / 100,
                                            maxAdditionalCd
                                        );
                                        
                                        recalculatedCd[paidFor.srNo] = Math.round((currentCd + additionalCd) * 100) / 100;
                                        remainingCdAfterFirstPass -= additionalCd;
                                        
                                        console.log(`Finalize - Additional CD to ${paidFor.srNo}:`, {
                                            currentCd,
                                            additionalCd,
                                            newCd: recalculatedCd[paidFor.srNo],
                                            maxAdditionalCd
                                        });
                                    }
                                }
                            }
                        }
                        
                        totalRecalculated = Object.values(recalculatedCd).reduce((sum, cd) => sum + cd, 0);
                        
                        // ============================================================
                        // CRITICAL: Redistribute reduced paid amounts to other purchases
                        // ============================================================
                        // If one purchase's paid amount was reduced, distribute that amount to other purchases
                        let totalReducedAmount = 0;
                        const reductions: { [srNo: string]: number } = {};
                        
                        // Calculate total reduction
                        for (const paidFor of sortedEligible) {
                            const originalPaidAmount = paidFor.amount;
                            const adjustedPaidAmount = paidAmountAdjustments[paidFor.srNo] || originalPaidAmount;
                            const reduction = originalPaidAmount - adjustedPaidAmount;
                            
                            if (reduction > 0.01) {
                                reductions[paidFor.srNo] = reduction;
                                totalReducedAmount += reduction;
                                
                                console.log(`Finalize - Reduction for ${paidFor.srNo}:`, {
                                    originalPaidAmount,
                                    adjustedPaidAmount,
                                    reduction
                                });
                            }
                        }
                        
                        console.log('Finalize - Total reduced amount to redistribute:', totalReducedAmount);
                        
                        // Redistribute reduced amount to other purchases (those that didn't have reduction)
                        if (totalReducedAmount > 0.01) {
                            // Get purchases that can accept more paid amount (won't go negative)
                            const eligibleForRedistribution = sortedEligible.filter(pf => {
                                // Skip purchases that had reduction
                                if (reductions[pf.srNo] && reductions[pf.srNo] > 0) {
                                    return false;
                                }
                                
                                const originalOutstanding = getOriginalOutstanding(pf.srNo);
                                const currentPaidAmount = paidAmountAdjustments[pf.srNo] || pf.amount;
                                const currentCd = recalculatedCd[pf.srNo] || 0;
                                const outstandingAfter = originalOutstanding - currentPaidAmount - currentCd;
                                
                                // Can accept more paid amount if outstanding > 0
                                return outstandingAfter > 0.01;
                            });
                            
                            console.log('Finalize - Eligible for redistribution:', eligibleForRedistribution.length);
                            
                            if (eligibleForRedistribution.length > 0) {
                                // Calculate total outstanding for eligible purchases (for proportional distribution)
                                const totalOutstandingForEligible = eligibleForRedistribution.reduce((sum, pf) => {
                                    const originalOutstanding = getOriginalOutstanding(pf.srNo);
                                    const currentPaidAmount = paidAmountAdjustments[pf.srNo] || pf.amount;
                                    const currentCd = recalculatedCd[pf.srNo] || 0;
                                    return sum + Math.max(0, originalOutstanding - currentPaidAmount - currentCd);
                                }, 0);
                                
                                let remainingToRedistribute = totalReducedAmount;
                                
                                // Distribute proportionally based on outstanding capacity
                                for (const paidFor of eligibleForRedistribution) {
                                    if (remainingToRedistribute <= 0.01) break;
                                    
                                    const originalOutstanding = getOriginalOutstanding(paidFor.srNo);
                                    const currentPaidAmount = paidAmountAdjustments[paidFor.srNo] || paidFor.amount;
                                    const currentCd = recalculatedCd[paidFor.srNo] || 0;
                                    const outstandingCapacity = Math.max(0, originalOutstanding - currentPaidAmount - currentCd);
                                    
                                    if (outstandingCapacity > 0.01 && totalOutstandingForEligible > 0) {
                                        const proportion = outstandingCapacity / totalOutstandingForEligible;
                                        const additionalPaid = Math.min(
                                            Math.round(remainingToRedistribute * proportion * 100) / 100,
                                            outstandingCapacity
                                        );
                                        
                                        const newPaidAmount = (paidAmountAdjustments[paidFor.srNo] || paidFor.amount) + additionalPaid;
                                        paidAmountAdjustments[paidFor.srNo] = newPaidAmount;
                                        remainingToRedistribute -= additionalPaid;
                                        
                                        console.log(`Finalize - Redistributed to ${paidFor.srNo}:`, {
                                            oldPaidAmount: paidFor.amount,
                                            additionalPaid,
                                            newPaidAmount,
                                            outstandingCapacity,
                                            newOutstanding: originalOutstanding - newPaidAmount - currentCd
                                        });
                                    }
                                }
                                
                                // If still remaining, distribute to purchases with highest outstanding capacity
                                if (remainingToRedistribute > 0.01) {
                                    const sortedByCapacity = [...eligibleForRedistribution].sort((a, b) => {
                                        const capacityA = Math.max(0, getOriginalOutstanding(a.srNo) - (paidAmountAdjustments[a.srNo] || a.amount) - (recalculatedCd[a.srNo] || 0));
                                        const capacityB = Math.max(0, getOriginalOutstanding(b.srNo) - (paidAmountAdjustments[b.srNo] || b.amount) - (recalculatedCd[b.srNo] || 0));
                                        return capacityB - capacityA; // Highest capacity first
                                    });
                                    
                                    for (const paidFor of sortedByCapacity) {
                                        if (remainingToRedistribute <= 0.01) break;
                                        
                                        const originalOutstanding = getOriginalOutstanding(paidFor.srNo);
                                        const currentPaidAmount = paidAmountAdjustments[paidFor.srNo] || paidFor.amount;
                                        const currentCd = recalculatedCd[paidFor.srNo] || 0;
                                        const outstandingCapacity = Math.max(0, originalOutstanding - currentPaidAmount - currentCd);
                                        
                                        if (outstandingCapacity > 0.01) {
                                            const additionalPaid = Math.min(
                                                Math.round(remainingToRedistribute * 100) / 100,
                                                outstandingCapacity
                                            );
                                            
                                            const newPaidAmount = currentPaidAmount + additionalPaid;
                                            paidAmountAdjustments[paidFor.srNo] = newPaidAmount;
                                            remainingToRedistribute -= additionalPaid;
                                            
                                            console.log(`Finalize - Final redistribution to ${paidFor.srNo}:`, {
                                                additionalPaid,
                                                newPaidAmount
                                            });
                                        }
                                    }
                                }
                                
                                console.log('Finalize - Redistribution complete. Remaining:', remainingToRedistribute);
                            }
                        }
                        
                        // ============================================================
                        // CRITICAL: Update paid amounts and CD in paidForDetails
                        // ============================================================
                        // Apply paid amount adjustments and CD allocations
                        let updatedCount = 0;
                        for (const paidFor of paidForDetails) {
                            // Update paid amount if adjusted
                            if (paidAmountAdjustments[paidFor.srNo] !== undefined) {
                                const oldPaidAmount = paidFor.amount;
                                paidFor.amount = Math.round(paidAmountAdjustments[paidFor.srNo] * 100) / 100;
                                
                                console.log(`Finalize - Updated paid amount for ${paidFor.srNo}:`, {
                                    oldPaidAmount,
                                    newPaidAmount: paidFor.amount,
                                    reduction: oldPaidAmount - paidFor.amount
                                });
                            }
                            
                            // Update CD amount
                            if (recalculatedCd[paidFor.srNo] !== undefined) {
                                const oldCd = paidFor.cdAmount || 0;
                                paidFor.cdAmount = Math.round(recalculatedCd[paidFor.srNo] * 100) / 100;
                                updatedCount++;
                                
                                console.log(`Finalize - Updated CD for ${paidFor.srNo}:`, {
                                    oldCd,
                                    newCd: paidFor.cdAmount
                                });
                            }
                        }
                        
                        console.log('Finalize - Updated entries:', updatedCount);
                        console.log('Finalize - Paid amount adjustments:', paidAmountAdjustments);
                        console.log('Finalize - Final CD distribution:', recalculatedCd);
                        
                        // ============================================================
                        // CRITICAL: Final verification - no outstanding should be negative
                        // ============================================================
                        // Verify all purchases have non-negative outstanding
                        // Outstanding = Original Outstanding - Paid Amount - CD Amount
                        for (const paidFor of paidForDetails) {
                            const originalOutstanding = getOriginalOutstanding(paidFor.srNo);
                            const finalPaidAmount = paidFor.amount; // Already adjusted if needed
                            const finalCd = paidFor.cdAmount || 0;
                            
                            // Calculate outstanding after payment and CD
                            const outstandingAfter = originalOutstanding - finalPaidAmount - finalCd;
                            
                            // Verify outstanding is non-negative
                            if (outstandingAfter < -0.01) {
                                console.error(`Finalize - ERROR: ${paidFor.srNo} still has negative outstanding!`, {
                                    originalOutstanding,
                                    finalPaidAmount,
                                    cdAmount: finalCd,
                                    outstandingAfter
                                });
                                // Last resort: Reduce paid amount to make outstanding = 0
                                const maxAllowedPaid = originalOutstanding - finalCd;
                                paidFor.amount = Math.max(0, maxAllowedPaid);
                                console.warn(`Finalize - Emergency: Reduced paid amount for ${paidFor.srNo} to ${paidFor.amount}`);
                            } else {
                                console.log(`Finalize - Verified ${paidFor.srNo}:`, {
                                    originalOutstanding,
                                    finalPaidAmount,
                                    cdAmount: finalCd,
                                    outstandingAfter,
                                    status: outstandingAfter >= 0 ? 'OK' : 'NEGATIVE!'
                                });
                            }
                            
                            // Final rounding
                            paidFor.amount = Math.round(paidFor.amount * 100) / 100;
                            paidFor.cdAmount = Math.round((paidFor.cdAmount || 0) * 100) / 100;
                        }
                        
                        // Final CD summary
                        const finalTotalCd = paidForDetails.reduce((sum, pf) => sum + (pf.cdAmount || 0), 0);
                        const cdDiff = cdToDistribute - finalTotalCd;
                        console.log('Finalize - Final CD Summary:', {
                            expectedCd: cdToDistribute,
                            actualCd: finalTotalCd,
                            diff: cdDiff,
                            note: 'CD distributed to eligible purchases, skipped ones that would go negative'
                        });
                    } else {
                        console.warn('Finalize - No eligible entries with payment amount > 0');
                    }
                } else {
                    console.warn('Finalize - Total paid amount is 0, cannot recalculate CD');
                }
            } else {
                console.log('Finalize Step: Skipped (not partial_on_paid mode or no CD to distribute)');
            }
            
            // ============================================================
            // STEP 6: Final Verification - Ensure CD is properly distributed
            // ============================================================
            // Make sure all CD allocations are reflected in paidForDetails
            // This handles cases where CD was allocated but not included in paidForDetails
            if (cdToDistribute > 0) {
                // Check if any entry has CD allocated but not in paidForDetails
                for (const { entry } of entryOutstandings) {
                    const allocatedCd = cdAllocations[entry.srNo] || 0;
                    if (allocatedCd > 0) {
                        const existingPaidFor = paidForDetails.find(pf => pf.srNo === entry.srNo);
                        if (existingPaidFor) {
                            // Update CD if it's missing or different
                            if (!existingPaidFor.cdAmount || existingPaidFor.cdAmount === 0) {
                                existingPaidFor.cdAmount = allocatedCd;
                                console.log(`STEP 6 - Added missing CD to ${entry.srNo}:`, allocatedCd);
                            }
                        } else {
                            // Entry not in paidForDetails, add it with CD only
                            paidForDetails.push({
                                srNo: entry.srNo,
                                amount: 0, // No payment, only CD
                                cdAmount: allocatedCd
                            });
                            console.log(`STEP 6 - Added entry ${entry.srNo} with CD only:`, allocatedCd);
                        }
                    }
                }
            }
            
            // ============================================================
            // STEP 7: Final Verification - Ensure no negative outstanding
            // ============================================================
            // Verify and adjust to prevent overpayment
            // Use original outstanding (before CD was applied) for calculation
            for (const paidFor of paidForDetails) {
                const eo = entryOutstandings.find(e => e.entry.srNo === paidFor.srNo);
                if (eo) {
                    // Get original outstanding before CD was applied
                    // Use stored originalOutstanding if available, otherwise calculate
                    const originalOutstanding = eo.originalOutstanding || (eo.outstanding + (cdAllocations[paidFor.srNo] || 0));
                    const paidAmount = paidFor.amount;
                    const cdAmount = paidFor.cdAmount || 0;
                    
                    // Calculate outstanding after payment and CD
                    const outstandingAfter = originalOutstanding - paidAmount - cdAmount;
                    
                    console.log(`STEP 7 - Checking ${paidFor.srNo}:`, {
                        originalOutstanding,
                        currentOutstanding: eo.outstanding,
                        cdAllocated: cdAllocations[paidFor.srNo] || 0,
                        paidAmount,
                        cdAmount,
                        settleAmount: paidAmount + cdAmount,
                        outstandingAfter,
                        capacity: originalOutstanding - cdAmount, // Maximum we can pay
                        wouldGoNegative: outstandingAfter < -0.01,
                        status: outstandingAfter < -0.01 ? 'NEGATIVE - NEEDS ADJUSTMENT' : outstandingAfter > 0.01 ? 'OUTSTANDING' : 'SETTLED'
                    });
                    
                    // If outstanding becomes negative, adjust CD (not payment amount)
                    if (outstandingAfter < -0.01) {
                        const excess = Math.abs(outstandingAfter);
                        const oldCd = cdAmount;
                        const newCd = Math.max(0, oldCd - excess);
                        paidFor.cdAmount = newCd;
                        
                        console.warn(`STEP 7 - WARNING: ${paidFor.srNo} would go negative! Adjusting CD:`, {
                            originalOutstanding,
                            paidAmount,
                            oldCd,
                            newCd,
                            excess,
                            outstandingAfterBeforeAdjustment: outstandingAfter,
                            outstandingAfterAfterAdjustment: originalOutstanding - paidAmount - newCd
                        });
                    }
                    
                    // Final rounding
                    paidFor.amount = Math.round(paidFor.amount * 100) / 100;
                    paidFor.cdAmount = Math.round((paidFor.cdAmount || 0) * 100) / 100;
                } else {
                    console.warn(`STEP 7 - WARNING: Could not find entry for ${paidFor.srNo} in entryOutstandings`);
                }
            }
            
            // Final summary of all purchases
            const finalSummary = paidForDetails.map(pf => {
                const eo = entryOutstandings.find(e => e.entry.srNo === pf.srNo);
                if (eo) {
                    const originalOutstanding = eo.originalOutstanding || (eo.outstanding + (cdAllocations[pf.srNo] || 0));
                    const outstandingAfter = originalOutstanding - pf.amount - (pf.cdAmount || 0);
                    
                    return {
                        srNo: pf.srNo,
                        originalOutstanding: Math.round(originalOutstanding * 100) / 100,
                        paidAmount: Math.round(pf.amount * 100) / 100,
                        cdAmount: Math.round((pf.cdAmount || 0) * 100) / 100,
                        settleAmount: Math.round((pf.amount + (pf.cdAmount || 0)) * 100) / 100,
                        outstandingAfter: Math.round(outstandingAfter * 100) / 100,
                        capacity: Math.round((originalOutstanding - (pf.cdAmount || 0)) * 100) / 100,
                        status: outstandingAfter < -0.01 ? 'NEGATIVE!' : outstandingAfter > 0.01 ? 'OUTSTANDING' : 'SETTLED',
                        formula: `Original (${Math.round(originalOutstanding * 100) / 100}) - Paid (${Math.round(pf.amount * 100) / 100}) - CD (${Math.round((pf.cdAmount || 0) * 100) / 100}) = Outstanding (${Math.round(outstandingAfter * 100) / 100})`
                    };
                }
                return { srNo: pf.srNo, error: 'Entry not found' };
            });
            
            console.log('STEP 7 - Final Summary of All Purchases:', finalSummary);
            
            // Check for any negative outstanding
            const negativePurchases = finalSummary.filter(p => p.status === 'NEGATIVE!');
            if (negativePurchases.length > 0) {
                console.error('STEP 7 - ERROR: Found purchases with negative outstanding:', negativePurchases);
            } else {
                console.log('STEP 7 - SUCCESS: All purchases have non-negative outstanding!');
            }
            
            // Show outstanding purchases
            const outstandingPurchases = finalSummary.filter(p => p.status === 'OUTSTANDING');
            if (outstandingPurchases.length > 0) {
                console.log('STEP 7 - Purchases with remaining outstanding:', outstandingPurchases.map(p => ({
                    srNo: p.srNo,
                    outstanding: p.outstandingAfter
                })));
            }
            
            // Final CD distribution verification
            const finalTotalCd = paidForDetails.reduce((sum, pf) => sum + (pf.cdAmount || 0), 0);
            console.log('STEP 7 - Final CD Verification:', {
                expectedCd: cdToDistribute,
                actualCd: finalTotalCd,
                diff: cdToDistribute - finalTotalCd,
                paidForDetails: paidForDetails.map(pf => ({
                    srNo: pf.srNo,
                    amount: pf.amount,
                    cdAmount: pf.cdAmount
                }))
            });
            
            // ============================================================
            // STEP 8: Calculate Final Outstanding (for table update)
            // ============================================================
            // Outstanding will be updated in the database:
            // New Outstanding = Current Outstanding - Paid Amount - CD Amount
            // This calculation happens when payment is saved to database
            
            // ============================================================
            // Payment distribution complete!
            // Summary:
            // - CD distributed to eligible purchases (those without previous CD)
            // - Paid amount distributed sequentially (least outstanding first)
            // - Settle Amount = Paid Amount + CD Amount
            // - Outstanding will be updated in database: New Outstanding = Old Outstanding - Paid - CD
            // ============================================================
        }
        // If still empty (e.g., partial edit without changing selection), fallback to previous mapping
        if (rtgsFor === 'Supplier' && paidForDetails.length === 0 && editingPayment?.paidFor?.length) {
            paidForDetails = editingPayment.paidFor.map((pf: any) => ({ srNo: pf.srNo, amount: pf.amount } as any));
        }
        
        // For RTGS, paymentId should be rtgsSrNo
        const finalPaymentId = paymentMethod === 'RTGS' ? rtgsSrNo : paymentId;
        
        const paymentDataBase: Omit<Payment, 'id'> = {
            paymentId: finalPaymentId, customerId: rtgsFor === 'Supplier' ? selectedCustomerKey || '' : 'OUTSIDER',
            date: paymentDate ? format(paymentDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            // amount = "To Be Paid" amount (actual payment, WITHOUT CD)
            // cdAmount = CD amount (separate field)
            amount: Math.round(finalAmountToPay), cdAmount: Math.round(calculatedCdAmount),
            cdApplied: cdEnabled, type: paymentType, receiptType: paymentMethod,
            notes: `UTR: ${utrNo || ''}, Check: ${checkNo || ''}`,
            paidFor: paidForDetails,
            sixRDate: sixRDate ? format(sixRDate, 'yyyy-MM-dd') : '',
            parchiNo: parchiNo,
            utrNo, checkNo,
            quantity: rtgsQuantity, rate: rtgsRate, rtgsAmount,
            supplierName: toTitleCase(supplierDetails.name),
            supplierFatherName: toTitleCase(supplierDetails.fatherName),
            supplierAddress: toTitleCase(supplierDetails.address),
            bankName: bankDetails.bank, bankBranch: bankDetails.branch, bankAcNo: bankDetails.acNo, bankIfsc: bankDetails.ifscCode,
            rtgsFor,
        };
        if (paymentMethod === 'RTGS') paymentDataBase.rtgsSrNo = rtgsSrNo;
        else delete (paymentDataBase as Partial<Payment>).rtgsSrNo;
        if (paymentMethod !== 'Cash') paymentDataBase.bankAccountId = accountIdForPayment;

        const paymentIdToUse = editingPayment ? editingPayment.id : (paymentMethod === 'RTGS' ? rtgsSrNo : paymentId);
        const newPaymentRef = doc(firestoreDB, "payments", paymentIdToUse);
        const now = Timestamp.now();
        transaction.set(newPaymentRef, { ...paymentDataBase, id: newPaymentRef.id, updatedAt: now });
        finalPaymentData = { id: newPaymentRef.id, ...paymentDataBase, updatedAt: now } as Payment;
        
    });
    } catch (err: any) {
        // Quota/offline fallback: write locally and enqueue sync
        const { isQuotaError, markFirestoreDisabled } = await import('./realtime-guard');
        if (isQuotaError(err)) {
            markFirestoreDisabled();
            // Rebuild payment data base (mirror above without transaction context)
            let paidForDetails: PaidFor[] = [];
            if (rtgsFor === 'Supplier' && incomingSelectedEntries && incomingSelectedEntries.length > 0) {
                paidForDetails = incomingSelectedEntries.map((e: Customer) => ({ srNo: e.srNo, amount: 0 } as any)); // amounts already embedded via distribution above; safe placeholder
            } else if (editingPayment?.paidFor?.length) {
                paidForDetails = editingPayment.paidFor.map((pf: any) => ({ srNo: pf.srNo, amount: pf.amount } as any));
            }
            const finalPaymentId = paymentMethod === 'RTGS' ? rtgsSrNo : paymentId;
            const paymentDataBase: Omit<Payment, 'id'> = {
                paymentId: finalPaymentId, customerId: rtgsFor === 'Supplier' ? selectedCustomerKey || '' : 'OUTSIDER',
                date: paymentDate ? format(paymentDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                amount: Math.round(finalAmountToPay), cdAmount: Math.round(calculatedCdAmount),
                cdApplied: cdEnabled, type: paymentType, receiptType: paymentMethod,
                notes: `UTR: ${utrNo || ''}, Check: ${checkNo || ''}`,
                paidFor: paidForDetails,
                sixRDate: sixRDate ? format(sixRDate, 'yyyy-MM-dd') : '',
                parchiNo: parchiNo,
                utrNo, checkNo,
                quantity: rtgsQuantity, rate: rtgsRate, rtgsAmount,
                supplierName: toTitleCase(supplierDetails.name),
                supplierFatherName: toTitleCase(supplierDetails.fatherName),
                supplierAddress: toTitleCase(supplierDetails.address),
                bankName: bankDetails.bank, bankBranch: bankDetails.branch, bankAcNo: bankDetails.acNo, bankIfsc: bankDetails.ifscCode,
                rtgsFor,
            };
            if (paymentMethod === 'RTGS') (paymentDataBase as any).rtgsSrNo = rtgsSrNo; else delete (paymentDataBase as any).rtgsSrNo;
            if (paymentMethod !== 'Cash') (paymentDataBase as any).bankAccountId = accountIdForPayment;
            const paymentIdToUse = editingPayment ? editingPayment.id : (paymentMethod === 'RTGS' ? rtgsSrNo : paymentId);
            const now = Timestamp.now();
            finalPaymentData = { id: paymentIdToUse, ...paymentDataBase, updatedAt: now } as Payment;
            try {
                if (db && finalPaymentData) {
                    if (editingPayment?.id) {
                        await db.payments.delete(editingPayment.id);
                    }
                    await db.payments.put(finalPaymentData);
                }
            } catch {}
            // enqueue sync
            try {
                const { enqueueSyncTask } = await import('./sync-queue');
                if (editingPayment?.id) {
                    await enqueueSyncTask('delete:payment', { id: editingPayment.id }, { attemptImmediate: true, dedupeKey: `payment:delete:${editingPayment.id}` });
                }
                await enqueueSyncTask('upsert:payment', finalPaymentData, { attemptImmediate: true, dedupeKey: `payment:${finalPaymentData.id}` });
            } catch {}
        } else {
            throw err;
        }
    }
    // Ensure local IndexedDB reflects the latest payment so UI updates instantly
    try {
        if (db && finalPaymentData) {
            await db.payments.put(finalPaymentData);
        }
    } catch {}
    if (!finalPaymentData) {
        return { success: false, message: "Failed to create payment" };
    }
    return { success: true, payment: finalPaymentData };
};


export const handleDeletePaymentLogic = async (paymentToDelete: Payment, allSuppliers: Customer[], transaction?: any) => {
    if (!paymentToDelete || !paymentToDelete.id) {
        throw new Error("Payment ID is missing for deletion.");
    }

    const performDelete = async (transOrBatch: any) => {
        const paymentDocRef = doc(firestoreDB, "payments", paymentToDelete.id);
        const paymentDoc = await transOrBatch.get(paymentDocRef);
        
        if (!paymentDoc.exists()) {
             console.warn(`Payment ${paymentToDelete.id} not found during deletion attempt.`);
             return; // Silently fail if doc is already gone
        }

        transOrBatch.delete(paymentDocRef);
    };
    
    if (transaction) {
        await performDelete(transaction);
    } else {
        await runTransaction(firestoreDB, async (t) => {
            await performDelete(t);
        });
    }

    if (db) {
        await db.payments.delete(paymentToDelete.id);
    }
};


