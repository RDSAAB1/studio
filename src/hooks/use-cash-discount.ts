
"use client";

import { useState, useEffect, useMemo } from 'react';

interface UseCashDiscountProps {
    paymentType: string;
    settleAmount: number;
    totalOutstanding: number;
    paymentDate: Date | undefined;
    selectedEntries: any[];
    toBePaidAmount: number;
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
    const [cdAt, setCdAt] = useState<'partial_on_paid' | 'on_unpaid_amount' | 'on_full_amount'>('partial_on_paid');

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
             // In Full payment, CD is based on the Settle Amount.
             baseAmountForCd = settleAmount;
        } else { // Partial payment
             // In Partial payment, CD is based on the "To Be Paid" amount.
             baseAmountForCd = toBePaidAmount;
        }

        if (isNaN(baseAmountForCd) || baseAmountForCd <= 0) {
            return 0;
        }

        const calculatedCd = (baseAmountForCd * cdPercent) / 100;
        
        // Final sanity check: CD cannot be more than the amount it's based on.
        return Math.min(calculatedCd, baseAmountForCd);

    }, [cdEnabled, eligibleForCd, settleAmount, cdPercent, paymentType, toBePaidAmount]);
    
    return {
        cdEnabled,
        setCdEnabled,
        cdPercent,
        setCdPercent,
        cdAt, 
        setCdAt,
        calculatedCdAmount,
    };
};
