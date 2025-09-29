
"use client";

import { useState, useEffect } from 'react';

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
    const [calculatedCdAmount, setCalculatedCdAmount] = useState(0);

    useEffect(() => {
        if (!cdEnabled) {
            setCalculatedCdAmount(0);
            return;
        }

        const effectivePaymentDate = paymentDate ? new Date(paymentDate) : new Date();
        effectivePaymentDate.setHours(0, 0, 0, 0);
        
        // Correctly filter for entries that are eligible for CD based on the payment date.
        // An entry is eligible if the payment is being made on or before its due date.
        const eligibleEntriesForCd = selectedEntries.filter(e => {
            const dueDate = new Date(e.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return effectivePaymentDate <= dueDate;
        });

        let baseAmountForCd = 0;
        
        if (cdAt === 'partial_on_paid') {
            // Only apply CD on paid amount if at least one selected entry is eligible
            if (eligibleEntriesForCd.length > 0) {
                 baseAmountForCd = paymentAmount;
            }
        } else {
            if (cdAt === 'on_unpaid_amount') {
                // CD only on the unpaid amount of eligible entries
                baseAmountForCd = eligibleEntriesForCd.reduce((sum, entry) => sum + (entry.netAmount || 0), 0);
            } else if (cdAt === 'on_full_amount') { // 'on_full_amount'
                 // CD on the full original amount of eligible entries
                baseAmountForCd = eligibleEntriesForCd.reduce((sum, entry) => sum + (entry.originalNetAmount || 0), 0);
            }
        }
        
        setCalculatedCdAmount(Math.round((baseAmountForCd * cdPercent) / 100));

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
