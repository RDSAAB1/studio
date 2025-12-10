"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Payment } from '@/lib/definitions';

interface UseCashDiscountProps {
    paymentType: string;
    settleAmount: number;
    totalOutstanding: number;
    paymentDate: Date | undefined;
    selectedEntries: Array<{
        srNo: string;
        dueDate?: string;
        totalCd?: number;
        originalNetAmount?: number;
        [key: string]: any;
    }>;
    toBePaidAmount: number;
    paymentHistory: Payment[];
    selectedCustomerKey?: string | null;
    editingPayment?: Payment | null;
}

type CdMode =
    | 'partial_on_paid'
    | 'on_unpaid_amount'
    | 'on_full_amount'
    | 'proportional_cd'
    | 'on_previously_paid_no_cd';

interface CdComputationContext {
    amount: number;
    baseAmount: number;
    offset: number;
    maxAvailable: number;
}

const clampNumber = (value: number, min: number, max: number) => {
    if (Number.isNaN(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
};

const roundToRupee = (value: number) => {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value);
};

export const useCashDiscount = ({
    paymentType,
    settleAmount,
    totalOutstanding,
    paymentDate,
    selectedEntries = [],
    toBePaidAmount,
    paymentHistory = [],
    selectedCustomerKey,
    editingPayment,
}: UseCashDiscountProps) => {
    const [cdEnabled, setCdEnabled] = useState(false);
    const [cdPercentState, setCdPercentState] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('cdPercent');
            if (saved !== null) {
                const parsed = parseFloat(saved);
                return Number.isFinite(parsed) ? parsed : 2;
            }
        }
        return 2;
    });
    const [cdAt, setCdAt] = useState<CdMode>('proportional_cd');
    const [manualCdAmount, setManualCdAmount] = useState<number | null>(null);

    const updateCdPercentState = useCallback((value: number) => {
        const sanitized = Number.isFinite(value) ? value : 0;
        setCdPercentState(sanitized);
    }, []);

    const setCdPercent = useCallback(
        (value: number) => {
            setManualCdAmount(null);
            updateCdPercentState(value);
        },
        [updateCdPercentState]
    );

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('cdPercent', cdPercentState.toString());
        }
    }, [cdPercentState]);

    const eligibleForCd = useMemo(() => {
        const effectivePaymentDate = paymentDate ? new Date(paymentDate) : new Date();
        effectivePaymentDate.setHours(0, 0, 0, 0);

        return selectedEntries.some(entry => {
            if (!entry.dueDate) return false;
            const dueDate = new Date(entry.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return effectivePaymentDate <= dueDate;
        });
    }, [selectedEntries, paymentDate]);

    useEffect(() => {
        setCdEnabled(prev => (prev !== eligibleForCd ? eligibleForCd : prev));
    }, [eligibleForCd]);

    const selectedEntriesKey = useMemo(
        () => selectedEntries.map(entry => entry.srNo).sort().join('|'),
        [selectedEntries]
    );

    useEffect(() => {
        setManualCdAmount(null);
    }, [selectedEntriesKey, editingPayment?.id, cdAt, paymentType]);

    useEffect(() => {
        if (!cdEnabled) {
            setManualCdAmount(null);
        }
    }, [cdEnabled]);

    // Only calculate totalCdOnSelectedEntries if CD is enabled or editing payment
    // Skip heavy paymentHistory processing when CD is disabled
    const totalCdOnSelectedEntries = useMemo(() => {
        // Skip calculation if CD is disabled and not editing
        if (!cdEnabled && !editingPayment) {
            return 0;
        }

        if (editingPayment) {
            const selectedSrNos = selectedEntries.map(e => e.srNo);
            // Early return if no selected entries
            if (selectedSrNos.length === 0) {
                return 0;
            }
            
            const otherPaymentsForEntries = paymentHistory.filter(
                payment =>
                    payment.id !== editingPayment.id &&
                    payment.paidFor &&
                    payment.paidFor.some(pf => selectedSrNos.includes(pf.srNo))
            );

            let totalCdFromOthers = 0;
            otherPaymentsForEntries.forEach(payment => {
                if (payment.cdApplied && payment.cdAmount) {
                    const totalPaymentAmount =
                        payment.paidFor?.reduce((sum, pf) => sum + (Number(pf.amount) || 0), 0) || 0;
                    if (totalPaymentAmount <= 0) {
                        return;
                    }
                    const amountForSelected =
                        payment.paidFor?.reduce((sum, pf) => {
                            return selectedSrNos.includes(pf.srNo) ? sum + (Number(pf.amount) || 0) : sum;
                        }, 0) || 0;
                    const proportion = amountForSelected / totalPaymentAmount;
                    totalCdFromOthers += payment.cdAmount * proportion;
                }
            });
            return totalCdFromOthers;
        }

        return selectedEntries.reduce((sum, entry) => sum + (Number(entry.totalCd) || 0), 0);
    }, [selectedEntries, editingPayment, paymentHistory, cdEnabled]);

    // Only calculate CD context if CD is enabled - skip heavy calculations when disabled
    const cdContext: CdComputationContext = useMemo(() => {
        // If CD is not enabled, return zero values immediately (no heavy calculations)
        if (!cdEnabled) {
            return {
                amount: 0,
                baseAmount: 0,
                offset: 0,
                maxAvailable: 0,
            };
        }

        const percent = Number.isFinite(cdPercentState) ? Math.max(cdPercentState, 0) : 0;
        const outstanding = Math.max(totalOutstanding, 0);

        let baseAmount = 0;
        let offset = 0;
        let computedAmount = 0;
        let maxAvailable = outstanding;

        switch (cdAt) {
            case 'partial_on_paid': {
                const isFullSettlement =
                    outstanding > 0 &&
                    (paymentType === 'Full' || settleAmount >= outstanding - 0.01);
                const baseCandidate = isFullSettlement ? outstanding : Math.max(toBePaidAmount, 0);
                baseAmount = baseCandidate;
                maxAvailable = Math.min(maxAvailable, baseCandidate);
                computedAmount = (baseCandidate * percent) / 100;
                break;
            }
            case 'on_unpaid_amount': {
                baseAmount = outstanding;
                maxAvailable = Math.min(maxAvailable, outstanding);
                computedAmount = (baseAmount * percent) / 100;
                break;
            }
            case 'on_full_amount':
            case 'proportional_cd': {
                const totalOriginalAmount = selectedEntries.reduce(
                    (sum, entry) => sum + (Number(entry.originalNetAmount) || 0),
                    0
                );
                baseAmount = totalOriginalAmount;
                offset = totalCdOnSelectedEntries;
                const totalPotential = (totalOriginalAmount * percent) / 100;
                const remaining = Math.max(0, totalPotential - offset);
                computedAmount = remaining;
                maxAvailable = Math.min(maxAvailable, Math.max(0, totalOriginalAmount - offset));
                break;
            }
            case 'on_previously_paid_no_cd': {
                // Only process paymentHistory if CD is enabled and this mode is selected
                const selectedSrNos = selectedEntries.map(e => e.srNo);
                let totalPaidWithoutCD = 0;
                // Only loop through paymentHistory if we have selected entries
                if (selectedSrNos.length > 0) {
                    paymentHistory.forEach(payment => {
                        if (
                            payment.paidFor &&
                            payment.paidFor.some(pf => selectedSrNos.includes(pf.srNo)) &&
                            (!payment.cdApplied || !payment.cdAmount)
                        ) {
                            payment.paidFor.forEach(pf => {
                                if (selectedSrNos.includes(pf.srNo)) {
                                    totalPaidWithoutCD += Number(pf.amount) || 0;
                                }
                            });
                        }
                    });
                }
                baseAmount = totalPaidWithoutCD;
                maxAvailable = Math.min(maxAvailable, totalPaidWithoutCD);
                computedAmount = (baseAmount * percent) / 100;
                break;
            }
            default: {
                baseAmount = 0;
                computedAmount = 0;
                maxAvailable = outstanding;
                break;
            }
        }

        const cappedAmount = clampNumber(computedAmount, 0, outstanding);
        const cappedMaxAvailable = clampNumber(
            maxAvailable,
            0,
            outstanding || Number.MAX_SAFE_INTEGER
        );
        const rupeeMaxAvailable = Math.max(0, Math.floor(cappedMaxAvailable));
        const rupeeAmount = Math.max(
            0,
            Math.min(roundToRupee(cappedAmount), rupeeMaxAvailable)
        );

        return {
            amount: rupeeAmount,
            baseAmount,
            offset,
            maxAvailable: rupeeMaxAvailable,
        };
    }, [
        cdEnabled, // Add cdEnabled to dependencies - skip calculations when disabled
        cdAt,
        cdPercentState,
        paymentType,
        settleAmount,
        totalOutstanding,
        toBePaidAmount,
        selectedEntries,
        totalCdOnSelectedEntries,
        paymentHistory,
    ]);

    useEffect(() => {
        if (manualCdAmount === null) {
            return;
        }
        const maxAvailable = Math.max(0, Math.floor(cdContext.maxAvailable));
        const clamped = clampNumber(roundToRupee(manualCdAmount), 0, maxAvailable);
        if (clamped !== manualCdAmount) {
            setManualCdAmount(clamped);
            return;
        }

        const base = cdContext.baseAmount;
        const offset = cdContext.offset;
        let derivedPercent = 0;

        if (['on_full_amount', 'proportional_cd'].includes(cdAt)) {
            derivedPercent = base > 0 ? ((clamped + offset) / base) * 100 : 0;
        } else {
            derivedPercent = base > 0 ? (clamped / base) * 100 : 0;
        }

        derivedPercent = Number.isFinite(derivedPercent)
            ? parseFloat(derivedPercent.toFixed(2))
            : 0;

        if (derivedPercent !== cdPercentState) {
            updateCdPercentState(derivedPercent);
        }
    }, [manualCdAmount, cdContext, cdAt, cdPercentState, updateCdPercentState]);

    const setCdAmount = useCallback(
        (value: number) => {
            const numeric = Number(value);
            const rounded = roundToRupee(Number.isFinite(numeric) ? numeric : 0);
            const maxAvailable = Math.max(0, Math.floor(cdContext.maxAvailable));
            const sanitized = clampNumber(rounded, 0, maxAvailable);
            setManualCdAmount(sanitized);

            const base = cdContext.baseAmount;
            const offset = cdContext.offset;

            let derivedPercent = 0;
            if (['on_full_amount', 'proportional_cd'].includes(cdAt)) {
                derivedPercent = base > 0 ? ((sanitized + offset) / base) * 100 : 0;
            } else {
                derivedPercent = base > 0 ? (sanitized / base) * 100 : 0;
            }

            derivedPercent = Number.isFinite(derivedPercent)
                ? parseFloat(derivedPercent.toFixed(2))
                : 0;
            updateCdPercentState(derivedPercent);
        },
        [cdAt, cdContext, updateCdPercentState]
    );

    const cdPercent = cdPercentState;

    const calculatedCdAmount = useMemo(() => {
        const amount = manualCdAmount !== null ? manualCdAmount : cdContext.amount;
        return roundToRupee(clampNumber(amount, 0, cdContext.maxAvailable));
    }, [manualCdAmount, cdContext]);

    return {
        cdEnabled,
        setCdEnabled,
        cdPercent,
        setCdPercent,
        cdAt,
        setCdAt,
        calculatedCdAmount,
        eligibleForCd,
        setCdAmount,
    };
};

