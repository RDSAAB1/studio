
"use client";

import { memo, useEffect } from "react";
import type { Customer } from "@/lib/definitions";
import { format, isValid } from "date-fns";
import { toTitleCase, formatCurrency } from "@/lib/utils";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Info, Pen, Printer, Trash, Loader2 } from "lucide-react";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";


export const EntryTable = memo(function EntryTable({ entries, onEdit, onDelete, onShowDetails, selectedIds, onSelectionChange, onPrintRow, entryType = 'Supplier', isDeleting = false }: any) {
    
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
                console.warn('Error restoring scroll position:', error);
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
                    console.warn('Error saving scroll position:', error);
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

    return (
        <Card variant="default-light" shape="organic-lg">
            <CardContent className="p-0">
                <ScrollArea ref={scrollRef} className="h-[60vh]">
                    <div className="overflow-x-auto">
                        <Table className="min-w-[800px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="px-3 py-2 text-xs w-10">
                                        <Checkbox
                                        checked={selectedIds.size > 0 && selectedIds.size === entries.length}
                                        onCheckedChange={handleSelectAll}
                                        aria-label="Select all rows"
                                    />
                                </TableHead>
                                <TableHead className="px-3 py-2 text-xs">SR No.</TableHead>
                                <TableHead className="px-3 py-2 text-xs">Date</TableHead>
                                <TableHead className="px-3 py-2 text-xs">Name</TableHead>
                                <TableHead className="px-3 py-2 text-xs">Variety</TableHead>
                                <TableHead className="px-3 py-2 text-xs">Net Weight</TableHead>
                                <TableHead className="text-right px-3 py-2 text-xs">Net Amount</TableHead>
                                <TableHead className="text-center px-3 py-2 text-xs">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visibleEntries.map((entry: Customer) => (
                                <TableRow key={entry.id} className="h-12" data-state={selectedIds.has(entry.id) ? 'selected' : ''}>
                                    <TableCell className="px-3 py-1">
                                        <Checkbox
                                            checked={selectedIds.has(entry.id)}
                                            onCheckedChange={() => handleRowSelect(entry.id)}
                                            aria-label={`Select row ${entry.srNo}`}
                                        />
                                    </TableCell>
                                    <TableCell className="font-mono px-3 py-1 text-sm">{entry.srNo}</TableCell>
                                    <TableCell className="px-3 py-1 text-sm">{formatDate(entry.date)}</TableCell>
                                    <TableCell className="px-3 py-1 text-sm">{toTitleCase(entry.name)}</TableCell>
                                    <TableCell className="px-3 py-1 text-sm">{toTitleCase(entry.variety)}</TableCell>
                                    <TableCell className="px-3 py-1 text-sm">{Number(entry.netWeight).toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-semibold px-3 py-1 text-sm">{formatCurrency(Number(entry.netAmount))}</TableCell>
                                    <TableCell className="text-center px-3 py-1">
                                        <div className="flex justify-center items-center gap-0">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onShowDetails(entry)}>
                                                <Info className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(entry.id)}>
                                                <Pen className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPrintRow && onPrintRow(entry)}>
                                                <Printer className="h-4 w-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isDeleting}>
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
                            ))}
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
