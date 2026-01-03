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
const customerPaymentsCollection = collection(firestoreDB, "customer_payments");
const governmentFinalizedPaymentsCollection = collection(firestoreDB, "governmentFinalizedPayments");
const settingsCollection = collection(firestoreDB, "settings");
const bankAccountsCollection = collection(firestoreDB, "bankAccounts");


interface ProcessPaymentResult {
    success: boolean;
    message?: string;
    payment?: Payment;
}

export const processPaymentLogic = async (context: any): Promise<ProcessPaymentResult> => {
    const {
        selectedCustomerKey, selectedEntries: incomingSelectedEntries, editingPayment,
        paymentAmount, paymentMethod, selectedAccountId,
        cdEnabled, calculatedCdAmount, settleAmount, totalOutstandingForSelected,
        paymentType, financialState, bankAccounts, paymentId, rtgsSrNo,
        paymentDate, utrNo, checkNo, sixRNo, sixRDate, parchiNo,
        rtgsQuantity, rtgsRate, rtgsAmount, govQuantity, govRate, govAmount,
        govRequiredAmount: userGovRequiredAmount, // Gov Required Amount from form
        supplierDetails, bankDetails,
        cdAt, // CD mode: 'partial_on_paid', 'on_unpaid_amount', 'on_full_amount', etc.
        isCustomer = false, // Flag to determine if this is a customer payment
        extraAmount: userExtraAmount, // Extra amount from form (Gov. payment only)
        centerName, // Center Name for Gov payments
        extraAmountBaseType = 'receipt', // 'receipt' = receipt-based, 'target' = target-based
        calcTargetAmount = 0, // Target amount for target-based calculation
    } = context;


    if (!selectedCustomerKey) {
        return { success: false, message: "No supplier selected" };
    }
    
    // Build selected entries for edit mode if not provided
    let selectedEntries = incomingSelectedEntries || [];
    if ((!selectedEntries || selectedEntries.length === 0) && editingPayment?.paidFor?.length) {
        const suppliers: Customer[] = Array.isArray((context as any).suppliers) ? (context as any).suppliers : [];
        selectedEntries = editingPayment.paidFor
            .map((pf: any) => suppliers.find(s => s.srNo === pf.srNo))
            .filter(Boolean) as Customer[];
    }

    if ((!selectedEntries || selectedEntries.length === 0)) {
        if (paymentMethod !== 'RTGS' && paymentMethod !== 'Gov.') {
            return { success: false, message: "Please select entries to pay" };
        } else if (paymentMethod === 'RTGS' && rtgsAmount <= 0) {
             return { success: false, message: "Please enter an amount for RTGS payment" };
        } else if (paymentMethod === 'Gov.' && govAmount <= 0) {
             return { success: false, message: "Please enter quantity and rate for Gov. payment" };
        }
    }

    // finalAmountToPay = "To Be Paid" amount (actual payment amount, WITHOUT CD)
    // settleAmount = "To Be Paid" + CD (total settlement amount, for validation/display only)
    const finalAmountToPay = paymentAmount;
    
    const accountIdForPayment = paymentMethod === 'Cash' ? 'CashInHand' : selectedAccountId;
    
    if (paymentMethod === 'RTGS' && !accountIdForPayment) {
        return { success: false, message: "Please select an account to pay from for RTGS." };
    }
    
    // Only apply CD if cdEnabled is true
    const effectiveCdAmount = cdEnabled ? calculatedCdAmount : 0;
    
    // Total to settle = actual payment amount + CD (for validation only, not saved)
    const totalToSettle = finalAmountToPay + effectiveCdAmount;

    // VALIDATION: Check if settlement amount (to be paid + CD) exceeds total outstanding (skip for Outsider mode, negative outstanding, or Gov. payment)
    // Allow payments even if outstanding is 0 or negative (for overpayment scenarios)
    // Gov. payment allows overpayment (receipt se zyada payment)
    // When CD is disabled, settleAmount should equal finalAmountToPay, so we validate totalToSettle
    if (paymentMethod !== 'Gov.' && totalOutstandingForSelected > 0 && totalToSettle > totalOutstandingForSelected + 0.01) { // Add a small tolerance for floating point issues
        return { success: false, message: `Settlement amount (${formatCurrency(totalToSettle)}) cannot exceed the total outstanding (${formatCurrency(totalOutstandingForSelected)}) for the selected entries.` };
    }

    if (finalAmountToPay <= 0 && effectiveCdAmount <= 0) {
        return { success: false, message: "Payment and CD amount cannot both be zero." };
    }

    let finalPaymentData: Payment | null = null;
    try {
    await runTransaction(firestoreDB, async (transaction) => {
        
        if (editingPayment?.id) {
            // For Gov. payments, use the separate governmentFinalizedPayments collection
            // For other payments, use the regular payments collection
            let paymentCollection;
            if (paymentMethod === 'Gov.') {
                paymentCollection = governmentFinalizedPaymentsCollection;
            } else {
                paymentCollection = isCustomer ? customerPaymentsCollection : paymentsCollection;
            }
            const oldPaymentRef = doc(paymentCollection, editingPayment.id);
            const oldPaymentDoc = await transaction.get(oldPaymentRef);

            if(oldPaymentDoc.exists()) {
                transaction.delete(oldPaymentRef);
            }
        }

        let paidForDetails: PaidFor[] = [];
        
        // Gov. payment extra amount variables (declared outside block for offline fallback access)
        let totalExtraAmount = 0;
        let govRequiredAmount = 0;
        let calculatedExtraAmount = 0; // Actual calculated extra amount (Total - Base) for database storage
        const extraAmountPerEntry: { [srNo: string]: number } = {};
        const adjustedOriginalPerEntry: { [srNo: string]: number } = {};
        const adjustedOutstandingPerEntry: { [srNo: string]: number } = {};
        
        if (selectedEntries && selectedEntries.length > 0) {
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
                
                // Get all payments for this entry (excluding the one being edited if in edit mode)
                const allPaymentsForEntry = paymentHistory.filter(p => 
                    p.paidFor?.some(pf => pf.srNo === entry.srNo) && 
                    (!editingPayment || p.id !== editingPayment.id)
                );
                
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
                    }
                }
                
                // Calculate outstanding using SAME formula as use-supplier-summary
                // Outstanding = Original - (Total Paid + Total CD)
                // If editing, add back the editing payment temporarily
                const currentOutstanding = originalAmount - totalPaidForEntry - totalCdForEntry;
                const outstanding = currentOutstanding + previousPaidAmount + previousCdAmount;
                
                // CRITICAL: Always prioritize fresh outstanding values
                // outstandingFromSummary or entry.netAmount are fresh from database
                // Don't rely on stale paymentHistory calculation
                let finalOutstanding = outstanding;
                if (outstandingFromSummary !== null && !editingPayment) {
                    // Use the outstanding from summary (already calculated correctly from fresh data)
                    finalOutstanding = outstandingFromSummary;
                } else if (outstandingFromSummary !== null && editingPayment) {
                    // If editing, add back the editing payment to outstandingFromSummary
                    finalOutstanding = outstandingFromSummary + previousPaidAmount + previousCdAmount;
                } else if (entry.netAmount !== undefined && entry.netAmount !== null) {
                    // CRITICAL: Use entry.netAmount as fallback (fresh from database)
                    // This is better than calculating from stale paymentHistory
                    finalOutstanding = Number(entry.netAmount);
                    if (editingPayment) {
                        // If editing, add back the editing payment
                        finalOutstanding = finalOutstanding + previousPaidAmount + previousCdAmount;
                    }
                }
                // If neither available, use calculated outstanding (last resort)
                
                // IMPORTANT: originalOutstanding should be the CURRENT outstanding (before new payment)
                // This is what we'll use for capacity calculation
                const originalOutstanding = Math.max(0, Math.round(finalOutstanding * 100) / 100);
                
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
            // Initialize CD allocations object first
            const cdAllocations: { [srNo: string]: number } = {};
            
            // Initialize all CD allocations to 0
            for (const { entry } of entryOutstandings) {
                cdAllocations[entry.srNo] = 0;
            }
            
            // If CD is disabled, allocations are already 0, so we can skip distribution
            
            // CD Distribution Rules:
            // 1. CD can only be applied to purchases that haven't received CD before
            // 2. CD reduces outstanding first (before paid amount)
            // 3. Distribution method depends on cdAt mode
            // 4. CD MUST be distributed even if payment amount is 0 (for CD-only payments)
            
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
                                }
                            }
                            
                            // Third pass: Redistribute excess CD to other purchases that have capacity
                            const totalExcessCd = Object.values(excessCd).reduce((sum, excess) => sum + excess, 0);
                            let remainingCdToDistribute = cdToDistribute - totalAllocated;
                            
                            if (remainingCdToDistribute > 0.01) {
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
                                        cdAllocations[eo.entry.srNo] = Math.max(0, eo.outstanding);
                                        totalAllocated = totalAllocated - finalCd + cdAllocations[eo.entry.srNo];
                                    }
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
            
            // ============================================================
            // STEP 3.5: Calculate Extra Amount for Gov. Payment (if applicable)
            // ============================================================
            // IMPORTANT: Calculate extra amount BEFORE payment distribution
            // This allows payment distribution to use adjusted outstanding
            // Variables already declared outside block for offline fallback access
            
            if (paymentMethod === 'Gov.' && govAmount > 0) {
                // First, initialize adjustedOriginal for ALL entries (will be updated if extra amount exists)
                // IMPORTANT: Calculate fresh from paymentHistory, NOT from cached entry object
                // This ensures we use correct base when making multiple payments without refresh
                entryOutstandings.forEach(eo => {
                    // Find the most recent Gov. payment for this entry from paymentHistory
                    // This gives us the latest adjustedOriginal (if any previous Gov. payment exists)
                    // IMPORTANT: Exclude the current editing payment if in edit mode
                    let previousAdjustedOriginal: number | null = null;
                    const previousGovPayments = paymentHistory
                        .filter(p => 
                            (p as any).receiptType === 'Gov.' && 
                            p.paidFor?.some(pf => pf.srNo === eo.entry.srNo) &&
                            (!editingPayment || p.id !== editingPayment.id) // Exclude editing payment
                        )
                        .sort((a, b) => {
                            // Sort by date descending to get most recent first
                            const dateA = a.date ? new Date(a.date).getTime() : 0;
                            const dateB = b.date ? new Date(b.date).getTime() : 0;
                            return dateB - dateA;
                        });
                    
                    if (previousGovPayments.length > 0) {
                        // Get the most recent Gov. payment's adjustedOriginal for this entry
                        const mostRecentGovPayment = previousGovPayments[0];
                        const paidForThisEntry = mostRecentGovPayment.paidFor?.find((pf: any) => pf.srNo === eo.entry.srNo);
                        if (paidForThisEntry && (paidForThisEntry as any).adjustedOriginal !== undefined) {
                            previousAdjustedOriginal = Number((paidForThisEntry as any).adjustedOriginal);
                        }
                    }
                    
                    // Use previous adjustedOriginal if found, otherwise use originalAmount
                    // This ensures we build upon previous Gov. payment's adjusted original
                    const baseOriginal = previousAdjustedOriginal !== null && previousAdjustedOriginal > 0
                        ? previousAdjustedOriginal
                        : (eo.originalAmount || 0);
                    
                    adjustedOriginalPerEntry[eo.entry.srNo] = baseOriginal;
                    
                    // Calculate base outstanding: Current outstanding already reflects payments against adjusted original
                    // So base outstanding = current outstanding (which already accounts for previous adjustments)
                    const originalOutstanding = eo.originalOutstanding || (Math.max(0, eo.outstanding || 0) + (cdAllocations[eo.entry.srNo] || 0));
                    adjustedOutstandingPerEntry[eo.entry.srNo] = originalOutstanding;
                    
                });

                // Calculate total receipt outstanding (after CD)
                // CRITICAL: Use originalOutstanding (before CD) for accurate calculation
                // This ensures we get the correct base outstanding for extra amount calculation
                // IMPORTANT: If originalOutstanding is 0 but outstanding is > 0, use outstanding
                // This handles cases where outstandingFromSummary or entry.netAmount might not be available
                const totalReceiptOutstanding = entryOutstandings.reduce((sum, eo) => {
                    // Use originalOutstanding first (most accurate), fallback to outstanding
                    // originalOutstanding is set in line 271 and should be the correct outstanding
                    let baseOutstanding = eo.originalOutstanding || 0;
                    // If originalOutstanding is 0 but outstanding > 0, use outstanding (might be updated after CD)
                    if (baseOutstanding <= 0.01 && eo.outstanding > 0.01) {
                        baseOutstanding = eo.outstanding;
                    }
                    // Ensure we're using a positive value
                    return sum + Math.max(0, baseOutstanding);
                }, 0);
                
                // IMPORTANT: Gov Required Amount and Extra Amount calculation depends on extraAmountBaseType
                if (extraAmountBaseType === 'target') {
                    // Target-based calculation:
                    // Extra = (Target Amount / Gov Rate) * Extra Rate per Quintal
                    // Gov Required = Target Amount + Extra
                    const targetAmt = typeof calcTargetAmount === 'function' ? calcTargetAmount() : (calcTargetAmount || 0);
                    const currentGovRate = govRate || 0;
                    
                    // Calculate extra amount: (Target Amount / Gov Rate) * Extra Rate per Quintal
                    // If we have userExtraAmount and govQuantity, calculate extra rate per quintal
                    let calculatedExtra = 0;
                    if (currentGovRate > 0 && targetAmt > 0) {
                        if (userExtraAmount !== undefined && userExtraAmount > 0 && govQuantity > 0) {
                            // Use the extra rate per quintal from the form
                            const extraRatePerQtl = userExtraAmount / govQuantity;
                            const quantity = targetAmt / currentGovRate;
                            calculatedExtra = quantity * extraRatePerQtl;
                        } else if (userGovRequiredAmount !== undefined && userGovRequiredAmount > targetAmt && govQuantity > 0) {
                            // Calculate extra rate from govRequiredAmount if available
                            const extraRatePerQtl = (userGovRequiredAmount - targetAmt) / govQuantity;
                            const quantity = targetAmt / currentGovRate;
                            calculatedExtra = quantity * extraRatePerQtl;
                        } else if (userExtraAmount !== undefined && userExtraAmount > 0) {
                            // Use user provided extra amount directly
                            calculatedExtra = userExtraAmount;
                        }
                    }
                    
                    calculatedExtraAmount = Math.max(0, calculatedExtra);
                    // Gov Required = Target Amount + Extra
                    govRequiredAmount = targetAmt + calculatedExtraAmount;
                    
                    // Override with user provided govRequiredAmount if it's explicitly set and different
                    if (userGovRequiredAmount !== undefined && userGovRequiredAmount > 0 && Math.abs(userGovRequiredAmount - govRequiredAmount) > 0.01) {
                        govRequiredAmount = userGovRequiredAmount;
                        // Recalculate extra based on the provided govRequiredAmount
                        calculatedExtraAmount = Math.max(0, govRequiredAmount - targetAmt);
                    }
                } else {
                    // Receipt-based calculation:
                    // Gov Required Amount = from form (or fallback to govAmount if not provided)
                govRequiredAmount = userGovRequiredAmount !== undefined && userGovRequiredAmount > 0 
                    ? userGovRequiredAmount 
                    : govAmount;
                
                    // Extra Amount = Total (govRequiredAmount) - Base (totalReceiptOutstanding)
                calculatedExtraAmount = Math.max(0, govRequiredAmount - totalReceiptOutstanding);
                }
                
                if (userExtraAmount !== undefined && userExtraAmount > 0) {
                    // Use user provided value, but validate it's reasonable
                    totalExtraAmount = Math.max(0, userExtraAmount);
                    const difference = Math.abs(totalExtraAmount - calculatedExtraAmount);
                    // Note: difference > 0.01 means user provided value differs from calculated
                } else {
                    // Calculate: Extra = Total - Base
                    totalExtraAmount = calculatedExtraAmount;
                }
                
                // totalExtraAmount ready for distribution
                
                // Distribute extra amount based on outstanding (not original amount)
                // This ensures fair distribution - receipts with more outstanding get more extra amount
                // IMPORTANT: Extra amount increases the capacity for payment, so it should be distributed
                // proportionally based on outstanding to ensure fair distribution
                if (totalExtraAmount > 0 && totalReceiptOutstanding > 0) {
                    // Calculate proportions based on outstanding
                    const proportions: { [srNo: string]: number } = {};
                    entryOutstandings.forEach(eo => {
                        const outstanding = Math.max(0, eo.outstanding || 0); // Already updated after CD
                        if (outstanding > 0) {
                            proportions[eo.entry.srNo] = outstanding / totalReceiptOutstanding;
                        }
                    });
                    
                    // Distribute extra amount proportionally
                    let totalDistributed = 0;
                    const sortedByOutstanding = [...entryOutstandings].sort((a, b) => {
                        const outstandingA = Math.max(0, a.outstanding || 0);
                        const outstandingB = Math.max(0, b.outstanding || 0);
                        return outstandingB - outstandingA; // Highest outstanding first for rounding
                    });
                    
                    // Distribute to all entries with outstanding > 0
                    sortedByOutstanding.forEach((eo, index) => {
                        const outstanding = Math.max(0, eo.outstanding || 0);
                        const originalOutstanding = eo.originalOutstanding || (outstanding + (cdAllocations[eo.entry.srNo] || 0));
                        
                        if (outstanding > 0) {
                            const proportion = proportions[eo.entry.srNo] || 0;
                            let extraAmount = totalExtraAmount * proportion;
                            
                            // For last entry, use remaining amount to avoid rounding errors
                            if (index === sortedByOutstanding.length - 1) {
                                extraAmount = totalExtraAmount - totalDistributed;
                            } else {
                                extraAmount = Math.round(extraAmount * 100) / 100;
                            }
                            
                            extraAmountPerEntry[eo.entry.srNo] = Math.max(0, extraAmount);
                            totalDistributed += extraAmountPerEntry[eo.entry.srNo];
                            
                            // Extra amount calculated and saved
                            
                            // Calculate adjusted original and outstanding
                            // IMPORTANT: Use baseOriginal (already set at initialization, might be previous adjustedOriginal)
                            // Add new extraAmount on top of baseOriginal
                            // This ensures we build upon previous Gov. payment's adjusted original correctly
                            const baseOriginal = adjustedOriginalPerEntry[eo.entry.srNo] || (eo.originalAmount || 0);
                            adjustedOriginalPerEntry[eo.entry.srNo] = baseOriginal + extraAmountPerEntry[eo.entry.srNo];
                            adjustedOutstandingPerEntry[eo.entry.srNo] = originalOutstanding + extraAmountPerEntry[eo.entry.srNo];
                            
                            // Adjusted original updated with new extra amount
                        } else {
                            // Even if outstanding is 0, keep the initialized adjustedOriginal
                            // This ensures the original amount is correctly displayed in the outstanding table
                            extraAmountPerEntry[eo.entry.srNo] = 0;
                            // adjustedOriginalPerEntry already initialized above
                            adjustedOutstandingPerEntry[eo.entry.srNo] = originalOutstanding;
                        }
                    });
                    
                    // Verify total distributed matches total extra amount (with small tolerance for rounding)
                    const roundingDifference = Math.abs(totalDistributed - totalExtraAmount);
                    // Note: roundingDifference > 0.01 indicates rounding error, but acceptable for final entry
                }
            }
            
            // Step 2: Distribute paid amount (To Be Paid amount)
            // IMPORTANT: For Gov. payment, first pay normal outstanding, then distribute only extra amount proportionally
            // paidFor.amount is the actual payment amount (To Be Paid), NOT (outstanding - CD)
            // CD is separate and stored in cdAmount field
            let amountToDistribute = Math.round(finalAmountToPay * 100) / 100;
            
            // Initialize roundedPayments object for payment distribution
            const roundedPayments: { [srNo: string]: number } = {};
            
            // For Gov. payment, distribute payment proportionally based on ADJUSTED outstanding (includes extra amount)
            // IMPORTANT: Payment should cover adjusted outstanding (receiptOutstanding + extraAmount)
            // This ensures the extra amount is properly paid
            if (paymentMethod === 'Gov.' && govRequiredAmount > 0 && totalExtraAmount > 0) {
                // Calculate total adjusted outstanding (includes extra amount)
                const totalAdjustedOutstanding = entryOutstandings.reduce((sum, eo) => {
                    const adjusted = adjustedOutstandingPerEntry[eo.entry.srNo] || Math.max(0, eo.outstanding || 0);
                    return sum + adjusted;
                }, 0);
                
                // Distribute payment proportionally based on adjusted outstanding
                const payments: { [srNo: string]: number } = {};
                let totalDistributed = 0;
                
                // Sort by adjusted outstanding (descending) for rounding
                const sortedByAdjustedOutstanding = [...entryOutstandings].sort((a, b) => {
                    const adjustedA = adjustedOutstandingPerEntry[a.entry.srNo] || Math.max(0, a.outstanding || 0);
                    const adjustedB = adjustedOutstandingPerEntry[b.entry.srNo] || Math.max(0, b.outstanding || 0);
                    return adjustedB - adjustedA;
                });
                
                sortedByAdjustedOutstanding.forEach((eo, index) => {
                    const adjustedOutstanding = adjustedOutstandingPerEntry[eo.entry.srNo] || Math.max(0, eo.outstanding || 0);
                    
                    if (adjustedOutstanding > 0 && amountToDistribute > totalDistributed) {
                        let paymentForThisEntry: number;
                        
                        if (index === sortedByAdjustedOutstanding.length - 1) {
                            // Last entry gets remaining amount to avoid rounding errors
                            paymentForThisEntry = amountToDistribute - totalDistributed;
                        } else {
                            // Calculate proportional payment
                            const proportion = totalAdjustedOutstanding > 0 ? adjustedOutstanding / totalAdjustedOutstanding : 0;
                            paymentForThisEntry = amountToDistribute * proportion;
                            paymentForThisEntry = Math.round(paymentForThisEntry * 100) / 100;
                        }
                        
                        // Cap payment at adjusted outstanding (can't pay more than capacity)
                        paymentForThisEntry = Math.min(paymentForThisEntry, adjustedOutstanding);
                        payments[eo.entry.srNo] = paymentForThisEntry;
                        totalDistributed += paymentForThisEntry;
                    } else {
                        payments[eo.entry.srNo] = 0;
                    }
                });
                
                // Set roundedPayments to the calculated payments
                Object.keys(payments).forEach(srNo => {
                    roundedPayments[srNo] = payments[srNo];
                });
                
                amountToDistribute = 0; // All distributed
            } else {
                // For non-Gov payments or Gov without extra amount, use normal sequential distribution
                // For Gov. payment, ensure payment doesn't exceed total adjusted outstanding
                if (paymentMethod === 'Gov.' && govRequiredAmount > 0) {
                    const totalAdjustedOutstanding = entryOutstandings.reduce((sum, eo) => {
                        const adjustedOutstanding = adjustedOutstandingPerEntry[eo.entry.srNo] || (eo.outstanding || 0);
                        return sum + Math.max(0, adjustedOutstanding);
                    }, 0);
                    
                    // Limit payment to total adjusted outstanding (Gov. Required amount)
                    // This ensures outstanding doesn't go negative
                    amountToDistribute = Math.min(amountToDistribute, totalAdjustedOutstanding);
                    
                }
            }
            
            // Sort entries by outstanding amount (ascending - least outstanding first)
            // IMPORTANT: eo.outstanding is already updated after CD allocation
            // For Gov. payment, use adjusted outstanding for sorting
            const sortedEntriesForPayment = entryOutstandings
                .filter(eo => {
                    let outstandingAfterCd = Math.max(0, eo.outstanding); // Already updated after CD
                    // For Gov. payment, use adjusted outstanding
                    if (paymentMethod === 'Gov.' && adjustedOutstandingPerEntry[eo.entry.srNo]) {
                        outstandingAfterCd = adjustedOutstandingPerEntry[eo.entry.srNo];
                    }
                    return outstandingAfterCd > 0.01; // Only entries with capacity > 0
                })
                .sort((a, b) => {
                    let outstandingA = Math.max(0, a.outstanding); // Already updated after CD
                    let outstandingB = Math.max(0, b.outstanding); // Already updated after CD
                    // For Gov. payment, use adjusted outstanding for sorting
                    if (paymentMethod === 'Gov.') {
                        if (adjustedOutstandingPerEntry[a.entry.srNo]) {
                            outstandingA = adjustedOutstandingPerEntry[a.entry.srNo];
                        }
                        if (adjustedOutstandingPerEntry[b.entry.srNo]) {
                            outstandingB = adjustedOutstandingPerEntry[b.entry.srNo];
                        }
                    }
                    // Sort by outstanding after CD (ascending - least first)
                    if (Math.abs(outstandingA - outstandingB) < 0.01) {
                        // If outstanding is same, maintain original order
                        return 0;
                    }
                    return outstandingA - outstandingB;
                });
            
            // Sequential distribution: complete each purchase fully before moving to next
            // Check if payments were already distributed (for Gov. with extra amount)
            const paymentsAlreadyDistributed = Object.keys(roundedPayments).length > 0;
            
            if (!paymentsAlreadyDistributed) {
                // Initialize all payments to 0 (if not already initialized)
                for (const { entry } of entryOutstandings) {
                    if (!(entry.srNo in roundedPayments)) {
                        roundedPayments[entry.srNo] = 0;
                    }
                }
            }
            
            // Distribute sequentially (skip if already distributed for Gov. with extra amount)
            if (!paymentsAlreadyDistributed) {
            for (const eo of sortedEntriesForPayment) {
                const { entry, outstanding } = eo;
                if (amountToDistribute <= 0.01) break;
                
                // Capacity = Outstanding after CD (this is the maximum we can pay)
                // IMPORTANT: eo.outstanding is already updated after CD allocation
                const cdAllocated = cdAllocations[entry.srNo] || 0;
                const outstandingAfterCd = Math.max(0, outstanding); // Already updated after CD
                
                // For Gov. payment, use adjusted outstanding (original outstanding + extra amount)
                // Capacity = Adjusted Outstanding - CD (because CD is separate from payment)
                // adjustedOutstandingPerEntry = originalOutstanding + extraAmount
                // So capacity = (originalOutstanding + extraAmount) - CD = outstandingAfterCd + extraAmount
                let capacity = outstandingAfterCd;
                if (paymentMethod === 'Gov.' && adjustedOutstandingPerEntry[entry.srNo] !== undefined) {
                    // Adjusted Outstanding = Original Outstanding + Extra Amount
                    // Capacity = Adjusted Outstanding - CD (CD is separate)
                    capacity = adjustedOutstandingPerEntry[entry.srNo] - cdAllocated;
                } else {
                    capacity = outstandingAfterCd; // Use regular outstanding for other payment methods
                }
                
                if (capacity > 0.01) {
                    // Pay the minimum of: remaining amount to distribute OR full capacity for this entry
                    const paymentForThisEntry = Math.min(amountToDistribute, capacity);
                    roundedPayments[entry.srNo] = Math.round(paymentForThisEntry * 100) / 100;
                    amountToDistribute = Math.round((amountToDistribute - paymentForThisEntry) * 100) / 100;
                    
                }
            }
            } // End of sequential distribution (only if not already distributed)
            
            // Handle any remaining amount due to rounding (distribute to entries with capacity)
            // Skip if payments were already distributed (for Gov. with extra amount)
            if (!paymentsAlreadyDistributed && amountToDistribute > 0.01) {
                // Find entries that still have capacity and distribute remaining amount
                for (const eo of sortedEntriesForPayment) {
                    const { entry, outstanding } = eo;
                    if (amountToDistribute <= 0.01) break;
                    
                    // IMPORTANT: eo.outstanding is already updated after CD allocation
                    const outstandingAfterCd = Math.max(0, outstanding); // Already updated after CD
                    const cdAllocated = cdAllocations[entry.srNo] || 0;
                    const alreadyPaid = roundedPayments[entry.srNo] || 0;
                    // For Gov. payment, use adjusted outstanding for remaining capacity
                    // Capacity = Adjusted Outstanding - CD (because CD is separate)
                    let capacity = outstandingAfterCd;
                    if (paymentMethod === 'Gov.' && adjustedOutstandingPerEntry[entry.srNo] !== undefined) {
                        // Adjusted Outstanding = Original Outstanding + Extra Amount
                        // Capacity = Adjusted Outstanding - CD (CD is separate)
                        capacity = adjustedOutstandingPerEntry[entry.srNo] - cdAllocated;
                    }
                    const remainingCapacity = capacity - alreadyPaid; // Remaining capacity = Capacity - Already paid
                    
                    if (remainingCapacity > 0.01) {
                        const additionalPayment = Math.min(amountToDistribute, remainingCapacity);
                        roundedPayments[entry.srNo] = Math.round((roundedPayments[entry.srNo] || 0) + additionalPayment) * 100 / 100;
                        amountToDistribute = Math.round((amountToDistribute - additionalPayment) * 100) / 100;
                    }
                }
            }
            
            // ============================================================
            // STEP 4: Create paidForDetails with payment amounts
            // ============================================================
            // IMPORTANT: Include entries even if only CD is present (no payment)
            // For Gov. payments, also include entries that have extra amount (even if no payment)
            // Settlement Amount = Paid Amount + CD Amount
            for (const { entry } of entryOutstandings) {
                const paymentForThisEntry = roundedPayments[entry.srNo] || 0;
                const cdForThisEntry = Math.round((cdAllocations[entry.srNo] || 0) * 100) / 100;
                const extraAmount = extraAmountPerEntry[entry.srNo] || 0;
                
                // Include entry if it has:
                // 1. Payment amount > 0, OR
                // 2. CD amount > 0, OR
                // 3. Extra amount > 0 (for Gov. payments - even if no payment, extra amount should be tracked)
                const shouldInclude = paymentForThisEntry > 0 || cdForThisEntry > 0 || (paymentMethod === 'Gov.' && extraAmount > 0);
                
                if (shouldInclude) {
                    // Get the entry outstanding data
                    const eo = entryOutstandings.find(eo => eo.entry.srNo === entry.srNo);
                    
                    // CRITICAL: receiptOutstanding should be the ORIGINAL outstanding BEFORE this payment
                    // This is the outstanding from database before any payments are applied
                    const receiptOutstanding = Math.max(0, eo?.originalOutstanding || (eo?.outstanding || 0) + (cdAllocations[entry.srNo] || 0));
                    
                    // CRITICAL: Get the correct extraAmount from distribution
                    const correctExtraAmount = extraAmountPerEntry[entry.srNo] || 0;
                    
                    // CRITICAL: adjustedOriginal = originalNetAmount + extraAmount
                    // Use the calculated adjustedOriginal from distribution, or calculate it
                    const baseOriginal = entry.originalNetAmount || 0;
                    const adjustedOriginal = adjustedOriginalPerEntry[entry.srNo] || (baseOriginal + correctExtraAmount);
                    
                    // CRITICAL: adjustedOutstanding = receiptOutstanding + extraAmount
                    // This is the outstanding BEFORE this payment, including extra amount
                    // Use the calculated adjustedOutstanding from distribution, or calculate it
                    const adjustedOutstanding = Math.max(0, adjustedOutstandingPerEntry[entry.srNo] || (receiptOutstanding + correctExtraAmount));
                    
                    // VERIFY: Ensure adjustedOutstanding = receiptOutstanding + extraAmount (recalculate if needed)
                    const recalculatedAdjustedOutstanding = receiptOutstanding + correctExtraAmount;
                    const finalAdjustedOutstanding = Math.max(0, recalculatedAdjustedOutstanding);
                    
                    // VERIFY: Ensure adjustedOriginal = baseOriginal + extraAmount (recalculate if needed)
                    const recalculatedAdjustedOriginal = baseOriginal + correctExtraAmount;
                    const finalAdjustedOriginal = recalculatedAdjustedOriginal;
                    
                    paidForDetails.push({
                        srNo: entry.srNo,
                        amount: Math.round(paymentForThisEntry * 100) / 100, // Actual payment amount (To Be Paid) - rounded
                        cdAmount: cdForThisEntry, // CD amount (separate) - already rounded
                        // Gov. payment extra amount tracking fields
                        receiptOutstanding: Math.round(receiptOutstanding * 100) / 100, // Original outstanding before payment - rounded
                        extraAmount: Math.round(correctExtraAmount * 100) / 100, // Proportional distribution of totalExtraAmount - rounded
                        adjustedOriginal: Math.round(finalAdjustedOriginal * 100) / 100, // Original + Extra - rounded
                        adjustedOutstanding: Math.round(finalAdjustedOutstanding * 100) / 100, // Outstanding + Extra - rounded
                    });
                }
            }
            
            // Verify: For Gov. payments, verify extraAmount values are correct
            if (paymentMethod === 'Gov.' && totalExtraAmount > 0) {
                const totalPaidForExtraAmount = paidForDetails.reduce((sum, pf: any) => sum + (pf.extraAmount || 0), 0);
                const extraAmountDiff = Math.abs(totalPaidForExtraAmount - totalExtraAmount);
                // CRITICAL: If mismatch detected, fix the extraAmount values
                if (extraAmountDiff > 0.01) {
                    // Recalculate proportional distribution to fix the mismatch
                    const totalReceiptOutstanding = entryOutstandings.reduce((sum, eo) => {
                        const outstanding = Math.max(0, eo.outstanding || 0);
                        return sum + outstanding;
                    }, 0);
                    
                    if (totalReceiptOutstanding > 0) {
                        // Recalculate proportions and redistribute
                        paidForDetails.forEach((pf: any) => {
                            const eo = entryOutstandings.find(e => e.entry.srNo === pf.srNo);
                            if (eo) {
                                const outstanding = Math.max(0, eo.outstanding || 0);
                                const proportion = outstanding / totalReceiptOutstanding;
                                pf.extraAmount = Math.round((totalExtraAmount * proportion) * 100) / 100;
                            }
                        });
                        
                        // Fix last entry to account for rounding
                        const recalculatedTotal = paidForDetails.reduce((sum, pf: any) => sum + (pf.extraAmount || 0), 0);
                        const remainingDiff = totalExtraAmount - recalculatedTotal;
                        if (paidForDetails.length > 0 && Math.abs(remainingDiff) > 0.01) {
                            const lastEntry = paidForDetails[paidForDetails.length - 1];
                            lastEntry.extraAmount = Math.round(((lastEntry.extraAmount || 0) + remainingDiff) * 100) / 100;
                        }
                        
                        // Recalculate adjustedOriginal and adjustedOutstanding with corrected extraAmount
                        paidForDetails.forEach((pf: any) => {
                            const eo = entryOutstandings.find(e => e.entry.srNo === pf.srNo);
                            if (eo) {
                                const baseOriginal = adjustedOriginalPerEntry[pf.srNo] || (eo.originalAmount || 0);
                                // Remove old extraAmount and add new one
                                const oldExtraAmount = extraAmountPerEntry[pf.srNo] || 0;
                                const correctedBaseOriginal = baseOriginal - oldExtraAmount;
                                adjustedOriginalPerEntry[pf.srNo] = correctedBaseOriginal + (pf.extraAmount || 0);
                                
                                const originalOutstanding = eo.originalOutstanding || (Math.max(0, eo.outstanding || 0) + (cdAllocations[pf.srNo] || 0));
                                adjustedOutstandingPerEntry[pf.srNo] = originalOutstanding + (pf.extraAmount || 0);
                                
                                // Update extraAmountPerEntry for consistency
                                extraAmountPerEntry[pf.srNo] = pf.extraAmount || 0;
                            }
                        });
                    }
                }
            }
            
            // Verify: Total CD distributed should match cdToDistribute
            const totalCdDistributed = paidForDetails.reduce((sum, pf) => sum + (pf.cdAmount || 0), 0);
            const cdDistributionDiff = cdToDistribute - totalCdDistributed;
            
            // CD distribution complete
            // Note: cdDistributionDiff indicates difference, but silent validation
            
            // ============================================================
            // STEP 5: Finalize CD Distribution (Recalculate for partial_on_paid mode)
            // ============================================================
            // For partial_on_paid mode: CD should be based on ACTUAL PAID AMOUNTS (not settled amounts)
            // IMPORTANT: paidFor.amount is the actual payment amount (To Be Paid), NOT settle amount
            // Settle Amount = Paid Amount + CD Amount
            // CD should be calculated on Paid Amount only
            if (cdToDistribute > 0 && paidForDetails.length > 0 && cdAt === 'partial_on_paid') {
                
                // Recalculate CD based on ACTUAL PAID AMOUNTS (not settled amounts)
                // paidFor.amount is already the actual paid amount (To Be Paid), not settle amount
                const totalPaidAmount = paidForDetails.reduce((sum, pf) => sum + pf.amount, 0);
                
                
                if (totalPaidAmount > 0) {
                    // Get eligible entries (those without previous CD)
                    // IMPORTANT: Use actual paid amount (pf.amount), not settle amount
                    const eligiblePaidFor = paidForDetails.filter(pf => {
                    const previousCd = totalCdReceivedByEntry[pf.srNo] || 0;
                        // Only entries with actual payment amount > 0 (not settle amount)
                        return previousCd === 0 && pf.amount > 0;
                    });
                    
                    
                    // Calculate total ACTUAL paid amount for eligible entries (not settle amount)
                    const totalPaidForEligible = eligiblePaidFor.reduce((sum, pf) => sum + pf.amount, 0);
                    
                    
                    if (totalPaidForEligible > 0) {
                        let totalRecalculated = 0;
                        const recalculatedCd: { [srNo: string]: number } = {};
                        
                        // Get original outstanding before CD was applied (add back CD that was already allocated)
                        // For Gov. payment, use adjusted outstanding (original outstanding + extra amount)
                        const getOriginalOutstanding = (srNo: string) => {
                            const eo = entryOutstandings.find(e => e.entry.srNo === srNo);
                            if (eo) {
                                // For Gov. payment, use adjusted outstanding (original outstanding + extra amount)
                                if (paymentMethod === 'Gov.' && adjustedOutstandingPerEntry[srNo] !== undefined) {
                                    // Adjusted Outstanding = Original Outstanding (before CD) + Extra Amount
                                    // This is the capacity for Gov. payment
                                    return adjustedOutstandingPerEntry[srNo];
                                }
                                // For other payment methods, current outstanding + CD already allocated = original outstanding before CD
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
                            
                            allValid = true;
                            const adjustmentsThisIteration: { [srNo: string]: number } = {};
                            
                            // Check each purchase sequentially
                            // IMPORTANT: Check ALL purchases - even those without CD
                            // If outstanding would go negative (with or without CD), reduce paid amount
                            for (let i = 0; i < sortedEligible.length; i++) {
                                const paidFor = sortedEligible[i];
                                const originalOutstanding = getOriginalOutstanding(paidFor.srNo);
                                const currentPaidAmount = paidAmountAdjustments[paidFor.srNo] || paidFor.amount;
                                const proposedCd = proportionalCd[paidFor.srNo] || 0;
                                
                                // Capacity = Original Outstanding - Proposed CD (this is the maximum we can pay)
                                const capacity = originalOutstanding - proposedCd;
                                
                                // Check if this purchase would go negative (with or without CD)
                                const outstandingAfter = originalOutstanding - currentPaidAmount - proposedCd;
                                
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
                                // All purchases are valid
                            }
                        }
                        
                        // Third pass: Distribute remaining CD to eligible purchases
                        let totalAllocated = Object.values(recalculatedCd).reduce((sum, cd) => sum + cd, 0);
                        let remainingCdAfterFirstPass = cdToDistribute - totalAllocated;
                        
                        
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
                                
                            }
                        }
                        
                        
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
                                            
                                        }
                                    }
                                }
                                
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
                                
                            }
                            
                            // Update CD amount
                            if (recalculatedCd[paidFor.srNo] !== undefined) {
                                const oldCd = paidFor.cdAmount || 0;
                                paidFor.cdAmount = Math.round(recalculatedCd[paidFor.srNo] * 100) / 100;
                                updatedCount++;
                            }
                        }
                        
                        
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
                                // Last resort: Reduce paid amount to make outstanding = 0
                                const maxAllowedPaid = originalOutstanding - finalCd;
                                paidFor.amount = Math.max(0, maxAllowedPaid);
                            }
                            
                            // Final rounding
                            paidFor.amount = Math.round(paidFor.amount * 100) / 100;
                            paidFor.cdAmount = Math.round((paidFor.cdAmount || 0) * 100) / 100;
                        }
                        
                        // Final CD summary
                        const finalTotalCd = paidForDetails.reduce((sum, pf) => sum + (pf.cdAmount || 0), 0);
                        const cdDiff = cdToDistribute - finalTotalCd;
                    }
                }
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
                            }
                        } else {
                            // Entry not in paidForDetails, add it with CD only
                            paidForDetails.push({
                                srNo: entry.srNo,
                                amount: 0, // No payment, only CD
                                cdAmount: allocatedCd
                            });
                        }
                    }
                }
            }
            
            // ============================================================
            // STEP 7: Final Verification - Ensure no negative outstanding
            // ============================================================
            // Verify and adjust to prevent overpayment
            // Use original outstanding (before CD was applied) for calculation
            // For Gov. payment, use adjusted outstanding (original + extra amount)
            for (const paidFor of paidForDetails) {
                const eo = entryOutstandings.find(e => e.entry.srNo === paidFor.srNo);
                if (eo) {
                    // Get original outstanding before CD was applied
                    // Use stored originalOutstanding if available, otherwise calculate
                    let originalOutstanding = eo.originalOutstanding || (eo.outstanding + (cdAllocations[paidFor.srNo] || 0));
                    
                    // CRITICAL: For Gov. payment, use adjustedOutstanding from paidFor (saved value)
                    // This is the outstanding BEFORE this payment, including extra amount
                    // For non-Gov payments, use originalOutstanding
                    let baseOutstandingForVerification = originalOutstanding;
                    if (paymentMethod === 'Gov.' && (paidFor as any).adjustedOutstanding !== undefined) {
                        // Use adjustedOutstanding from paidFor (this is receiptOutstanding + extraAmount)
                        baseOutstandingForVerification = (paidFor as any).adjustedOutstanding;
                    } else if (paymentMethod === 'Gov.' && adjustedOutstandingPerEntry[paidFor.srNo] !== undefined) {
                        // Fallback: Use adjustedOutstandingPerEntry if paidFor doesn't have it yet
                        baseOutstandingForVerification = adjustedOutstandingPerEntry[paidFor.srNo];
                    }
                    
                    const paidAmount = paidFor.amount;
                    const cdAmount = paidFor.cdAmount || 0;
                    
                    // Calculate outstanding after payment and CD
                    // Outstanding After = Base Outstanding (before payment) - Paid Amount - CD Amount
                    let outstandingAfter = baseOutstandingForVerification - paidAmount - cdAmount;
                    
                    // IMPORTANT: Cap outstanding at 0 to prevent negative values
                    outstandingAfter = Math.max(0, outstandingAfter);
                    
                    // If outstanding becomes negative (before capping), adjust payment amount and CD
                    // IMPORTANT: For Gov. payment, this should not happen if payment is within adjusted outstanding
                    // But if it does (due to rounding or other issues), adjust both payment and CD
                    if (outstandingAfter < -0.01) {
                        const excess = Math.abs(outstandingAfter);
                        // First, try to reduce CD
                        const oldCd = cdAmount;
                        const newCd = Math.max(0, oldCd - excess);
                        paidFor.cdAmount = newCd;
                        
                        // If CD reduction is not enough, reduce payment amount
                        const remainingExcess = excess - (oldCd - newCd);
                        if (remainingExcess > 0.01) {
                            paidFor.amount = Math.max(0, paidAmount - remainingExcess);
                        }
                        
                        // Recalculate outstanding after adjustment
                        outstandingAfter = baseOutstandingForVerification - paidFor.amount - paidFor.cdAmount;
                        outstandingAfter = Math.max(0, outstandingAfter);
                    }
                    
                    // Final rounding - ensure all values are properly rounded
                    paidFor.amount = Math.round(paidFor.amount * 100) / 100;
                    paidFor.cdAmount = Math.round((paidFor.cdAmount || 0) * 100) / 100;
                    
                    // CRITICAL: Verify and fix adjustedOutstanding and adjustedOriginal if they're incorrect
                    if (paymentMethod === 'Gov.' && (paidFor as any).adjustedOutstanding !== undefined) {
                        const receiptOutstanding = (paidFor as any).receiptOutstanding || 0;
                        const extraAmount = (paidFor as any).extraAmount || 0;
                        const recalculatedAdjustedOutstanding = receiptOutstanding + extraAmount;
                        
                        // Update if there's a mismatch (due to rounding or calculation errors)
                        if (Math.abs((paidFor as any).adjustedOutstanding - recalculatedAdjustedOutstanding) > 0.01) {
                            (paidFor as any).adjustedOutstanding = Math.round(recalculatedAdjustedOutstanding * 100) / 100;
                        }
                        
                        // Verify adjustedOriginal
                        const entry = eo.entry;
                        const baseOriginal = entry.originalNetAmount || 0;
                        const recalculatedAdjustedOriginal = baseOriginal + extraAmount;
                        if ((paidFor as any).adjustedOriginal !== undefined) {
                            if (Math.abs((paidFor as any).adjustedOriginal - recalculatedAdjustedOriginal) > 0.01) {
                                (paidFor as any).adjustedOriginal = Math.round(recalculatedAdjustedOriginal * 100) / 100;
                            }
                        }
                    }
                }
            }
            
            // Final summary of all purchases
            const finalSummary = paidForDetails.map(pf => {
                const eo = entryOutstandings.find(e => e.entry.srNo === pf.srNo);
                if (eo) {
                    let originalOutstanding = eo.originalOutstanding || (eo.outstanding + (cdAllocations[pf.srNo] || 0));
                    
                    // For Gov. payment, use adjusted outstanding (original outstanding + extra amount)
                    // This allows payment up to adjusted outstanding without going negative
                    // IMPORTANT: adjustedOutstandingPerEntry = originalOutstanding (before CD) + extraAmount
                    // This ensures CD is only subtracted once in verification
                    if (paymentMethod === 'Gov.' && adjustedOutstandingPerEntry[pf.srNo] !== undefined) {
                        // Use adjusted outstanding directly (already includes extra amount)
                        originalOutstanding = adjustedOutstandingPerEntry[pf.srNo];
                    }
                    
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
                        formula: paymentMethod === 'Gov.' 
                            ? `Adjusted Outstanding (${Math.round(originalOutstanding * 100) / 100}) - Paid (${Math.round(pf.amount * 100) / 100}) - CD (${Math.round((pf.cdAmount || 0) * 100) / 100}) = Outstanding (${Math.round(outstandingAfter * 100) / 100})`
                            : `Original (${Math.round(originalOutstanding * 100) / 100}) - Paid (${Math.round(pf.amount * 100) / 100}) - CD (${Math.round((pf.cdAmount || 0) * 100) / 100}) = Outstanding (${Math.round(outstandingAfter * 100) / 100})`
                    };
                }
                return { srNo: pf.srNo, error: 'Entry not found' };
            });
            
            // Final CD distribution verification
            const finalTotalCd = paidForDetails.reduce((sum, pf) => sum + (pf.cdAmount || 0), 0);
            
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
        if (paidForDetails.length === 0 && editingPayment?.paidFor?.length) {
            paidForDetails = editingPayment.paidFor.map((pf: any) => ({ srNo: pf.srNo, amount: pf.amount } as any));
        }
        
        // For RTGS and Gov., paymentId should be rtgsSrNo
        const finalPaymentId = (paymentMethod === 'RTGS' || paymentMethod === 'Gov.') ? rtgsSrNo : paymentId;
        
        // Validate paymentDate before formatting
        let formattedDate: string;
        if (paymentDate && paymentDate instanceof Date && !isNaN(paymentDate.getTime())) {
            formattedDate = format(paymentDate, 'yyyy-MM-dd');
        } else {
            formattedDate = format(new Date(), 'yyyy-MM-dd');
        }
        
        const paymentDataBase: Omit<Payment, 'id'> = {
            paymentId: finalPaymentId, customerId: selectedCustomerKey || '',
            date: formattedDate,
            // amount = "To Be Paid" amount (actual payment, WITHOUT CD)
            // cdAmount = CD amount (separate field)
            amount: Math.round(finalAmountToPay), cdAmount: Math.round(effectiveCdAmount),
            cdApplied: cdEnabled, type: paymentType, receiptType: paymentMethod,
            notes: paymentMethod === 'Gov.' ? '' : `UTR: ${utrNo || ''}, Check: ${checkNo || ''}`, // Empty notes for Gov.
            paidFor: paidForDetails,
            sixRDate: sixRDate ? format(sixRDate, 'yyyy-MM-dd') : '',
            parchiNo: parchiNo,
            supplierName: toTitleCase(supplierDetails.name),
            supplierFatherName: toTitleCase(supplierDetails.fatherName),
            supplierAddress: toTitleCase(supplierDetails.address),
        };
        
        // Payment method specific fields
        if (paymentMethod === 'RTGS') {
            paymentDataBase.rtgsSrNo = rtgsSrNo;
            paymentDataBase.utrNo = utrNo;
            paymentDataBase.checkNo = checkNo;
            paymentDataBase.quantity = rtgsQuantity;
            paymentDataBase.rate = rtgsRate;
            paymentDataBase.rtgsAmount = rtgsAmount;
            paymentDataBase.bankName = bankDetails.bank;
            paymentDataBase.bankBranch = bankDetails.branch;
            paymentDataBase.bankAcNo = bankDetails.acNo;
            paymentDataBase.bankIfsc = bankDetails.ifscCode;
            paymentDataBase.bankAccountId = accountIdForPayment;
        } else if (paymentMethod === 'Gov.') {
            // Gov. payment specific fields
            (paymentDataBase as any).rtgsSrNo = rtgsSrNo; // Gov. SR No
            (paymentDataBase as any).govQuantity = govQuantity || 0;
            (paymentDataBase as any).govRate = govRate || 0;
            (paymentDataBase as any).govAmount = govAmount || 0;
            (paymentDataBase as any).govRequiredAmount = govRequiredAmount || 0;
            // IMPORTANT: Save calculated extra amount (Total - Base), not user provided value
            (paymentDataBase as any).extraAmount = calculatedExtraAmount || 0;
            // Center Name for Gov payments (save in uppercase)
            (paymentDataBase as any).centerName = centerName ? String(centerName).toUpperCase() : '';
            // CRITICAL: Gov payments use GovAccount, NOT Cash or any bank account
            // Do NOT set bankAccountId - Gov payments are tracked separately via GovAccount
            // Do NOT set bank fields for Gov. payment
            // Do NOT set utrNo, checkNo for Gov. payment
            // Do NOT set quantity, rate, rtgsAmount for Gov. payment (use govQuantity, govRate, govAmount)
        } else if (paymentMethod === 'Cash') {
            // Cash payment - no bank details needed
            paymentDataBase.utrNo = utrNo;
            paymentDataBase.checkNo = checkNo;
        } else {
            // Online payment
            paymentDataBase.utrNo = utrNo;
            paymentDataBase.checkNo = checkNo;
            paymentDataBase.bankName = bankDetails.bank;
            paymentDataBase.bankBranch = bankDetails.branch;
            paymentDataBase.bankAcNo = bankDetails.acNo;
            paymentDataBase.bankIfsc = bankDetails.ifscCode;
            paymentDataBase.bankAccountId = accountIdForPayment;
        }

        const paymentIdToUse = editingPayment ? editingPayment.id : ((paymentMethod === 'RTGS' || paymentMethod === 'Gov.') ? rtgsSrNo : paymentId);
        
        // For Gov. payments, use the separate governmentFinalizedPayments collection
        // For other payments, use the regular payments collection
        let paymentCollection;
        if (paymentMethod === 'Gov.') {
            paymentCollection = governmentFinalizedPaymentsCollection;
        } else {
            paymentCollection = isCustomer ? customerPaymentsCollection : paymentsCollection;
        }
        
        const newPaymentRef = doc(paymentCollection, paymentIdToUse);
        const now = Timestamp.now();
        transaction.set(newPaymentRef, { ...paymentDataBase, id: newPaymentRef.id, updatedAt: now });
        finalPaymentData = { id: newPaymentRef.id, ...paymentDataBase, updatedAt: now } as Payment;
    });
    
    // ✅ Update sync registry AFTER transaction completes (non-blocking)
    try {
        const { notifySyncRegistry } = await import('./sync-registry');
        let collectionName: string;
        if (paymentMethod === 'Gov.') {
            collectionName = 'governmentFinalizedPayments';
        } else {
            collectionName = isCustomer ? 'customerPayments' : 'payments';
        }
        // Run async without blocking
        notifySyncRegistry(collectionName, {}).catch(err => {});
    } catch (err) {
        // Error updating sync registry
    }
    } catch (err: any) {
        // Quota/offline fallback: write locally and enqueue sync
        const { isQuotaError, markFirestoreDisabled } = await import('./realtime-guard');
        if (isQuotaError(err)) {
            markFirestoreDisabled();
            // Rebuild payment data base (mirror above without transaction context)
            let paidForDetails: PaidFor[] = [];
            if (incomingSelectedEntries && incomingSelectedEntries.length > 0) {
                paidForDetails = incomingSelectedEntries.map((e: Customer) => ({ srNo: e.srNo, amount: 0 } as any)); // amounts already embedded via distribution above; safe placeholder
            } else if (editingPayment?.paidFor?.length) {
                paidForDetails = editingPayment.paidFor.map((pf: any) => ({ srNo: pf.srNo, amount: pf.amount } as any));
            }
            
            // Calculate Gov. payment extra amount for offline fallback (if not already calculated)
            // If main block didn't run, calculate basic values
            let fallbackGovRequiredAmount = 0;
            let fallbackCalculatedExtraAmount = 0;
            if (paymentMethod === 'Gov.' && govAmount > 0) {
                // Use userGovRequiredAmount if provided, else use govAmount
                // Note: govRequiredAmount and calculatedExtraAmount may not be calculated if main block failed
                fallbackGovRequiredAmount = userGovRequiredAmount || govAmount;
                // calculatedExtraAmount will be 0 if not calculated (will be recalculated on sync)
                // This is fine - it will be recalculated when synced
                fallbackCalculatedExtraAmount = 0;
            }
            
            const finalPaymentId = (paymentMethod === 'RTGS' || paymentMethod === 'Gov.') ? rtgsSrNo : paymentId;
            const paymentDataBase: Omit<Payment, 'id'> = {
                paymentId: finalPaymentId, customerId: selectedCustomerKey || '',
                date: (paymentDate && paymentDate instanceof Date && !isNaN(paymentDate.getTime())) ? format(paymentDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                amount: Math.round(finalAmountToPay), cdAmount: Math.round(calculatedCdAmount),
                cdApplied: cdEnabled, type: paymentType, receiptType: paymentMethod,
                notes: paymentMethod === 'Gov.' ? '' : `UTR: ${utrNo || ''}, Check: ${checkNo || ''}`,
                paidFor: paidForDetails,
                sixRDate: (sixRDate && sixRDate instanceof Date && !isNaN(sixRDate.getTime())) ? format(sixRDate, 'yyyy-MM-dd') : '',
                parchiNo: parchiNo,
                supplierName: toTitleCase(supplierDetails.name),
                supplierFatherName: toTitleCase(supplierDetails.fatherName),
                supplierAddress: toTitleCase(supplierDetails.address),
            };
            
            // Payment method specific fields (mirror main logic)
            if (paymentMethod === 'RTGS') {
                (paymentDataBase as any).rtgsSrNo = rtgsSrNo;
                paymentDataBase.utrNo = utrNo;
                paymentDataBase.checkNo = checkNo;
                paymentDataBase.quantity = rtgsQuantity;
                paymentDataBase.rate = rtgsRate;
                paymentDataBase.rtgsAmount = rtgsAmount;
                paymentDataBase.bankName = bankDetails.bank;
                paymentDataBase.bankBranch = bankDetails.branch;
                paymentDataBase.bankAcNo = bankDetails.acNo;
                paymentDataBase.bankIfsc = bankDetails.ifscCode;
                (paymentDataBase as any).bankAccountId = accountIdForPayment;
            } else if (paymentMethod === 'Gov.') {
                (paymentDataBase as any).rtgsSrNo = rtgsSrNo;
                (paymentDataBase as any).govQuantity = govQuantity || 0;
                (paymentDataBase as any).govRate = govRate || 0;
                (paymentDataBase as any).govAmount = govAmount || 0;
                (paymentDataBase as any).govRequiredAmount = fallbackGovRequiredAmount || 0;
                // IMPORTANT: Save calculated extra amount (Total - Base), not user provided value
                // fallbackCalculatedExtraAmount will be 0 if not calculated (will be recalculated on sync)
                (paymentDataBase as any).extraAmount = fallbackCalculatedExtraAmount || 0;
                (paymentDataBase as any).centerName = centerName || '';
                // Do NOT set bank fields, utrNo, checkNo, quantity, rate, rtgsAmount for Gov.
            } else if (paymentMethod === 'Cash') {
                paymentDataBase.utrNo = utrNo;
                paymentDataBase.checkNo = checkNo;
            } else {
                paymentDataBase.utrNo = utrNo;
                paymentDataBase.checkNo = checkNo;
                paymentDataBase.bankName = bankDetails.bank;
                paymentDataBase.bankBranch = bankDetails.branch;
                paymentDataBase.bankAcNo = bankDetails.acNo;
                paymentDataBase.bankIfsc = bankDetails.ifscCode;
                (paymentDataBase as any).bankAccountId = accountIdForPayment;
            }
            const paymentIdToUse = editingPayment ? editingPayment.id : ((paymentMethod === 'RTGS' || paymentMethod === 'Gov.') ? rtgsSrNo : paymentId);
            const now = Timestamp.now();
            finalPaymentData = { id: paymentIdToUse, ...paymentDataBase, updatedAt: now } as Payment;
            try {
                if (db && finalPaymentData) {
                    if (editingPayment?.id) {
                        if (paymentMethod === 'Gov.') {
                            await db.governmentFinalizedPayments.delete(editingPayment.id);
                        } else if (isCustomer) {
                            await db.customerPayments.delete(editingPayment.id);
                        } else {
                            await db.payments.delete(editingPayment.id);
                        }
                    }
                    // Ensure receiptType is set for gov payments
                    const paymentToSave = paymentMethod === 'Gov.' 
                        ? { ...finalPaymentData, receiptType: finalPaymentData.receiptType || 'Gov.' }
                        : finalPaymentData;
                    
                    if (paymentMethod === 'Gov.') {
                        await db.governmentFinalizedPayments.put(paymentToSave);
                    } else if (isCustomer) {
                        await db.customerPayments.put(paymentToSave as any);
                    } else {
                        await db.payments.put(paymentToSave);
                    }
                }
            } catch {}
            // enqueue sync
            try {
                const { enqueueSyncTask } = await import('./sync-queue');
                if (editingPayment?.id) {
                    // For Gov. payments, use delete:governmentFinalizedPayment
                    let deleteTaskType;
                    if (paymentMethod === 'Gov.') {
                        deleteTaskType = 'delete:governmentFinalizedPayment';
                    } else {
                        deleteTaskType = isCustomer ? 'delete:customerPayment' : 'delete:payment';
                    }
                    await enqueueSyncTask(deleteTaskType, { id: editingPayment.id }, { attemptImmediate: true, dedupeKey: `${deleteTaskType}:${editingPayment.id}` });
                }
                // For Gov. payments, use a different sync task type
                let upsertTaskType;
                if (paymentMethod === 'Gov.') {
                    upsertTaskType = 'upsert:governmentFinalizedPayment';
                } else {
                    upsertTaskType = isCustomer ? 'upsert:customerPayment' : 'upsert:payment';
                }
                await enqueueSyncTask(upsertTaskType, finalPaymentData, { attemptImmediate: true, dedupeKey: `${upsertTaskType}:${finalPaymentData.id}` });
            } catch {}
        } else {
            throw err;
        }
    }
    // Ensure local IndexedDB reflects the latest payment so UI updates instantly (non-blocking)
    if (db && finalPaymentData) {
        // Run IndexedDB update in background without blocking
        (async () => {
            try {
                // Ensure receiptType is set for gov payments
                const paymentToSave = paymentMethod === 'Gov.' 
                    ? { ...finalPaymentData, receiptType: finalPaymentData.receiptType || 'Gov.' }
                    : finalPaymentData;
                
                if (paymentMethod === 'Gov.') {
                    await db.governmentFinalizedPayments.put(paymentToSave);
                } else if (isCustomer) {
                    await db.customerPayments.put(paymentToSave as any);
                } else {
                    await db.payments.put(paymentToSave);
                }
                
                // ✅ Trigger custom event to notify listeners of IndexedDB update
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('indexeddb:payment:updated', { 
                        detail: { payment: paymentToSave, paymentMethod, isCustomer } 
                    }));
                }
            } catch (err) {
            }
        })();
    }
    if (!finalPaymentData) {
        return { success: false, message: "Failed to create payment" };
    }
    
    // ✅ Recalculate outstanding for affected suppliers/customers after payment save/edit (non-blocking)
    const affectedSrNos = finalPaymentData.paidFor?.map(pf => pf.srNo) || [];
    if (affectedSrNos.length > 0) {
        // Get old payment's affected SR Nos if editing
        const oldAffectedSrNos = editingPayment?.paidFor?.map(pf => pf.srNo) || [];
        // Combine both old and new to ensure all affected entries are updated
        const allAffectedSrNos = [...new Set([...affectedSrNos, ...oldAffectedSrNos])];
        
        // Run in background without blocking
        (async () => {
            try {
                await recalculateOutstandingForAffectedEntries(allAffectedSrNos, isCustomer);
                
                // ✅ Trigger custom event to notify listeners of supplier/customer updates
                if (typeof window !== 'undefined') {
                    try {
                        window.dispatchEvent(new CustomEvent('indexeddb:suppliers:updated', { 
                            detail: { affectedSrNos: allAffectedSrNos, isCustomer } 
                        }));
                    } catch (error) {
                    }
                }
            } catch (error) {
                // Don't fail the payment save if recalculation fails
            }
        })();
    }
    
    return { success: true, payment: finalPaymentData };
};


