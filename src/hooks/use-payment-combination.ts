
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

export type PaymentOption = {
    quantity: number;
    rate: number;
    calculatedAmount: number;
    amountRemaining: number;
    // Optional: number of bags (when bag size constraint is used)
    bags?: number | null;
};

type SortConfig = {
    key: keyof PaymentOption;
    direction: 'ascending' | 'descending';
};

export type ExtraAmountBase = 'netQty' | 'finalQty' | 'outstanding';

interface UsePaymentCombinationProps {
    calcTargetAmount: number;
    minRate: number;
    maxRate: number;
    rsValue?: number;
    extraAmountBase?: ExtraAmountBase;
    selectedReceipts?: any[]; // For net/final qty calculation
}

export const usePaymentCombination = ({ 
    calcTargetAmount,
    minRate,
    maxRate,
    rsValue = 0,
    extraAmountBase = 'outstanding',
    selectedReceipts = [],
}: UsePaymentCombinationProps) => {
    const { toast } = useToast();
    const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
    const [roundFigureToggle, setRoundFigureToggle] = useState(false);
    // New toggle: allow amount in paise (non-integer), otherwise force whole-rupee amounts only
    const [allowPaiseAmount, setAllowPaiseAmount] = useState(false);
    const [rateStep, setRateStep] = useState<1 | 5>(1);
    // New: bag size for quantity (e.g. 50 kg per bag) to ensure qty / bagSize is whole number
    const [bagSize, setBagSize] = useState<number | undefined>(undefined);

    // Store current values in refs to use latest values in generate function
    const currentValuesRef = useRef({ calcTargetAmount, minRate, maxRate, rsValue, extraAmountBase, selectedReceipts });
    useEffect(() => {
        currentValuesRef.current = { calcTargetAmount, minRate, maxRate, rsValue, extraAmountBase, selectedReceipts };
    }, [calcTargetAmount, minRate, maxRate, rsValue, extraAmountBase, selectedReceipts]);

    const handleGeneratePaymentOptions = (overrideValues?: { calcTargetAmount?: number; minRate?: number; maxRate?: number; rsValue?: number; extraAmountBase?: ExtraAmountBase; selectedReceipts?: any[]; bagSize?: number }) => {
        // Use override values if provided, otherwise use current values from ref
        const calcTargetAmountValue = overrideValues?.calcTargetAmount !== undefined 
            ? overrideValues.calcTargetAmount
            : (typeof currentValuesRef.current.calcTargetAmount === 'function' 
                ? currentValuesRef.current.calcTargetAmount() 
                : currentValuesRef.current.calcTargetAmount);
        const currentMinRate = overrideValues?.minRate !== undefined ? overrideValues.minRate : currentValuesRef.current.minRate;
        const currentMaxRate = overrideValues?.maxRate !== undefined ? overrideValues.maxRate : currentValuesRef.current.maxRate;
        const currentRsValue = overrideValues?.rsValue !== undefined ? overrideValues.rsValue : currentValuesRef.current.rsValue;
        const currentExtraAmountBase = overrideValues?.extraAmountBase !== undefined ? overrideValues.extraAmountBase : currentValuesRef.current.extraAmountBase;
        const currentSelectedReceipts = overrideValues?.selectedReceipts !== undefined ? overrideValues.selectedReceipts : currentValuesRef.current.selectedReceipts;
        const currentBagSize = overrideValues?.bagSize !== undefined ? overrideValues.bagSize : bagSize;

        if (isNaN(calcTargetAmountValue) || isNaN(currentMinRate) || isNaN(currentMaxRate) || currentMinRate > currentMaxRate || currentMinRate <= 0 || calcTargetAmountValue <= 0) {
            toast({ 
                title: 'Invalid input for payment calculation.', 
                description: currentMinRate <= 0 ? 'Rate must be greater than 0' : calcTargetAmountValue <= 0 ? 'Target amount must be greater than 0' : 'Please check your inputs',
                variant: 'destructive' 
            });
            return;
        }

        // Calculate base quantity based on extraAmountBase selection
        let baseQuantity = 0;
        if (currentExtraAmountBase === 'netQty' && currentSelectedReceipts && currentSelectedReceipts.length > 0) {
            // Sum of net weights from selected receipts
            baseQuantity = currentSelectedReceipts.reduce((sum, receipt) => {
                return sum + (Number(receipt.netWeight) || 0);
            }, 0);
        } else if (currentExtraAmountBase === 'finalQty' && currentSelectedReceipts && currentSelectedReceipts.length > 0) {
            // Sum of final weights from selected receipts
            baseQuantity = currentSelectedReceipts.reduce((sum, receipt) => {
                return sum + (Number(receipt.weight) || 0);
            }, 0);
        } else {
            // 'outstanding' - use calcTargetAmount / minRate (default behavior)
            baseQuantity = currentMinRate > 0 ? calcTargetAmountValue / currentMinRate : 0;
        }

        // If Rs value is provided, adjust the targeted amount based on selected base
        let adjustedTargetAmount = calcTargetAmountValue;
        if (currentRsValue && currentRsValue > 0) {
            adjustedTargetAmount = calcTargetAmountValue + (baseQuantity * currentRsValue);
        }

        const rawOptions: PaymentOption[] = [];
        const step = roundFigureToggle ? 100 : 1; // round-figure step in rupees (used when RF toggle is ON)

        // Generate combinations with quantity divisible by 0.10
        const qtyStep = 0.10; // Quantity should be divisible by 0.10
        // Significantly increase max quantity to generate many more options
        // Calculate based on target amount and minimum rate, but allow much larger range
        const baseMaxQty = adjustedTargetAmount / Math.max(currentMinRate, 1);
        const maxQty = Math.min(20000, baseMaxQty * 10); // Much larger multiplier and max for many more combinations

        const normalizedMinRate = Math.ceil(Math.max(currentMinRate, 0) / rateStep) * rateStep;
        const normalizedMaxRate = Math.floor(Math.max(currentMaxRate, normalizedMinRate) / rateStep) * rateStep;

        // Start from 0.10 and increment by 0.10 (quantity divisible by 0.10)
        // Use integer-based loop to avoid floating point precision issues and generate many more options
        const qtyMultiplier = 10; // Multiply by 10 to work with integers (0.10 = 1, 0.20 = 2, etc.)
        const maxQtyInt = Math.floor(maxQty * qtyMultiplier);
        
        // Generate all combinations where quantity is divisible by 0.10
        for (let qtyInt = 1; qtyInt <= maxQtyInt; qtyInt++) {
            // Convert back to decimal (divisible by 0.10)
            const q = qtyInt / qtyMultiplier;
            
            // For quantity q, amount = q * rate will be whole number if rate makes it so
            // We'll check all rates and only include where q * rate is valid as per toggles
            for (let currentRate = normalizedMinRate; currentRate <= normalizedMaxRate; currentRate += rateStep) {

                const rawAmount = q * currentRate;

                let calculatedAmount: number;
                let bags: number | null = null;

                // If bagSize is provided, enforce that q / bagSize is a whole number
                if (currentBagSize && currentBagSize > 0) {
                    const approxBags = q / currentBagSize;
                    const epsilonBags = 0.0000001;
                    const roundedBags = Math.round(approxBags);
                    const isWholeBags = Math.abs(approxBags - roundedBags) < epsilonBags;
                    if (!isWholeBags) continue;
                    bags = roundedBags;
                }

                if (allowPaiseAmount) {
                    // Allow paise: keep amount up to 2 decimal places (₹ + paise)
                    calculatedAmount = Math.round(rawAmount * 100) / 100; // 2 decimal places

                    // Still respect target amount bounds (use adjusted target amount)
                    if (calculatedAmount > adjustedTargetAmount) continue;
                    if (calculatedAmount <= 0) continue;

                    // If round-figure toggle is ON, enforce that the rounded rupee amount is divisible by step (100 or 1)
                    if (roundFigureToggle) {
                        const rupeeOnly = Math.round(calculatedAmount); // nearest whole rupee
                        if (rupeeOnly % step !== 0) continue;
                    }
                } else {
                    // Old behaviour: only accept exact whole-rupee amounts (no paise)
                    // Check if the amount is exactly a whole number (no rounding, exact match only)
                    // Use a small epsilon to handle floating point precision issues
                    const epsilon = 0.0000001;
                    const roundedAmount = Math.round(rawAmount);
                    const isWholeNumber = Math.abs(rawAmount - roundedAmount) < epsilon;
                    
                    // Only include if amount is naturally a whole number (exact, no rounding)
                    if (!isWholeNumber) continue;
                    
                    // Get the exact whole number amount
                    calculatedAmount = roundedAmount;
                    
                    // If round figure toggle is on, check if it's divisible by 100 (exact, no rounding)
                    if (roundFigureToggle) {
                        if (calculatedAmount % step !== 0) continue; // Only include if exactly divisible by step
                    }

                    // Ensure it's a proper integer
                    if (!Number.isInteger(calculatedAmount)) continue;
                    
                    // Allow combinations up to target (no strict filtering - allow all valid combinations)
                    // Use adjusted target amount
                    if (calculatedAmount > adjustedTargetAmount) continue;
                    if (calculatedAmount <= 0) continue;
                }

                // Calculate remaining amount (can be decimal when paise is allowed)
                // Use adjusted target amount
                let amountRemaining = adjustedTargetAmount - calculatedAmount;
                
                // Round to 2 decimal places to handle floating point precision
                amountRemaining = Math.round(amountRemaining * 100) / 100;
                
                // IMPORTANT: If amountRemaining is very close to 0 (within 0.01), set it to exactly 0
                // This ensures exact matches are properly identified
                if (Math.abs(amountRemaining) <= 0.01) {
                    amountRemaining = 0;
                }
                
                // Only filter out truly negative values (less than -0.01)
                // This ensures options with amountRemaining === 0 are included
                if (amountRemaining < -0.01) continue;
                
                rawOptions.push({
                    quantity: parseFloat(q.toFixed(2)), // Ensure 2 decimal places (0.10, 0.20, etc.)
                    rate: currentRate,
                    calculatedAmount: calculatedAmount,
                    amountRemaining: amountRemaining, // Already rounded above
                    bags,
                });
            }
        }
        
        // Ensure combinations are unique by (rate, quantity); allow duplicate remaining amounts
        // When paise is not allowed, all amounts are already exact whole numbers (no rounding was done beyond integer)
        const pairToOption = new Map<string, PaymentOption>();
        for (const opt of rawOptions) {
            // If paise is not allowed, verify it's still a proper integer (should already be, but double-check)
            if (!allowPaiseAmount && !Number.isInteger(opt.calculatedAmount)) continue;
            
            const key = `${opt.rate}-${opt.quantity}`;
            if (!pairToOption.has(key)) {
                pairToOption.set(key, opt);
            }
        }
        // All options are already exact whole numbers, no conversion needed
        const uniqueOptions = Array.from(pairToOption.values());
        // Sort by: minimal remaining, then lower rate (kam rate), then higher quantity (zyada qty), then higher calculated amount
        const sortedOptions = uniqueOptions.sort((a, b) => {
            if (a.amountRemaining !== b.amountRemaining) return a.amountRemaining - b.amountRemaining;
            if (a.rate !== b.rate) return a.rate - b.rate; // prefer lower rate
            if (a.quantity !== b.quantity) return b.quantity - a.quantity; // prefer higher quantity
            return b.calculatedAmount - a.calculatedAmount;
        });

        // Take top combinations sorted by priority
        // Increase limit to show more options
        const targetTotal = 2000; // Increased from 500 to 2000 for more options
        
        // If we have enough options, take top 2000
        // If less than 2000, take all available
        const limitedOptions = sortedOptions.length >= targetTotal 
            ? sortedOptions.slice(0, targetTotal)
            : sortedOptions;

        setPaymentOptions(limitedOptions);
        setSortConfig(null);
        
        // Removed unnecessary toast message
    };
    
    const requestSort = (key: keyof PaymentOption) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedPaymentOptions = useMemo(() => {
        let sortableItems = [...paymentOptions];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [paymentOptions, sortConfig]);

    return {
        paymentOptions,
        roundFigureToggle,
        setRoundFigureToggle,
        allowPaiseAmount,
        setAllowPaiseAmount,
        bagSize,
        setBagSize,
        rateStep,
        setRateStep,
        handleGeneratePaymentOptions,
        requestSort,
        sortedPaymentOptions,
    };
};
