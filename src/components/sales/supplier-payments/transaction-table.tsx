
"use client";

import React, { useMemo, useState, useEffect } from "react";
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
    compact?: boolean;
    showTabsInHeader?: boolean;
    onEditEntry?: (entry: any) => void;
    activeTab?: string;
    onTabChange?: (tab: string) => void;
    type?: 'supplier' | 'customer' | 'outsider'; // Add type prop to explicitly prevent rendering for outsider
    highlightEntryId?: string | null;
    maxRows?: number;
}

export const TransactionTable = React.memo(
    ({ suppliers, onShowDetails, selectedIds, onSelectionChange, embed = false, compact = false, showTabsInHeader = false, onEditEntry, activeTab: externalActiveTab, onTabChange, type, highlightEntryId, maxRows }: TransactionTableProps) => {
        // Never render for outsider type - this table shows outstanding entries which are not needed for outsider
        if (type === 'outsider') {
            return null;
        }
        
        // Don't render if suppliers array is empty
        if (!suppliers || suppliers.length === 0) {
            return null;
        }
        
        const [internalActiveTab, setInternalActiveTab] = useState("outstanding");
        const activeTab = externalActiveTab ?? internalActiveTab;
        const setActiveTab = onTabChange ?? setInternalActiveTab;

        const headerHeightClass = compact ? "h-7" : "h-9";
        const rowHeightClass = compact ? "h-6" : "h-8";
        const headTextClass = compact ? "text-[9px]" : "text-[11px]";
        const checkboxClass = compact ? "h-2.5 w-2.5" : "h-3 w-3";
        const rowCheckboxClass = compact ? "h-3 w-3" : "h-3.5 w-3.5";
        const entrySrClass = compact ? "text-[10px]" : "text-[12px]";
        const entryMetaClass = compact ? "text-[9px]" : "text-[11px]";
        const amountMainClass = compact ? "text-[10px]" : "text-[12px]";
        const amountSubClass = compact ? "text-[9px]" : "text-[11px]";
        const outstandingTextClass = compact ? "text-[10px]" : "text-[12px]";
        const actionBtnClass = compact ? "h-4 w-4" : "h-5 w-5";
        const actionIconClass = compact ? "h-2.5 w-2.5" : "h-3 w-3";

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

        const transactionCounts = useMemo(() => {
            return {
                all: sortedSuppliers.length,
                outstanding: outstandingTransactions.length,
                running: runningTransactions.length,
                profitable: profitableTransactions.length,
                paid: paidTransactions.length,
            };
        }, [sortedSuppliers, outstandingTransactions, runningTransactions, profitableTransactions, paidTransactions]);

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
            enabled: !maxRows && filteredSuppliers.length > 30,
        });

        const visibleSuppliers = maxRows ? filteredSuppliers.slice(0, maxRows) : filteredSuppliers.slice(0, visibleItems);

        const allSuppliers = useMemo(() => filteredSuppliers, [filteredSuppliers]);

        // Highlight entry when highlightEntryId changes (no scrolling to avoid unresponsiveness)

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

        const tabButtonBaseClass = compact
            ? "flex items-center justify-between gap-1.5 px-1 py-0.5 rounded-[10px] transition-colors border flex-1"
            : "flex items-center justify-between gap-2 px-1.5 py-0.5 rounded-[10px] transition-colors border flex-1";
        const tabLabelClass = compact ? "text-[8px] font-bold" : "text-[8px] font-bold";
        const tabCountClass = compact
            ? "px-1 py-0.5 rounded-md text-[8px] font-semibold bg-slate-100 text-slate-700 border border-slate-200"
            : "px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-slate-100 text-slate-700 border border-slate-200";

        const tableColumnGroup = (
            <colgroup>
                <col className="w-[4%]" />
                <col className="w-[13%]" />
                <col className="w-[12%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[6%]" />
            </colgroup>
        );

        const headCellBaseClass = `${headerHeightClass} ${headTextClass} font-extrabold sticky top-0 z-10 bg-primary/20`;

        const tableHeader = (
            <TableHeader>
                <TableRow className={`border-b border-primary/30 ${headerHeightClass} bg-transparent`}>
                    <TableHead className={`py-0 px-1 ${headCellBaseClass} text-center`}>
                        <div className="flex items-center justify-center">
                            <Checkbox
                                checked={(selectedIds?.size ?? 0) > 0 && selectedIds.size === allSuppliers.length}
                                onCheckedChange={handleSelectAll}
                                className={checkboxClass}
                            />
                        </div>
                    </TableHead>
                    <TableHead className={`py-0 px-1.5 ${headCellBaseClass} align-middle`}>Entry</TableHead>
                    <TableHead className={`py-0 px-1.5 ${headCellBaseClass} align-middle`}>Date</TableHead>
                    <TableHead className={`py-0 px-1.5 ${headCellBaseClass} text-right align-middle`}>Original</TableHead>
                    <TableHead className={`py-0 px-1.5 ${headCellBaseClass} text-right align-middle`}>Extra</TableHead>
                    <TableHead className={`py-0 px-1.5 ${headCellBaseClass} text-right align-middle`}>Paid</TableHead>
                    <TableHead className={`py-0 px-1.5 ${headCellBaseClass} text-right align-middle`}>CD</TableHead>
                    <TableHead className={`py-0 px-1.5 ${headCellBaseClass} text-right align-middle`}>Outstanding</TableHead>
                    <TableHead className={`py-0 px-1 ${headCellBaseClass} text-center align-middle`}>Actions</TableHead>
                </TableRow>
            </TableHeader>
        );

        const tableBody = (
            <div className={`${compact ? "text-[10px]" : "text-[12px]"} rounded-[12px] overflow-hidden flex flex-col flex-1 min-h-0 bg-white/80 border border-slate-200/80 shadow-[0_10px_30px_rgba(0,0,0,0.10)] hover:shadow-[0_14px_40px_rgba(0,0,0,0.14)] transition-shadow backdrop-blur-[20px]`}>
                <div className="flex-shrink-0 bg-primary/20 border-b border-primary/30 shadow-sm backdrop-blur-sm">
                    {showTabsInHeader && (
                        <div className="px-1 py-1 border-b border-slate-200/70">
                            <div className="flex items-center gap-1 rounded-[12px] bg-slate-100/80 border border-slate-200/80 p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("all")}
                                    className={`${tabButtonBaseClass} ${
                                        activeTab === "all"
                                            ? "bg-white border-slate-200/80 text-slate-900 shadow-sm ring-1 ring-violet-200/60"
                                            : "bg-transparent border-transparent text-slate-600 hover:bg-white/70 hover:border-slate-200/80"
                                    }`}
                                >
                                    <span className={tabLabelClass}>All</span>
                                    <span className={tabCountClass}>{transactionCounts.all}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("outstanding")}
                                    className={`${tabButtonBaseClass} ${
                                        activeTab === "outstanding"
                                            ? "bg-white border-slate-200/80 text-slate-900 shadow-sm ring-1 ring-violet-200/60"
                                            : "bg-transparent border-transparent text-slate-600 hover:bg-white/70 hover:border-slate-200/80"
                                    }`}
                                >
                                    <span className={tabLabelClass}>Outstanding</span>
                                    <span className={tabCountClass}>{transactionCounts.outstanding}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("running")}
                                    className={`${tabButtonBaseClass} ${
                                        activeTab === "running"
                                            ? "bg-white border-slate-200/80 text-slate-900 shadow-sm ring-1 ring-violet-200/60"
                                            : "bg-transparent border-transparent text-slate-600 hover:bg-white/70 hover:border-slate-200/80"
                                    }`}
                                >
                                    <span className={tabLabelClass}>Running</span>
                                    <span className={tabCountClass}>{transactionCounts.running}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("profitable")}
                                    className={`${tabButtonBaseClass} ${
                                        activeTab === "profitable"
                                            ? "bg-white border-slate-200/80 text-slate-900 shadow-sm ring-1 ring-violet-200/60"
                                            : "bg-transparent border-transparent text-slate-600 hover:bg-white/70 hover:border-slate-200/80"
                                    }`}
                                >
                                    <span className={tabLabelClass}>Profitable</span>
                                    <span className={tabCountClass}>{transactionCounts.profitable}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("paid")}
                                    className={`${tabButtonBaseClass} ${
                                        activeTab === "paid"
                                            ? "bg-white border-slate-200/80 text-slate-900 shadow-sm ring-1 ring-violet-200/60"
                                            : "bg-transparent border-transparent text-slate-600 hover:bg-white/70 hover:border-slate-200/80"
                                    }`}
                                >
                                    <span className={tabLabelClass}>Paid</span>
                                    <span className={tabCountClass}>{transactionCounts.paid}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                {maxRows ? (
                    <div className="flex-1 min-h-0 overflow-hidden">
                        <Table className="w-full table-fixed">
                            {tableColumnGroup}
                            {tableHeader}
                            <TableBody>
                            {visibleSuppliers.map((entry: any, index: number) => {
                                const outstanding = Number((entry as any).outstandingForEntry || entry.netAmount || 0);
                                const hasOutstanding = outstanding > 0.01;
                                const isNegative = outstanding < -0.01;
                                const paymentBreakdown = Array.isArray((entry as any).paymentBreakdown) ? (entry as any).paymentBreakdown : [];
                                const isHighlighted = highlightEntryId === entry.id;
                                const uniqueKey = `${entry.id || 'entry'}-${index}`;

                                return (
                                    <React.Fragment key={uniqueKey}>
                                        <TableRow
                                            id={`transaction-row-${entry.id}`}
                                            data-state={selectedIds?.has(entry.id) ? 'selected' : ''}
                                            className={`${rowHeightClass} border-b border-slate-200/70 text-slate-900 odd:bg-slate-50/60 hover:bg-violet-50/60 transition-colors ${
                                                selectedIds?.has(entry.id) ? 'bg-violet-100/40' : ''
                                            } ${isHighlighted ? 'bg-violet-100/60 ring-2 ring-violet-500/40' : ''}`}
                                        >
                                            <TableCell className="py-0 px-1 align-middle">
                                                <div className="flex items-center justify-center">
                                                    <Checkbox
                                                        checked={selectedIds?.has(entry.id)}
                                                        onCheckedChange={() => handleRowSelect(entry.id)}
                                                        className={checkboxClass}
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-0 px-1.5 align-middle">
                                                <div className={`font-mono ${entrySrClass} font-bold leading-tight`}>{entry.srNo}</div>
                                            </TableCell>
                                            <TableCell className="py-0 px-1.5 align-middle">
                                                <div className={`${entryMetaClass} text-muted-foreground font-medium leading-tight`}>
                                                    {entry.date && isValid(new Date(entry.date)) ? format(new Date(entry.date), "dd-MMM-yy") : 'N/A'}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right py-0 px-1.5 align-middle">
                                                <div className={`${amountMainClass} font-bold leading-tight text-slate-900`}>
                                                    {formatCurrency(
                                                        (entry as any).adjustedOriginal !== undefined
                                                            ? (entry as any).adjustedOriginal
                                                            : entry.originalNetAmount
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right py-0 px-1.5 align-middle">
                                                <div className={`${amountSubClass} font-semibold leading-tight text-slate-600`}>
                                                    {((entry as any).totalExtraForEntry ?? (entry as any).totalGovExtraForEntry) !== 0
                                                        ? formatCurrency((entry as any).totalExtraForEntry ?? (entry as any).totalGovExtraForEntry)
                                                        : '-'}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right py-0 px-1.5 align-middle">
                                                <div className={`${amountMainClass} font-semibold leading-tight text-slate-900`}>
                                                    {formatCurrency((entry as any).totalPaidForEntry || entry.totalPaid || 0)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right py-0 px-1.5 align-middle">
                                                <div className={`${amountSubClass} font-semibold leading-tight text-slate-600`}>
                                                    {formatCurrency((entry as any).totalCdForEntry || entry.totalCd || 0)}
                                                </div>
                                            </TableCell>
                                            <TableCell
                                                className={`text-right px-2 py-0 ${outstandingTextClass} font-extrabold align-middle rounded-md ${
                                                    isNegative
                                                        ? 'text-rose-700 bg-rose-500/10 border border-rose-500/20'
                                                        : hasOutstanding
                                                            ? 'text-emerald-700 bg-emerald-500/10 border border-emerald-500/20'
                                                        : 'text-slate-500 bg-slate-500/5 border border-slate-200/70'
                                                }`}
                                            >
                                                {formatCurrency(outstanding)}
                                            </TableCell>
                                            <TableCell className="text-center py-0 px-1 align-middle">
                                                <div className="flex items-center justify-center gap-1">
                                                    {onEditEntry && (
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} hover:bg-primary/10 hover:text-primary`} 
                                                            onClick={() => onEditEntry(entry)}
                                                            title="Edit Entry"
                                                        >
                                                            <Pencil className={compact ? "h-2 w-2" : "h-2.5 w-2.5"} />
                                                        </Button>
                                                    )}
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} hover:bg-primary/10 hover:text-primary`} 
                                                        onClick={() => onShowDetails && typeof onShowDetails === 'function' ? onShowDetails(entry) : null} 
                                                        title="View Details"
                                                    >
                                                        <Info className={compact ? "h-2 w-2" : "h-2.5 w-2.5"} />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                        {paymentBreakdown.length > 0 &&
                                            paymentBreakdown.map((payment: any, idx: number) => {
                                                const paymentDate =
                                                    payment.date && isValid(new Date(payment.date))
                                                        ? format(new Date(payment.date), "dd-MMM-yy")
                                                        : 'N/A';

                                                return (
                                                    <TableRow key={`${entry.id}-payment-${idx}`} className="bg-slate-50/60">
                                                        <TableCell className="py-0 px-1 align-middle" />
                                                        <TableCell className="py-0 px-1.5 align-middle">
                                                            <div
                                                                className={`${entryMetaClass} text-muted-foreground font-medium leading-tight ${
                                                                    compact ? "text-[8px]" : "text-[9px]"
                                                                }`}
                                                            >
                                                                Payment: {payment.paymentId || 'N/A'}
                                                                {payment.receiptType ? ` (${payment.receiptType})` : ''}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-0 px-1.5 align-middle">
                                                            <div
                                                                className={`${entryMetaClass} text-muted-foreground font-medium leading-tight ${
                                                                    compact ? "text-[8px]" : "text-[9px]"
                                                                }`}
                                                            >
                                                                {paymentDate}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right py-0 px-1.5 align-middle">
                                                            <div className={`${amountMainClass} font-bold leading-tight text-slate-400`}>-</div>
                                                        </TableCell>
                                                        <TableCell className="text-right py-0 px-1.5 align-middle">
                                                            <div className={`${amountSubClass} font-semibold leading-tight text-slate-400`}>-</div>
                                                        </TableCell>
                                                        <TableCell className="text-right py-0 px-1.5 align-middle">
                                                            <div className={`${amountMainClass} font-semibold leading-tight text-slate-900`}>
                                                                {formatCurrency(payment.amount || 0)}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right py-0 px-1.5 align-middle">
                                                            <div className={`${amountSubClass} font-semibold leading-tight text-slate-600`}>
                                                                {formatCurrency(payment.cdAmount || 0)}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right py-0 px-2 align-middle">
                                                            <div className={`${outstandingTextClass} font-extrabold leading-tight text-slate-400`}>-</div>
                                                        </TableCell>
                                                        <TableCell className="text-center py-0 px-1 align-middle" />
                                                    </TableRow>
                                                );
                                            })}
                                    </React.Fragment>
                                );
                            })}
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-1 h-6">
                                        <Loader2 className="h-3 w-3 animate-spin mx-auto inline-block" />
                                        <span className={`ml-1 ${compact ? "text-[9px]" : "text-[11px]"} text-muted-foreground`}>Loading more entries...</span>
                                    </TableCell>
                                </TableRow>
                            )}
                            {!hasMore && filteredSuppliers.length > 30 && (
                                <TableRow>
                                    <TableCell colSpan={9} className={`text-center py-0.5 ${compact ? "text-[9px]" : "text-[11px]"} text-muted-foreground h-6`}>
                                        Showing all {filteredSuppliers.length} entries
                                    </TableCell>
                                </TableRow>
                            )}
                            {filteredSuppliers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={9} className={`text-center text-muted-foreground h-12 ${compact ? "text-[9px]" : "text-[11px]"}`}>
                                        No {activeTab === "outstanding" ? "outstanding" : activeTab === "running" ? "running" : activeTab === "profitable" ? "profitable" : "paid"} transactions found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                ) : (
                    <ScrollArea ref={scrollRef} className="flex-1 min-h-0">
                        <Table className="w-full table-fixed">
                            {tableColumnGroup}
                            {tableHeader}
                            <TableBody>
                                {visibleSuppliers.map((entry: any, index: number) => {
                                    const outstanding = Number((entry as any).outstandingForEntry || entry.netAmount || 0);
                                    const hasOutstanding = outstanding > 0.01;
                                    const isNegative = outstanding < -0.01;
                                    const paymentBreakdown = Array.isArray((entry as any).paymentBreakdown) ? (entry as any).paymentBreakdown : [];
                                    const isHighlighted = highlightEntryId === entry.id;
                                    const uniqueKey = `${entry.id || 'entry'}-${index}`;

                                    return (
                                        <React.Fragment key={uniqueKey}>
                                            <TableRow
                                                id={`transaction-row-${entry.id}`}
                                                data-state={selectedIds?.has(entry.id) ? 'selected' : ''}
                                                className={`${rowHeightClass} border-b border-slate-200/70 text-slate-900 odd:bg-slate-50/60 hover:bg-violet-50/60 transition-colors ${
                                                    selectedIds?.has(entry.id) ? 'bg-violet-100/40' : ''
                                                } ${isHighlighted ? 'bg-violet-100/60 ring-2 ring-violet-500/40' : ''}`}
                                            >
                                                <TableCell className="py-0 px-1 align-middle">
                                                    <div className="flex items-center justify-center">
                                                        <Checkbox
                                                            checked={selectedIds?.has(entry.id)}
                                                            onCheckedChange={() => handleRowSelect(entry.id)}
                                                            className={rowCheckboxClass}
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-0 px-1.5 align-middle">
                                                    <div className={`font-mono ${entrySrClass} font-bold leading-tight`}>{entry.srNo}</div>
                                                </TableCell>
                                                <TableCell className="py-0 px-1.5 align-middle">
                                                    <div className={`${entryMetaClass} text-muted-foreground font-medium leading-tight`}>
                                                        {entry.date && isValid(new Date(entry.date)) ? format(new Date(entry.date), "dd-MMM-yy") : 'N/A'}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right py-0 px-1.5 align-middle">
                                                    <div className={`${amountMainClass} font-bold leading-tight text-slate-900`}>
                                                        {formatCurrency(
                                                            (entry as any).adjustedOriginal !== undefined
                                                                ? (entry as any).adjustedOriginal
                                                                : entry.originalNetAmount
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right py-0 px-1.5 align-middle">
                                                    <div className={`${amountSubClass} font-semibold leading-tight text-slate-600`}>
                                                        {((entry as any).totalExtraForEntry ?? (entry as any).totalGovExtraForEntry) !== 0
                                                            ? formatCurrency((entry as any).totalExtraForEntry ?? (entry as any).totalGovExtraForEntry)
                                                            : '-'}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right py-0 px-1.5 align-middle">
                                                    <div className={`${amountMainClass} font-semibold leading-tight text-slate-900`}>
                                                        {formatCurrency((entry as any).totalPaidForEntry || entry.totalPaid || 0)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right py-0 px-1.5 align-middle">
                                                    <div className={`${amountSubClass} font-semibold leading-tight text-slate-600`}>
                                                        {formatCurrency((entry as any).totalCdForEntry || entry.totalCd || 0)}
                                                    </div>
                                                </TableCell>
                                                <TableCell
                                                    className={`text-right px-2 py-0 ${outstandingTextClass} font-extrabold align-middle rounded-md ${
                                                        isNegative
                                                            ? 'text-rose-700 bg-rose-500/10 border border-rose-500/20'
                                                            : hasOutstanding
                                                            ? 'text-emerald-700 bg-emerald-500/10 border border-emerald-500/20'
                                                            : 'text-slate-500 bg-slate-500/5 border border-slate-200/70'
                                                    }`}
                                                >
                                                    {formatCurrency(outstanding)}
                                                </TableCell>
                                                <TableCell className="text-center py-0 px-1 align-middle">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {onEditEntry && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className={`${actionBtnClass} hover:bg-primary/10 hover:text-primary`} 
                                                                onClick={() => onEditEntry(entry)}
                                                                title="Edit Entry"
                                                            >
                                                                <Pencil className={actionIconClass} />
                                                            </Button>
                                                        )}
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className={`${actionBtnClass} hover:bg-primary/10 hover:text-primary`} 
                                                            onClick={() => onShowDetails && typeof onShowDetails === 'function' ? onShowDetails(entry) : null} 
                                                            title="View Details"
                                                        >
                                                            <Info className={actionIconClass} />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                            {paymentBreakdown.length > 0 &&
                                                paymentBreakdown.map((payment: any, idx: number) => {
                                                    const paymentDate =
                                                        payment.date && isValid(new Date(payment.date))
                                                            ? format(new Date(payment.date), "dd-MMM-yy")
                                                            : 'N/A';

                                                    return (
                                                        <TableRow key={`${entry.id}-payment-${idx}`} className="bg-slate-50/60">
                                                            <TableCell className="py-0 px-1 align-middle" />
                                                            <TableCell className="py-0 px-1.5 align-middle">
                                                                <div className={`${entryMetaClass} text-[10px] text-muted-foreground font-medium leading-tight`}>
                                                                    Payment: {payment.paymentId || 'N/A'}
                                                                    {payment.receiptType ? ` (${payment.receiptType})` : ''}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-0 px-1.5 align-middle">
                                                                <div className={`${entryMetaClass} text-[10px] text-muted-foreground font-medium leading-tight`}>
                                                                    {paymentDate}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right py-0 px-1.5 align-middle">
                                                                <div className={`${amountMainClass} font-bold leading-tight text-slate-400`}>-</div>
                                                            </TableCell>
                                                            <TableCell className="text-right py-0 px-1.5 align-middle">
                                                                <div className={`${amountSubClass} font-semibold leading-tight text-slate-400`}>-</div>
                                                            </TableCell>
                                                            <TableCell className="text-right py-0 px-1.5 align-middle">
                                                                <div className={`${amountMainClass} font-semibold leading-tight text-slate-900`}>
                                                                    {formatCurrency(payment.amount || 0)}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right py-0 px-1.5 align-middle">
                                                                <div className={`${amountSubClass} font-semibold leading-tight text-slate-600`}>
                                                                    {formatCurrency(payment.cdAmount || 0)}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right py-0 px-2 align-middle">
                                                                <div className={`${outstandingTextClass} font-extrabold leading-tight text-slate-400`}>-</div>
                                                            </TableCell>
                                                            <TableCell className="text-center py-0 px-1 align-middle" />
                                                        </TableRow>
                                                    );
                                                })}
                                        </React.Fragment>
                                    );
                                })}
                                {isLoading && (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-1 h-6">
                                            <Loader2 className="h-3 w-3 animate-spin mx-auto inline-block" />
                                            <span className="ml-1 text-[11px] text-muted-foreground">Loading more entries...</span>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {!hasMore && filteredSuppliers.length > 30 && (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-0.5 text-[11px] text-muted-foreground h-6">
                                            Showing all {filteredSuppliers.length} entries
                                        </TableCell>
                                    </TableRow>
                                )}
                                {filteredSuppliers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center text-muted-foreground h-12 text-[11px]">
                                            No {activeTab === "outstanding" ? "outstanding" : activeTab === "running" ? "running" : activeTab === "profitable" ? "profitable" : "paid"} transactions found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                )}
            </div>
        );

        if (embed) {
            return (
                <div className="overflow-hidden rounded-[12px] border border-slate-200/80 bg-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.10)] backdrop-blur-[14px] flex flex-col h-full">
                    {tableBody}
                </div>
            );
        }

        return (
            <Card className="mt-3 flex flex-col h-full rounded-[12px] border border-slate-200/80 bg-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.10)] backdrop-blur-[14px]">
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
