
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from '@/components/ui/switch';
import { Bot, ArrowUpDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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

interface PaymentCombinationGeneratorProps {
    calcTargetAmount: number;
    selectPaymentAmount: (option: PaymentOption) => void;
}

export const PaymentCombinationGenerator: React.FC<PaymentCombinationGeneratorProps> = ({
    calcTargetAmount,
    selectPaymentAmount,
}) => {
    const { toast } = useToast();
    const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
    const [minRate, setMinRate] = useState(2300);
    const [maxRate, setMaxRate] = useState(2400);
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
    const [roundFigureToggle, setRoundFigureToggle] = useState(false);

    const handleGeneratePaymentOptions = () => {
        if (isNaN(calcTargetAmount) || isNaN(minRate) || isNaN(maxRate) || minRate > maxRate) {
            toast({ title: 'Invalid input for payment calculation.', variant: 'destructive' });
            return;
        }

        const rawOptions: PaymentOption[] = [];
        const step = roundFigureToggle ? 100 : 5;

        for (let q = 0.10; q <= 200; q = parseFloat((q + 0.10).toFixed(2))) {
            for (let currentRate = minRate; currentRate <= maxRate; currentRate += 5) {
                if (currentRate % 5 !== 0) continue;

                const rawAmount = q * currentRate;
                const calculatedAmount = Math.round(rawAmount / step) * step;
                
                // Only include options where the rounded amount is very close to the raw amount
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

    return (
        <Card>
            <CardHeader className="p-2 pb-1 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Payment Combination Generator</CardTitle>
                <div className="flex items-center gap-2">
                    <Label htmlFor="round-figure-toggle" className="text-xs">Round Figure</Label>
                    <Switch id="round-figure-toggle" checked={roundFigureToggle} onCheckedChange={setRoundFigureToggle} />
                </div>
            </CardHeader>
            <CardContent className="p-2 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="space-y-1">
                        <Label className="text-xs">Target Amount</Label>
                        <Input type="number" value={calcTargetAmount} readOnly className="h-8 text-xs bg-muted" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Min Rate</Label>
                        <Input type="number" value={minRate} onChange={(e) => setMinRate(Number(e.target.value))} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Max Rate</Label>
                        <Input type="number" value={maxRate} onChange={(e) => setMaxRate(Number(e.target.value))} className="h-8 text-xs" />
                    </div>
                </div>
                <Button onClick={handleGeneratePaymentOptions} size="sm" className="h-8 text-xs"><Bot className="mr-2 h-4 w-4" />Generate Combinations</Button>
                <div className="p-2 border rounded-lg bg-background min-h-[100px] max-h-60 overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="h-8 p-1"><Button variant="ghost" size="sm" onClick={() => requestSort('quantity')} className="text-xs p-1">Qty <ArrowUpDown className="inline h-3 w-3" /></Button></TableHead>
                                <TableHead className="h-8 p-1"><Button variant="ghost" size="sm" onClick={() => requestSort('rate')} className="text-xs p-1">Rate <ArrowUpDown className="inline h-3 w-3" /></Button></TableHead>
                                <TableHead className="h-8 p-1"><Button variant="ghost" size="sm" onClick={() => requestSort('calculatedAmount')} className="text-xs p-1">Amount <ArrowUpDown className="inline h-3 w-3" /></Button></TableHead>
                                <TableHead className="h-8 p-1"><Button variant="ghost" size="sm" onClick={() => requestSort('amountRemaining')} className="text-xs p-1">Remain <ArrowUpDown className="inline h-3 w-3" /></Button></TableHead>
                                <TableHead className="h-8 p-1">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedPaymentOptions.length > 0 ? sortedPaymentOptions.map((option: any, index: number) => (
                                <TableRow key={index}>
                                    <TableCell className="p-1 text-xs">{option.quantity.toFixed(2)}</TableCell>
                                    <TableCell className="p-1 text-xs">{option.rate}</TableCell>
                                    <TableCell className="p-1 text-xs">{formatCurrency(option.calculatedAmount)}</TableCell>
                                    <TableCell className="p-1 text-xs">{formatCurrency(option.amountRemaining)}</TableCell>
                                    <TableCell className="p-1 text-xs"><Button variant="outline" size="sm" className="h-6 p-1 text-xs" onClick={() => selectPaymentAmount(option)}>Select</Button></TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-xs h-24">Generated payment combinations will appear here.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};
