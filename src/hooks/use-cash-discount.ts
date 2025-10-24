
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { Payment } from '@/lib/definitions';

// --- Interface for Hook Props ---
interface UseCashDiscountProps {
    paymentType: string;
    settleAmount: number;
    totalOutstanding: number;
    paymentDate: Date | undefined;
    selectedEntries: Array<{
        srNo: string;
        dueDate?: string;  // For eligibility
        totalCd?: number;  // CD already applied from previous payments
        originalNetAmount?: number; // Original amount of the entry
        [key: string]: any;
    }>;
    toBePaidAmount: number;
    paymentHistory: Payment[]; // Pass full payment history for calculations
    selectedCustomerKey?: string | null; // Pass the key/ID of the currently selected supplier
    editingPayment?: Payment | null; // Pass the payment being edited to exclude it from calculations
}

// --- The Custom Hook: useCashDiscount ---
export const useCashDiscount = ({
    // Destructure all required props
    paymentType, // Not used in calculation logic, but part of context
    settleAmount, // Not used in calculation logic
    totalOutstanding, // Current unpaid amount
    paymentDate, // Date of current payment
    selectedEntries = [], // List of items being paid
    toBePaidAmount, // Amount user is paying now
    paymentHistory = [],
    selectedCustomerKey,
    editingPayment, // Payment being edited to exclude from calculations
}: UseCashDiscountProps) => {
    
    // 1. State Management with Persistence
    const [cdEnabled, setCdEnabled] = useState(false);
    
    // CD Percent with localStorage persistence
    const [cdPercent, setCdPercent] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('cdPercent');
            return saved ? parseFloat(saved) : 2; // Default 2%
        }
        return 2;
    });
    
    const [cdAt, setCdAt] = useState<'partial_on_paid' | 'on_unpaid_amount' | 'on_full_amount' | 'on_previously_paid_no_cd'>('on_full_amount'); // Changed to on_full_amount for proper CD tracking

    // Save CD percent to localStorage when it changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('cdPercent', cdPercent.toString());
        }
    }, [cdPercent]);

    // 2. Eligibility Check (Memoized)
    const eligibleForCd = useMemo(() => {
        const effectivePaymentDate = paymentDate ? new Date(paymentDate) : new Date();
        effectivePaymentDate.setHours(0, 0, 0, 0);

        return selectedEntries.some(e => {
            if (!e.dueDate) return false;
            const dueDate = new Date(e.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return effectivePaymentDate <= dueDate;
        });
    }, [selectedEntries, paymentDate]);

    // 3. Effect to Auto-Enable CD based on eligibility
    useEffect(() => {
        // Only update if different to prevent infinite loop
        setCdEnabled(prev => {
            if (prev !== eligibleForCd) {
                return eligibleForCd;
            }
            return prev;
        });
    }, [eligibleForCd]);
    
    // 4. Total CD Already Applied (Memoized) - Exclude editing payment
    const totalCdOnSelectedEntries = useMemo(() => {
        if (editingPayment) {
            // During editing, calculate CD excluding the payment being edited
            // This ensures fresh CD calculation based on total invoice value
            const selectedSrNos = selectedEntries.map(e => e.srNo);
            
            // Find all payments for these entries except the one being edited
            const otherPaymentsForEntries = paymentHistory.filter(p => 
                p.id !== editingPayment.id && 
                p.paidFor && 
                p.paidFor.some(pf => selectedSrNos.includes(pf.srNo))
            );
            
            // Calculate total CD from other payments
            let totalCdFromOtherPayments = 0;
            otherPaymentsForEntries.forEach(payment => {
                if (payment.cdApplied && payment.cdAmount) {
                    // Calculate proportion of this payment that applies to selected entries
                    const totalPaymentAmount = payment.paidFor?.reduce((sum, pf) => sum + pf.amount, 0) || 0;
                    const amountForSelectedEntries = payment.paidFor?.reduce((sum, pf) => {
                        return selectedSrNos.includes(pf.srNo) ? sum + pf.amount : sum;
                    }, 0) || 0;
                    
                    if (totalPaymentAmount > 0) {
                        const proportion = amountForSelectedEntries / totalPaymentAmount;
                        totalCdFromOtherPayments += payment.cdAmount * proportion;
                    }
                }
            });
            
            console.log('CD Calculation - Excluding editing payment:', {
                editingPaymentId: editingPayment.id,
                selectedSrNos,
                otherPaymentsCount: otherPaymentsForEntries.length,
                totalCdFromOtherPayments,
                originalTotalCd: selectedEntries.reduce((sum, entry) => sum + (entry.totalCd || 0), 0)
            });
            
            return totalCdFromOtherPayments;
        }
        
        // Normal mode: use the total CD from selected entries
        return selectedEntries.reduce((sum, entry) => sum + (entry.totalCd || 0), 0);
    }, [selectedEntries, editingPayment, paymentHistory]);


    // 5. Final Calculated CD Amount (Memoized)
    const calculatedCdAmount = useMemo(() => {
        console.log('CD Calculation:', {
            cdEnabled,
            cdPercent,
            cdAt,
            toBePaidAmount,
            totalOutstanding,
            selectedEntriesCount: selectedEntries.length,
            totalCdOnSelectedEntries
        });
        
        if (!cdEnabled || cdPercent <= 0) {
            return 0;
        }

        let baseAmountForCd = 0;
        
        switch (cdAt) {
            case 'partial_on_paid':
                baseAmountForCd = toBePaidAmount;
                break;
            case 'on_unpaid_amount':
                baseAmountForCd = totalOutstanding;
                break;
            case 'on_full_amount': {
                const totalOriginalAmount = selectedEntries.reduce((sum, entry) => sum + (entry.originalNetAmount || 0), 0);
                const totalPotentialCD = (totalOriginalAmount * cdPercent) / 100;
                
                // During editing, ignore previous CD to allow fresh calculation
                // This ensures CD is calculated based on total invoice value, not remaining CD
                const remainingCD = totalPotentialCD - totalCdOnSelectedEntries;
                
                console.log('CD Calculation - on_full_amount:', {
                    totalOriginalAmount,
                    cdPercent,
                    totalPotentialCD,
                    totalCdOnSelectedEntries,
                    remainingCD,
                    finalCD: Math.max(0, remainingCD)
                });
                
                return Math.max(0, remainingCD);
            }
             case 'on_previously_paid_no_cd': {
                console.log('4th Option - On Paid Amount (No CD) - Starting calculation:', {
                    selectedCustomerKey,
                    selectedEntriesCount: selectedEntries.length,
                    selectedEntries: selectedEntries.map(e => e.srNo),
                    paymentHistoryLength: paymentHistory.length,
                    cdEnabled,
                    cdPercent
                });
                
                if (!selectedCustomerKey || selectedEntries.length === 0) {
                    console.log('4th Option - No selectedCustomerKey or selectedEntries, returning 0');
                    return 0;
                }
                
                // Get all serial numbers from selected entries
                const selectedSrNos = selectedEntries.map(e => e.srNo);
                console.log('4th Option - Selected Serial Numbers:', selectedSrNos);
                
                // Find all payments that were made for these specific serial numbers
                const paymentsForSelectedEntries = paymentHistory.filter(p => 
                    p.paidFor && p.paidFor.some(pf => selectedSrNos.includes(pf.srNo))
                );
                
                console.log('4th Option - Payments for selected entries:', {
                    totalPayments: paymentsForSelectedEntries.length,
                    payments: paymentsForSelectedEntries.map(p => ({
                        id: p.id,
                        amount: p.amount,
                        cdApplied: p.cdApplied,
                        cdAmount: p.cdAmount,
                        paidFor: p.paidFor?.map(pf => ({
                            srNo: pf.srNo,
                            amount: pf.amount
                        }))
                    }))
                });
                
                // Filter those payments to find ones where no CD was applied
                const previousPaymentsWithoutCD = paymentsForSelectedEntries.filter(p => 
                    !p.cdApplied || p.cdAmount === 0
                );
                
                // Calculate the total amount paid for selected entries without CD
                let totalPaidWithoutCD = 0;
                previousPaymentsWithoutCD.forEach(payment => {
                    payment.paidFor?.forEach(pf => {
                        if (selectedSrNos.includes(pf.srNo)) {
                            totalPaidWithoutCD += pf.amount;
                        }
                    });
                });
                
                baseAmountForCd = totalPaidWithoutCD;
                
                // Debug log
                console.log('4th Option - CD on previously paid (no CD):', {
                    selectedSrNos,
                    totalPaymentsForEntries: paymentsForSelectedEntries.length,
                    paymentsWithoutCD: previousPaymentsWithoutCD.length,
                    paymentsWithoutCDDetails: previousPaymentsWithoutCD.map(p => ({
                        id: p.id,
                        amount: p.amount,
                        cdApplied: p.cdApplied,
                        cdAmount: p.cdAmount,
                        paidFor: p.paidFor?.filter(pf => selectedSrNos.includes(pf.srNo))
                    })),
                    totalPaidWithoutCD,
                    baseAmountForCd,
                    cdPercent,
                    calculatedCD: (baseAmountForCd * cdPercent) / 100
                });
                break;
            }
            default:
                baseAmountForCd = 0;
        }
        
        if (isNaN(baseAmountForCd) || baseAmountForCd <= 0) {
            return 0;
        }

        let calculatedCd = (baseAmountForCd * cdPercent) / 100;
        
        const finalCd = Math.max(0, calculatedCd);
        
        return Math.min(finalCd, totalOutstanding);

    }, [cdEnabled, cdPercent, cdAt, toBePaidAmount, totalOutstanding, selectedEntries, totalCdOnSelectedEntries, paymentHistory, selectedCustomerKey]);
    
    return {
        cdEnabled,
        setCdEnabled,
        cdPercent,
        setCdPercent,
        cdAt, 
        setCdAt,
        calculatedCdAmount,
        eligibleForCd,
    };
};
