
"use client";

import React from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, Info, Download, Trash2, Pen } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


export const PaymentHistory = ({ payments, onShowDetails, onPrintRtgs, onExport, onDelete, onEdit, title, suppliers }: any) => {
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
        if (payment.paidFor && payment.paidFor.length > 0) {
            return payment.paidFor.map((pf: any) => pf.srNo).join(', ');
        }
        return payment.parchiNo || '';
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
                    <span className="ml-2 text-sm text-muted-foreground">({payments.length})</span>
                </CardTitle>
                {onExport && <Button onClick={onExport} size="sm" variant="outline"><Download className="mr-2 h-4 w-4" />Export</Button>}
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto overflow-y-auto max-h-96">
                    <div className="min-w-[1000px]">
                        <Table className="w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="p-1 text-xs w-24">ID & 6R</TableHead>
                                    <TableHead className="p-1 text-xs w-20">Date</TableHead>
                                    <TableHead className="p-1 text-xs w-20">Method</TableHead>
                                    <TableHead className="p-1 text-xs w-40">Payee & Receipt</TableHead>
                                    <TableHead className="p-1 text-xs w-28">Bank</TableHead>
                                    <TableHead className="p-1 text-xs w-36">Branch & Details</TableHead>
                                    <TableHead className="p-1 text-xs w-28">Weight & Rate</TableHead>
                                    <TableHead className="text-right p-1 text-xs w-24">Amount</TableHead>
                                    <TableHead className="text-right p-1 text-xs w-20">CD</TableHead>
                                    <TableHead className="text-center p-1 text-xs w-24">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payments.map((p: any) => (
                                    <TableRow key={p.id}>
                                        <TableCell className="p-1 text-[11px] w-24" title={`ID: ${p.paymentId || p.rtgsSrNo} | 6R: ${p.sixRNo || ''}`}>
                                            <div className="text-slate-900 font-medium text-[11px] break-words">
                                                {p.paymentId || p.rtgsSrNo}
                                            </div>
                                            <div className="text-slate-700 text-[11px] break-words mt-0.5">
                                                {p.sixRNo || ''}
                                            </div>
                                        </TableCell>
                                        <TableCell className="p-1 text-[11px] w-20">
                                            <div className="break-words">{format(new Date(p.date), "dd-MMM-yy")}</div>
                                        </TableCell>
                                        <TableCell className="p-1 text-[11px] w-20">
                                            <Badge variant={p.receiptType === 'RTGS' ? 'default' : 'secondary'} className="text-[11px]">{p.receiptType}</Badge>
                                        </TableCell>
                                        <TableCell className="p-1 text-[11px] w-40" title={`Payee: ${p.supplierName || ''} | Receipt: ${getReceiptHolderName(p)} | No: ${getReceiptNumbers(p)}`}>
                                            <div className="break-words font-semibold text-slate-900 text-[11px]">
                                                {p.supplierName || ''}
                                            </div>
                                            <div className="text-slate-800 text-[11px] mt-0.5 break-words">
                                                {getReceiptHolderName(p)}
                                            </div>
                                            <div className="text-slate-700 text-[11px] mt-0.5">
                                                <div className="break-words">
                                                    {getReceiptNumbers(p)}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="p-1 text-[11px] w-28" title={(p.bankName || '').toString()}>
                                            <div className="break-words text-slate-900 font-medium text-[11px]">
                                                {p.bankName || ''}
                                            </div>
                                        </TableCell>
                                        <TableCell className="p-1 text-[11px] w-36" title={`Branch: ${p.bankBranch || ''} | IFSC: ${p.bankIfsc || ''} | Account: ${p.bankAcNo || ''}`}>
                                            <div className="text-slate-900 text-[11px] font-medium break-words">
                                                {p.bankAcNo || ''}
                                            </div>
                                            <div className="text-slate-800 text-[11px] break-words mt-0.5">
                                                {p.bankBranch || ''}
                                            </div>
                                            <div className="text-slate-700 text-[11px] break-words mt-0.5">
                                                {p.bankIfsc || ''}
                                            </div>
                                        </TableCell>
                                        <TableCell className="p-1 text-[11px] w-28" title={`Weight: ${p.quantity || 0} | Rate: ${p.rate || 0}`}>
                                            <div className="text-slate-900 text-[11px] font-medium break-words">
                                                {p.quantity || 0}
                                            </div>
                                            <div className="text-slate-800 text-[11px] break-words mt-0.5">
                                                {p.rate || 0}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right p-1 text-[11px] w-24 font-mono">
                                            <div className="break-words text-slate-900 font-semibold">{formatCurrency(p.amount)}</div>
                                        </TableCell>
                                        <TableCell className="text-right p-1 text-[11px] w-20 font-mono">
                                            <div className="break-words text-slate-800">{formatCurrency(p.cdAmount)}</div>
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
                                {payments.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={10} className="text-center text-muted-foreground h-24">No payment history found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
