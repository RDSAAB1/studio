
"use client";

import { useState, useEffect, useMemo } from 'react';

// --- Interface for Hook Props ---
interface UseCashDiscountProps {
    paymentType: string;
    settleAmount: number;
    totalOutstanding: number;
    paymentDate: Date | undefined;
    selectedEntries: Array<{
        dueDate?: string;  // For eligibility
        totalCd?: number;  // CD already applied from previous payments
        originalNetAmount?: number; // Original amount of the entry
        [key: string]: any;
    }>;
    toBePaidAmount: number;
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
}: UseCashDiscountProps) => {
    
    // 1. State Management
    const [cdEnabled, setCdEnabled] = useState(false);
    const [cdPercent, setCdPercent] = useState(2); // Default 2%
    const [cdAt, setCdAt] = useState<'partial_on_paid' | 'on_unpaid_amount' | 'on_full_amount'>('partial_on_paid');

    // 2. Eligibility Check (Memoized)
    // Determines if the payment date meets the due date condition for at least one entry.
    const eligibleForCd = useMemo(() => {
        // Normalize dates to midnight for accurate comparison
        const effectivePaymentDate = paymentDate ? new Date(paymentDate) : new Date();
        effectivePaymentDate.setHours(0, 0, 0, 0);

        // Check if payment is made on or before the due date for ANY selected entry.
        return selectedEntries.some(e => {
            if (!e.dueDate) return false;
            const dueDate = new Date(e.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return effectivePaymentDate <= dueDate;
        });
    }, [selectedEntries, paymentDate]);

    // 3. Effect to Auto-Enable CD
    useEffect(() => {
        // Automatically enable the discount if any entry is eligible
        setCdEnabled(eligibleForCd);
    }, [eligibleForCd]);
    
    // 4. Total CD Already Applied (Memoized)
    // Sums up all the cash discount applied in previous payments for the selected entries.
    const totalCdOnSelectedEntries = useMemo(() => {
        return selectedEntries.reduce((sum, entry) => sum + (entry.totalCd || 0), 0);
    }, [selectedEntries]);


    // 5. Final Calculated CD Amount (Memoized)
    const calculatedCdAmount = useMemo(() => {
        // Pre-check: If disabled or percentage is zero, return 0.
        if (!cdEnabled || cdPercent <= 0) {
            return 0;
        }

        let baseAmountForCd = 0;
        
        // Determine the base amount based on the 'cdAt' setting
        switch (cdAt) {
            case 'partial_on_paid':
                baseAmountForCd = toBePaidAmount;
                break;
            case 'on_unpaid_amount':
                baseAmountForCd = totalOutstanding;
                break;
            case 'on_full_amount': {
                // Calculate total original amount of selected entries
                const totalOriginalAmount = selectedEntries.reduce((sum, entry) => sum + (entry.originalNetAmount || 0), 0);
                // Calculate the total potential CD on the original amount
                const totalPotentialCD = (totalOriginalAmount * cdPercent) / 100;
                // The new CD to be applied is the total potential CD minus what's already been given
                const remainingCD = totalPotentialCD - totalCdOnSelectedEntries;
                // Ensure we don't give a negative CD
                return Math.max(0, remainingCD);
            }
            default:
                baseAmountForCd = 0;
        }
        
        if (isNaN(baseAmountForCd) || baseAmountForCd <= 0) {
            return 0;
        }

        // Calculate the raw CD amount
        let calculatedCd = (baseAmountForCd * cdPercent) / 100;
        
        // Constraint 1: Ensure calculated CD is not negative.
        const finalCd = Math.max(0, calculatedCd);
        
        // Constraint 2: Ensure final CD does not exceed the remaining outstanding balance.
        return Math.min(finalCd, totalOutstanding);

    }, [cdEnabled, cdPercent, cdAt, toBePaidAmount, totalOutstanding, selectedEntries, totalCdOnSelectedEntries]);
    
    // 6. Hook Return Values
    return {
        cdEnabled,
        setCdEnabled,
        cdPercent,
        setCdPercent,
        cdAt, 
        setCdAt,
        calculatedCdAmount, // The final, safe, and adjusted cash discount amount
        eligibleForCd,      // Eligibility status
    };
};
