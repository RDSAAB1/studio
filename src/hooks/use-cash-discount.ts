
"use client";

import { useState, useEffect, useMemo } from 'react';

interface UseCashDiscountProps {
    paymentType: string;
    settleAmount: number; // The amount being settled from outstanding
    totalOutstanding: number;
    paymentDate: Date | undefined;
    selectedEntries: any[];
}

export const useCashDiscount = ({
    paymentType,
    settleAmount,
    totalOutstanding,
    paymentDate,
    selectedEntries = [],
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
        if (!cdEnabled || !eligibleForCd) {
            return 0;
        }

        let baseAmountForCd = 0;
        
        if (paymentType === 'Full') {
            baseAmountForCd = settleAmount; // In full payment, settle amount is the outstanding.
        } else { // Partial
             if (cdAt === 'partial_on_paid') {
                 // CD is on the amount being settled.
                 baseAmountForCd = settleAmount;
            } else if (cdAt === 'on_unpaid_amount') {
                baseAmountForCd = Math.max(0, totalOutstanding - settleAmount);
            } else if (cdAt === 'on_full_amount') {
                baseAmountForCd = totalOutstanding;
            }
        }
        
        if (isNaN(baseAmountForCd) || baseAmountForCd <= 0) {
            return 0;
        }
        
        const calculatedCd = (baseAmountForCd * cdPercent) / 100;
        // The actual CD cannot be more than the amount being settled
        return Math.min(calculatedCd, settleAmount);

    }, [cdEnabled, eligibleForCd, settleAmount, cdPercent, cdAt, totalOutstanding, paymentType]);
    
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
