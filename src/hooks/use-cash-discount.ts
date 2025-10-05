
"use client";

import { useState, useEffect, useMemo } from 'react';

interface UseCashDiscountProps {
    paymentType: string;
    settleAmount: number;
    totalOutstanding: number;
    paymentDate: Date | undefined;
    selectedEntries: any[];
    toBePaidAmount: number; // New prop for "To Be Paid" amount
}

export const useCashDiscount = ({
    paymentType,
    settleAmount,
    totalOutstanding,
    paymentDate,
    selectedEntries = [],
    toBePaidAmount,
}: UseCashDiscountProps) => {
    const [cdEnabled, setCdEnabled] = useState(false);
    const [cdPercent, setCdPercent] = useState(2);
    
    // "cdAt" is no longer needed as the logic is now directly tied to paymentType
    // const [cdAt, setCdAt] = useState<'partial_on_paid' | 'on_unpaid_amount' | 'on_full_amount'>('partial_on_paid');

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

    useEffect(() => {
        setCdEnabled(eligibleForCd);
    }, [eligibleForCd]);

    const calculatedCdAmount = useMemo(() => {
        if (!cdEnabled || !eligibleForCd || cdPercent <= 0) {
            return 0;
        }

        let baseAmountForCd = 0;
        
        if (paymentType === 'Full') {
            // In Full payment, CD is always on the settle amount (which is the total outstanding)
            baseAmountForCd = settleAmount;
        } else { // Partial payment
            // As per the new request, CD for partial payments is on the "To Be Paid" amount.
            baseAmountForCd = toBePaidAmount;
        }
        
        if (isNaN(baseAmountForCd) || baseAmountForCd <= 0) {
            return 0;
        }
        
        const calculatedCd = (baseAmountForCd * cdPercent) / 100;
        
        // Final sanity check: CD cannot be more than the amount being paid/settled.
        const maxCdAllowed = paymentType === 'Full' ? settleAmount : toBePaidAmount;
        
        return Math.min(calculatedCd, maxCdAllowed);

    }, [cdEnabled, eligibleForCd, settleAmount, cdPercent, paymentType, toBePaidAmount]);
    
    return {
        cdEnabled,
        setCdEnabled,
        cdPercent,
        setCdPercent,
        calculatedCdAmount,
    };
};
