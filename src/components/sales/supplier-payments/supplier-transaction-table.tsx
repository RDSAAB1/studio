
"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { format, isValid } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Info, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useTransactionManagement, type SortKey } from "./hooks/use-transaction-management";
import { TransactionTableHeader, TransactionTableTotals } from "./table-header";
import { TransactionRow, PaymentBreakdownRow } from "./entry-row";
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
        
        const {
            activeTab,
            setActiveTab,
            sortKey,
            sortDirection,
            transactionCounts,
            sortedFilteredSuppliers,
            requestSort,
            handleSelectAll,
            handleRowSelect
        } = useTransactionManagement({
            suppliers,
            externalActiveTab,
            onTabChange,
            selectedIds,
            onSelectionChange,
            embed,
            compact,
            maxRows
        });

        const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(() => new Set());
        const toggleExpanded = (id: string) => {
            setExpandedEntryIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
            });
        };

        const shouldShowBreakdown = (id: string) => expandedEntryIds.has(id);

        const headerHeightClass = compact ? "h-7" : "h-8";
        const rowHeightClass = compact ? "h-7" : "h-9";
        const headTextClass = compact ? "text-[10px]" : "text-[12px]";
        const checkboxClass = compact ? "h-2.5 w-2.5" : "h-3 w-3";
        const rowCheckboxClass = compact ? "h-3 w-3" : "h-3.5 w-3.5";
        const entrySrClass = compact ? "text-[10px]" : "text-[12px]";
        const entryMetaClass = compact ? "text-[9px]" : "text-[11px]";
        const amountMainClass = compact ? "text-[10px]" : "text-[12px]";
        const amountSubClass = compact ? "text-[9px]" : "text-[11px]";
        const outstandingTextClass = compact ? "text-[10px]" : "text-[12px]";
        const actionBtnClass = compact ? "h-4 w-4" : "h-5 w-5";
        const actionIconClass = compact ? "h-2.5 w-2.5" : "h-3 w-3";

        // Infinite scroll pagination
        const { visibleItems, hasMore, isLoading, scrollRef } = useInfiniteScroll(sortedFilteredSuppliers, {
            totalItems: sortedFilteredSuppliers.length,
            initialLoad: 30,
            loadMore: 30,
            threshold: 5,
            enabled: !maxRows && sortedFilteredSuppliers.length > 30,
        });

        const visibleSuppliers = maxRows ? sortedFilteredSuppliers.slice(0, maxRows) : sortedFilteredSuppliers.slice(0, visibleItems);

        const tabButtonBaseClass = compact
            ? "flex items-center justify-between gap-1.5 px-1 py-0.5 rounded-[4px] transition-colors border flex-1"
            : "flex items-center justify-between gap-2 px-1.5 py-0.5 rounded-[4px] transition-colors border flex-1";
        const tabLabelClass = compact ? "text-[8px] font-bold" : "text-[8px] font-bold";
        const tabCountClass = compact
            ? "px-1 py-0.5 rounded-[4px] text-[8px] font-semibold bg-slate-100 text-slate-700 border border-slate-200"
            : "px-1.5 py-0.5 rounded-[4px] text-[9px] font-semibold bg-slate-100 text-slate-700 border border-slate-200";

        const isDetailed = type === 'customer' || type === 'supplier';

        const totals = useMemo(() => {
            if (!isDetailed || !suppliers || suppliers.length === 0) return null;
            return suppliers.reduce((acc, curr) => {
                acc.grossWt += Number(curr.grossWeight || curr.grossWt || 0);
                acc.teirWt += Number(curr.teirWeight || curr.teirWt || 0);
                acc.weight += Number(curr.weight || 0);
                acc.kartaWeight += Number(curr.kartaWeight || 0);
                acc.netWeight += Number(curr.netWeight || 0);
                acc.bags += Number(curr.bags || 0);
                acc.amount += Number(curr.amount || 0);
                acc.bagWeightDeductionAmount += Number(curr.bagWeightDeductionAmount || 0);
                acc.kartaAmount += Number(curr.kartaAmount || 0);
                acc.finalAmount += Number(curr.finalAmount || 0);
                acc.brokerage += Number(curr.brokerage || 0);
                acc.cd += Number(curr.cd || 0);
                acc.transportAmount += Number(curr.transportAmount || 0);
                acc.totalReceivable += (Number(curr.originalNetAmount) || 0) + (Number(curr.advanceFreight) || 0);
                acc.paid += Number(curr.totalPaidForEntry || 0);
                acc.cdPaid += Number(curr.totalCdForEntry || 0);
                acc.outstanding += Number(curr.outstandingForEntry ?? curr.netAmount ?? 0);
                acc.totalKanta += Number(curr.kanta || 0);
                acc.totalLabouryAmount += Number(curr.labouryAmount || 0);
                return acc;
            }, {
                grossWt: 0, teirWt: 0, weight: 0, kartaWeight: 0, netWeight: 0,
                bags: 0, amount: 0, bagWeightDeductionAmount: 0, kartaAmount: 0,
                finalAmount: 0, brokerage: 0, cd: 0, transportAmount: 0,
                totalReceivable: 0, paid: 0, cdPaid: 0, outstanding: 0,
                totalKanta: 0, totalLabouryAmount: 0
            });
        }, [isDetailed, suppliers]);

        const totalBagWtQtl = totals ? (totals.bags * 1) / 100 : 0; // Assuming 1kg bag for total
        const avgRate = totals && totals.netWeight ? totals.amount / totals.netWeight : 0;
        const avgBagWt = totals && totals.bags ? (totals.weight / totals.bags) * 100 : 0;

        const isSupplier = type === 'supplier';
        const colCount = isDetailed ? (isSupplier ? 15 : 16) : 9;

        const tableColumnGroup = (
            <colgroup>
                <col className="w-[30px]" />
                <col className="w-[72px]" />
                <col className="w-[68px]" />
                <col className="w-[78px]" />
                <col className="w-[72px]" />
                {!isSupplier && <col className="w-[62px]" />}
                <col className="w-[78px]" />
                {isSupplier ? (
                    <>
                        <col className="w-[60px]" />
                        <col className="w-[60px]" />
                    </>
                ) : (
                    <col className="w-[78px]" />
                )}
                <col className="w-[90px]" />
                {!isSupplier && <col className="w-[62px]" />}
                <col className="w-[78px]" />
                <col className="w-[46px]" />
                <col className="w-[70px]" />
                <col className="w-[58px]" />
                <col className="w-[72px]" />
                <col className="w-[60px]" />
            </colgroup>
        );

        const tableHeader = (
            <TransactionTableHeader
                selectedIdsSize={selectedIds.size}
                totalFilteredSize={sortedFilteredSuppliers.length}
                handleSelectAll={handleSelectAll}
                sortKey={sortKey}
                sortDirection={sortDirection}
                requestSort={requestSort}
                isDetailed={isDetailed}
                compact={compact}
                headTextClass={headTextClass}
                checkboxClass={checkboxClass}
                type={type}
            />
        );

        const tableBody = (
            <div className={`${compact ? "text-[10px]" : "text-[12px]"} rounded-[4px] overflow-hidden flex flex-col flex-1 min-h-0 bg-card`}>
                <div className="flex-shrink-0 bg-card border-b border-border rounded-none z-50">
                    {showTabsInHeader && (
                        <div className="px-1 py-1 border-b border-slate-200/70">
                            <div className="flex items-center gap-1 rounded-[4px] border border-border/50 bg-card p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("all")}
                                    className={`${tabButtonBaseClass} ${
                                        activeTab === "all"
                                            ? "bg-primary text-primary-foreground border-primary/40 shadow-sm"
                                            : "bg-transparent border-transparent text-muted-foreground hover:bg-card hover:border-border"
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
                                            ? "bg-primary text-primary-foreground border-primary/40 shadow-sm"
                                            : "bg-transparent border-transparent text-muted-foreground hover:bg-card hover:border-border"
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
                                            ? "bg-primary text-primary-foreground border-primary/40 shadow-sm"
                                            : "bg-transparent border-transparent text-muted-foreground hover:bg-card hover:border-border"
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
                                            ? "bg-primary text-primary-foreground border-primary/40 shadow-sm"
                                            : "bg-transparent border-transparent text-muted-foreground hover:bg-card hover:border-border"
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
                                            ? "bg-primary text-primary-foreground border-primary/40 shadow-sm"
                                            : "bg-transparent border-transparent text-muted-foreground hover:bg-card hover:border-border"
                                    }`}
                                >
                                    <span className={tabLabelClass}>Paid</span>
                                    <span className={tabCountClass}>{transactionCounts.paid}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Fixed Header */}
                <div className="flex-shrink-0">
                    <Table className="w-full min-w-[1050px] table-fixed border-separate border-spacing-0">
                        {tableColumnGroup}
                        {tableHeader}
                    </Table>
                </div>

                {/* Scrollable Body */}
                <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto overscroll-contain">
                    <Table className="w-full min-w-[1050px] table-fixed translate-z-0 border-separate border-spacing-0">
                        {tableColumnGroup}
                        <TableBody>
                            {visibleSuppliers.map((entry: any, index: number) => {
                                const paymentBreakdown = Array.isArray((entry as any).paymentBreakdown) ? (entry as any).paymentBreakdown : [];
                                const entryKey = String(entry.id || entry.srNo || index);

                                return (
                                    <React.Fragment key={entryKey}>
                                        <TransactionRow
                                            entry={entry}
                                            selectedIds={selectedIds}
                                            handleRowSelect={handleRowSelect}
                                            rowHeightClass={rowHeightClass}
                                            isHighlighted={highlightEntryId === entry.id}
                                            checkboxClass={checkboxClass}
                                            entrySrClass={entrySrClass}
                                            entryMetaClass={entryMetaClass}
                                            amountMainClass={amountMainClass}
                                            amountSubClass={amountSubClass}
                                            outstandingTextClass={outstandingTextClass}
                                            isDetailed={isDetailed}
                                            paymentBreakdown={paymentBreakdown}
                                            shouldShowBreakdown={shouldShowBreakdown(entryKey)}
                                            toggleExpanded={toggleExpanded}
                                            onEditEntry={onEditEntry}
                                            onShowDetails={onShowDetails}
                                            actionBtnClass={actionBtnClass}
                                            actionIconClass={actionIconClass}
                                            type={type}
                                        />
                                        {paymentBreakdown.length > 0 && shouldShowBreakdown(entryKey) &&
                                            paymentBreakdown.map((payment: any, idx: number) => (
                                                <PaymentBreakdownRow
                                                    key={`${entry.id}-payment-${idx}`}
                                                    payment={payment}
                                                    idx={idx}
                                                    entryMetaClass={entryMetaClass}
                                                    amountMainClass={amountMainClass}
                                                    amountSubClass={amountSubClass}
                                                    outstandingTextClass={outstandingTextClass}
                                                    compact={compact}
                                                    isDetailed={isDetailed}
                                                    type={type}
                                                />
                                            ))}
                                    </React.Fragment>
                                );
                            })}
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={colCount} className="text-center py-1 h-6">
                                        <Loader2 className="h-3 w-3 animate-spin mx-auto inline-block" />
                                        <span className="ml-1 text-[11px] text-muted-foreground">Loading more entries...</span>
                                    </TableCell>
                                </TableRow>
                            )}
                            {!hasMore && sortedFilteredSuppliers.length > 30 && (
                                <TableRow>
                                    <TableCell colSpan={colCount} className="text-center py-0.5 text-[11px] text-muted-foreground h-6">
                                        Showing all {sortedFilteredSuppliers.length} entries
                                    </TableCell>
                                </TableRow>
                            )}
                            {sortedFilteredSuppliers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={colCount} className="text-center text-muted-foreground h-12 text-[11px]">
                                        No {activeTab === "outstanding" ? "outstanding" : activeTab === "running" ? "running" : activeTab === "profitable" ? "profitable" : "paid"} transactions found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Fixed Totals */}
                {isDetailed && totals && (
                    <div className="flex-shrink-0">
                        <Table className="w-full min-w-[1050px] table-fixed border-separate border-spacing-0 border-t border-border">
                            {tableColumnGroup}
                            <TableBody>
                                <TransactionTableTotals
                                    totals={totals}
                                    avgRate={avgRate}
                                    avgBagWt={avgBagWt}
                                    isSupplier={isSupplier}
                                    type={type}
                                />
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        );

        if (embed) {
            return (
                <div className="overflow-x-auto rounded-[4px] border border-border bg-card flex flex-col h-full no-scrollbar">
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
