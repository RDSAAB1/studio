
'use client';

import { collection, doc, getDocs, query, runTransaction, where, addDoc, deleteDoc, limit, updateDoc, getDoc, DocumentReference, WriteBatch } from 'firebase/firestore';
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
            // Calculate outstanding for each entry (restore if editing)
            // CRITICAL: Outstanding must reflect the ACTUAL outstanding before payment
            // Need to restore both paid amount AND CD amount from previous payment
            const entryOutstandings = selectedEntries.map(entry => {
                const previousPaidFor = editingPayment?.paidFor?.find((pf:any) => pf.srNo === entry.srNo);
                const previousPaidAmount = previousPaidFor?.amount || 0;
                
                // Get previous CD allocation for this entry
                // First check if CD amount is directly stored in paidFor (new format)
                let previousCdAmount = 0;
                if (previousPaidFor && 'cdAmount' in previousPaidFor && previousPaidFor.cdAmount) {
                    previousCdAmount = Number(previousPaidFor.cdAmount || 0);
                } else if (editingPayment?.cdApplied && editingPayment?.cdAmount && editingPayment?.paidFor && editingPayment.paidFor.length > 0) {
                    // Fallback to proportional calculation for old payments
                    const totalPaidForInPreviousPayment = editingPayment.paidFor.reduce((sum: number, pf: any) => sum + (pf.amount || 0), 0);
                    if (totalPaidForInPreviousPayment > 0) {
                        const proportion = previousPaidAmount / totalPaidForInPreviousPayment;
                        previousCdAmount = Math.round(editingPayment.cdAmount * proportion);
                    }
                }
                
                // Restore outstanding by adding back both paid amount and CD
                // entry.netAmount is current outstanding (after previous payment)
                // Add back previousPaidAmount + previousCdAmount to get original outstanding before this payment
                const outstanding = Number(entry.netAmount) + previousPaidAmount + previousCdAmount;
                
                return { entry, outstanding: Math.max(0, outstanding) };
            });
            
            const totalOutstanding = entryOutstandings.reduce((sum, eo) => sum + eo.outstanding, 0);
            
            // Step 1: Distribute CD (CD reduces outstanding first, sequentially)
            // For "partial CD on paid amount": 
            // - Calculate CD percent from total CD and to be paid amount
            // - Apply CD to each entry's outstanding sequentially (CD% × entry outstanding, capped by available CD)
            // - Remaining CD goes to next entry
            const cdToDistribute = cdEnabled ? Math.round(calculatedCdAmount) : 0;
            const cdAllocations: { [srNo: string]: number } = {};
            const cdAllocationsPrecise: { [srNo: string]: number } = {}; // Define outside for debug access
            
            // Determine CD distribution mode (needed for paid amount distribution too)
            // Calculate total original amount once (used for full CD mode and proportional CD mode)
            const totalOriginalAmount = entryOutstandings.reduce((sum, eo) => sum + (eo.entry.originalNetAmount || 0), 0);
            const useOriginalAmountForDistribution = cdAt === 'on_full_amount' || cdAt === 'proportional_cd';
            
            if (cdToDistribute > 0 && totalOutstanding > 0 && finalAmountToPay > 0) {
                // CD distribution logic depends on CD mode:
                // - 'on_full_amount' or 'proportional_cd': CD distributed based on each entry's ORIGINAL AMOUNT × CD% (proportional)
                // - 'partial_on_paid' or 'on_unpaid_amount': CD distributed based on each entry's OUTSTANDING × CD%
                
                let cdPercent = 0;
                
                if (useOriginalAmountForDistribution) {
                    // For "Full CD" mode: CD should be distributed based on ORIGINAL AMOUNT of each entry
                    // Each entry gets CD proportional to its original amount
                    // CD for entry = (entry.originalAmount / totalOriginalAmount) × totalCDToDistribute
                    if (totalOriginalAmount > 0) {
                        // Calculate CD% from total - this will be used to verify, but distribution is proportional
                        cdPercent = (cdToDistribute / totalOriginalAmount) * 100;
                    }
                } else {
                    // For "Partial CD on Paid Amount" or "CD on Unpaid Amount":
                    // CD is distributed based on OUTSTANDING × CD%
                    cdPercent = (cdToDistribute / finalAmountToPay) * 100;
                }
                
                // For Full CD mode and Proportional CD mode, calculate directly from proportions - skip intermediate steps
                if (useOriginalAmountForDistribution) {
                    // Full CD / Proportional CD mode: Direct proportional calculation - simplest and most accurate
                    // Calculate CD for each entry based on original amount proportion
                    const proportionalAllocations: { [srNo: string]: number } = {};
                    let totalCalculated = 0;
                    
                    for (const { entry, outstanding } of entryOutstandings) {
                        // Skip entries that are already overpaid (negative outstanding)
                        // But still allocate CD based on original amount proportion for all selected entries
                        const originalAmount = entry.originalNetAmount || 0;
                        if (originalAmount > 0 && totalOriginalAmount > 0) {
                            const proportion = originalAmount / totalOriginalAmount;
                            const exactAmount = cdToDistribute * proportion;
                            const rounded = Math.round(exactAmount * 100) / 100;
                            proportionalAllocations[entry.srNo] = rounded;
                            totalCalculated += rounded;
                        }
                    }
                    
                    // Distribute rounding difference proportionally
                    let roundingDiff = cdToDistribute - totalCalculated;
                    if (Math.abs(roundingDiff) >= 0.01) {
                        for (const { entry } of entryOutstandings) {
                            if (Math.abs(roundingDiff) < 0.01) break;
                            
                            const originalAmount = entry.originalNetAmount || 0;
                            if (originalAmount > 0 && totalOriginalAmount > 0) {
                                const proportion = originalAmount / totalOriginalAmount;
                                const adjustment = Math.round(roundingDiff * proportion * 100) / 100;
                                
                                if (Math.abs(adjustment) >= 0.01) {
                                    proportionalAllocations[entry.srNo] = (proportionalAllocations[entry.srNo] || 0) + adjustment;
                                    roundingDiff -= adjustment;
                                }
                            }
                        }
                        
                        // Final remainder to first entry
                        if (Math.abs(roundingDiff) >= 0.01 && entryOutstandings.length > 0) {
                            const firstEntry = entryOutstandings[0];
                            proportionalAllocations[firstEntry.entry.srNo] = (proportionalAllocations[firstEntry.entry.srNo] || 0) + roundingDiff;
                        }
                    }
                    
                    // Copy directly to final cdAllocations (skip all intermediate steps)
                    for (const srNo in proportionalAllocations) {
                        cdAllocations[srNo] = proportionalAllocations[srNo];
                        cdAllocationsPrecise[srNo] = proportionalAllocations[srNo]; // For consistency
                    }
                } else {
                    // Partial/Unpaid CD mode: Sequential allocation based on OUTSTANDING
                    let remainingCd = cdToDistribute;
                    
                    for (const { entry, outstanding } of entryOutstandings) {
                        if (remainingCd <= 0) continue;
                        
                        if (outstanding <= 0) continue;
                        const calculatedCdForEntryPrecise = outstanding * (cdPercent / 100);
                        const maxCdAllowed = outstanding;
                        
                        const cdForThisEntryPrecise = Math.min(calculatedCdForEntryPrecise, remainingCd, maxCdAllowed);
                        
                        if (cdForThisEntryPrecise > 0) {
                            cdAllocationsPrecise[entry.srNo] = cdForThisEntryPrecise;
                            remainingCd -= cdForThisEntryPrecise;
                        }
                    }
                    
                    // Round and adjust for Partial CD mode
                    let totalRounded = 0;
                    const roundedAllocations: { [srNo: string]: number } = {};
                    
                    for (const { entry, outstanding } of entryOutstandings) {
                        const preciseCd = cdAllocationsPrecise[entry.srNo] || 0;
                        if (preciseCd > 0) {
                            const rounded = Math.round(preciseCd * 100) / 100;
                            roundedAllocations[entry.srNo] = Math.min(Math.max(rounded, 0), outstanding);
                            totalRounded += roundedAllocations[entry.srNo];
                        }
                    }
                    
                    // Adjust rounding differences for Partial CD mode
                    const roundingDiff = cdToDistribute - totalRounded;
                    let remainingAdjustment = roundingDiff;
                    
                    if (Math.abs(remainingAdjustment) >= 0.001) {
                        const sortedEntries = entryOutstandings
                            .filter(eo => (roundedAllocations[eo.entry.srNo] || 0) > 0 || remainingAdjustment > 0)
                            .sort((a, b) => {
                                const aHasCd = (roundedAllocations[a.entry.srNo] || 0) > 0;
                                const bHasCd = (roundedAllocations[b.entry.srNo] || 0) > 0;
                                if (aHasCd && !bHasCd) return -1;
                                if (!aHasCd && bHasCd) return 1;
                                const aCapacity = a.outstanding - (roundedAllocations[a.entry.srNo] || 0);
                                const bCapacity = b.outstanding - (roundedAllocations[b.entry.srNo] || 0);
                                return bCapacity - aCapacity;
                            });
                        
                        for (const { entry, outstanding } of sortedEntries) {
                            if (Math.abs(remainingAdjustment) < 0.001) break;
                            
                            const currentAllocation = roundedAllocations[entry.srNo] || 0;
                            const maxCapacity = outstanding - currentAllocation;
                            
                            if (remainingAdjustment > 0 && maxCapacity > 0) {
                                const adjustment = Math.min(maxCapacity, remainingAdjustment);
                                roundedAllocations[entry.srNo] = currentAllocation + adjustment;
                                remainingAdjustment -= adjustment;
                            } else if (remainingAdjustment < 0 && currentAllocation > 0 && Math.abs(remainingAdjustment) > 0.1) {
                                const reduction = Math.min(currentAllocation, Math.abs(remainingAdjustment));
                                roundedAllocations[entry.srNo] = currentAllocation - reduction;
                                remainingAdjustment += reduction;
                            }
                        }
                    }
                    
                    // Copy to final cdAllocations for Partial CD mode
                    for (const srNo in roundedAllocations) {
                        cdAllocations[srNo] = roundedAllocations[srNo];
                    }
                }
            }
            
            // Step 2: Distribute paid amount from remaining outstanding (after CD)
            let amountToDistribute = Math.round(finalAmountToPay);

            for (const { entry, outstanding } of entryOutstandings) {
                if (amountToDistribute <= 0) break;
                
                // Outstanding after CD has been deducted
                const cdForThis = cdAllocations[entry.srNo] || 0;
                const outstandingAfterCd = Math.max(0, outstanding - cdForThis);
                
                // Allocate paid amount from remaining outstanding
                // IMPORTANT: In Full CD mode, CD is already allocated based on original amount proportion
                // So we just need to allocate paid amount to cover remaining outstanding
                let paymentForThisEntry = Math.min(outstandingAfterCd, amountToDistribute);
                
                // Ensure we don't overpay: payment + CD should not exceed original amount
                // This is important for Full CD mode when one entry fully settles
                if (useOriginalAmountForDistribution) {
                    const originalAmount = entry.originalNetAmount || 0;
                    const maxAllowedPayment = Math.max(0, originalAmount - cdForThis);
                    paymentForThisEntry = Math.min(paymentForThisEntry, maxAllowedPayment);
                }

                if (paymentForThisEntry > 0) {
                    const roundedPayment = Math.round(paymentForThisEntry * 100) / 100;
                    const roundedCd = Math.round((cdAllocations[entry.srNo] || 0) * 100) / 100;
                    
                    paidForDetails.push({
                        srNo: entry.srNo,
                        amount: roundedPayment, // Actual payment amount (after CD has reduced outstanding)
                        cdAmount: roundedCd, // Store CD amount allocated to this entry
                    });
                    amountToDistribute -= roundedPayment;
                }
            }
            
            // FINALIZE STEP: Final verification and correction of CD distribution
            // This ensures exact proportional distribution and prevents negative outstanding
            if (cdToDistribute > 0 && paidForDetails.length > 0 && useOriginalAmountForDistribution) {
                // Recalculate CD distribution based on exact proportions
                const finalCdAllocations: { [srNo: string]: number } = {};
                let totalCalculated = 0;
                
                // Calculate exact proportional CD for each entry
                for (const paidFor of paidForDetails) {
                    const entry = entryOutstandings.find(eo => eo.entry.srNo === paidFor.srNo)?.entry;
                    if (entry && totalOriginalAmount > 0) {
                        const originalAmount = entry.originalNetAmount || 0;
                        const proportion = originalAmount / totalOriginalAmount;
                        const exactAmount = cdToDistribute * proportion;
                        const rounded = Math.round(exactAmount * 100) / 100;
                        finalCdAllocations[paidFor.srNo] = rounded;
                        totalCalculated += rounded;
                    }
                }
                
                // Distribute rounding difference proportionally
                let roundingDiff = cdToDistribute - totalCalculated;
                if (Math.abs(roundingDiff) >= 0.01) {
                    const entriesWithPayment = paidForDetails.map(pf => {
                        const eo = entryOutstandings.find(e => e.entry.srNo === pf.srNo);
                        return eo ? { paidFor: pf, entry: eo.entry, originalAmount: eo.entry.originalNetAmount || 0 } : null;
                    }).filter(Boolean) as Array<{ paidFor: PaidFor; entry: any; originalAmount: number }>;
                    
                    for (const { paidFor, originalAmount } of entriesWithPayment) {
                        if (Math.abs(roundingDiff) < 0.01) break;
                        if (originalAmount > 0 && totalOriginalAmount > 0) {
                            const proportion = originalAmount / totalOriginalAmount;
                            const adjustment = Math.round(roundingDiff * proportion * 100) / 100;
                            
                            if (Math.abs(adjustment) >= 0.01) {
                                finalCdAllocations[paidFor.srNo] = (finalCdAllocations[paidFor.srNo] || 0) + adjustment;
                                roundingDiff -= adjustment;
                            }
                        }
                    }
                    
                    // Final remainder to first entry
                    if (Math.abs(roundingDiff) >= 0.01 && entriesWithPayment.length > 0) {
                        const firstSrNo = entriesWithPayment[0].paidFor.srNo;
                        finalCdAllocations[firstSrNo] = (finalCdAllocations[firstSrNo] || 0) + roundingDiff;
                    }
                }
                
                // Update paidForDetails with corrected CD amounts and verify no negative outstanding
                for (const paidFor of paidForDetails) {
                    const correctedCd = finalCdAllocations[paidFor.srNo] || 0;
                    const entry = entryOutstandings.find(eo => eo.entry.srNo === paidFor.srNo);
                    
                    if (entry) {
                        // Verify: payment + CD should not exceed original amount
                        const originalAmount = entry.entry.originalNetAmount || 0;
                        const totalSettlement = paidFor.amount + correctedCd;
                        
                        if (totalSettlement > originalAmount) {
                            // Adjust: reduce CD if needed to prevent overpayment
                            const maxAllowedCd = Math.max(0, originalAmount - paidFor.amount);
                            paidFor.cdAmount = Math.min(correctedCd, maxAllowedCd);
                        } else {
                            paidFor.cdAmount = correctedCd;
                        }
                        
                        // Final verification: Check outstanding after payment
                        const outstandingAfterPayment = entry.outstanding - paidFor.amount - (paidFor.cdAmount || 0);
                        
                        // If outstanding becomes negative (overpaid), adjust payment amount
                        if (outstandingAfterPayment < -0.01) {
                            const excess = Math.abs(outstandingAfterPayment);
                            // Reduce payment amount to prevent negative outstanding
                            paidFor.amount = Math.max(0, paidFor.amount - excess);
                            // If payment becomes zero, we might need to adjust CD too
                            if (paidFor.amount <= 0) {
                                // If no payment, CD should also be zero or minimal
                                const remainingOutstanding = entry.outstanding;
                                paidFor.cdAmount = Math.min(paidFor.cdAmount || 0, Math.max(0, remainingOutstanding));
                            }
                        }
                        
                        // Round final values
                        paidFor.amount = Math.round(paidFor.amount * 100) / 100;
                        paidFor.cdAmount = Math.round((paidFor.cdAmount || 0) * 100) / 100;
                    }
                }
                
                // Final verification: Total CD allocated should match cdToDistribute
                const finalTotalCd = paidForDetails.reduce((sum, pf) => sum + (pf.cdAmount || 0), 0);
                const finalCdDiff = cdToDistribute - finalTotalCd;
                
                if (Math.abs(finalCdDiff) >= 0.01 && paidForDetails.length > 0) {
                    // Distribute remaining CD difference proportionally to all entries
                    const entriesWithPayment = paidForDetails.map(pf => {
                        const eo = entryOutstandings.find(e => e.entry.srNo === pf.srNo);
                        return eo ? { paidFor: pf, entry: eo.entry, originalAmount: eo.entry.originalNetAmount || 0 } : null;
                    }).filter(Boolean) as Array<{ paidFor: PaidFor; entry: any; originalAmount: number }>;
                    
                    let remainingDiff = finalCdDiff;
                    
                    for (const { paidFor, originalAmount } of entriesWithPayment) {
                        if (Math.abs(remainingDiff) < 0.01) break;
                        if (originalAmount > 0 && totalOriginalAmount > 0) {
                            const proportion = originalAmount / totalOriginalAmount;
                            const adjustment = Math.round(remainingDiff * proportion * 100) / 100;
                            
                            if (Math.abs(adjustment) >= 0.01) {
                                const entry = entryOutstandings.find(eo => eo.entry.srNo === paidFor.srNo);
                                if (entry) {
                                    const originalAmount = entry.entry.originalNetAmount || 0;
                                    const maxAllowedCd = Math.max(0, originalAmount - paidFor.amount);
                                    const newCd = Math.min((paidFor.cdAmount || 0) + adjustment, maxAllowedCd);
                                    paidFor.cdAmount = Math.round(newCd * 100) / 100;
                                    remainingDiff -= (paidFor.cdAmount - (finalCdAllocations[paidFor.srNo] || 0));
                                }
                            }
                        }
                    }
                    
                    // If any remainder left, add to first entry
                    if (Math.abs(remainingDiff) >= 0.01 && entriesWithPayment.length > 0) {
                        const firstEntry = entriesWithPayment[0];
                        const entry = entryOutstandings.find(eo => eo.entry.srNo === firstEntry.paidFor.srNo);
                        if (entry) {
                            const originalAmount = entry.entry.originalNetAmount || 0;
                            const maxAllowedCd = Math.max(0, originalAmount - firstEntry.paidFor.amount);
                            const adjustedCd = Math.min((firstEntry.paidFor.cdAmount || 0) + remainingDiff, maxAllowedCd);
                            firstEntry.paidFor.cdAmount = Math.round(adjustedCd * 100) / 100;
                        }
                    }
                }
                
                // Final sanity check: Verify total payment + CD = expected settle amount
                const totalPayment = paidForDetails.reduce((sum, pf) => sum + pf.amount, 0);
                const totalCdFinal = paidForDetails.reduce((sum, pf) => sum + (pf.cdAmount || 0), 0);
                const expectedSettle = finalAmountToPay + cdToDistribute;
                const actualSettle = totalPayment + totalCdFinal;
                const settleDiff = expectedSettle - actualSettle;
                
                // If there's a significant difference, log warning (but don't block payment)
                if (Math.abs(settleDiff) >= 1) {
                    console.warn(`CD Distribution Warning: Expected settle ${expectedSettle}, got ${actualSettle}, diff: ${settleDiff}`);
                }
            }
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
        transaction.set(newPaymentRef, { ...paymentDataBase, id: newPaymentRef.id });
        finalPaymentData = { id: newPaymentRef.id, ...paymentDataBase } as Payment;
        
    });
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


