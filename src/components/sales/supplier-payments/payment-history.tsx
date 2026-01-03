
"use client";

import React from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, Info, Download, Trash2, Pen, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";


export const PaymentHistory = ({ payments, onShowDetails, onPrintRtgs, onExport, onDelete, onEdit, title, suppliers, onParchiSelect }: any) => {
    // Helper: normalize payment id for sorting
    const getIdForSort = React.useCallback((payment: any): string => {
        const rawId = payment?.id || payment?.paymentId || payment?.rtgsSrNo || '';
        return String(rawId).trim().replace(/\s+/g, '');
    }, []);

    // Helper: parse ID into prefix and numeric part for proper sorting
    // Handles IDs like E832, EX00118, EX0000174, EX00839.1, P00081, RT00393
    const parseIdForSort = React.useCallback((id: string): { prefix: string; numericValue: number; decimalValue: number } => {
        if (!id || typeof id !== 'string') return { prefix: '', numericValue: 0, decimalValue: 0 };
        
        // Clean the ID - remove any non-alphanumeric characters except dots
        const cleanId = id.trim().replace(/[^A-Za-z0-9.]/g, '');
        if (!cleanId) return { prefix: '', numericValue: 0, decimalValue: 0 };
        
        // Extract prefix (letters), number, and optional decimal part
        // Pattern: letters + digits + optional decimal point + optional decimal digits
        const match = cleanId.match(/^([A-Za-z]*)(\d+)(?:\.(\d+))?$/);
        if (match && match[2]) {
            const prefix = match[1] || '';
            const numberStr = match[2] || '0';
            const decimalStr = match[3] || '0';
            
            // Convert to numbers for proper numeric comparison
            const numericValue = parseInt(numberStr, 10);
            const decimalValue = decimalStr ? parseInt(decimalStr, 10) : 0;
            
            // Validate that parsing was successful
            if (!isNaN(numericValue)) {
                return { prefix, numericValue, decimalValue };
            }
        }
        
        // Fallback: if no match or parsing failed, treat entire ID as string for prefix comparison
        return { prefix: cleanId || id, numericValue: 0, decimalValue: 0 };
    }, []);

    // Sort payments by ID in descending order - prefix first, then number (highest first)
    // This ensures proper sorting even if parent doesn't sort correctly
    const sortedPayments = React.useMemo(() => {
        if (!payments || payments.length === 0) return [];
        
        // Create a copy and sort it
        const sorted = [...payments].sort((a, b) => {
            try {
                const idA = getIdForSort(a);
                const idB = getIdForSort(b);
                
                if (!idA && !idB) return 0;
                if (!idA) return 1;
                if (!idB) return -1;
                
                const parsedA = parseIdForSort(idA);
                const parsedB = parseIdForSort(idB);
                
                // First compare prefixes alphabetically (case-insensitive)
                const prefixA = parsedA.prefix.toUpperCase();
                const prefixB = parsedB.prefix.toUpperCase();
                const prefixCompare = prefixA.localeCompare(prefixB);
                if (prefixCompare !== 0) return prefixCompare;
                
                // If prefixes are same, compare numbers numerically (descending - highest first)
                if (parsedA.numericValue !== parsedB.numericValue) {
                    return parsedB.numericValue - parsedA.numericValue;
                }
                
                // If numbers are same, compare decimal parts (descending)
                return parsedB.decimalValue - parsedA.decimalValue;
            } catch (error) {
                console.error('Error sorting payment:', error, a, b);
                return 0;
            }
        });
        
        return sorted;
    }, [payments, getIdForSort, parseIdForSort]);

    // Infinite scroll pagination
    const { visibleItems, hasMore, isLoading, scrollRef } = useInfiniteScroll(sortedPayments, {
        totalItems: sortedPayments.length,
        initialLoad: 30,
        loadMore: 30,
        threshold: 5,
        enabled: sortedPayments.length > 30,
    });

    const visiblePayments = sortedPayments.slice(0, visibleItems);

    // Helper function to get receipt holder name from supplier data
    const getReceiptHolderName = React.useCallback((payment: any) => {
        // First try parchiName field
        if (payment.parchiName) return payment.parchiName;
        
        // If no parchiName, try to get from paidFor array
        if (payment.paidFor && payment.paidFor.length > 0) {
            const firstPaidFor = payment.paidFor[0];
            if (firstPaidFor.supplierName) return firstPaidFor.supplierName;
            
            // If no supplierName in paidFor, try to find from suppliers data
            if (suppliers && firstPaidFor.srNo) {
                const supplier = suppliers.find((s: any) => s.srNo === firstPaidFor.srNo);
                if (supplier) return supplier.name;
            }
        }
        
        // Fallback to parchiNo
        return payment.parchiNo || '';
    }, [suppliers]);

    // Helper function to get receipt numbers from paidFor array
    const getReceiptNumbers = React.useCallback((payment: any) => {
        // First check if parchiNo exists directly
        if (payment.parchiNo) {
            return payment.parchiNo;
        }
        // Then check paidFor array
        if (payment.paidFor && payment.paidFor.length > 0) {
            const srNos = payment.paidFor.map((pf: any) => pf.srNo).filter(Boolean);
            if (srNos.length > 0) {
                return srNos.join(', ');
            }
        }
        return '';
    }, []);

    // Helper function to check if receipt numbers should be on new line
    const shouldReceiptNumbersBeOnNewLine = React.useCallback((payment: any) => {
        const receiptNumbers = getReceiptNumbers(payment);
        return receiptNumbers.split(',').length > 3;
    }, [getReceiptNumbers]);
    
    return (
        <Card>
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                    {title || 'Payment History'} 
                    <span className="ml-2 text-sm text-muted-foreground">({sortedPayments.length})</span>
                </CardTitle>
                {onExport && <Button onClick={onExport} size="sm" variant="outline"><Download className="mr-2 h-4 w-4" />Export</Button>}
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea ref={scrollRef} className="h-96">
                    <div className="overflow-x-auto">
                        <div className="min-w-[1000px]">
                            <Table className="w-full">
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="p-1 text-xs w-24 font-bold text-foreground">ID</TableHead>
                                        <TableHead className="p-1 text-xs w-20 font-bold text-foreground">Method</TableHead>
                                        <TableHead className="p-1 text-xs w-40 font-bold text-foreground">Payee & Receipt</TableHead>
                                        <TableHead className="p-1 text-xs w-28 font-bold text-foreground">Bank / Gov. Required</TableHead>
                                        <TableHead className="p-1 text-xs w-36 font-bold text-foreground">Branch & Details / Extra</TableHead>
                                        <TableHead className="p-1 text-xs w-28 font-bold text-foreground">Weight & Rate / Gov. Qty & Rate</TableHead>
                                        <TableHead className="text-right p-1 text-xs w-24 font-bold text-foreground">Amount</TableHead>
                                        <TableHead className="text-right p-1 text-xs w-20 font-bold text-foreground">CD</TableHead>
                                        <TableHead className="text-center p-1 text-xs w-24 font-bold text-foreground">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {visiblePayments.map((p: any, index: number) => (
                                    <TableRow 
                                        key={`${p.id || p.paymentId || p.rtgsSrNo || index}-${p.date || ''}`} 
                                        className="hover:bg-muted/50"
                                        onClick={(e) => {
                                            // Prevent row click from interfering with button click
                                            const target = e.target as HTMLElement;
                                            if (target.tagName === 'BUTTON' || target.closest('button')) {
                                                return;
                                            }
                                        }}
                                    >
                                        <TableCell className="p-1 text-[11px] w-24" title={`ID: ${p.paymentId || p.rtgsSrNo}`}>
                                            <div className="text-foreground font-semibold text-[11px] break-words">
                                                {p.paymentId || p.rtgsSrNo}
                                            </div>
                                        </TableCell>
                                        <TableCell className="p-1 text-[11px] w-20">
                                            <Badge variant={p.receiptType === 'RTGS' ? 'default' : p.receiptType === 'Gov.' ? 'default' : 'secondary'} className="text-[11px] font-medium">{p.receiptType}</Badge>
                                        </TableCell>
                                        <TableCell 
                                            className="p-1 text-[11px] w-40 cursor-pointer" 
                                            title={`Payee: ${p.supplierName || ''} | Receipt: ${getReceiptHolderName(p)} | No: ${getReceiptNumbers(p)} | Click receipt number to use as reference`}
                                            onClick={(e) => {
                                                // Make the entire cell clickable for receipt numbers
                                                const target = e.target as HTMLElement;
                                                // Only trigger if clicking on the receipt number area (not on other elements)
                                                if (target.closest('.receipt-number-area') || target.classList.contains('receipt-number-area')) {

                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    
                                                    if (onParchiSelect) {
                                                        const receiptNumbers = getReceiptNumbers(p);
                                                        const parchiValue = p.parchiNo || receiptNumbers;

                                                        if (parchiValue) {

                                                            onParchiSelect(parchiValue);
                                                        }
                                                    }
                                                }
                                            }}
                                        >
                                            <div className="break-words font-bold text-foreground text-[11px]">
                                                {p.supplierName || ''}
                                            </div>
                                            <div className="text-foreground/90 text-[11px] mt-0.5 break-words font-semibold">
                                                {getReceiptHolderName(p)}
                                            </div>
                                            <div 
                                                className="text-muted-foreground text-[11px] mt-0.5 receipt-number-area hover:text-primary hover:underline cursor-pointer"
                                                onClick={(e) => {

                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    
                                                    if (onParchiSelect) {
                                                        const receiptNumbers = getReceiptNumbers(p);
                                                        const parchiValue = p.parchiNo || receiptNumbers;

                                                        if (parchiValue) {

                                                            onParchiSelect(parchiValue);
                                                        } else {

                                                        }
                                                    } else {

                                                    }
                                                }}
                                                title="Click to use as reference"
                                            >
                                                {getReceiptNumbers(p)}
                                            </div>
                                        </TableCell>
                                        {p.receiptType === 'Gov.' ? (
                                            <>
                                                <TableCell className="p-1 text-[11px] w-28" title="Gov. Required Amount">
                                                    <div className="break-words text-foreground font-bold text-[11px]">
                                                        {formatCurrency((p as any).govRequiredAmount || 0)}
                                                    </div>
                                                    <div className="text-muted-foreground text-[10px] mt-0.5">
                                                        Required
                                                    </div>
                                                </TableCell>
                                                <TableCell className="p-1 text-[11px] w-36" title={`Extra Amount: ${formatCurrency((p as any).extraAmount || 0)}`}>
                                                    <div className="text-foreground text-[11px] font-bold break-words">
                                                        {formatCurrency((p as any).extraAmount || 0)}
                                                    </div>
                                                    <div className="text-muted-foreground text-[10px] mt-0.5">
                                                        Extra
                                                    </div>
                                                </TableCell>
                                                <TableCell className="p-1 text-[11px] w-28" title={`Gov. Quantity: ${(p as any).govQuantity || 0} | Gov. Rate: ${(p as any).govRate || 0} | Gov. Amount: ${formatCurrency((p as any).govAmount || 0)}`}>
                                                    <div className="text-foreground text-[11px] font-bold break-words">
                                                        {(p as any).govQuantity || 0}
                                                    </div>
                                                    <div className="text-foreground/90 text-[11px] break-words mt-0.5 font-semibold">
                                                        {(p as any).govRate || 0}
                                                    </div>
                                                    <div className="text-muted-foreground text-[10px] break-words mt-0.5 font-medium">
                                                        {formatCurrency((p as any).govAmount || 0)}
                                                    </div>
                                                </TableCell>
                                            </>
                                        ) : (
                                            <>
                                                <TableCell className="p-1 text-[11px] w-28" title={(p.bankName || '').toString()}>
                                                    <div className="break-words text-foreground font-bold text-[11px]">
                                                        {p.bankName || ''}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="p-1 text-[11px] w-36" title={`Branch: ${p.bankBranch || ''} | IFSC: ${p.bankIfsc || ''} | Account: ${p.bankAcNo || ''}`}>
                                                    <div className="text-foreground text-[11px] font-bold break-words">
                                                        {p.bankAcNo || ''}
                                                    </div>
                                                    <div className="text-foreground/90 text-[11px] break-words mt-0.5 font-semibold">
                                                        {p.bankBranch || ''}
                                                    </div>
                                                    <div className="text-muted-foreground text-[11px] break-words mt-0.5 font-medium">
                                                        {p.bankIfsc || ''}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="p-1 text-[11px] w-28" title={`Weight: ${p.quantity || 0} | Rate: ${p.rate || 0}`}>
                                                    <div className="text-foreground text-[11px] font-bold break-words">
                                                        {p.quantity || 0}
                                                    </div>
                                                    <div className="text-foreground/90 text-[11px] break-words mt-0.5 font-semibold">
                                                        {p.rate || 0}
                                                    </div>
                                                </TableCell>
                                            </>
                                        )}
                                        <TableCell className="text-right p-1 text-[11px] w-24 font-mono">
                                            <div className="break-words text-foreground font-bold">{formatCurrency(p.amount)}</div>
                                        </TableCell>
                                        <TableCell className="text-right p-1 text-[11px] w-20 font-mono">
                                            <div className="break-words text-foreground font-semibold">{formatCurrency(p.cdAmount)}</div>
                                        </TableCell>
                                        <TableCell className="text-center p-0 w-24">
                                            <div className="flex justify-center items-center gap-0">
                                                {p.receiptType === 'RTGS' && (
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPrintRtgs(p)}>
                                                        <Printer className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onShowDetails(p)}>
                                                    <Info className="h-4 w-4" />
                                                </Button>
                                                {onEdit && (
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(p)}>
                                                        <Pen className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                {onDelete && (
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader><AlertDialogTitle>Delete Payment?</AlertDialogTitle><AlertDialogDescription>This will permanently delete payment {p.paymentId || p.rtgsSrNo} and restore outstanding balances. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => onDelete(p)}>Delete</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    ))}
                                    {isLoading && (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center py-4">
                                                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                                <span className="ml-2 text-sm text-muted-foreground">Loading more payments...</span>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {!hasMore && sortedPayments.length > 30 && (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center py-2 text-xs text-muted-foreground">
                                                Showing all {sortedPayments.length} payments
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {sortedPayments.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center text-muted-foreground h-24">No payment history found.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
};