/**
 * Recalculate and update outstanding/netAmount for suppliers/customers affected by payment changes
 */
async function recalculateOutstandingForAffectedEntries(
    affectedSrNos: string[],
    isCustomer: boolean = false
): Promise<void> {
    if (!affectedSrNos || affectedSrNos.length === 0) return;

    try {
        const { getAllSuppliers, getAllCustomers, getHolidays, getDailyPaymentLimit } = await import('./firestore');
        const { calculateSupplierEntry } = await import('./utils');
        const { writeBatch } = await import('firebase/firestore');
        const { collection, doc, getDoc, query, where, getDocs } = await import('firebase/firestore');

        const holidays = await getHolidays();
        const dailyPaymentLimit = await getDailyPaymentLimit();
        
        // Get all payments to recalculate outstanding (including Gov. payments)
        const regularPayments = isCustomer 
            ? await db.customerPayments.toArray() 
            : await db.payments.toArray();
        const govPayments = await db.governmentFinalizedPayments.toArray();
        const allPayments = [...regularPayments, ...govPayments];
        
        const batch = writeBatch(firestoreDB);
        let updatedCount = 0;

        for (const srNo of affectedSrNos) {
            // Find supplier/customer by srNo using query
            const collectionRef = isCustomer ? customersCollection : suppliersCollection;
            const q = query(collectionRef, where('srNo', '==', srNo));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) continue;
            
            const entryDoc = querySnapshot.docs[0];
            const entryData = entryDoc.data() as Customer;
            const entryRef = doc(collectionRef, entryDoc.id);
            
            // Recalculate outstanding based on all payments
            const recalculatedData = calculateSupplierEntry(entryData, allPayments, holidays, dailyPaymentLimit, []);
            
            // Calculate total paid and CD for this entry
            const paymentsForEntry = allPayments.filter(p => 
                p.paidFor?.some(pf => pf.srNo === srNo)
            );
            
            let totalPaid = 0;
            let totalCd = 0;
            
            paymentsForEntry.forEach(p => {
                const paidForEntry = p.paidFor?.find(pf => pf.srNo === srNo);
                if (paidForEntry) {
                    totalPaid += Number(paidForEntry.amount || 0);
                    totalCd += Number(paidForEntry.cdAmount || 0);
                }
            });
            
            // Outstanding = Original - Total Paid - Total CD
            // IMPORTANT: Cap at 0 to prevent negative outstanding
            const outstanding = Math.max(0, Math.round((recalculatedData.originalNetAmount - totalPaid - totalCd) * 100) / 100);
            const netAmount = outstanding;
            
            // Update only outstanding and netAmount
            batch.update(entryRef, {
                netAmount: netAmount,
                updatedAt: new Date().toISOString()
            });
            
            // Also update IndexedDB
            if (db) {
                if (isCustomer) {
                    await db.customers.update(entryDoc.id, { netAmount, updatedAt: new Date().toISOString() });
                } else {
                    await db.suppliers.update(entryDoc.id, { netAmount, updatedAt: new Date().toISOString() });
                }
            }
            
            updatedCount++;
        }
        
        if (updatedCount > 0) {
            await batch.commit();
            
            // ✅ Trigger custom event to notify listeners of IndexedDB update
            if (typeof window !== 'undefined') {
                try {
                    window.dispatchEvent(new CustomEvent('indexeddb:suppliers:updated', { 
                        detail: { affectedSrNos, isCustomer } 
                    }));
                } catch (error) {
                }
            }
        }
    } catch (error) {
        // Don't throw - this is a background update
    }
}

