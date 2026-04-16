
"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { format, isValid } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Info, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useTransactionManagement, type SortKey } from "./hooks/use-transaction-management";
import { TransactionTableHeader } from "./table-header";
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
        const checkboxClass = compact ? "h-2.5 w-2.5 rounded-full" : "h-3 w-3 rounded-full";
        const rowCheckboxClass = compact ? "h-3 w-3 rounded-full" : "h-3.5 w-3.5 rounded-full";
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

        const isCustomer = type === 'customer';
        const tableColumnGroup = (
            <colgroup><col className="w-[4%]" /><col className={isCustomer ? "w-[15%]" : "w-[15%]"} /><col className={isCustomer ? "w-[15%]" : "w-[15%]"} /><col className={isCustomer ? "w-[10%]" : "w-[12%]"} /><col className={isCustomer ? "w-[9%]" : "w-[11%]"} /><col className={isCustomer ? "w-[9%]" : "w-[11%]"} /><col className={isCustomer ? "w-[8%]" : "w-[10%]"} /><col className={isCustomer ? "w-[10%]" : "w-[12%]"} />{isCustomer && <col className="w-[10%]" />}<col className="w-[10%]" /></colgroup>
        );

        const tableHeader = (
            <TransactionTableHeader
                selectedIdsSize={selectedIds.size}
                totalFilteredSize={sortedFilteredSuppliers.length}
                handleSelectAll={handleSelectAll}
                sortKey={sortKey}
                sortDirection={sortDirection}
                requestSort={requestSort}
                isCustomer={isCustomer}
                compact={compact}
                headTextClass={headTextClass}
                checkboxClass={checkboxClass}
            />
        );

        const tableBody = (
            <div className={`${compact ? "text-[10px]" : "text-[12px]"} rounded-[4px] overflow-hidden flex flex-col flex-1 min-h-0 bg-card`}>
                <div className="flex-shrink-0 bg-card border-b border-border rounded-none">
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
                {maxRows ? (
                    <div className="flex-1 min-h-0 overflow-x-auto border-t border-slate-200/50">
                        <Table className="w-full min-w-[700px] xl:min-w-0 table-fixed">
                            {tableColumnGroup}
                            {tableHeader}
                            <TableBody>
                            {visibleSuppliers.map((entry: any, index: number) => (
                                <React.Fragment key={entry.id || index}>
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
                                        isCustomer={isCustomer}
                                        paymentBreakdown={Array.isArray((entry as any).paymentBreakdown) ? (entry as any).paymentBreakdown : []}
                                        shouldShowBreakdown={shouldShowBreakdown(entry.id || entry.srNo)}
                                        toggleExpanded={toggleExpanded}
                                        onEditEntry={onEditEntry}
                                        onShowDetails={onShowDetails}
                                        actionBtnClass={actionBtnClass}
                                        actionIconClass={actionIconClass}
                                    />
                                    {Array.isArray((entry as any).paymentBreakdown) && shouldShowBreakdown(entry.id || entry.srNo) &&
                                        (entry as any).paymentBreakdown.map((payment: any, idx: number) => (
                                            <PaymentBreakdownRow
                                                key={`${entry.id}-payment-${idx}`}
                                                payment={payment}
                                                idx={idx}
                                                entryMetaClass={entryMetaClass}
                                                amountMainClass={amountMainClass}
                                                amountSubClass={amountSubClass}
                                                outstandingTextClass={outstandingTextClass}
                                                compact={compact}
                                            />
                                        ))
                                    }
                                </React.Fragment>
                            ))}
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={isCustomer ? 10 : 9} className="text-center py-1 h-6">
                                        <Loader2 className="h-3 w-3 animate-spin mx-auto inline-block" />
                                        <span className={`ml-1 ${compact ? "text-[9px]" : "text-[11px]"} text-muted-foreground`}>Loading more entries...</span>
                                    </TableCell>
                                </TableRow>
                            )}
                            {!hasMore && sortedFilteredSuppliers.length > 30 && (
                                <TableRow>
                                    <TableCell colSpan={isCustomer ? 10 : 9} className={`text-center py-0.5 ${compact ? "text-[9px]" : "text-[11px]"} text-muted-foreground h-6`}>
                                        Showing all {sortedFilteredSuppliers.length} entries
                                    </TableCell>
                                </TableRow>
                            )}
                            {sortedFilteredSuppliers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={isCustomer ? 10 : 9} className={`text-center text-muted-foreground h-12 ${compact ? "text-[9px]" : "text-[11px]"}`}>
                                        No {activeTab === "outstanding" ? "outstanding" : activeTab === "running" ? "running" : activeTab === "profitable" ? "profitable" : "paid"} transactions found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                        <div className="w-full overflow-x-auto">
                            <Table className="w-full min-w-[700px] xl:min-w-0 table-fixed translate-z-0">
                            {tableColumnGroup}
                            {tableHeader}
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
                                                isCustomer={isCustomer}
                                                paymentBreakdown={paymentBreakdown}
                                                shouldShowBreakdown={shouldShowBreakdown(entryKey)}
                                                toggleExpanded={toggleExpanded}
                                                onEditEntry={onEditEntry}
                                                onShowDetails={onShowDetails}
                                                actionBtnClass={actionBtnClass}
                                                actionIconClass={actionIconClass}
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
                                                    />
                                                ))}
                                        </React.Fragment>
                                    );
                                })}
                                {isLoading && (
                                    <TableRow>
                                        <TableCell colSpan={isCustomer ? 10 : 9} className="text-center py-1 h-6">
                                            <Loader2 className="h-3 w-3 animate-spin mx-auto inline-block" />
                                            <span className="ml-1 text-[11px] text-muted-foreground">Loading more entries...</span>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {!hasMore && sortedFilteredSuppliers.length > 30 && (
                                    <TableRow>
                                        <TableCell colSpan={isCustomer ? 10 : 9} className="text-center py-0.5 text-[11px] text-muted-foreground h-6">
                                            Showing all {sortedFilteredSuppliers.length} entries
                                        </TableCell>
                                    </TableRow>
                                )}
                                {sortedFilteredSuppliers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={isCustomer ? 10 : 9} className="text-center text-muted-foreground h-12 text-[11px]">
                                            No {activeTab === "outstanding" ? "outstanding" : activeTab === "running" ? "running" : activeTab === "profitable" ? "profitable" : "paid"} transactions found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                            </Table>
                        </div>
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
