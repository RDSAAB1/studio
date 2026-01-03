
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
    rsValue?: number;
    setRsValue?: (value: number) => void;
    selectPaymentAmount: (option: PaymentOption) => void;
    combination: {
        paymentOptions: PaymentOption[];
        sortedPaymentOptions: PaymentOption[];
        roundFigureToggle: boolean;
        setRoundFigureToggle: (value: boolean) => void;
        allowPaiseAmount: boolean;
        setAllowPaiseAmount: (value: boolean) => void;
        bagSize?: number;
        setBagSize: (value: number | undefined) => void;
        rateStep: 1 | 5;
        setRateStep: (value: 1 | 5) => void;
        handleGeneratePaymentOptions: () => void;
        requestSort: (key: keyof PaymentOption) => void;
    };
    showResults?: boolean;
    paymentMethod?: 'Cash' | 'Online' | 'RTGS' | 'Gov.';
}

export const PaymentCombinationGenerator: React.FC<PaymentCombinationGeneratorProps> = ({
    calcTargetAmount,
    setCalcTargetAmount,
    minRate,
    setMinRate,
    maxRate,
    setMaxRate,
    rsValue = 0,
    setRsValue,
    selectPaymentAmount,
    combination,
    showResults = true,
    paymentMethod,
}) => {
    const {
        paymentOptions,
        sortedPaymentOptions,
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
    } = combination;

    const handleSelectAndClose = (option: any) => {
        selectPaymentAmount(option);
    }

    // Show Rs and Bag Qty fields only for Gov. payment method
    const showRsAndBagFields = paymentMethod === 'Gov.';
    // Hide Min/Max Rate and Rs fields for Gov. payment method (Gov Rate and Extra Rs/Qtl are used instead)
    const hideRateFields = paymentMethod === 'Gov.';

    return (
        <div className="space-y-3 text-[11px]">
            <div className={cn("grid grid-cols-1 gap-2", 
                hideRateFields ? "sm:grid-cols-1" : showRsAndBagFields ? "sm:grid-cols-5" : "sm:grid-cols-3")}>
                <div className="space-y-1">
                    <Label className="text-[11px] whitespace-nowrap">Target Amt</Label>
                    <Input
                        type="number"
                        value={calcTargetAmount}
                        onChange={(e) => setCalcTargetAmount(Number(e.target.value))}
                        className="h-8 text-[11px]"
                    />
                </div>
                {!hideRateFields && (
                    <>
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
                    </>
                )}
                {/* Rs field - only show for Gov. payment if rate fields are not hidden */}
                {showRsAndBagFields && setRsValue && !hideRateFields && (
                    <div className="space-y-1">
                        <Label className="text-[11px] whitespace-nowrap">Rs</Label>
                        <Input
                            type="number"
                            value={rsValue || ''}
                            onChange={(e) => setRsValue(Number(e.target.value) || 0)}
                            className="h-8 text-[11px]"
                            placeholder="Rs value"
                        />
                    </div>
                )}
                {showRsAndBagFields && (
                    <div className="space-y-1">
                        <Label className="text-[11px] whitespace-nowrap">Bag Qty</Label>
                        <Input
                            type="number"
                            value={bagSize ?? ''}
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                if (!e.target.value || isNaN(v) || v <= 0) {
                                    setBagSize(undefined);
                                } else {
                                    setBagSize(v);
                                }
                            }}
                            className="h-8 text-[11px]"
                            placeholder="Per bag qty"
                        />
                    </div>
                )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setRoundFigureToggle(!roundFigureToggle)}
                        className={cn(
                            "relative w-40 h-7 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 ease-in-out bg-muted/60 border border-border overflow-hidden"
                        )}
                    >
                        {/* Background labels - always visible */}
                        <span className={cn(
                            "absolute left-4 text-[10px] font-semibold transition-colors z-0",
                            !roundFigureToggle ? "text-muted-foreground/70" : "text-foreground"
                        )}>Off</span>
                        <span className={cn(
                            "absolute right-4 text-[10px] font-semibold transition-colors z-0",
                            roundFigureToggle ? "text-muted-foreground/70" : "text-foreground"
                        )}>On</span>
                        
                        {/* Sliding indicator */}
                        <div
                            className={cn(
                                "absolute w-[calc(50%-4px)] h-[calc(100%-8px)] top-1 rounded-full shadow-md flex items-center justify-center transition-transform duration-300 ease-in-out bg-primary z-10",
                                roundFigureToggle ? "left-[calc(50%+2px)]" : "left-[2px]"
                            )}
                            style={{
                                transform: roundFigureToggle ? 'translateX(0)' : 'translateX(0)',
                            }}
                        >
                            <span className="text-[10px] font-bold text-primary-foreground">RF</span>
                        </div>
                    </button>
                    {/* Toggle: Amount in rupees only vs rupees + paise */}
                    <button
                        type="button"
                        onClick={() => setAllowPaiseAmount(!allowPaiseAmount)}
                        className={cn(
                            "relative w-40 h-7 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 ease-in-out bg-muted/60 border border-border overflow-hidden"
                        )}
                    >
                        {/* Background labels - always visible */}
                        <span className={cn(
                            "absolute left-4 text-[10px] font-semibold transition-colors z-0",
                            !allowPaiseAmount ? "text-muted-foreground/70" : "text-foreground"
                        )}>
                            ₹ Only
                        </span>
                        <span className={cn(
                            "absolute right-4 text-[10px] font-semibold transition-colors z-0",
                            allowPaiseAmount ? "text-muted-foreground/70" : "text-foreground"
                        )}>
                            ₹ + Paise
                        </span>
                        
                        {/* Sliding indicator */}
                        <div
                            className={cn(
                                "absolute w-[calc(50%-4px)] h-[calc(100%-8px)] top-1 rounded-full shadow-md flex items-center justify-center transition-transform duration-300 ease-in-out bg-primary z-10",
                                allowPaiseAmount ? "left-[calc(50%+2px)]" : "left-[2px]"
                            )}
                            style={{
                                transform: allowPaiseAmount ? 'translateX(0)' : 'translateX(0)',
                            }}
                        >
                            <span className="text-[10px] font-bold text-primary-foreground">
                                {allowPaiseAmount ? "₹.ps" : "₹"}
                            </span>
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => setRateStep(rateStep === 1 ? 5 : 1)}
                        className={cn(
                            "relative w-40 h-7 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 ease-in-out bg-muted/60 border border-border overflow-hidden"
                        )}
                    >
                        {/* Background labels - always visible on base bar */}
                        <span className={cn(
                            "absolute left-4 text-[10px] font-semibold transition-colors z-0",
                            rateStep === 1 ? "text-muted-foreground/70" : "text-foreground"
                        )}>÷1</span>
                        <span className={cn(
                            "absolute right-4 text-[10px] font-semibold transition-colors z-0",
                            rateStep === 5 ? "text-muted-foreground/70" : "text-foreground"
                        )}>÷5</span>
                        
                        {/* Sliding indicator - moves based on selection */}
                        <div
                            className={cn(
                                "absolute w-[calc(50%-4px)] h-[calc(100%-8px)] top-1 rounded-full shadow-md flex items-center justify-center transition-transform duration-300 ease-in-out bg-primary z-10",
                                rateStep === 5 ? "left-[calc(50%+2px)]" : "left-[2px]"
                            )}
                            style={{
                                transform: rateStep === 5 ? 'translateX(0)' : 'translateX(0)',
                            }}
                        >
                            <span className="text-[10px] font-bold text-primary-foreground">
                                ÷{rateStep}
                            </span>
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
                            Bags
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
                            <TableCell className="p-2 text-[11px]">
                                {option.bags != null ? option.bags : '-'}
                            </TableCell>
                            <TableCell className="p-2 text-[11px]">{option.rate}</TableCell>
                            <TableCell className="p-2 text-[11px]">{formatCurrency(Math.round(option.calculatedAmount))}</TableCell>
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


