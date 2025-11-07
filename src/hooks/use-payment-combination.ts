
"use client";

import { useState, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

type PaymentOption = {
    quantity: number;
    rate: number;
    calculatedAmount: number;
    amountRemaining: number;
};

type SortConfig = {
    key: keyof PaymentOption;
    direction: 'ascending' | 'descending';
};

interface UsePaymentCombinationProps {
    calcTargetAmount: number;
    minRate: number;
    maxRate: number;
}

export const usePaymentCombination = ({ 
    calcTargetAmount,
    minRate,
    maxRate,
}: UsePaymentCombinationProps) => {
    const { toast } = useToast();
    const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
    const [roundFigureToggle, setRoundFigureToggle] = useState(false);

    const handleGeneratePaymentOptions = () => {
        if (isNaN(calcTargetAmount) || isNaN(minRate) || isNaN(maxRate) || minRate > maxRate) {
            toast({ title: 'Invalid input for payment calculation.', variant: 'destructive' });
            return;
        }

        const rawOptions: PaymentOption[] = [];
        const step = roundFigureToggle ? 100 : 1; // finer granularity for better minimal remaining

        // Generate more combinations with finer quantity increments
        // Use smaller quantity steps to generate more combinations
        const qtyStep = 0.05; // Reduced from 0.10 to 0.05 for more combinations
        const maxQty = Math.min(2000, calcTargetAmount / minRate * 1.5); // Dynamic max based on target
        
        for (let q = 0.05; q <= maxQty; q = parseFloat((q + qtyStep).toFixed(2))) {
            for (let currentRate = Math.ceil(minRate); currentRate <= Math.floor(maxRate); currentRate += 1) { // Rate divisible by 1

                const rawAmount = q * currentRate;
                // Round to step for round figure toggle
                const calculatedAmount = roundFigureToggle ? Math.round(rawAmount / step) * step : Math.round(rawAmount * 100) / 100;

                // Allow combinations up to target (no strict filtering)
                if (calculatedAmount > calcTargetAmount) continue;

                const amountRemaining = parseFloat((calcTargetAmount - calculatedAmount).toFixed(2));
                if (amountRemaining < 0) continue;
                
                rawOptions.push({
                    quantity: q,
                    rate: currentRate,
                    calculatedAmount: calculatedAmount,
                    amountRemaining: amountRemaining
                });
            }
        }
        
        // Ensure combinations are unique by (rate, quantity); allow duplicate remaining amounts
        const pairToOption = new Map<string, PaymentOption>();
        for (const opt of rawOptions) {
            const key = `${opt.rate}-${opt.quantity}`;
            if (!pairToOption.has(key)) pairToOption.set(key, opt);
        }
        const uniqueOptions = Array.from(pairToOption.values());
        // Sort by: minimal remaining, then lower rate (kam rate), then higher quantity (zyada qty), then higher calculated amount
        const sortedOptions = uniqueOptions.sort((a, b) => {
            if (a.amountRemaining !== b.amountRemaining) return a.amountRemaining - b.amountRemaining;
            if (a.rate !== b.rate) return a.rate - b.rate; // prefer lower rate
            if (a.quantity !== b.quantity) return b.quantity - a.quantity; // prefer higher quantity
            return b.calculatedAmount - a.calculatedAmount;
        });

        // Take top 500 combinations sorted by priority
        const targetTotal = 500;
        
        // If we have enough options, take top 500
        // If less than 500, take all available
        const limitedOptions = sortedOptions.length >= targetTotal 
            ? sortedOptions.slice(0, targetTotal)
            : sortedOptions;

        setPaymentOptions(limitedOptions);
        setSortConfig(null);
        
        toast({ title: `Generated ${limitedOptions.length} payment options.`, variant: 'success' });
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
        handleGeneratePaymentOptions,
        requestSort,
        sortedPaymentOptions,
    };
};
