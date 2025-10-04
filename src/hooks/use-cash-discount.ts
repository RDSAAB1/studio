
"use client";

import { useState, useEffect, useMemo } from 'react';

interface UseCashDiscountProps {
    totalOutstanding: number;
    paymentType: string;
    selectedEntries: any[];
    paymentDate: Date | undefined;
}

export const useCashDiscount = ({
    totalOutstanding,
    paymentType,
    selectedEntries = [],
    paymentDate,
}: UseCashDiscountProps) => {
    const [cdEnabled, setCdEnabled] = useState(false);
    const [cdPercent, setCdPercent] = useState(2);
    const [cdAt, setCdAt] = useState('on_unpaid_amount');

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
        
        switch (cdAt) {
            case 'on_full_amount':
                 baseAmountForCd = totalOutstanding;
                break;
            case 'on_unpaid_amount':
                baseAmountForCd = totalOutstanding;
                break;
            case 'partial_on_paid':
                // For partial, CD is on the amount being paid from the eligible entries
                const eligibleOutstanding = selectedEntries.reduce((sum, entry) => {
                    const dueDate = new Date(entry.dueDate);
                    const effectiveDate = paymentDate ? new Date(paymentDate) : new Date();
                    return effectiveDate <= dueDate ? sum + (entry.netAmount || 0) : sum;
                }, 0);
                baseAmountForCd = Math.min(totalOutstanding, eligibleOutstanding);
                break;
            default:
                baseAmountForCd = 0;
        }
        
        // Safety check to prevent NaN
        if (isNaN(baseAmountForCd)) {
            return 0;
        }

        return Math.round((baseAmountForCd * cdPercent) / 100);

    }, [cdEnabled, cdPercent, cdAt, selectedEntries, paymentDate, eligibleForCd, totalOutstanding]);
    
    useEffect(() => {
        if (paymentType === 'Full') {
            setCdAt('on_full_amount');
        } else if (paymentType === 'Partial') {
            setCdAt('on_unpaid_amount');
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
