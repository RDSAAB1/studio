
"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { format, isValid } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronUp, Info, Loader2, Pencil } from "lucide-react";
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

        type SortKey = "entry" | "date" | "original" | "extra" | "paid" | "cd" | "outstanding" | "advanceFreight";
        type SortDirection = "asc" | "desc";

        const shouldSkipInitialSort = Boolean(embed && compact && !maxRows && (suppliers?.length || 0) > 800);
        const userSortTouchedRef = useRef(false);

        const [sortKey, setSortKey] = useState<SortKey | null>(() => (shouldSkipInitialSort ? null : "entry"));
        const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
        const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(() => new Set());

        useEffect(() => {
            if (userSortTouchedRef.current) return;
            if (shouldSkipInitialSort) {
                if (sortKey !== null) setSortKey(null);
                return;
            }
            if (sortKey === null) setSortKey("entry");
        }, [shouldSkipInitialSort, sortKey]);

        const headerHeightClass = compact ? "h-7" : "h-9";
        const rowHeightClass = compact ? "h-6" : "h-8";
        const headTextClass = compact ? "text-[9px]" : "text-[11px]";
        const checkboxClass = compact ? "h-2.5 w-2.5 rounded-full" : "h-3 w-3 rounded-full";
        const rowCheckboxClass = compact ? "h-3 w-3 rounded-full" : "h-3.5 w-3.5 rounded-full";
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

        const supplierList = suppliers;

        const transactionCounts = useMemo(() => {
            const counts = { all: 0, outstanding: 0, running: 0, profitable: 0, paid: 0 };
            if (!Array.isArray(supplierList) || supplierList.length === 0) return counts;

            counts.all = supplierList.length;
            for (const t of supplierList) {
                const totalPaid = (t as any).totalPaidForEntry || (t as any).totalPaid || 0;
                const original = (t as any).originalNetAmount || 0;
                const outstanding = Number((t as any).outstandingForEntry || (t as any).netAmount || 0);

                if (outstanding < 1) counts.paid += 1;
                else if (outstanding < 200) counts.profitable += 1;
                else if (outstanding >= 200 && totalPaid > 0) counts.running += 1;

                if (totalPaid === 0 && original > 0) counts.outstanding += 1;
            }
            return counts;
        }, [supplierList]);

        const filteredSuppliers = useMemo(() => {
            if (!Array.isArray(supplierList) || supplierList.length === 0) return [];
            if (!activeTab || activeTab === "all") return supplierList;

            return supplierList.filter((t: any) => {
                const totalPaid = t.totalPaidForEntry || t.totalPaid || 0;
                const original = t.originalNetAmount || 0;
                const outstanding = Number(t.outstandingForEntry || t.netAmount || 0);

                switch (activeTab) {
                    case "outstanding":
                        return totalPaid === 0 && original > 0;
                    case "running":
                        return outstanding >= 200 && totalPaid > 0;
                    case "profitable":
                        return outstanding >= 1 && outstanding < 200;
                    case "paid":
                        return outstanding < 1;
                    default:
                        return true;
                }
            });
        }, [activeTab, supplierList]);

        const sortedFilteredSuppliers = useMemo(() => {
            if (!sortKey) return filteredSuppliers;
            const items = [...filteredSuppliers];

            const compareNumber = (a: number, b: number) => {
                if (a < b) return -1;
                if (a > b) return 1;
                return 0;
            };

            const compareMaybeNumber = (a: number | null, b: number | null) => {
                if (a === null && b === null) return 0;
                if (a === null) return 1;
                if (b === null) return -1;
                return compareNumber(a, b);
            };

            const getSortValue = (entry: any) => {
                switch (sortKey) {
                    case "entry":
                        return getSerialNumberForSort(entry);
                    case "date": {
                        const dateObj = entry?.date ? new Date(entry.date) : null;
                        if (!dateObj || !isValid(dateObj)) return null;
                        return dateObj.getTime();
                    }
                    case "original":
                        return Number(
                            (entry as any).adjustedOriginal !== undefined
                                ? (entry as any).adjustedOriginal
                                : entry.originalNetAmount || 0
                        );
                    case "extra":
                        return Number((entry as any).totalExtraForEntry ?? (entry as any).totalGovExtraForEntry ?? 0);
                    case "paid":
                        return Number((entry as any).totalPaidForEntry || entry.totalPaid || 0);
                    case "cd":
                        return Number((entry as any).totalCdForEntry || entry.totalCd || 0);
                    case "outstanding":
                        return Number((entry as any).outstandingForEntry || entry.netAmount || 0);
                    case "advanceFreight":
                        return Number(entry.advanceFreight || 0);
                    default:
                        return 0;
                }
            };

            const directionMultiplier = sortDirection === "asc" ? 1 : -1;

            items.sort((a, b) => {
                const valueA = getSortValue(a);
                const valueB = getSortValue(b);

                const raw =
                    sortKey === "date"
                        ? compareMaybeNumber(valueA as number | null, valueB as number | null)
                        : compareNumber(Number(valueA), Number(valueB));

                if (raw !== 0) return raw * directionMultiplier;

                const srFallback = compareNumber(getSerialNumberForSort(a), getSerialNumberForSort(b));
                return srFallback === 0 ? 0 : srFallback * -1;
            });

            return items;
        }, [filteredSuppliers, sortDirection, sortKey]);

        const requestSort = (key: SortKey) => {
            userSortTouchedRef.current = true;
            setSortKey((currentKey) => {
                if (currentKey === key) {
                    setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
                    return currentKey;
                }
                // Outstanding (Net): default high to low (desc); other columns default asc (low to high)
                setSortDirection(key === "outstanding" ? "desc" : "asc");
                return key;
            });
        };

        const toggleExpanded = (id: string) => {
            setExpandedEntryIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
            });
        };

        const shouldShowBreakdown = (id: string) => !compact || expandedEntryIds.has(id);

        // Infinite scroll pagination
        const { visibleItems, hasMore, isLoading, scrollRef } = useInfiniteScroll(sortedFilteredSuppliers, {
            totalItems: sortedFilteredSuppliers.length,
            initialLoad: 30,
            loadMore: 30,
            threshold: 5,
            enabled: !maxRows && sortedFilteredSuppliers.length > 30,
        });

        const visibleSuppliers = maxRows ? sortedFilteredSuppliers.slice(0, maxRows) : sortedFilteredSuppliers.slice(0, visibleItems);

        const allSuppliers = useMemo(() => sortedFilteredSuppliers, [sortedFilteredSuppliers]);

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

        const isCustomer = type === 'customer';
        const tableColumnGroup = (
            <colgroup>
                <col className="w-[4%]" />
                <col className={isCustomer ? "w-[11%]" : "w-[13%]"} />
                <col className={isCustomer ? "w-[11%]" : "w-[12%]"} />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                {isCustomer && <col className="w-[10%]" />}
                <col className="w-[6%]" />
            </colgroup>
        );

        const headCellBaseClass = `${headerHeightClass} ${headTextClass} font-extrabold sticky top-0 z-10 bg-muted/50`;
        const headSortButtonClass = `w-full h-full flex items-center gap-1 ${compact ? "text-[9px]" : "text-[11px]"} font-extrabold`;

        const SortIndicator = ({ columnKey }: { columnKey: SortKey }) => {
            if (sortKey !== columnKey) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
            return sortDirection === "asc" ? (
                <ArrowUp className="h-3 w-3 opacity-80" />
            ) : (
                <ArrowDown className="h-3 w-3 opacity-80" />
            );
        };

        const tableHeader = (
            <TableHeader>
                <TableRow className={`border-b border-border ${headerHeightClass} rounded-none bg-transparent`}>
                    <TableHead className={`py-0 px-1 ${headCellBaseClass} text-center`}>
                        <div className="flex items-center justify-center">
                            <Checkbox
                                checked={(selectedIds?.size ?? 0) > 0 && selectedIds.size === allSuppliers.length}
                                onCheckedChange={handleSelectAll}
                                className={checkboxClass}
                            />
                        </div>
                    </TableHead>
                    <TableHead className={`py-0 px-1.5 ${headCellBaseClass} align-middle`}>
                        <button type="button" className={headSortButtonClass} onClick={() => requestSort("entry")}>
                            <SortIndicator columnKey="entry" />
                            <span>Entry</span>
                        </button>
                    </TableHead>
                    <TableHead className={`py-0 px-1.5 ${headCellBaseClass} align-middle`}>
                        <button type="button" className={headSortButtonClass} onClick={() => requestSort("date")}>
                            <SortIndicator columnKey="date" />
                            <span>Date</span>
                        </button>
                    </TableHead>
                    <TableHead className={`py-0 px-1.5 ${headCellBaseClass} text-right align-middle`} title="Income/Credit – Total Amount">
                        <button type="button" className={`${headSortButtonClass} justify-end`} onClick={() => requestSort("original")}>
                            <SortIndicator columnKey="original" />
                            <span>Original (Income)</span>
                        </button>
                    </TableHead>
                    <TableHead className={`py-0 px-1.5 ${headCellBaseClass} text-right align-middle`} title="Income/Credit">
                        <button type="button" className={`${headSortButtonClass} justify-end`} onClick={() => requestSort("extra")}>
                            <SortIndicator columnKey="extra" />
                            <span>Extra (Income)</span>
                        </button>
                    </TableHead>
                    <TableHead className={`py-0 px-1.5 ${headCellBaseClass} text-right align-middle`} title="Expense/Debit – Total Paid">
                        <button type="button" className={`${headSortButtonClass} justify-end`} onClick={() => requestSort("paid")}>
                            <SortIndicator columnKey="paid" />
                            <span>Paid (Expense)</span>
                        </button>
                    </TableHead>
                    <TableHead className={`py-0 px-1.5 ${headCellBaseClass} text-right align-middle`} title="Expense/Debit">
                        <button type="button" className={`${headSortButtonClass} justify-end`} onClick={() => requestSort("cd")}>
                            <SortIndicator columnKey="cd" />
                            <span>CD (Expense)</span>
                        </button>
                    </TableHead>
                    <TableHead className={`py-0 px-1.5 ${headCellBaseClass} text-right align-middle`} title="Net balance">
                        <button type="button" className={`${headSortButtonClass} justify-end`} onClick={() => requestSort("outstanding")}>
                            <SortIndicator columnKey="outstanding" />
                            <span>Outstanding (Net)</span>
                        </button>
                    </TableHead>
                    {isCustomer && (
                        <TableHead className={`py-0 px-1.5 ${headCellBaseClass} text-right align-middle`} title="Advance Freight taken (recover in payment)">
                            <button type="button" className={`${headSortButtonClass} justify-end`} onClick={() => requestSort("advanceFreight")}>
                                <SortIndicator columnKey="advanceFreight" />
                                <span>Adv. Freight</span>
                            </button>
                        </TableHead>
                    )}
                    <TableHead className={`py-0 px-1 ${headCellBaseClass} text-center align-middle`}>Actions</TableHead>
                </TableRow>
            </TableHeader>
        );

        const tableBody = (
            <div className={`${compact ? "text-[10px]" : "text-[12px]"} rounded-md overflow-hidden flex flex-col flex-1 min-h-0 bg-card`}>
                <div className="flex-shrink-0 bg-card border-b border-border rounded-none">
                    {showTabsInHeader && (
                        <div className="px-1 py-1 border-b border-slate-200/70">
                            <div className="flex items-center gap-1 rounded-md border border-border/50 bg-card p-0.5">
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
                                const entryKey = String(entry.id || entry.srNo || uniqueKey);

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
                                                <div className={`${amountMainClass} font-semibold leading-tight text-rose-700`}>
                                                    - {formatCurrency((entry as any).totalPaidForEntry || entry.totalPaid || 0)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right py-0 px-1.5 align-middle">
                                                <div className={`${amountSubClass} font-semibold leading-tight text-rose-700`}>
                                                    - {formatCurrency((entry as any).totalCdForEntry || entry.totalCd || 0)}
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
                                            {isCustomer && (
                                                <TableCell className="text-right py-0 px-1.5 align-middle">
                                                    <div className={`${amountSubClass} font-semibold leading-tight ${Number(entry.advanceFreight || 0) > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                                                        {Number(entry.advanceFreight || 0) > 0 ? formatCurrency(Number(entry.advanceFreight)) : '-'}
                                                    </div>
                                                </TableCell>
                                            )}
                                            <TableCell className="text-center py-0 px-1 align-middle">
                                                <div className="flex items-center justify-center gap-1">
                                                    {paymentBreakdown.length > 0 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} hover:bg-primary/10 hover:text-primary`}
                                                            onClick={() => toggleExpanded(entryKey)}
                                                            title={shouldShowBreakdown(entryKey) ? "Hide Payments" : "Show Payments"}
                                                        >
                                                            {shouldShowBreakdown(entryKey) ? (
                                                                <ChevronUp className={compact ? "h-2 w-2" : "h-2.5 w-2.5"} />
                                                            ) : (
                                                                <ChevronDown className={compact ? "h-2 w-2" : "h-2.5 w-2.5"} />
                                                            )}
                                                        </Button>
                                                    )}
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
                                        {paymentBreakdown.length > 0 && shouldShowBreakdown(entryKey) &&
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
                                    const entryKey = String(entry.id || entry.srNo || uniqueKey);

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
                                                    <div className={`${amountMainClass} font-semibold leading-tight text-rose-700`}>
                                                        - {formatCurrency((entry as any).totalPaidForEntry || entry.totalPaid || 0)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right py-0 px-1.5 align-middle">
                                                    <div className={`${amountSubClass} font-semibold leading-tight text-rose-700`}>
                                                        - {formatCurrency((entry as any).totalCdForEntry || entry.totalCd || 0)}
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
                                                {isCustomer && (
                                                    <TableCell className="text-right py-0 px-1.5 align-middle">
                                                        <div className={`${amountSubClass} font-semibold leading-tight ${Number(entry.advanceFreight || 0) > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                                                            {Number(entry.advanceFreight || 0) > 0 ? formatCurrency(Number(entry.advanceFreight)) : '-'}
                                                        </div>
                                                    </TableCell>
                                                )}
                                                <TableCell className="text-center py-0 px-1 align-middle">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {paymentBreakdown.length > 0 && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className={`${actionBtnClass} hover:bg-primary/10 hover:text-primary`} 
                                                                onClick={() => toggleExpanded(entryKey)}
                                                                title={shouldShowBreakdown(entryKey) ? "Hide Payments" : "Show Payments"}
                                                            >
                                                                {shouldShowBreakdown(entryKey) ? (
                                                                    <ChevronUp className={actionIconClass} />
                                                                ) : (
                                                                    <ChevronDown className={actionIconClass} />
                                                                )}
                                                            </Button>
                                                        )}
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
                                            {paymentBreakdown.length > 0 && shouldShowBreakdown(entryKey) &&
                                                paymentBreakdown.map((payment: any, idx: number) => {
                                                    const paymentDate =
                                                        payment.date && isValid(new Date(payment.date))
                                                            ? format(new Date(payment.date), "dd-MMM-yy")
                                                            : 'N/A';

                                                    const receiptTypeLower = String(payment.receiptType || "").trim().toLowerCase();
                                                    const drCrLower = String((payment as any).drCr || "").trim().toLowerCase();
                                                    const isLedger = receiptTypeLower === "ledger";
                                                    const isLedgerCredit = isLedger && drCrLower === "credit";

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
                                                                <div className={`${amountSubClass} font-semibold leading-tight ${
                                                                    isLedgerCredit ? "text-emerald-700" : "text-slate-400"
                                                                }`}>
                                                                    {isLedgerCredit ? formatCurrency(Math.abs(payment.amount || 0)) : "-"}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right py-0 px-1.5 align-middle">
                                                                <div className={`${amountMainClass} font-semibold leading-tight ${isLedgerCredit ? "text-slate-400" : "text-rose-700"}`}>
                                                                    {isLedgerCredit ? "-" : `- ${formatCurrency(Math.abs(payment.amount || 0))}`}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right py-0 px-1.5 align-middle">
                                                                <div className={`${amountSubClass} font-semibold leading-tight text-rose-700`}>
                                                                    - {formatCurrency(payment.cdAmount || 0)}
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
                    </ScrollArea>
                )}
            </div>
        );

        if (embed) {
            return (
                <div className="overflow-hidden rounded-md border border-border bg-card flex flex-col h-full">
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
