
"use client";

import React, { useMemo, useRef } from 'react';
import type { CustomerSummary } from "@/lib/definitions";
import { toTitleCase, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Download, Printer } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export const StatementPreview = ({ data }: { data: CustomerSummary | null }) => {
    const { toast } = useToast();
    const statementRef = useRef<HTMLDivElement>(null);

    if (!data) return null;

    const transactions = useMemo(() => {
        const allTransactions = data.allTransactions || [];
        const allPayments = data.allPayments || [];
        
        const mappedTransactions = allTransactions.map(t => ({
            date: t.date,
            particulars: `Purchase (SR# ${t.srNo})`,
            debit: t.originalNetAmount || 0,
            credit: 0,
        }));
        
        const mappedPayments = allPayments.map(p => ({
            date: p.date,
            particulars: `Payment (ID# ${p.paymentId})`,
            debit: 0,
            credit: p.amount + (p.cdAmount || 0),
        }));

        const combined = [...mappedTransactions, ...mappedPayments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let runningBalance = 0;
        return combined.map(item => {
            runningBalance += item.debit - item.credit;
            return { ...item, balance: runningBalance };
        });
    }, [data]);

    const totalDebit = transactions.reduce((sum, item) => sum + item.debit, 0);
    const totalCredit = transactions.reduce((sum, item) => sum + item.credit, 0);
    const closingBalance = totalDebit - totalCredit;

     const handlePrint = () => {
        const node = statementRef.current;
        if (!node) {
            toast({ title: 'Error', description: 'Could not find printable content.', variant: 'destructive'});
            return;
        }

        const newWindow = window.open('', '', 'height=800,width=1200');
        if (newWindow) {
            const document = newWindow.document;
            document.write(`
                <html>
                    <head>
                        <title>Print Statement</title>
                        <style>
                            /* Include basic styles for printing */
                            body { font-family: 'Inter', sans-serif; margin: 20px; font-size: 14px; }
                            table { width: 100%; border-collapse: collapse; }
                            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                            th { background-color: #f2f2f2; }
                            .no-print { display: none; }
                             @media print {
                                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                                .printable-area { background-color: #fff !important; color: #000 !important; }
                                .printable-area * { color: #000 !important; border-color: #ccc !important; }
                                .print-bg-gray-800 {
                                    background-color: #f2f2f2 !important; /* Light gray for print */
                                    color: #000 !important;
                                    -webkit-print-color-adjust: exact;
                                    print-color-adjust: exact;
                                }
                             }
                        </style>
                    </head>
                    <body>
                    </body>
                </html>
            `);

            // Use a more robust method to clone and append styles
            Array.from(window.document.styleSheets).forEach(styleSheet => {
                try {
                    const css = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('');
                    const styleElement = document.createElement('style');
                    styleElement.appendChild(document.createTextNode(css));
                    newWindow.document.head.appendChild(styleElement);
                } catch (e) {
                    console.warn('Could not copy stylesheet:', e);
                }
            });

            document.body.innerHTML = node.innerHTML;
            
            setTimeout(() => {
                newWindow.focus();
                newWindow.print();
                newWindow.close();
            }, 500);
        } else {
            toast({ title: 'Print Error', description: 'Please allow pop-ups for this site to print.', variant: 'destructive'});
        }
    };
    
    return (
    <>
        <DialogHeader className="p-4 sm:p-6 pb-0 no-print">
             <DialogTitle>Account Statement for {data.name}</DialogTitle>
             <DialogDescription className="sr-only">
             A detailed summary and transaction history for {data.name}.
             </DialogDescription>
        </DialogHeader>
        <div ref={statementRef} className="printable-statement bg-white p-4 sm:p-6 font-sans text-black">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start pb-4 border-b mb-4">
                <div className="mb-4 sm:mb-0">
                    <h2 className="text-xl font-bold">BizSuite DataFlow</h2>
                    <p className="text-xs text-gray-600">{toTitleCase(data.name)}</p>
                    <p className="text-xs text-gray-600">{toTitleCase(data.address || '')}</p>
                    <p className="text-xs text-gray-600">{data.contact}</p>
                </div>
                <div className="text-left sm:text-right w-full sm:w-auto">
                        <h1 className="text-2xl font-bold text-primary">Statement of Account</h1>
                        <div className="mt-2 text-sm w-full sm:w-80 border-t pt-1">
                        <div className="flex justify-between">
                            <span className="font-semibold">Statement Date:</span>
                            <span>{format(new Date(), 'dd-MMM-yyyy')}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-semibold">Closing Balance:</span>
                            <span className="font-bold">{formatCurrency(data.totalOutstanding)}</span>
                        </div>
                        </div>
                </div>
            </div>

            {/* Summary Section */}
             <Card className="mb-6">
                <CardContent className="p-4">
                    <div className="summary-grid-container grid grid-cols-1 md:grid-cols-3 gap-x-6">
                        {/* Operational Summary */}
                        <div className="text-sm">
                            <h3 className="font-semibold text-primary mb-2 text-base border-b pb-1">Operational</h3>
                             <table className="w-full"><tbody>
                                <tr><td className="py-0.5 text-gray-600">Gross Wt</td><td className="py-0.5 text-right font-semibold">{`${(data.totalGrossWeight || 0).toFixed(2)} kg`}</td></tr>
                                <tr><td className="py-0.5 text-gray-600">Teir Wt</td><td className="py-0.5 text-right font-semibold">{`${(data.totalTeirWeight || 0).toFixed(2)} kg`}</td></tr>
                                <tr className="font-bold border-t"><td className="py-1">Final Wt</td><td className="py-1 text-right font-semibold">{`${(data.totalFinalWeight || 0).toFixed(2)} kg`}</td></tr>
                                <tr><td className="py-0.5 text-gray-600">Karta Wt</td><td className="py-0.5 text-right font-semibold">{`${(data.totalKartaWeight || 0).toFixed(2)} kg`}</td></tr>
                                <tr className="font-bold text-primary border-t"><td className="py-1">Net Wt</td><td className="py-1 text-right">{`${(data.totalNetWeight || 0).toFixed(2)} kg`}</td></tr>
                            </tbody></table>
                        </div>
                        {/* Deduction Summary */}
                        <div className="text-sm">
                            <h3 className="font-semibold text-primary mb-2 text-base border-b pb-1">Deductions</h3>
                            <table className="w-full"><tbody>
                                <tr><td className="py-0.5 text-gray-600">Total Amount</td><td className="py-0.5 text-right font-semibold">{`${formatCurrency(data.totalAmount || 0)}`}</td></tr>
                                <tr className="border-t"><td className="py-0.5 text-gray-600">Karta</td><td className="py-0.5 text-right font-semibold">{`- ${formatCurrency(data.totalKartaAmount || 0)}`}</td></tr>
                                <tr><td className="py-0.5 text-gray-600">Laboury</td><td className="py-0.5 text-right font-semibold">{`- ${formatCurrency(data.totalLabouryAmount || 0)}`}</td></tr>
                                <tr><td className="py-0.5 text-gray-600">Kanta</td><td className="py-0.5 text-right font-semibold">{`- ${formatCurrency(data.totalKanta || 0)}`}</td></tr>
                                <tr><td className="py-0.5 text-gray-600">Other</td><td className="py-0.5 text-right font-semibold">{`- ${formatCurrency(data.totalOtherCharges || 0)}`}</td></tr>
                                <tr className="font-bold text-primary border-t"><td className="py-1">Original Amount</td><td className="py-1 text-right">{formatCurrency(data.totalOriginalAmount || 0)}</td></tr>
                            </tbody></table>
                        </div>
                        {/* Financial Summary */}
                        <div className="text-sm">
                            <h3 className="font-semibold text-primary mb-2 text-base border-b pb-1">Financial</h3>
                            <table className="w-full"><tbody>
                                <tr><td className="py-0.5 text-gray-600">Original Purchases</td><td className="py-0.5 text-right font-semibold">{formatCurrency(data.totalOriginalAmount || 0)}</td></tr>
                                <tr className="border-t"><td className="py-0.5 text-gray-600">Total Paid</td><td className="py-0.5 text-right font-semibold text-green-600">{`${formatCurrency(data.totalPaid || 0)}`}</td></tr>
                                <tr><td className="py-0.5 text-gray-600">Total CD Granted</td><td className="py-0.5 text-right font-semibold">{`${formatCurrency(data.totalCdAmount || 0)}`}</td></tr>
                                <tr className="font-bold text-destructive border-t"><td className="py-1">Outstanding Balance</td><td className="py-1 text-right">{`${formatCurrency(data.totalOutstanding)}`}</td></tr>
                            </tbody></table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Transaction Table */}
            <div>
                <h2 className="text-lg font-semibold border-b pb-1 mb-2">TRANSACTIONS</h2>
                <div className="overflow-x-auto border rounded-lg">
                    <Table className="print-table min-w-full">
                        <TableHeader>
                            <TableRow className="bg-gray-100">
                                <TableHead className="py-2 px-3">Date</TableHead>
                                <TableHead className="py-2 px-3">Particulars</TableHead>
                                <TableHead className="text-right py-2 px-3">Debit</TableHead>
                                <TableHead className="text-right py-2 px-3">Credit</TableHead>
                                <TableHead className="text-right py-2 px-3">Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell colSpan={4} className="font-semibold py-2 px-3">Opening Balance</TableCell>
                                <TableCell className="text-right font-semibold font-mono py-2 px-3">{formatCurrency(0)}</TableCell>
                            </TableRow>
                            {transactions.map((item, index) => (
                                <TableRow key={index} className="[&_td]:py-2 [&_td]:px-3">
                                    <TableCell>{format(new Date(item.date), "dd-MMM-yy")}</TableCell>
                                    <TableCell>{item.particulars}</TableCell>
                                    <TableCell className="text-right font-mono">{item.debit > 0 ? formatCurrency(item.debit) : '-'}</TableCell>
                                    <TableCell className="text-right font-mono">{item.credit > 0 ? formatCurrency(item.credit) : '-'}</TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(item.balance)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="bg-gray-100 font-bold">
                                <TableCell colSpan={2} className="py-2 px-3">Closing Balance</TableCell>
                                <TableCell className="text-right font-mono py-2 px-3">{formatCurrency(totalDebit)}</TableCell>
                                <TableCell className="text-right font-mono py-2 px-3">{formatCurrency(totalCredit)}</TableCell>
                                <TableCell className="text-right font-mono py-2 px-3">{formatCurrency(closingBalance)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </div>

             {/* Reminder Section */}
            <div className="mt-6">
                    <h2 className="text-lg font-semibold border-b pb-1 mb-2">REMINDER</h2>
                    <div className="border rounded-lg p-4 min-h-[80px] text-sm text-gray-600">
                    Payment is due by the date specified.
                    </div>
            </div>
        </div>
        <DialogFooter className="p-4 border-t no-print">
            <Button variant="outline" onClick={() => (document.querySelector('.printable-statement-container [aria-label="Close"]') as HTMLElement)?.click()}>Close</Button>
            <div className="flex-grow" />
            <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4"/> Print</Button>
            <Button onClick={handlePrint}><Download className="mr-2 h-4 w-4"/> Download PDF</Button>
        </DialogFooter>
    </>
    );
};
