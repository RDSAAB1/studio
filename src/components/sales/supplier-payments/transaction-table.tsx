
"use client";

import React, { useMemo, useState } from "react";
import { format, isValid } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Info, Loader2, Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TransactionTableProps {
    suppliers: any[];
    onShowDetails: (entry: any) => void;
    selectedIds: Set<string>;
    onSelectionChange: (ids: Set<string>) => void;
    embed?: boolean;
    onEditEntry?: (entry: any) => void;
    activeTab?: string;
    onTabChange?: (tab: string) => void;
}

export const TransactionTable = React.memo(
    ({ suppliers, onShowDetails, selectedIds, onSelectionChange, embed = false, onEditEntry, activeTab: externalActiveTab, onTabChange }: TransactionTableProps) => {
        const [internalActiveTab, setInternalActiveTab] = useState("outstanding");
        const activeTab = externalActiveTab ?? internalActiveTab;
        const setActiveTab = onTabChange ?? setInternalActiveTab;

        // Helper function to extract numeric part from serial number for sorting
        const getSerialNumberForSort = (entry: any): number => {
            const srNo = entry.srNo || '';
            if (!srNo) return 0;
            // Extract numeric part from serial number (e.g., "S00001" -> 1, "00001" -> 1)
            const numericMatch = srNo.toString().match(/\d+/);
            return numericMatch ? parseInt(numericMatch[0], 10) : 0;
        };

        const sortedSuppliers = useMemo(() => {
            return [...suppliers].sort((a: any, b: any) => {
                // Sort by serial number (descending - high to low)
                const srNoA = getSerialNumberForSort(a);
                const srNoB = getSerialNumberForSort(b);
                return srNoB - srNoA; // Descending order
            });
        }, [suppliers]);

        // Categorize transactions
        const { outstandingTransactions, runningTransactions, profitableTransactions, paidTransactions } = useMemo(() => {
            const outstanding = sortedSuppliers.filter((t: any) => {
                const totalPaid = (t.totalPaidForEntry || t.totalPaid || 0);
                return totalPaid === 0 && (t.originalNetAmount || 0) > 0;
            });
            
            const paid = sortedSuppliers.filter((t: any) => {
                const outstanding = Number(t.outstandingForEntry || t.netAmount || 0);
                return outstanding < 1;
            });
            
            const profitable = sortedSuppliers.filter((t: any) => {
                const outstanding = Number(t.outstandingForEntry || t.netAmount || 0);
                return outstanding >= 1 && outstanding < 200;
            });
            
            const running = sortedSuppliers.filter((t: any) => {
                const outstanding = Number(t.outstandingForEntry || t.netAmount || 0);
                const totalPaid = (t.totalPaidForEntry || t.totalPaid || 0);
                return outstanding >= 200 && totalPaid > 0;
            });

            return { outstandingTransactions: outstanding, runningTransactions: running, profitableTransactions: profitable, paidTransactions: paid };
        }, [sortedSuppliers]);

        // Get filtered suppliers based on active tab
        const filteredSuppliers = useMemo(() => {
            switch (activeTab) {
                case "all":
                    return sortedSuppliers;
                case "outstanding":
                    return outstandingTransactions;
                case "running":
                    return runningTransactions;
                case "profitable":
                    return profitableTransactions;
                case "paid":
                    return paidTransactions;
                default:
                    return sortedSuppliers;
            }
        }, [activeTab, outstandingTransactions, runningTransactions, profitableTransactions, paidTransactions, sortedSuppliers]);

        // Infinite scroll pagination
        const { visibleItems, hasMore, isLoading, scrollRef } = useInfiniteScroll(filteredSuppliers, {
            totalItems: filteredSuppliers.length,
            initialLoad: 30,
            loadMore: 30,
            threshold: 5,
            enabled: filteredSuppliers.length > 30,
        });

        const visibleSuppliers = filteredSuppliers.slice(0, visibleItems);

        const allSuppliers = useMemo(() => filteredSuppliers, [filteredSuppliers]);

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
            <div className="text-[11px] border border-t-0 rounded-b-lg overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="overflow-x-auto border-b flex-shrink-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b-0 h-8 bg-transparent">
                                <TableHead className="py-1 px-0.5 text-[11px] w-8 h-8 flex items-center justify-center">
                                    <Checkbox
                                        checked={(selectedIds?.size ?? 0) > 0 && selectedIds.size === allSuppliers.length}
                                        onCheckedChange={handleSelectAll}
                                        className="h-3.5 w-3.5"
                                    />
                                </TableHead>
                                <TableHead className="py-1 px-1 text-[11px] h-8 align-middle">SR No</TableHead>
                                <TableHead className="py-1 px-1 text-[11px] h-8 align-middle">Date</TableHead>
                                <TableHead className="py-1 px-1 text-[11px] text-right h-8 align-middle">Original Amt</TableHead>
                                <TableHead className="py-1 px-1 text-[11px] text-right h-8 align-middle">Paid Amt</TableHead>
                                <TableHead className="py-1 px-1 text-[11px] text-right h-8 align-middle">CD Amt</TableHead>
                                <TableHead className="py-1 px-1 text-[11px] text-right h-8 align-middle">Outstanding</TableHead>
                                <TableHead className="py-1 px-0.5 text-[11px] text-center h-8 w-10 align-middle">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                    </Table>
                </div>
                <ScrollArea ref={scrollRef} className="flex-1 min-h-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableBody>
                            {visibleSuppliers.map((entry: any) => {
                                const outstanding = Number((entry as any).outstandingForEntry || entry.netAmount || 0);
                                const hasOutstanding = outstanding > 0.01;
                                const isNegative = outstanding < -0.01;
                                const paymentBreakdown = Array.isArray((entry as any).paymentBreakdown) ? (entry as any).paymentBreakdown : [];

                                return (
                                    <React.Fragment key={entry.id}>
                                        <TableRow
                                            data-state={selectedIds?.has(entry.id) ? 'selected' : ''}
                                            className="h-6"
                                        >
                                            <TableCell className="py-0 px-0.5 h-6 align-middle">
                                                <div className="flex items-center justify-center">
                                                    <Checkbox
                                                        checked={selectedIds?.has(entry.id)}
                                                        onCheckedChange={() => handleRowSelect(entry.id)}
                                                        className="h-3 w-3"
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-[11px] py-0 px-1 h-6 align-middle">{entry.srNo}</TableCell>
                                            <TableCell className="py-0 px-1 text-[11px] h-6 align-middle">
                                                {entry.date && isValid(new Date(entry.date)) ? format(new Date(entry.date), "dd-MMM-yy") : 'N/A'}
                                            </TableCell>
                                            <TableCell className="text-right py-0 px-1 text-[11px] h-6 align-middle">
                                                {formatCurrency(entry.originalNetAmount)}
                                            </TableCell>
                                            <TableCell className="text-right py-0 px-1 text-[11px] text-green-600 h-6 align-middle">
                                                {formatCurrency((entry as any).totalPaidForEntry || entry.totalPaid || 0)}
                                            </TableCell>
                                            <TableCell className="text-right py-0 px-1 text-[11px] text-blue-600 h-6 align-middle">
                                                {formatCurrency((entry as any).totalCdForEntry || entry.totalCd || 0)}
                                            </TableCell>
                                            <TableCell
                                                className={`text-right py-0 px-1 text-[11px] font-semibold h-6 align-middle ${
                                                    isNegative
                                                        ? 'text-red-600'
                                                        : hasOutstanding
                                                        ? 'text-orange-600'
                                                        : 'text-muted-foreground'
                                                }`}
                                            >
                                                {formatCurrency(outstanding)}
                                            </TableCell>
                                            <TableCell className="text-center py-0 px-0.5 h-6 align-middle">
                                                <div className="flex items-center justify-center gap-1">
                                                    {onEditEntry && (
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-5 w-5" 
                                                            onClick={() => onEditEntry(entry)}
                                                            title="Edit Entry"
                                                        >
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onShowDetails(entry)} title="View Details">
                                                        <Info className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                        {paymentBreakdown.length > 0 && (
                                            <TableRow className="bg-muted/20">
                                                <TableCell colSpan={8} className="py-0.5 px-1">
                                                    <div className="space-y-0.5">
                                                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
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
                                                                    className="flex flex-wrap items-center justify-between text-[10px] gap-1"
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
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-1 h-6">
                                        <Loader2 className="h-3 w-3 animate-spin mx-auto inline-block" />
                                        <span className="ml-1 text-[11px] text-muted-foreground">Loading more entries...</span>
                                    </TableCell>
                                </TableRow>
                            )}
                            {!hasMore && filteredSuppliers.length > 30 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-0.5 text-[11px] text-muted-foreground h-6">
                                        Showing all {filteredSuppliers.length} entries
                                    </TableCell>
                                </TableRow>
                            )}
                            {filteredSuppliers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center text-muted-foreground h-12 text-[11px]">
                                        No {activeTab === "outstanding" ? "outstanding" : activeTab === "running" ? "running" : activeTab === "profitable" ? "profitable" : "paid"} transactions found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ScrollArea>
            </div>
        );

        if (embed) {
            return (
                <div className="overflow-hidden border border-border/70 bg-card rounded-lg flex flex-col h-full">
                    {tableBody}
                </div>
            );
        }

        return (
            <Card className="mt-3 flex flex-col h-full">
                <CardHeader className="p-2 pb-1 flex-shrink-0">
                    <CardTitle className="text-[11px]">Outstanding Entries</CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex flex-col flex-1 min-h-0">
                    {tableBody}
                </CardContent>
            </Card>
        );
    }
);
