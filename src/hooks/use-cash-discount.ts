
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
}: UseCashDiscountProps) => {
    
    // 1. State Management
    const [cdEnabled, setCdEnabled] = useState(false);
    const [cdPercent, setCdPercent] = useState(2); // Default 2%
    const [cdAt, setCdAt] = useState<'partial_on_paid' | 'on_unpaid_amount' | 'on_full_amount' | 'on_previously_paid_no_cd'>('on_full_amount'); // Changed to on_full_amount for proper CD tracking

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
    
    // 4. Total CD Already Applied (Memoized)
    const totalCdOnSelectedEntries = useMemo(() => {
        return selectedEntries.reduce((sum, entry) => sum + (entry.totalCd || 0), 0);
    }, [selectedEntries]);


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
                const remainingCD = totalPotentialCD - totalCdOnSelectedEntries;
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
