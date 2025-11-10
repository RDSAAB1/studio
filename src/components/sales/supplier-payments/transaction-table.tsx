
"use client";

import React, { useMemo } from 'react';
import { format, isValid } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Checkbox } from '@/components/ui/checkbox';

export const TransactionTable = React.memo(({ suppliers, onShowDetails, selectedIds, onSelectionChange }: any) => {
    
    // Sort suppliers by outstanding amount (descending - highest outstanding first)
    // This ensures purchases with remaining outstanding are shown at the top
    const sortedSuppliers = useMemo(() => {
        return [...suppliers].sort((a: any, b: any) => {
            const outstandingA = Number((a as any).outstandingForEntry || a.netAmount || 0);
            const outstandingB = Number((b as any).outstandingForEntry || b.netAmount || 0);
            return outstandingB - outstandingA; // Descending order
        });
    }, [suppliers]);

    // Show all entries, including those with 0 or negative outstanding
    const allSuppliers = useMemo(() => sortedSuppliers, [sortedSuppliers]);

    const handleSelectAll = (checked: boolean) => {
        const allEntryIds = allSuppliers.map((c: any) => c.id);
        onSelectionChange(checked ? new Set(allEntryIds) : new Set());
    };

    const handleRowSelect = (id: string) => {
        const newSelectedIds = new Set(selectedIds);
        if (newSelectedIds.has(id)) {
            newSelectedIds.delete(id);
        } else {
            newSelectedIds.add(id);
        }
        onSelectionChange(newSelectedIds);
    };

    return (
        <Card className="mt-3">
            <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Outstanding Entries</CardTitle></CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-40">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="p-2 text-xs w-10">
                                        <Checkbox
                                            checked={(selectedIds?.size ?? 0) > 0 && selectedIds.size === allSuppliers.length}
                                            onCheckedChange={handleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead className="p-2 text-xs">SR No</TableHead>
                                    <TableHead className="p-2 text-xs">Date</TableHead>
                                    <TableHead className="p-2 text-xs text-right">Original Amt</TableHead>
                                    <TableHead className="p-2 text-xs text-right">Paid Amt</TableHead>
                                    <TableHead className="p-2 text-xs text-right">CD Amt</TableHead>
                                    <TableHead className="p-2 text-xs text-right">Outstanding</TableHead>
                                    <TableHead className="p-2 text-xs text-center">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedSuppliers.map((entry: any) => {
                                    const outstanding = Number((entry as any).outstandingForEntry || entry.netAmount || 0);
                                    const hasOutstanding = outstanding > 0.01; // Has remaining outstanding
                                    const isNegative = outstanding < -0.01; // Negative outstanding (overpaid)
                                    const paymentBreakdown = Array.isArray((entry as any).paymentBreakdown) ? (entry as any).paymentBreakdown : [];
                                    
                                    return (
                                        <React.Fragment key={entry.id}>
                                            <TableRow 
                                                data-state={selectedIds?.has(entry.id) ? 'selected' : ''}
                                                className={hasOutstanding ? 'bg-orange-50/50 hover:bg-orange-100/50' : ''}
                                            >
                                                <TableCell className="p-2">
                                                    <Checkbox 
                                                        checked={selectedIds?.has(entry.id)} 
                                                        onCheckedChange={() => handleRowSelect(entry.id)}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-mono text-xs p-2">{entry.srNo}</TableCell>
                                                <TableCell className="p-2 text-xs">{entry.date && isValid(new Date(entry.date)) ? format(new Date(entry.date), "dd-MMM-yy") : 'N/A'}</TableCell>
                                                <TableCell className="text-right p-2 text-xs">{formatCurrency(entry.originalNetAmount)}</TableCell>
                                                <TableCell className="text-right p-2 text-xs text-green-600">{formatCurrency((entry as any).totalPaidForEntry || entry.totalPaid || 0)}</TableCell>
                                                <TableCell className="text-right p-2 text-xs text-blue-600">{formatCurrency((entry as any).totalCdForEntry || entry.totalCd || 0)}</TableCell>
                                                <TableCell className={`text-right p-2 text-xs font-bold ${
                                                    isNegative 
                                                        ? 'text-red-600' 
                                                        : hasOutstanding 
                                                            ? 'text-orange-600' 
                                                            : 'text-muted-foreground'
                                                }`}>
                                                    {formatCurrency(outstanding)}
                                                    {hasOutstanding && (
                                                        <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 border-orange-300 text-orange-600">
                                                            Due
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center p-0">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onShowDetails(entry)}>
                                                        <Info className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                            {paymentBreakdown.length > 0 && (
                                                <TableRow className="bg-muted/20">
                                                    <TableCell colSpan={8} className="p-2">
                                                        <div className="space-y-1">
                                                            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                                                Payment History
                                                            </div>
                                                            {paymentBreakdown.map((payment: any, idx: number) => {
                                                                const paymentDate = payment.date && isValid(new Date(payment.date))
                                                                    ? format(new Date(payment.date), "dd-MMM-yy")
                                                                    : 'N/A';
                                                                return (
                                                                    <div key={`${entry.id}-payment-${idx}`} className="flex flex-wrap items-center justify-between text-[11px] gap-2">
                                                                        <span className="font-medium text-muted-foreground">
                                                                            Payment: {payment.paymentId || 'N/A'}
                                                                            {payment.receiptType ? ` (${payment.receiptType})` : ''}
                                                                        </span>
                                                                        <span className="text-muted-foreground">Date: {paymentDate}</span>
                                                                        <span className="text-green-700 font-semibold">Paid: {formatCurrency(payment.amount || 0)}</span>
                                                                        <span className="text-blue-600 font-semibold">CD: {formatCurrency(payment.cdAmount || 0)}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                                {sortedSuppliers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center text-muted-foreground h-24">No transactions found for this supplier.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
});
