
"use client";

import { useState, useEffect } from 'react';

interface UseCashDiscountProps {
    paymentAmount: number;
    paymentType: string;
    selectedEntries: any[];
    paymentHistory: any[];
}

export const useCashDiscount = ({
    paymentAmount,
    paymentType,
    selectedEntries,
    paymentHistory,
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

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let baseAmountForCd = 0;
        
        if (cdAt === 'partial_on_paid') {
            baseAmountForCd = paymentAmount;
        } else {
            const eligibleEntries = selectedEntries.filter(e => new Date(e.dueDate) >= today);
            if (cdAt === 'on_unpaid_amount') {
                baseAmountForCd = eligibleEntries.reduce((sum, entry) => sum + (entry.netAmount || 0), 0);
            } else {
                const selectedSrNos = new Set(selectedEntries.map(e => e.srNo));
                const paymentsForSelectedEntries = (paymentHistory || []).filter(p => 
                    p.paidFor?.some((pf: any) => selectedSrNos.has(pf.srNo))
                );
                
                let eligiblePaidAmount = 0;
                paymentsForSelectedEntries.forEach(p => {
                    if (!p.cdApplied) {
                        p.paidFor?.forEach((pf: any) => {
                            const originalEntry = selectedEntries.find(s => s.srNo === pf.srNo);
                            if (originalEntry && new Date(p.date) <= new Date(originalEntry.dueDate)) {
                                eligiblePaidAmount += pf.amount;
                            }
                        });
                    }
                });

                if (cdAt === 'on_previously_paid') {
                    baseAmountForCd = eligiblePaidAmount;
                } else if (cdAt === 'on_full_amount') {
                    const eligibleUnpaid = eligibleEntries.reduce((sum, entry) => sum + (entry.netAmount || 0), 0);
                    baseAmountForCd = eligibleUnpaid + eligiblePaidAmount;
                }
            }
        }
        
        setCalculatedCdAmount(Math.round((baseAmountForCd * cdPercent) / 100));

    }, [cdEnabled, cdPercent, cdAt, paymentAmount, selectedEntries, paymentHistory, paymentType]);
    
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
