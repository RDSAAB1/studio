
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from '@/components/ui/switch';
import { Bot, ArrowUpDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { usePaymentCombination } from '@/hooks/use-payment-combination';

interface PaymentCombinationGeneratorProps {
    calcTargetAmount: number;
    selectPaymentAmount: (option: { quantity: number; rate: number; calculatedAmount: number; amountRemaining: number; }) => void;
}

export const PaymentCombinationGenerator: React.FC<PaymentCombinationGeneratorProps> = ({
    calcTargetAmount,
    selectPaymentAmount,
}) => {
    const {
        paymentOptions,
        minRate,
        setMinRate,
        maxRate,
        setMaxRate,
        roundFigureToggle,
        setRoundFigureToggle,
        handleGeneratePaymentOptions,
        requestSort,
        sortedPaymentOptions
    } = usePaymentCombination({ calcTargetAmount });

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
