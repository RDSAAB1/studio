
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

interface UsePaymentCombinationProps {
    targetAmount: number;
    minRate: number;
    maxRate: number;
}

export const usePaymentCombination = ({ 
    targetAmount,
    minRate,
    maxRate,
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
    const currentValuesRef = useRef({ targetAmount, minRate, maxRate });
    useEffect(() => {
        currentValuesRef.current = { targetAmount, minRate, maxRate };
    }, [targetAmount, minRate, maxRate]);

    const handleGeneratePaymentOptions = (overrideValues?: { targetAmount?: number; minRate?: number; maxRate?: number; bagSize?: number }) => {
        // Use override values if provided, otherwise use current values from ref
        const targetAmountValue = overrideValues?.targetAmount !== undefined 
            ? overrideValues.targetAmount
            : currentValuesRef.current.targetAmount;
        const currentMinRate = overrideValues?.minRate !== undefined ? overrideValues.minRate : currentValuesRef.current.minRate;
        const currentMaxRate = overrideValues?.maxRate !== undefined ? overrideValues.maxRate : currentValuesRef.current.maxRate;
        const currentBagSize = overrideValues?.bagSize !== undefined ? overrideValues.bagSize : bagSize;

        if (isNaN(targetAmountValue) || isNaN(currentMinRate) || isNaN(currentMaxRate) || currentMinRate > currentMaxRate || currentMinRate <= 0 || targetAmountValue <= 0) {
            toast({ 
                title: 'Invalid input for payment calculation.', 
                description: currentMinRate <= 0 ? 'Rate must be greater than 0' : targetAmountValue <= 0 ? 'Target amount must be greater than 0' : 'Please check your inputs',
                variant: 'destructive' 
            });
            return;
        }

        // Use target amount directly
        const adjustedTargetAmount = targetAmountValue;

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
        // OPTIMIZED: Iterate over rates instead of quantity to reduce complexity from O(Q*R) to O(R*k)
        // This is much faster for large target amounts and small rates
        
        for (let currentRate = normalizedMinRate; currentRate <= normalizedMaxRate; currentRate += rateStep) {
            // Calculate ideal quantity for this rate to reach target amount
            // q = target / rate
            const idealQ = adjustedTargetAmount / currentRate;
            
            // Determine quantity step (bagSize or 0.10)
            const effectiveQtyStep = (currentBagSize && currentBagSize > 0) ? currentBagSize : 0.10;
            
            // Calculate max multiplier k such that k * step <= idealQ
            const maxK = Math.floor(idealQ / effectiveQtyStep);
            
            // Check a range of k values downwards from maxK to find valid combinations
            // Limit to top 50 closest matches per rate to ensure performance
            const checks = 50;
            const startK = Math.max(1, maxK);
            const endK = Math.max(1, maxK - checks);
            
            for (let k = startK; k >= endK; k--) {
                const q = k * effectiveQtyStep;
                const rawAmount = q * currentRate;
                
                let calculatedAmount: number;
                let bags: number | null = null;
                
                // Calculate bags if bagSize is set
                if (currentBagSize && currentBagSize > 0) {
                     bags = k; // Since q = k * bagSize
                }
                
                if (allowPaiseAmount) {
                    calculatedAmount = Math.round(rawAmount * 100) / 100;
                    
                    if (calculatedAmount > adjustedTargetAmount) continue;
                    if (calculatedAmount <= 0) continue;
                    
                    if (roundFigureToggle) {
                        const rupeeOnly = Math.round(calculatedAmount);
                        if (rupeeOnly % step !== 0) continue;
                    }
                } else {
                    const epsilon = 0.0000001;
                    const roundedAmount = Math.round(rawAmount);
                    const isWholeNumber = Math.abs(rawAmount - roundedAmount) < epsilon;
                    
                    if (!isWholeNumber) continue;
                    
                    calculatedAmount = roundedAmount;
                    
                    if (roundFigureToggle) {
                        if (calculatedAmount % step !== 0) continue;
                    }
                    
                    if (!Number.isInteger(calculatedAmount)) continue;
                    
                    if (calculatedAmount > adjustedTargetAmount) continue;
                    if (calculatedAmount <= 0) continue;
                }
                
                let amountRemaining = adjustedTargetAmount - calculatedAmount;
                amountRemaining = Math.round(amountRemaining * 100) / 100;
                
                if (Math.abs(amountRemaining) <= 0.01) {
                    amountRemaining = 0;
                }
                
                if (amountRemaining < -0.01) continue;
                
                rawOptions.push({
                    quantity: parseFloat(q.toFixed(2)),
                    rate: currentRate,
                    calculatedAmount: calculatedAmount,
                    amountRemaining: amountRemaining,
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
                const aVal = a[sortConfig.key];
                const bVal = b[sortConfig.key];
                const aNum = typeof aVal === 'number' ? aVal : Number.NEGATIVE_INFINITY;
                const bNum = typeof bVal === 'number' ? bVal : Number.NEGATIVE_INFINITY;
                if (aNum < bNum) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aNum > bNum) {
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