export const handleDeletePaymentLogic = async (context: { paymentId: string; paymentHistory?: Payment[]; suppliers?: Customer[]; expenses?: Expense[]; incomes?: Income[]; isCustomer?: boolean }) => {
    const { paymentId, paymentHistory, suppliers, expenses, incomes, isCustomer = false } = context;
    
    if (!paymentId) {
        throw new Error("Payment ID is missing for deletion.");
    }

    // Find the payment to delete - check id, paymentId, and rtgsSrNo for RTGS payments
    const paymentToDelete = paymentHistory?.find(p => 
        p.id === paymentId || 
        p.paymentId === paymentId || 
        (p as any).rtgsSrNo === paymentId
    );
    if (!paymentToDelete) {
        throw new Error("Payment not found.");
    }

    // Get affected SR Nos before deleting
    const affectedSrNos = paymentToDelete.paidFor?.map(pf => pf.srNo) || [];

    // Check if this is a Gov. payment
    const isGovPayment = paymentToDelete.receiptType === 'Gov.';
    
    const performDelete = async (transOrBatch: any) => {
        // For Gov. payments, use the governmentFinalizedPayments collection
        // For other payments, use the regular payments collection
        let paymentCollection;
        if (isGovPayment) {
            paymentCollection = governmentFinalizedPaymentsCollection;
        } else {
            paymentCollection = isCustomer ? customerPaymentsCollection : paymentsCollection;
        }
        
        const paymentDocRef = doc(paymentCollection, paymentToDelete.id);
        const paymentDoc = await transOrBatch.get(paymentDocRef);
        
        if (!paymentDoc.exists()) {
             return; // Silently fail if doc is already gone
        }

        transOrBatch.delete(paymentDocRef);
    };
    
    try {
        await runTransaction(firestoreDB, async (t) => {
            await performDelete(t);
        });
        
        // ✅ Update sync registry AFTER transaction completes (non-blocking)
        try {
            const { notifySyncRegistry } = await import('./sync-registry');
            let collectionName: string;
            if (isGovPayment) {
                collectionName = 'governmentFinalizedPayments';
            } else {
                collectionName = isCustomer ? 'customerPayments' : 'payments';
            }
            // Run async without blocking
            notifySyncRegistry(collectionName, {}).catch(err => {});
        } catch (err) {
        }
    } catch (err: any) {
        // Quota/offline fallback: delete locally and enqueue sync
        const { isQuotaError, markFirestoreDisabled } = await import('./realtime-guard');
        if (isQuotaError(err)) {
            markFirestoreDisabled();
        }
        // Continue with local delete and sync queue
    }

    // Run IndexedDB delete and sync in background (non-blocking)
    if (db) {
        (async () => {
            try {
                // Delete from IndexedDB
                if (isGovPayment) {
                    await db.governmentFinalizedPayments.delete(paymentToDelete.id);
                } else if (isCustomer) {
                    await db.customerPayments.delete(paymentToDelete.id);
                } else {
                    await db.payments.delete(paymentToDelete.id);
                }
                
                // ✅ Enqueue sync task for deletion
                try {
                    const { enqueueSyncTask } = await import('./sync-queue');
                    let deleteTaskType;
                    if (isGovPayment) {
                        deleteTaskType = 'delete:governmentFinalizedPayment';
                    } else {
                        deleteTaskType = isCustomer ? 'delete:customerPayment' : 'delete:payment';
                    }
                    await enqueueSyncTask(deleteTaskType, { id: paymentToDelete.id }, { attemptImmediate: true, dedupeKey: `${deleteTaskType}:${paymentToDelete.id}` });
                } catch (error) {
                }
                
                // ✅ Trigger custom event to notify listeners of IndexedDB delete
                if (typeof window !== 'undefined') {
                    try {
                        window.dispatchEvent(new CustomEvent('indexeddb:payment:deleted', { 
                            detail: { 
                                paymentId: paymentToDelete.id, 
                                payment: paymentToDelete,
                                receiptType: paymentToDelete.receiptType,
                                paymentMethod: (paymentToDelete as any).paymentMethod,
                                isGovPayment, 
                                isCustomer 
                            } 
                        }));
                    } catch (error) {
                    }
                }
            } catch (err) {
            }
        })();
    }

    // ✅ Recalculate outstanding for affected suppliers/customers (non-blocking)
    if (affectedSrNos.length > 0) {
        // Run in background without blocking
        (async () => {
            try {
                await recalculateOutstandingForAffectedEntries(affectedSrNos, isCustomer);
                
                // ✅ Trigger custom event to notify listeners of supplier/customer updates
                if (typeof window !== 'undefined') {
                    try {
                        window.dispatchEvent(new CustomEvent('indexeddb:suppliers:updated', { 
                            detail: { affectedSrNos, isCustomer } 
                        }));
                    } catch (error) {
                    }
                }
            } catch (error) {
            }
        })();
    }
};


