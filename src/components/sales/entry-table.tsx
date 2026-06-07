
"use client";

import { memo, useEffect } from "react";
import type { Customer } from "@/lib/definitions";
import { format, isValid } from "date-fns";
import { toTitleCase, formatCurrency, cn } from "@/lib/utils";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Info, Pen, Printer, Trash, Loader2 } from "lucide-react";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";


export const EntryTable = memo(function EntryTable({ 
    entries, 
    onEdit, 
    onDelete, 
    onShowDetails, 
    selectedIds, 
    onSelectionChange, 
    onPrintRow, 
    entryType = 'Supplier', 
    isDeleting = false, 
    highlightEntryId,
    totals 
}: any) {
    
    // Infinite scroll pagination
    const { visibleItems, hasMore, isLoading, scrollRef } = useInfiniteScroll(entries, {
        totalItems: entries.length,
        initialLoad: 30,
        loadMore: 30,
        threshold: 5,
        enabled: entries.length > 30,
    });

    const visibleEntries = entries.slice(0, visibleItems);
    
    // Restore scroll position from localStorage
    useEffect(() => {
        if (!scrollRef.current || typeof window === 'undefined') return;
        
        const restoreScroll = () => {
            try {
                const savedScroll = localStorage.getItem(`entry-table-scroll-position-${entryType}`);
                if (savedScroll) {
                    const scrollPosition = parseInt(savedScroll, 10);
                    if (!isNaN(scrollPosition) && scrollPosition > 0) {
                        const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
                        if (viewport) {
                            viewport.scrollTop = scrollPosition;
                        }
                    }
                }
            } catch (error) {

            }
        };
        
        // Try immediately
        restoreScroll();
        // Also try after a delay to ensure DOM is ready
        const timer = setTimeout(restoreScroll, 300);
        return () => clearTimeout(timer);
    }, [scrollRef, entryType, visibleEntries.length]);
    
    // Save scroll position to localStorage
    useEffect(() => {
        if (!scrollRef.current || typeof window === 'undefined') return;
        
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
        if (!viewport) return;
        
        let saveTimer: NodeJS.Timeout;
        const handleScroll = () => {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
                try {
                    localStorage.setItem(`entry-table-scroll-position-${entryType}`, String(viewport.scrollTop));
                } catch (error) {

                }
            }, 200);
        };
        
        viewport.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            viewport.removeEventListener('scroll', handleScroll);
            clearTimeout(saveTimer);
        };
    }, [scrollRef, entryType]);

    const handleSelectAll = (checked: boolean) => {
        const allEntryIds = entries.map((c: Customer) => c.id);
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
    
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return isValid(date) ? format(date, "dd-MMM-yy") : 'N/A';
    };

    const isCustomer = entryType === 'Customer';

    return (
        <Card>
            <CardContent className="p-0">
                <ScrollArea ref={scrollRef} className="h-[60vh]">
                    <div className="overflow-x-auto">
                        <Table className={cn("w-max table-fixed border-separate border-spacing-0", isCustomer && "min-w-[1380px]")}>
                        <TableHeader>
                            <TableRow className="bg-slate-100 hover:bg-slate-100">
                                <TableHead className="px-1 py-2 w-[35px] sticky left-0 bg-slate-100 z-20">
                                        <Checkbox
                                        checked={selectedIds.size > 0 && selectedIds.size === entries.length}
                                        onCheckedChange={handleSelectAll}
                                        aria-label="Select all rows"
                                    />
                                </TableHead>
                                <TableHead className="px-1 py-2 text-[11px] font-bold sticky left-[35px] bg-slate-100 z-20 w-[80px]">SR No/Date</TableHead>
                                <TableHead className="px-2 py-2 text-[11.5px] font-bold w-[300px]">Name/Company</TableHead>
                                
                                {isCustomer ? (
                                    <>
                                        <TableHead className="px-1.5 py-2 text-[11px] font-bold text-right w-[90px]">Gross/Teir</TableHead>
                                        <TableHead className="px-1.5 py-2 text-[11px] font-bold text-right w-[110px]">Final/Karta/Bag</TableHead>
                                        <TableHead className="px-1.5 py-2 text-[11px] font-bold text-right w-[95px]">Net Wt/Rate</TableHead>
                                        <TableHead className="px-1 py-2 text-[11px] font-bold text-center w-[100px]">Bags/Avg</TableHead>
                                        <TableHead className="px-1.5 py-2 text-[11px] font-bold text-right w-[90px]">Base Amount</TableHead>
                                        <TableHead className="px-1.5 py-2 text-[11px] font-bold text-right w-[100px]">Bag Ded/Karta</TableHead>
                                        <TableHead className="px-1.5 py-2 text-[11px] font-bold text-right w-[90px]">Final Amt</TableHead>
                                        <TableHead className="px-1.5 py-2 text-[11px] font-bold text-right w-[90px]">Brk/CD Amt</TableHead>
                                        <TableHead className="px-1.5 py-2 text-[11px] font-bold text-right w-[90px]">Transport</TableHead>
                                        <TableHead className="px-2 py-2 text-[11.5px] font-bold text-right text-primary w-[110px]">Total Rec.</TableHead>
                                    </>
                                ) : (
                                    <>
                                        <TableHead className="px-3 py-2 text-[11px] font-bold text-right">Variety / Rate</TableHead>
                                        <TableHead className="px-3 py-2 text-xs font-bold">Net Weight</TableHead>
                                        <TableHead className="text-right px-3 py-2 text-xs font-bold">Total Amount</TableHead>
                                    </>
                                )}
                                <TableHead className="text-center px-1 py-2 text-[11px] font-bold sticky right-0 bg-slate-100 z-20 w-[130px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {/* Sticky Total Row at Top */}
                            {isCustomer && totals && (
                                <TableRow className="bg-violet-50 hover:bg-violet-100 border-b-2 border-violet-200 sticky top-0 z-30 shadow-sm">
                                    <TableCell className="px-1 py-2 bg-violet-50 sticky left-0 z-30" />
                                    <TableCell className="px-1.5 py-2 text-[10px] font-bold text-violet-700 uppercase sticky left-[35px] bg-violet-50 z-30">
                                        TOTAL
                                    </TableCell>
                                    <TableCell className="px-2 py-2 text-[11px] font-bold text-violet-700">
                                        Summary ({entries.length})
                                    </TableCell>
                                    <TableCell className="px-1.5 py-2 text-[11px] font-bold text-right text-slate-700 leading-tight">
                                        <div>G:{totals.grossWt.toFixed(1)}</div>
                                        <div className="text-[9px] text-slate-500 font-normal">T:{totals.teirWt.toFixed(1)}</div>
                                    </TableCell>
                                    <TableCell className="px-1.5 py-2 text-[11px] font-bold text-right text-slate-700 leading-tight">
                                        <div className="text-slate-900">{totals.finalWt.toFixed(2)}</div>
                                        <div className="text-[9px] text-rose-600 font-normal">{totals.kartaWt.toFixed(2)} / {totals.totalBagWt.toFixed(2)}</div>
                                    </TableCell>
                                    <TableCell className="px-1.5 py-2 text-[11px] font-bold text-right text-slate-700 leading-tight">
                                        <div className="text-slate-900">{totals.netWt.toFixed(2)}</div>
                                        <div className="text-[9px] text-slate-500 font-normal">@{formatCurrency(totals.rateAvg || 0)}</div>
                                    </TableCell>
                                    <TableCell className="px-1.5 py-2 text-[12px] font-bold text-center text-violet-700 leading-tight">
                                        <div>{totals.bags}</div>
                                        <div className="text-[9px] text-slate-500 font-normal">{totals.avgBagWtAvg?.toFixed(2)}kg</div>
                                    </TableCell>
                                    <TableCell className="px-1.5 py-2 text-[11px] font-bold text-right text-slate-700">
                                        {formatCurrency(totals.baseAmt)}
                                    </TableCell>
                                    <TableCell className="px-1.5 py-2 text-[10px] font-bold text-right text-rose-600 leading-tight">
                                        <div>B:-{formatCurrency(totals.bagDedAmt)}</div>
                                        <div>K:-{formatCurrency(totals.kartaAmt)}</div>
                                    </TableCell>
                                    <TableCell className="px-1.5 py-2 text-[11px] font-bold text-right text-slate-900">
                                        {formatCurrency(totals.finalAmt)}
                                    </TableCell>
                                    <TableCell className="px-1.5 py-2 text-[10px] font-bold text-right text-slate-600 leading-tight">
                                        <div>B:-{formatCurrency(totals.brkAmt)}</div>
                                        <div>C:-{formatCurrency(totals.cdAmt)}</div>
                                    </TableCell>
                                    <TableCell className="px-1.5 py-2 text-[11px] font-bold text-right text-slate-600">
                                        +{formatCurrency(totals.transAmt)}
                                    </TableCell>
                                    <TableCell className="px-2 py-2 text-[13px] font-bold text-right text-primary">
                                        {formatCurrency(totals.totalRec)}
                                    </TableCell>
                                    <TableCell className="px-1.5 py-2 bg-violet-50 sticky right-0 z-30" />
                                </TableRow>
                            )}
                            {visibleEntries.map((entry: Customer) => {
                                const isHighlighted = highlightEntryId === entry.id;
                                
                                // User requested calculations for Table View
                                const baseAmt = Number(entry.amount || 0);
                                const kAmt = Number(entry.kartaAmount || 0);
                                const bDeduction = Number((entry as any).bagWeightDeductionAmount || 0);
                                const calculatedFinalAmount = Math.round(baseAmt - kAmt - bDeduction);
                                
                                const cdAmt = (Number(entry.amount || 0)) * ((Number(entry.cdRate || entry.cd || 0)) / 100);
                                const brkAmt = (Number(entry.weight || 0)) * (Number(entry.brokerageRate || entry.brokerage || 0));
                                const bagAmt = Number(entry.bagAmount || 0);
                                const transAmt = Number((entry as any).transportAmount || 0);
                                const kantaAmt = Number(entry.kanta || 0);
                                
                                const totalRec = Math.round(calculatedFinalAmount - cdAmt - brkAmt + bagAmt + transAmt + kantaAmt + Number(entry.advanceFreight || 0));
                                
                                const totalBagWtQtl = (Number(entry.bags || 0) * Number(entry.bagWeightKg || 0)) / 100;
                                const avgBagWtKg = Number(entry.bags || 0) > 0 ? (Number(entry.netWeight || 0) * 100) / Number(entry.bags) : 0;

                                return (
                                <TableRow 
                                    key={entry.id} 
                                    id={`entry-row-${entry.id}`}
                                    className={`h-auto transition-colors border-b ${isHighlighted ? 'bg-primary/10 ring-2 ring-primary' : ''}`}
                                    data-state={selectedIds.has(entry.id) ? 'selected' : ''}
                                >
                                    <TableCell className="px-1 py-2 align-middle sticky left-0 bg-inherit z-10">
                                        <Checkbox
                                            checked={selectedIds.has(entry.id)}
                                            onCheckedChange={() => handleRowSelect(entry.id)}
                                            aria-label={`Select row ${entry.srNo}`}
                                        />
                                    </TableCell>
                                    <TableCell className="px-1 py-2 text-[12px] align-middle sticky left-[35px] bg-inherit z-10">
                                        <div className="font-mono font-bold">{entry.srNo}</div>
                                        <div className="text-slate-500 text-[11px]">{formatDate(entry.date)}</div>
                                    </TableCell>
                                    <TableCell className="px-2 py-2 text-[12px] align-middle">
                                        <div className="font-bold text-[12.5px] truncate max-w-[290px]" title={entry.name}>{toTitleCase(entry.name)}</div>
                                        <div className="flex flex-col">
                                            <div className="text-[11px] text-slate-500 truncate max-w-[290px] font-medium">{entry.companyName ? toTitleCase(entry.companyName) : entry.contact}</div>
                                            {entry.vehicleNo && (
                                                <div className="text-[10px] font-mono text-violet-600 font-bold uppercase mt-0.5">{entry.vehicleNo}</div>
                                            )}
                                        </div>
                                    </TableCell>
                                    
                                    {isCustomer ? (
                                        <>
                                            <TableCell className="px-1.5 py-2 text-[11.5px] align-middle text-right leading-tight">
                                                <div className="text-slate-600 font-medium">G:{Number(entry.grossWeight || 0).toFixed(1)}</div>
                                                <div className="text-slate-500 text-[10px]">T:{Number(entry.teirWeight || 0).toFixed(1)}</div>
                                            </TableCell>
                                            <TableCell className="px-1.5 py-2 text-[11px] align-middle text-right leading-tight">
                                                <div className="text-slate-900 font-bold">{Number(entry.weight || 0).toFixed(2)}</div>
                                                <div className="text-rose-600 text-[9px] mt-0.5">{Number(entry.kartaWeight || 0).toFixed(2)} / {totalBagWtQtl.toFixed(2)}</div>
                                            </TableCell>
                                            <TableCell className="px-1.5 py-2 text-[11.5px] align-middle text-right leading-tight">
                                                <div className="font-bold text-slate-900">{Number(entry.netWeight).toFixed(2)}</div>
                                                <div className="text-slate-500 text-[10px]">@ {formatCurrency(Number(entry.rate || 0))}</div>
                                            </TableCell>
                                            <TableCell className="px-1.5 py-2 text-[11px] align-middle text-center leading-tight">
                                                <div className="text-violet-700 font-bold text-[12.5px]">{entry.bags || 0}</div>
                                                <div className="text-slate-500 text-[9px] mt-0.5">{avgBagWtKg.toFixed(2)}kg</div>
                                            </TableCell>
                                            <TableCell className="px-1.5 py-2 text-[11.5px] align-middle text-right">
                                                <div className="text-slate-600 font-medium">{formatCurrency(baseAmt)}</div>
                                            </TableCell>
                                            <TableCell className="px-1.5 py-2 text-[11px] align-middle text-right leading-tight">
                                                <div className="text-rose-500 font-bold">B:-{formatCurrency(bDeduction)}</div>
                                                <div className="text-rose-500 font-bold">K:-{formatCurrency(kAmt)}</div>
                                            </TableCell>
                                            <TableCell className="px-1.5 py-2 text-[11px] align-middle text-right leading-tight">
                                                <div className="font-bold text-slate-900 text-[12px]">{formatCurrency(calculatedFinalAmount)}</div>
                                            </TableCell>
                                            <TableCell className="px-1.5 py-2 text-[11px] align-middle text-right leading-tight">
                                                <div className="text-slate-600">B:-{formatCurrency(brkAmt)}</div>
                                                <div className="text-slate-600">C:-{formatCurrency(cdAmt)}</div>
                                            </TableCell>
                                            <TableCell className="px-1.5 py-2 text-[11px] align-middle text-right leading-tight">
                                                <div className="text-slate-600">+{formatCurrency(transAmt)}</div>
                                            </TableCell>
                                            <TableCell className="px-2 py-2 text-[11.5px] align-middle text-right font-bold text-slate-900">
                                                <div className="flex flex-col items-end leading-none">
                                                    <span className="text-[13.5px]">{formatCurrency(totalRec)}</span>
                                                    {entry.paymentType && (
                                                        <span className="text-[10px] font-bold text-violet-600 uppercase mt-1">{entry.paymentType}</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </>
                                    ) : (
                                        <>
                                            <TableCell className="px-3 py-2 text-[11px] align-middle text-right">
                                                <div className="font-medium">{toTitleCase(entry.variety)}</div>
                                                <div className="text-slate-500">@ {formatCurrency(Number(entry.rate || 0))}</div>
                                            </TableCell>
                                            <TableCell className="px-3 py-2 text-sm align-middle">{Number(entry.netWeight).toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-semibold px-3 py-2 text-sm align-middle">{formatCurrency(Number(entry.originalNetAmount))}</TableCell>
                                        </>
                                    )}
                                    
                                    <TableCell className="text-center px-1.5 py-2 align-middle sticky right-0 bg-inherit z-10 border-l">
                                        <div className="flex justify-center items-center gap-0">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onShowDetails(entry)} aria-label="View entry details">
                                                <Info className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(entry.id)} aria-label="Edit entry">
                                                <Pen className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPrintRow && onPrintRow(entry)} aria-label="Print entry">
                                                <Printer className="h-4 w-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isDeleting} aria-label="Delete entry">
                                                    {isDeleting ? (
                                                        <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                                                    ) : (
                                                    <Trash className="h-4 w-4 text-destructive" />
                                                    )}
                                                </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                    This action cannot be undone. This will permanently delete the entry for {toTitleCase(entry.name)} (SR No: {entry.srNo}).
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => onDelete(entry.id)} disabled={isDeleting}>
                                                        {isDeleting ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                Deleting...
                                                            </>
                                                        ) : (
                                                            'Continue'
                                                        )}
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                                );
                            })}
                            {/* NO LOADING STATES - Data loads instantly */}
                            {!hasMore && entries.length > 30 && (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-2 text-xs text-muted-foreground">
                                        Showing all {entries.length} entries
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    </div>
                    <ScrollBar orientation="horizontal" />
                    <ScrollBar orientation="vertical" />
                </ScrollArea>
            </CardContent>
        </Card>
    );
});
