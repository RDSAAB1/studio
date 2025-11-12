
"use client";

import React from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bot, ArrowUpDown } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import type { PaymentOption } from '@/hooks/use-payment-combination';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PaymentCombinationGeneratorProps {
    calcTargetAmount: number;
    setCalcTargetAmount: (value: number) => void;
    minRate: number;
    setMinRate: (value: number) => void;
    maxRate: number;
    setMaxRate: (value: number) => void;
    selectPaymentAmount: (option: PaymentOption) => void;
    combination: {
        paymentOptions: PaymentOption[];
        sortedPaymentOptions: PaymentOption[];
        roundFigureToggle: boolean;
        setRoundFigureToggle: (value: boolean) => void;
        rateStep: 1 | 5;
        setRateStep: (value: 1 | 5) => void;
        handleGeneratePaymentOptions: () => void;
        requestSort: (key: keyof PaymentOption) => void;
    };
    showResults?: boolean;
}

export const PaymentCombinationGenerator: React.FC<PaymentCombinationGeneratorProps> = ({
    calcTargetAmount,
    setCalcTargetAmount,
    minRate,
    setMinRate,
    maxRate,
    setMaxRate,
    selectPaymentAmount,
    combination,
    showResults = true,
}) => {
    const {
        paymentOptions,
        sortedPaymentOptions,
        roundFigureToggle,
        setRoundFigureToggle,
        rateStep,
        setRateStep,
        handleGeneratePaymentOptions,
        requestSort,
    } = combination;

    const handleSelectAndClose = (option: any) => {
        selectPaymentAmount(option);
    }

    return (
        <div className="space-y-3 text-[11px]">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                    <Label className="text-[11px] whitespace-nowrap">Target Amt</Label>
                    <Input
                        type="number"
                        value={calcTargetAmount}
                        onChange={(e) => setCalcTargetAmount(Number(e.target.value))}
                        className="h-8 text-[11px]"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-[11px] whitespace-nowrap">Min Rate</Label>
                    <Input
                        type="number"
                        value={minRate}
                        onChange={(e) => setMinRate(Number(e.target.value))}
                        className="h-8 text-[11px]"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-[11px] whitespace-nowrap">Max Rate</Label>
                    <Input
                        type="number"
                        value={maxRate}
                        onChange={(e) => setMaxRate(Number(e.target.value))}
                        className="h-8 text-[11px]"
                    />
                </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setRoundFigureToggle(!roundFigureToggle)}
                        className={cn(
                            "relative w-40 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out",
                            roundFigureToggle ? "bg-primary/20" : "bg-secondary/20"
                        )}
                    >
                        <span className={cn("absolute left-4 text-[10px] font-semibold transition-colors", !roundFigureToggle ? "text-primary" : "text-muted-foreground")}>Off</span>
                        <span className={cn("absolute right-4 text-[10px] font-semibold transition-colors", roundFigureToggle ? "text-primary" : "text-muted-foreground")}>On</span>
                        <div
                            className={cn(
                                "absolute w-[calc(50%+12px)] h-full top-0 rounded-full shadow-lg flex items-center justify-center transition-transform duration-300 ease-in-out bg-card",
                                roundFigureToggle ? "translate-x-[calc(100%-26px)]" : "-translate-x-[4px]"
                            )}
                        >
                            <div className="h-full w-full rounded-full flex items-center justify-center transition-colors duration-300 bg-primary text-primary-foreground text-[10px] font-bold">
                                RF
                            </div>
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => setRateStep(rateStep === 1 ? 5 : 1)}
                        className={cn(
                            "relative w-40 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out",
                            rateStep === 5 ? "bg-primary/20" : "bg-secondary/20"
                        )}
                    >
                        <span className={cn("absolute left-4 text-[10px] font-semibold transition-colors", rateStep === 1 ? "text-primary" : "text-muted-foreground")}>÷1</span>
                        <span className={cn("absolute right-4 text-[10px] font-semibold transition-colors", rateStep === 5 ? "text-primary" : "text-muted-foreground")}>÷5</span>
                        <div
                            className={cn(
                                "absolute w-[calc(50%+12px)] h-full top-0 rounded-full shadow-lg flex items-center justify-center transition-transform duration-300 ease-in-out bg-card",
                                rateStep === 5 ? "translate-x-[calc(100%-26px)]" : "-translate-x-[4px]"
                            )}
                        >
                            <div className="h-full w-full rounded-full flex items-center justify-center transition-colors duration-300 bg-primary text-primary-foreground text-[10px] font-bold">
                                ÷{rateStep}
                            </div>
                        </div>
                    </button>
                </div>
                <Button onClick={handleGeneratePaymentOptions} size="sm" className="h-7 px-3 text-[11px]">
                    <Bot className="mr-2 h-3.5 w-3.5" />Generate
                </Button>
            </div>

            {showResults && paymentOptions.length > 0 && (
                <PaymentCombinationResults
                    options={sortedPaymentOptions}
                    requestSort={requestSort}
                    onSelect={handleSelectAndClose}
                />
            )}
        </div>
    );
};

interface PaymentCombinationResultsProps {
    options: PaymentOption[];
    requestSort: (key: keyof PaymentOption) => void;
    onSelect: (option: PaymentOption) => void;
}

export const PaymentCombinationResults: React.FC<PaymentCombinationResultsProps> = ({ options, requestSort, onSelect }) => {
    if (!options.length) return null;

    return (
        <ScrollArea className="h-56 w-full rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="h-8 p-2">
                            <Button variant="ghost" size="sm" onClick={() => requestSort('quantity')} className="p-1 text-[11px]">
                                Qty <ArrowUpDown className="inline h-3 w-3" />
                            </Button>
                        </TableHead>
                        <TableHead className="h-8 p-2">
                            <Button variant="ghost" size="sm" onClick={() => requestSort('rate')} className="p-1 text-[11px]">
                                Rate <ArrowUpDown className="inline h-3 w-3" />
                            </Button>
                        </TableHead>
                        <TableHead className="h-8 p-2">
                            <Button variant="ghost" size="sm" onClick={() => requestSort('calculatedAmount')} className="p-1 text-[11px]">
                                Amount <ArrowUpDown className="inline h-3 w-3" />
                            </Button>
                        </TableHead>
                        <TableHead className="h-8 p-2">
                            <Button variant="ghost" size="sm" onClick={() => requestSort('amountRemaining')} className="p-1 text-[11px]">
                                Remain <ArrowUpDown className="inline h-3 w-3" />
                            </Button>
                        </TableHead>
                        <TableHead className="h-8 p-2 text-[11px]">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {options.map((option, index) => (
                        <TableRow key={index}>
                            <TableCell className="p-2 text-[11px]">{option.quantity.toFixed(2)}</TableCell>
                            <TableCell className="p-2 text-[11px]">{option.rate}</TableCell>
                            <TableCell className="p-2 text-[11px]">{formatCurrency(option.calculatedAmount)}</TableCell>
                            <TableCell className="p-2 text-[11px]">{formatCurrency(option.amountRemaining)}</TableCell>
                            <TableCell className="p-2 text-[11px]">
                                <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => onSelect(option)}>
                                    Select
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </ScrollArea>
    );
};


