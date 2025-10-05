
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
    paymentAmount,
    selectedEntries = [],
    paymentDate,
}: UseCashDiscountProps) => {
    const [cdEnabled, setCdEnabled] = useState(false);
    const [cdPercent, setCdPercent] = useState(2);
    const [cdAt, setCdAt] = useState('partial_on_paid');

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
        const currentPaymentAmount = paymentAmount || 0;
        
        switch (cdAt) {
            case 'on_full_amount':
                 baseAmountForCd = totalOutstanding;
                break;
            case 'on_unpaid_amount':
                const remainingAfterPayment = totalOutstanding - currentPaymentAmount;
                baseAmountForCd = remainingAfterPayment > 0 ? remainingAfterPayment : 0;
                break;
            case 'partial_on_paid':
                baseAmountForCd = currentPaymentAmount;
                break;
            default:
                baseAmountForCd = 0;
        }
        
        if (isNaN(baseAmountForCd) || baseAmountForCd <= 0) {
            return 0;
        }

        return Math.round((baseAmountForCd * cdPercent) / 100);

    }, [cdEnabled, eligibleForCd, cdAt, paymentAmount, totalOutstanding, cdPercent]);
    
    useEffect(() => {
        if (paymentType === 'Full') {
            setCdAt('on_full_amount');
        } else if (paymentType === 'Partial') {
            setCdAt('partial_on_paid');
        }
    }, [paymentType]);


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
