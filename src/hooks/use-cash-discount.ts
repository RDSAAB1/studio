
"use client";

import { useState, useEffect, useMemo } from 'react';

interface UseCashDiscountProps {
    paymentAmount: number;
    paymentType: string;
    selectedEntries: any[];
    paymentHistory: any[];
    paymentDate: Date | undefined; // Added paymentDate
}

export const useCashDiscount = ({
    paymentAmount,
    paymentType,
    selectedEntries = [], // Fallback to an empty array
    paymentHistory,
    paymentDate, // Receive paymentDate
}: UseCashDiscountProps) => {
    const [cdEnabled, setCdEnabled] = useState(false);
    const [cdPercent, setCdPercent] = useState(2);
    const [cdAt, setCdAt] = useState('on_unpaid_amount');

    const eligibleForCd = useMemo(() => {
        const effectivePaymentDate = paymentDate ? new Date(paymentDate) : new Date();
        effectivePaymentDate.setHours(0, 0, 0, 0);

        return selectedEntries.some(e => {
            const dueDate = new Date(e.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return effectivePaymentDate <= dueDate;
        });
    }, [selectedEntries, paymentDate]);

    useEffect(() => {
        setCdEnabled(eligibleForCd);
    }, [eligibleForCd]);

    const calculatedCdAmount = useMemo(() => {
        if (!cdEnabled) {
            return 0;
        }

        const effectivePaymentDate = paymentDate ? new Date(paymentDate) : new Date();
        effectivePaymentDate.setHours(0, 0, 0, 0);

        const eligibleEntriesForCd = selectedEntries.filter(e => {
            const dueDate = new Date(e.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return effectivePaymentDate <= dueDate;
        });
        
        let baseAmountForCd = 0;
        
        if (cdAt === 'partial_on_paid') {
            if (eligibleEntriesForCd.length > 0) {
                baseAmountForCd = paymentAmount;
            }
        } else {
            if (cdAt === 'on_unpaid_amount') {
                baseAmountForCd = eligibleEntriesForCd.reduce((sum, entry) => sum + (entry.netAmount || 0), 0);
            } else if (cdAt === 'on_full_amount') {
                baseAmountForCd = eligibleEntriesForCd.reduce((sum, entry) => sum + (entry.originalNetAmount || 0), 0);
            }
        }
        
        return Math.round((baseAmountForCd * cdPercent) / 100);

    }, [cdEnabled, cdPercent, cdAt, paymentAmount, selectedEntries, paymentDate]);
    
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
