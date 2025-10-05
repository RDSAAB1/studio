
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
        if (!cdEnabled || cdPercent <= 0) {
            return 0;
        }

        let baseAmountForCd = 0;

        // This is the core logic change based on user feedback.
        if (paymentType === 'Full') {
             // For 'Full' payment, CD is calculated on the amount being settled (which is the total outstanding).
            baseAmountForCd = settleAmount;
        } else { // For 'Partial' payment
            switch (cdAt) {
                case 'partial_on_paid':
                    // For 'Partial', CD is calculated on the amount the user intends to pay.
                    baseAmountForCd = toBePaidAmount;
                    break;
                case 'on_unpaid_amount':
                    baseAmountForCd = totalOutstanding - toBePaidAmount;
                    break;
                case 'on_full_amount':
                    baseAmountForCd = totalOutstanding;
                    break;
                default:
                    baseAmountForCd = 0;
            }
        }


        if (isNaN(baseAmountForCd) || baseAmountForCd <= 0) {
            return 0;
        }

        const calculatedCd = (baseAmountForCd * cdPercent) / 100;
        
        // CD cannot be more than the amount it's calculated on, or more than the total outstanding.
        return Math.min(calculatedCd, baseAmountForCd, totalOutstanding);

    }, [cdEnabled, cdPercent, cdAt, toBePaidAmount, totalOutstanding, paymentType, settleAmount]);
    
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
