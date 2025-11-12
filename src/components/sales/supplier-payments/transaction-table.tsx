
"use client";

import React, { useMemo } from "react";
import { format, isValid } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface TransactionTableProps {
    suppliers: any[];
    onShowDetails: (entry: any) => void;
    selectedIds: Set<string>;
    onSelectionChange: (ids: Set<string>) => void;
    embed?: boolean;
}

export const TransactionTable = React.memo(
    ({ suppliers, onShowDetails, selectedIds, onSelectionChange, embed = false }: TransactionTableProps) => {
        const sortedSuppliers = useMemo(() => {
            return [...suppliers].sort((a: any, b: any) => {
                const outstandingA = Number((a as any).outstandingForEntry || a.netAmount || 0);
                const outstandingB = Number((b as any).outstandingForEntry || b.netAmount || 0);
                return outstandingB - outstandingA;
            });
        }, [suppliers]);

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

        const tableBody = (
            <ScrollArea className="h-56 text-[12px]">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="p-2 text-[11px] w-10">
                                    <Checkbox
                                        checked={(selectedIds?.size ?? 0) > 0 && selectedIds.size === allSuppliers.length}
                                        onCheckedChange={handleSelectAll}
                                    />
                                </TableHead>
                                <TableHead className="p-2 text-[11px]">SR No</TableHead>
                                <TableHead className="p-2 text-[11px]">Date</TableHead>
                                <TableHead className="p-2 text-[11px] text-right">Original Amt</TableHead>
                                <TableHead className="p-2 text-[11px] text-right">Paid Amt</TableHead>
                                <TableHead className="p-2 text-[11px] text-right">CD Amt</TableHead>
                                <TableHead className="p-2 text-[11px] text-right">Outstanding</TableHead>
                                <TableHead className="p-2 text-[11px] text-center">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedSuppliers.map((entry: any) => {
                                const outstanding = Number((entry as any).outstandingForEntry || entry.netAmount || 0);
                                const hasOutstanding = outstanding > 0.01;
                                const isNegative = outstanding < -0.01;
                                const paymentBreakdown = Array.isArray((entry as any).paymentBreakdown) ? (entry as any).paymentBreakdown : [];

                                return (
                                    <React.Fragment key={entry.id}>
                                        <TableRow
                                            data-state={selectedIds?.has(entry.id) ? 'selected' : ''}
                                        >
                                            <TableCell className="p-2">
                                                <Checkbox
                                                    checked={selectedIds?.has(entry.id)}
                                                    onCheckedChange={() => handleRowSelect(entry.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-mono text-[11px] p-2">{entry.srNo}</TableCell>
                                            <TableCell className="p-2 text-[11px]">
                                                {entry.date && isValid(new Date(entry.date)) ? format(new Date(entry.date), "dd-MMM-yy") : 'N/A'}
                                            </TableCell>
                                            <TableCell className="text-right p-2 text-[11px]">
                                                {formatCurrency(entry.originalNetAmount)}
                                            </TableCell>
                                            <TableCell className="text-right p-2 text-[11px] text-green-600">
                                                {formatCurrency((entry as any).totalPaidForEntry || entry.totalPaid || 0)}
                                            </TableCell>
                                            <TableCell className="text-right p-2 text-[11px] text-blue-600">
                                                {formatCurrency((entry as any).totalCdForEntry || entry.totalCd || 0)}
                                            </TableCell>
                                            <TableCell
                                                className={`text-right p-2 text-[11px] font-semibold ${
                                                    isNegative
                                                        ? 'text-red-600'
                                                        : hasOutstanding
                                                        ? 'text-orange-600'
                                                        : 'text-muted-foreground'
                                                }`}
                                            >
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
                                                            const paymentDate =
                                                                payment.date && isValid(new Date(payment.date))
                                                                    ? format(new Date(payment.date), "dd-MMM-yy")
                                                                    : 'N/A';
                                                            return (
                                                                <div
                                                                    key={`${entry.id}-payment-${idx}`}
                                                                    className="flex flex-wrap items-center justify-between text-[11px] gap-2"
                                                                >
                                                                    <span className="font-medium text-muted-foreground">
                                                                        Payment: {payment.paymentId || 'N/A'}
                                                                        {payment.receiptType ? ` (${payment.receiptType})` : ''}
                                                                    </span>
                                                                    <span className="text-muted-foreground">Date: {paymentDate}</span>
                                                                    <span className="text-green-700 font-semibold">
                                                                        Paid: {formatCurrency(payment.amount || 0)}
                                                                    </span>
                                                                    <span className="text-blue-600 font-semibold">
                                                                        CD: {formatCurrency(payment.cdAmount || 0)}
                                                                    </span>
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
                                    <TableCell colSpan={8} className="text-center text-muted-foreground h-24">
                                        No transactions found for this supplier.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ScrollArea>
        );

        if (embed) {
            return (
            <div className="overflow-hidden rounded-lg border border-border/70 bg-card">
                {tableBody}
            </div>
            );
        }

        return (
            <Card className="mt-3">
                <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm">Outstanding Entries</CardTitle>
                </CardHeader>
                <CardContent className="p-0">{tableBody}</CardContent>
            </Card>
        );
    }
);
