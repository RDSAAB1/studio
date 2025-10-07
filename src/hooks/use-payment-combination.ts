
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
        const step = roundFigureToggle ? 100 : 5;

        for (let q = 0.10; q <= 500; q = parseFloat((q + 0.10).toFixed(2))) {
            for (let currentRate = minRate; currentRate <= maxRate; currentRate += 5) {
                if (currentRate % 5 !== 0) continue;

                const rawAmount = q * currentRate;
                const calculatedAmount = Math.round(rawAmount / step) * step;
                
                if (Math.abs(rawAmount - calculatedAmount) > 0.01) continue;

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
        
        const sortedOptions = rawOptions.sort((a, b) => a.amountRemaining - b.amountRemaining);
        const limitedOptions = sortedOptions.slice(0, 200);

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
