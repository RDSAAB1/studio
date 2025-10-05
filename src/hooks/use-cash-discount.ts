
"use client";

import { useState, useEffect, useMemo } from 'react';

interface UseCashDiscountProps {
    totalOutstanding: number;
    paymentType: string;
    settleAmount: number; // The amount being settled from outstanding
    selectedEntries: any[];
    paymentDate: Date | undefined;
}

export const useCashDiscount = ({
    totalOutstanding,
    paymentType,
    settleAmount,
    selectedEntries = [],
    paymentDate,
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
        const outstandingAmount = totalOutstanding || 0;

        switch (cdAt) {
            case 'partial_on_paid':
                baseAmountForCd = settleAmount;
                break;
            case 'on_unpaid_amount':
                baseAmountForCd = Math.max(0, outstandingAmount - settleAmount);
                break;
            case 'on_full_amount':
                baseAmountForCd = outstandingAmount;
                break;
            default:
                baseAmountForCd = 0;
        }
        
        if (isNaN(baseAmountForCd) || baseAmountForCd <= 0) {
            return 0;
        }
        
        const calculatedCd = Math.round((baseAmountForCd * cdPercent) / 100);
        // The actual CD cannot be more than the amount being settled
        return Math.min(calculatedCd, settleAmount);

    }, [cdEnabled, eligibleForCd, settleAmount, cdPercent, cdAt, totalOutstanding]);
    
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
