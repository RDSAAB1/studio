
"use client";

import React, { useMemo, useRef } from 'react';
import type { CustomerSummary } from "@/lib/definitions";
import { toTitleCase, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Download, Printer } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { formatDate } from "@/lib/date-utils";
import { SupplierSummaryCards } from "@/components/sales/supplier-payments/supplier-summary-cards";
import { printHtmlContent } from "@/lib/electron-print";

export const StatementPrintTemplate = ({ data }: { data: CustomerSummary | null }) => {
    const { toast } = useToast();
    const statementRef = React.useRef<HTMLDivElement>(null);

    const toNumber = (value: number | string | null | undefined) => {
        const numericValue = Number(value);
        return Number.isFinite(numericValue) ? numericValue : 0;
    };

    const formatDecimal = (value: number | string | null | undefined) => {
        return toNumber(value).toFixed(2);
    };

    const formatWeight = (value: number | string | null | undefined) => {
        return `${formatDecimal(value)} kg`;
    };

    const formatPercentage = (value: number | string | null | undefined) => {
        return `${formatDecimal(value)}%`;
    };

    const transactions = useMemo(() => {
        if (!data) return [];
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
            credit: p.amount,
        }));

        const combined = [...mappedTransactions, ...mappedPayments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let runningBalance = 0;
        return combined.map(item => {
            runningBalance += item.debit - item.credit;
            return { ...item, balance: runningBalance };
        });
    }, [data]);
    
    if (!data) return null;

    const totalDebit = transactions.reduce((sum, item) => sum + item.debit, 0);
    const totalCredit = transactions.reduce((sum, item) => sum + item.credit, 0);
    const closingBalance = data.totalOutstanding; // Use the already calculated precise outstanding

     const handlePrint = () => {
        const node = statementRef.current;
        if (!node) {
            toast({ title: 'Error', description: 'Could not find printable content.', variant: 'destructive'});
            return;
        }

        const customStyles = `
            @media print {
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .printable-area { background-color: #fff !important; color: #000 !important; }
                .printable-area * { color: #000 !important; border-color: #ccc !important; }
                .summary-grid-container { display: flex !important; flex-wrap: nowrap !important; }
                .summary-grid-container > div { flex: 1; }
                .print-table tbody tr { background-color: transparent !important; }
                .print-bg-gray-800 {
                    background-color: #f2f2f2 !important; /* Light gray for print */
                    color: #000 !important;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
            }
        `;

        printHtmlContent(node.outerHTML, customStyles);
    };
    
    return (
    <>
        <style>
        {`
            @media print {
              .print-table tbody tr {
                  background-color: transparent !important;
              }
              .print-table th, .print-table td {
                  padding: 6px 9px;
                  font-size: 13px !important;
                  line-height: 1.3 !important;
                  color: #222222 !important;
              }
              .print-table th {
                  font-weight: 600 !important;
                  color: #333333 !important;
              }

              /* Dashboard summary layout for print (SupplierSummaryCards) */
              /* Flattened, professional summary block for print */
              .supplier-summary-dashboard-root {
                  background-color: #ffffff !important;
                  border-radius: 0.3rem !important;
                  padding: 4px 4px 2px 4px !important;
                  margin-bottom: 6px !important;
                  border: none !important;
              }
              .supplier-summary-dashboard-top,
              .supplier-summary-dashboard-middle,
              .supplier-summary-dashboard-bottom {
                  display: grid !important;
                  gap: 0.5rem !important;
              }
              .supplier-summary-dashboard-top {
                  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
              }
              .supplier-summary-dashboard-middle,
              .supplier-summary-dashboard-bottom {
                  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
              }
              .supplier-summary-dashboard-card {
                  border-radius: 0.25rem !important;
                  border: none !important;
                  padding: 2px 4px !important;
                  background-color: transparent !important;
                  box-shadow: none !important;
              }

              /* Top metric row: add subtle bottom border */
              .supplier-summary-dashboard-top .supplier-summary-dashboard-card {
                  border-bottom: 1px solid #e5e7eb !important;
              }

              /* Compact typography for summary (print-only) */
              .supplier-summary-dashboard-root .text-base {
                  font-size: 9px !important;
                  line-height: 1.2 !important;
              }
              .supplier-summary-dashboard-root .text-[10px] {
                  font-size: 7px !important;
                  line-height: 1.2 !important;
              }

              /* Soften summary colours / weights for cleaner look */
              .supplier-summary-dashboard-root .text-slate-900 {
                  color: #222222 !important;
                  font-weight: 500 !important;
              }
              .supplier-summary-dashboard-root .text-slate-800,
              .supplier-summary-dashboard-root .text-slate-700,
              .supplier-summary-dashboard-root .text-slate-600 {
                  color: #666666 !important;
                  font-weight: 500 !important;
              }
              .supplier-summary-dashboard-root .font-bold {
                  font-weight: 600 !important;
              }
              .supplier-summary-dashboard-root .font-semibold {
                  font-weight: 500 !important;
              }

              /* Top 4 KPI cards – larger amount text for print */
              .supplier-summary-dashboard-top .text-base {
                  font-size: 16px !important;
                  font-weight: 700 !important;
                  color: #111111 !important;
                  line-height: 1.25 !important;
              }
              .supplier-summary-dashboard-top .text-[10px] {
                  font-size: 10px !important;
                  font-weight: 500 !important;
              }

              /* Coloured amount cells for table */
              .debit-cell,
              .closing-debit {
                  color: #b91c1c !important; /* red */
              }
              .credit-cell,
              .closing-credit {
                  color: #15803d !important; /* green */
              }
              .balance-cell,
              .closing-balance,
              .opening-amount {
                  color: #111827 !important; /* near-black */
                  font-weight: 600 !important;
              }
              .opening-label,
              .closing-label {
                  color: #4b5563 !important; /* gray-600 */
              }
            }
        `}
        </style>
        <DialogHeader className="p-4 sm:p-6 pb-0 no-print">
             <DialogTitle>Account Statement for {data.name}</DialogTitle>
             <DialogDescription className="sr-only">
             A detailed summary and transaction history for {data.name}.
             </DialogDescription>
        </DialogHeader>
        <div ref={statementRef} className="printable-area bg-white p-4 sm:p-6 font-sans text-black">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start pb-4 border-b border-gray-300 mb-4">
                <div className="mb-4 sm:mb-0">
                    <h2 className="text-xl font-bold text-black">BizSuite DataFlow</h2>
                    <p className="text-xs text-gray-600">{toTitleCase(data.name)}</p>
                    <p className="text-xs text-gray-600">{toTitleCase(data.address || '')}</p>
                    <p className="text-xs text-gray-600">{data.contact}</p>
                </div>
                <div className="text-left sm:text-right w-full sm:w-auto">
                        <h1 className="text-2xl font-bold text-black">Statement of Account</h1>
                        <div className="mt-2 text-sm w-full sm:w-80 border-t border-gray-300 pt-1">
                        <div className="flex justify-between">
                            <span className="font-semibold text-black">Statement Date:</span>
                            <span className="text-black">
                                {formatDate(new Date(), "dd-MMM-yyyy")}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-semibold text-black">Closing Balance:</span>
                            <span className="font-bold text-black">{formatCurrency(data.totalOutstanding)}</span>
                        </div>
                        </div>
                </div>
            </div>

            {/* Summary Section – use same dashboard summary as unified payments */}
            <div className="mb-4">
                <SupplierSummaryCards
                    summary={data as any}
                    variant="dashboard"
                    type="supplier"
                />
            </div>

            {/* Transaction Table */}
            <div>
                <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2 text-black">TRANSACTIONS</h2>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <Table className="print-table min-w-full">
                        <TableHeader>
                            <TableRow className="bg-gray-100">
                                <TableHead className="py-2 px-3 text-black">Date</TableHead>
                                <TableHead className="py-2 px-3 text-black">Particulars</TableHead>
                                <TableHead className="text-right py-2 px-3 text-black">Debit</TableHead>
                                <TableHead className="text-right py-2 px-3 text-black">Credit</TableHead>
                                <TableHead className="text-right py-2 px-3 text-black">Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell colSpan={4} className="font-semibold py-2 px-3 text-gray-700 opening-label">Opening Balance</TableCell>
                                <TableCell className="text-right font-semibold font-mono py-2 px-3 text-gray-900 opening-amount">{formatCurrency(0)}</TableCell>
                            </TableRow>
                            {transactions.map((item, index) => (
                                <TableRow key={index} className="[&_td]:py-2 [&_td]:px-3">
                                    <TableCell className="text-gray-800">
                                        {formatDate(item.date, "dd-MMM-yy")}
                                    </TableCell>
                                    <TableCell className="text-gray-800">{item.particulars}</TableCell>
                                    <TableCell className="text-right font-mono debit-cell">{item.debit > 0 ? formatCurrency(item.debit) : '-'}</TableCell>
                                    <TableCell className="text-right font-mono credit-cell">{item.credit > 0 ? formatCurrency(item.credit) : '-'}</TableCell>
                                    <TableCell className="text-right font-mono balance-cell">{formatCurrency(item.balance)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="bg-gray-100 font-bold">
                                <TableCell colSpan={2} className="py-2 px-3 text-gray-700 closing-label">Closing Balance</TableCell>
                                <TableCell className="text-right font-mono py-2 px-3 text-red-700 closing-debit">{formatCurrency(totalDebit)}</TableCell>
                                <TableCell className="text-right font-mono py-2 px-3 text-emerald-700 closing-credit">{formatCurrency(totalCredit)}</TableCell>
                                <TableCell className="text-right font-mono py-2 px-3 text-gray-900 closing-balance">{formatCurrency(closingBalance)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </div>

             {/* Reminder Section */}
            <div className="mt-6">
                    <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2 text-black">REMINDER</h2>
                    <div className="border border-gray-200 rounded-lg p-4 min-h-[80px] text-sm text-gray-600">
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
