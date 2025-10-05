
"use client";

import { useState, useEffect, useMemo } from 'react';

interface UseCashDiscountProps {
    totalOutstanding: number;
    paymentType: string;
    paymentAmount: number; // The amount being entered by the user to pay
    selectedEntries: any[];
    paymentDate: Date | undefined;
}

export const useCashDiscount = ({
    totalOutstanding,
    paymentType,
    paymentAmount, // This is now treated as the "Settle Amount"
    selectedEntries = [],
    paymentDate,
}: UseCashDiscountProps) => {
    const [cdEnabled, setCdEnabled] = useState(false);
    const [cdPercent, setCdPercent] = useState(2);
    // cdAt is removed as the logic is now simplified and more robust.

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
        if (!cdEnabled || !eligibleForCd) {
            return 0;
        }

        // The base for CD calculation is always the amount being settled (paymentAmount).
        const baseAmountForCd = paymentAmount || 0;
        
        if (isNaN(baseAmountForCd) || baseAmountForCd <= 0) {
            return 0;
        }

        // The CD amount cannot be more than the amount being settled.
        const calculatedCd = Math.round((baseAmountForCd * cdPercent) / 100);
        return Math.min(calculatedCd, baseAmountForCd);

    }, [cdEnabled, eligibleForCd, paymentAmount, cdPercent]);
    
    return {
        cdEnabled,
        setCdEnabled,
        cdPercent,
        setCdPercent,
        calculatedCdAmount,
    };
};
