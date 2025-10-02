
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


export const PaymentHistory = ({ payments, onShowDetails, onPrintRtgs, onExport, onDelete, onEdit }: any) => {
    return (
        <Card>
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Payment History</CardTitle>
                {onExport && <Button onClick={onExport} size="sm" variant="outline"><Download className="mr-2 h-4 w-4" />Export</Button>}
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-96">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="p-2 text-xs">ID</TableHead>
                                    <TableHead className="p-2 text-xs">Date</TableHead>
                                    <TableHead className="p-2 text-xs">Method</TableHead>
                                    <TableHead className="p-2 text-xs">Ref (SR#)</TableHead>
                                    <TableHead className="text-right p-2 text-xs">Amount</TableHead>
                                    <TableHead className="text-right p-2 text-xs">CD</TableHead>
                                    <TableHead className="text-center p-2 text-xs">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payments.map((p: any) => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-mono text-xs p-2">{p.paymentId || p.rtgsSrNo}</TableCell>
                                        <TableCell className="p-2 text-xs">{format(new Date(p.date), "dd-MMM-yy")}</TableCell>
                                        <TableCell className="p-2 text-xs"><Badge variant={p.receiptType === 'RTGS' ? 'default' : 'secondary'}>{p.receiptType}</Badge></TableCell>
                                        <TableCell className="text-xs max-w-[100px] truncate p-2" title={(p.paidFor || []).map((pf: any) => pf.srNo).join(', ')}>
                                            {(p.paidFor || []).map((pf: any) => pf.srNo).join(', ')}
                                        </TableCell>
                                        <TableCell className="text-right p-2 text-xs">{formatCurrency(p.amount)}</TableCell>
                                        <TableCell className="text-right p-2 text-xs">{formatCurrency(p.cdAmount)}</TableCell>
                                        <TableCell className="text-center p-0">
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
                                                                <AlertDialogAction onClick={() => onDelete(p.id)}>Delete</AlertDialogAction>
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
                                        <TableCell colSpan={7} className="text-center text-muted-foreground h-24">No payment history found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
};
