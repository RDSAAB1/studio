
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bot, ArrowUpDown, Replace } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { usePaymentCombination } from '@/hooks/use-payment-combination';
import { ScrollArea } from '../ui/scroll-area';

interface PaymentCombinationGeneratorProps {
    calcTargetAmount: number;
    setCalcTargetAmount: (value: number) => void;
    minRate: number;
    setMinRate: (value: number) => void;
    maxRate: number;
    setMaxRate: (value: number) => void;
    selectPaymentAmount: (option: { quantity: number; rate: number; calculatedAmount: number; amountRemaining: number; }) => void;
}

export const PaymentCombinationGenerator: React.FC<PaymentCombinationGeneratorProps> = ({
    calcTargetAmount,
    setCalcTargetAmount,
    minRate,
    setMinRate,
    maxRate,
    setMaxRate,
    selectPaymentAmount,
}) => {
    const {
        paymentOptions,
        roundFigureToggle,
        setRoundFigureToggle,
        handleGeneratePaymentOptions,
        requestSort,
        sortedPaymentOptions
    } = usePaymentCombination({ calcTargetAmount, minRate, maxRate });

    const handleSelectAndClose = (option: any) => {
        selectPaymentAmount(option);
    }

    return (
        <div className="space-y-3">
            <div className="p-2 border rounded-lg bg-background flex flex-wrap items-center gap-3">
                <div className="flex items-center space-x-2">
                     <button type="button" onClick={() => setRoundFigureToggle(!roundFigureToggle)} className={cn( "relative w-40 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", roundFigureToggle ? 'bg-primary/20' : 'bg-secondary/20' )} >
                        <span className={cn("absolute right-4 text-xs font-semibold transition-colors duration-300", roundFigureToggle ? 'text-primary' : 'text-muted-foreground')}>On</span>
                        <span className={cn("absolute left-4 text-xs font-semibold transition-colors duration-300", !roundFigureToggle ? 'text-primary' : 'text-muted-foreground')}>Off</span>
                        <div className={cn( "absolute w-[calc(50%+12px)] h-full top-0 rounded-full shadow-lg flex items-center justify-center transition-transform duration-300 ease-in-out bg-card transform", roundFigureToggle ? 'translate-x-[calc(100%-28px)]' : 'translate-x-[-4px]' )}>
                            <div className={cn( "h-full w-full rounded-full flex items-center justify-center transition-colors duration-300", roundFigureToggle ? 'bg-primary' : 'bg-secondary' )}>
                                <span className="text-xs font-bold text-primary-foreground">Round Figure</span>
                            </div>
                        </div>
                    </button>
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-[150px]">
                    <Label className="text-xs whitespace-nowrap">Target Amt</Label>
                    <Input type="number" value={calcTargetAmount} onChange={(e) => setCalcTargetAmount(Number(e.target.value))} className="h-8 text-xs" />
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                    <Label className="text-xs whitespace-nowrap">Min Rate</Label>
                    <Input type="number" value={minRate} onChange={(e) => setMinRate(Number(e.target.value))} className="h-8 text-xs" />
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                    <Label className="text-xs whitespace-nowrap">Max Rate</Label>
                    <Input type="number" value={maxRate} onChange={(e) => setMaxRate(Number(e.target.value))} className="h-8 text-xs" />
                </div>
                 <div className="flex gap-2">
                     <Button onClick={handleGeneratePaymentOptions} size="sm" className="h-8 text-xs"><Bot className="mr-2 h-4 w-4" />Generate</Button>
                 </div>
            </div>

            {paymentOptions.length > 0 && (
                <ScrollArea className="h-48 border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="h-8 p-2"><Button variant="ghost" size="sm" onClick={() => requestSort('quantity')} className="text-xs p-1">Qty <ArrowUpDown className="inline h-3 w-3" /></Button></TableHead>
                                <TableHead className="h-8 p-2"><Button variant="ghost" size="sm" onClick={() => requestSort('rate')} className="text-xs p-1">Rate <ArrowUpDown className="inline h-3 w-3" /></Button></TableHead>
                                <TableHead className="h-8 p-2"><Button variant="ghost" size="sm" onClick={() => requestSort('calculatedAmount')} className="text-xs p-1">Amount <ArrowUpDown className="inline h-3 w-3" /></Button></TableHead>
                                <TableHead className="h-8 p-2"><Button variant="ghost" size="sm" onClick={() => requestSort('amountRemaining')} className="text-xs p-1">Remain <ArrowUpDown className="inline h-3 w-3" /></Button></TableHead>
                                <TableHead className="h-8 p-2">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedPaymentOptions.map((option: any, index: number) => (
                                <TableRow key={index}>
                                    <TableCell className="p-2 text-xs">{option.quantity.toFixed(2)}</TableCell>
                                    <TableCell className="p-2 text-xs">{option.rate}</TableCell>
                                    <TableCell className="p-2 text-xs">{formatCurrency(option.calculatedAmount)}</TableCell>
                                    <TableCell className="p-2 text-xs">{formatCurrency(option.amountRemaining)}</TableCell>
                                    <TableCell className="p-2 text-xs"><Button variant="outline" size="sm" className="h-6 p-1 text-xs" onClick={() => handleSelectAndClose(option)}>Select</Button></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            )}
        </div>
    );
};
