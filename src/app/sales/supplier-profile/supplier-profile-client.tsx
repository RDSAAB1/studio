
"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Customer as Supplier, CustomerSummary, Payment, CustomerPayment } from "@/lib/definitions";
import { toTitleCase, cn, formatCurrency } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useSupplierData } from '@/hooks/use-supplier-data';


// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { DetailsDialog } from "@/components/sales/details-dialog";
import { PaymentDetailsDialog } from "@/components/sales/supplier-payments/payment-details-dialog";
import { SupplierProfileView } from "@/app/sales/supplier-profile/supplier-profile-view";
import { getSuppliersRealtime, getPaymentsRealtime } from '@/lib/firestore';


// Icons
import { Users, Calendar as CalendarIcon, Download, Printer, Loader2 } from "lucide-react";

const MILL_OVERVIEW_KEY = 'mill-overview';

export const StatementPreview = ({ data }: { data: CustomerSummary | null }) => {
    const { toast } = useToast();
    const statementRef = React.useRef<HTMLDivElement>(null);

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
    const closingBalance = data.totalOutstanding; // Use the already calculated precise outstanding

     const handlePrint = () => {
        const node = statementRef.current;
        if (!node) {
            toast({ title: 'Error', description: 'Could not find printable content.', variant: 'destructive'});
            return;
        }

        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        
        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) {
            toast({ title: 'Print Error', description: 'Could not open print window.', variant: 'destructive'});
            document.body.removeChild(iframe);
            return;
        }

        iframeDoc.open();
        iframeDoc.write('<html><head><title>Print Statement</title>');

        Array.from(window.document.styleSheets).forEach(styleSheet => {
            try {
                const css = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('');
                const styleElement = iframeDoc.createElement('style');
                styleElement.appendChild(iframeDoc.createTextNode(css));
                iframeDoc.head.appendChild(styleElement);
            } catch (e) {
                console.warn('Could not copy stylesheet:', e);
            }
        });
        
        iframeDoc.write(`
            <style>
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
            </style>
        </head><body></body></html>`);

        iframeDoc.body.innerHTML = node.innerHTML;
        iframeDoc.close();
        
        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            document.body.removeChild(iframe);
        }, 500);
    };
    
    return (
    <>
        <style>
        {`
            @media print {
            .summary-grid-container {
                display: flex !important;
                flex-wrap: nowrap !important;
                gap: 1rem !important;
            }
            .summary-grid-container > div {
                flex: 1;
                padding: 8px;
            }
            .print-table tbody tr {
                background-color: transparent !important;
            }
            .print-table th, .print-table td {
                padding: 4px 6px;
            }
            }
        `}
        </style>
        <DialogHeader className="p-4 sm:p-6 pb-0 no-print">
             <DialogTitle>Account Statement for {data.name}</DialogTitle>
             <DialogDescription className="sr-only">A detailed summary and transaction history for {data.name}.</DialogDescription>
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
                            <span className="text-black">{format(new Date(), 'dd-MMM-yyyy')}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-semibold text-black">Closing Balance:</span>
                            <span className="font-bold text-black">{formatCurrency(data.totalOutstanding)}</span>
                        </div>
                        </div>
                </div>
            </div>

            {/* Summary Section */}
            <Card className="mb-6 bg-white border-gray-200">
                <CardContent className="p-4">
                    <div className="summary-grid-container grid grid-cols-1 md:grid-cols-3 gap-x-6">
                        {/* Operational Summary */}
                        <div className="text-sm">
                            <h3 className="font-semibold text-black mb-2 text-base border-b border-gray-300 pb-1">Operational</h3>
                             <table className="w-full"><tbody>
                                <tr><td className="py-0.5 text-gray-600">Gross Wt</td><td className="py-0.5 text-right font-semibold text-black">{`${(data.totalGrossWeight || 0).toFixed(2)} kg`}</td></tr>
                                <tr><td className="py-0.5 text-gray-600">Teir Wt</td><td className="py-0.5 text-right font-semibold text-black">{`${(data.totalTeirWeight || 0).toFixed(2)} kg`}</td></tr>
                                <tr className="font-bold border-t border-gray-200"><td className="py-1 text-black">Final Wt</td><td className="py-1 text-right font-semibold text-black">{`${(data.totalFinalWeight || 0).toFixed(2)} kg`}</td></tr>
                                <tr><td className="py-0.5 text-gray-600">Karta Wt</td><td className="py-0.5 text-right font-semibold text-black">{`${(data.totalKartaWeight || 0).toFixed(2)} kg`}</td></tr>
                                <tr className="font-bold text-primary border-t border-gray-200"><td className="py-1">Net Wt</td><td className="py-1 text-right">{`${(data.totalNetWeight || 0).toFixed(2)} kg`}</td></tr>
                            </tbody></table>
                        </div>
                        {/* Deduction Summary */}
                        <div className="text-sm">
                            <h3 className="font-semibold text-black mb-2 text-base border-b border-gray-300 pb-1">Deductions</h3>
                            <table className="w-full"><tbody>
                                <tr><td className="py-0.5 text-gray-600">Total Amount</td><td className="py-0.5 text-right font-semibold text-black">{`${formatCurrency(data.totalAmount || 0)}`}</td></tr>
                                <tr className="border-t border-gray-200"><td className="py-0.5 text-gray-600">Karta</td><td className="py-0.5 text-right font-semibold text-black">{`- ${formatCurrency(data.totalKartaAmount || 0)}`}</td></tr>
                                <tr><td className="py-0.5 text-gray-600">Laboury</td><td className="py-0.5 text-right font-semibold text-black">{`- ${formatCurrency(data.totalLabouryAmount || 0)}`}</td></tr>
                                <tr><td className="py-0.5 text-gray-600">Kanta</td><td className="py-0.5 text-right font-semibold text-black">{`- ${formatCurrency(data.totalKanta || 0)}`}</td></tr>
                                <tr><td className="py-0.5 text-gray-600">Other</td><td className="py-0.5 text-right font-semibold text-black">{`- ${formatCurrency(data.totalOtherCharges || 0)}`}</td></tr>
                                <tr className="font-bold text-primary border-t border-gray-200"><td className="py-1">Original Amount</td><td className="py-1 text-right">{formatCurrency(data.totalOriginalAmount || 0)}</td></tr>
                            </tbody></table>
                        </div>
                        {/* Financial Summary */}
                        <div className="text-sm">
                            <h3 className="font-semibold text-black mb-2 text-base border-b border-gray-300 pb-1">Financial</h3>
                            <table className="w-full"><tbody>
                                <tr><td className="py-0.5 text-gray-600">Original Purchases</td><td className="py-0.5 text-right font-semibold text-black">{formatCurrency(data.totalOriginalAmount || 0)}</td></tr>
                                <tr className="border-t border-gray-200"><td className="py-0.5 text-gray-600">Total Paid</td><td className="py-0.5 text-right font-semibold text-green-600">{`${formatCurrency(data.totalPaid || 0)}`}</td></tr>
                                <tr><td className="py-0.5 text-gray-600">Total CD Granted</td><td className="py-0.5 text-right font-semibold text-black">{`${formatCurrency(data.totalCdAmount || 0)}`}</td></tr>
                                <tr className="font-bold text-destructive border-t border-gray-200"><td className="py-1">Outstanding Balance</td><td className="py-1 text-right">{`${formatCurrency(data.totalOutstanding)}`}</td></tr>
                            </tbody></table>
                        </div>
                    </div>
                </CardContent>
            </Card>

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
                                <TableCell colSpan={4} className="font-semibold py-2 px-3 text-black">Opening Balance</TableCell>
                                <TableCell className="text-right font-semibold font-mono py-2 px-3 text-black">{formatCurrency(0)}</TableCell>
                            </TableRow>
                            {transactions.map((item, index) => (
                                <TableRow key={index} className="[&_td]:py-2 [&_td]:px-3">
                                    <TableCell className="text-black">{format(new Date(item.date), "dd-MMM-yy")}</TableCell>
                                    <TableCell className="text-black">{item.particulars}</TableCell>
                                    <TableCell className="text-right font-mono text-black">{item.debit > 0 ? formatCurrency(item.debit) : '-'}</TableCell>
                                    <TableCell className="text-right font-mono text-black">{item.credit > 0 ? formatCurrency(item.credit) : '-'}</TableCell>
                                    <TableCell className="text-right font-mono text-black">{formatCurrency(item.balance)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="bg-gray-100 font-bold">
                                <TableCell colSpan={2} className="py-2 px-3 text-black">Closing Balance</TableCell>
                                <TableCell className="text-right font-mono py-2 px-3 text-black">{formatCurrency(totalDebit)}</TableCell>
                                <TableCell className="text-right font-mono py-2 px-3 text-black">{formatCurrency(totalCredit)}</TableCell>
                                <TableCell className="text-right font-mono py-2 px-3 text-black">{formatCurrency(closingBalance)}</TableCell>
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


export default function SupplierProfileClient() {
  const { suppliers, paymentHistory, loading, isClient } = useSupplierData();

  const [selectedSupplierKey, setSelectedSupplierKey] = useState<string | null>(MILL_OVERVIEW_KEY);
  
  const [detailsCustomer, setDetailsCustomer] = useState<Supplier | null>(null);
  const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState<Payment | CustomerPayment | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  const filteredData = useMemo(() => {
    let filteredSuppliers = suppliers;
    let filteredPayments = paymentHistory;

    if (startDate || endDate) {
        const start = startDate ? new Date(startDate.setHours(0, 0, 0, 0)) : null;
        const end = endDate ? new Date(endDate.setHours(23, 59, 59, 999)) : null;
    
        const filterByDate = (dateStr: string) => {
            const date = new Date(dateStr);
            if (start && end) return date >= start && date <= end;
            if (start) return date >= start;
            if (end) return date <= end;
            return true;
        };
    
        filteredSuppliers = suppliers.filter(s => filterByDate(s.date));
        filteredPayments = paymentHistory.filter(p => filterByDate(p.date));
    }

    return { filteredSuppliers, filteredPayments };
  }, [suppliers, paymentHistory, startDate, endDate]);

  const supplierSummaryMap = useMemo(() => {
    const { filteredSuppliers, filteredPayments } = filteredData;
    const summary = new Map<string, CustomerSummary>();

    // Initialize map with all unique suppliers
    filteredSuppliers.forEach(s => {
        if (s.customerId && !summary.has(s.customerId)) {
            summary.set(s.customerId, {
                name: s.name, contact: s.contact, so: s.so, address: s.address,
                acNo: s.acNo, ifscCode: s.ifscCode, bank: s.bank, branch: s.branch,
                totalAmount: 0, totalPaid: 0, totalOutstanding: 0, totalOriginalAmount: 0, totalCdAmount: 0,
                paymentHistory: [], outstandingEntryIds: [], allTransactions: [], allPayments: [],
                transactionsByVariety: {}, totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0, 
                totalKartaWeight: 0, totalNetWeight: 0, totalKartaAmount: 0, totalLabouryAmount: 0, 
                totalKanta: 0, totalOtherCharges: 0, totalDeductions: 0,
                averageRate: 0, minRate: 0, maxRate: 0, averageOriginalPrice: 0, totalTransactions: 0, totalOutstandingTransactions: 0,
                averageKartaPercentage: 0, averageLabouryRate: 0,
                totalBrokerage: 0, totalCd: 0, totalCashPaid: 0, totalRtgsPaid: 0,
            });
        }
    });

    let supplierRateSum: { [key: string]: { rate: number, karta: number, laboury: number, count: number } } = {};

    filteredSuppliers.forEach(s => {
        if (!s.customerId) return;
        const data = summary.get(s.customerId)!;
        data.allTransactions!.push(s);
    });

    filteredPayments.forEach(p => {
        if (p.customerId && summary.has(p.customerId)) {
            summary.get(p.customerId)!.allPayments!.push(p);
        }
    });

    summary.forEach((data, key) => {
        const updatedTransactions = (data.allTransactions || []).map(t => {
            const paymentsForThisEntry = (data.allPayments || []).filter(p => p.paidFor?.some(pf => pf.srNo === t.srNo));
            let totalPaidForEntry = 0;
            let totalCdForEntry = 0;

            paymentsForThisEntry.forEach(p => {
                const paidForThisDetail = p.paidFor!.find(pf => pf.srNo === t.srNo)!;
                totalPaidForEntry += paidForThisDetail.amount;

                if (p.cdApplied && p.cdAmount && p.paidFor && p.paidFor.length > 0) {
                    const totalAmountInPayment = p.paidFor.reduce((sum, pf) => sum + pf.amount, 0);
                    if(totalAmountInPayment > 0) {
                        const proportion = paidForThisDetail.amount / totalAmountInPayment;
                        totalCdForEntry += p.cdAmount * proportion;
                    }
                }
            });
            
            const calculatedNetAmount = (t.originalNetAmount || 0) - totalPaidForEntry;
            return { ...t, netAmount: calculatedNetAmount, totalPaid: totalPaidForEntry - totalCdForEntry, totalCd: totalCdForEntry };
        });

        data.allTransactions = updatedTransactions;

        data.totalOriginalAmount = data.allTransactions.reduce((sum, t) => sum + (t.originalNetAmount || 0), 0);
        data.totalAmount = data.allTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
        data.totalBrokerage = data.allTransactions.reduce((sum, t) => sum + (t.brokerage || 0), 0);
        data.totalCd = data.allTransactions.reduce((sum, t) => sum + (t.cd || 0), 0);
        data.totalOtherCharges = data.allTransactions.reduce((sum, t) => sum + (t.advanceFreight || 0), 0);
        data.totalGrossWeight = data.allTransactions.reduce((sum, t) => sum + t.grossWeight, 0);
        data.totalTeirWeight = data.allTransactions.reduce((sum, t) => sum + t.teirWeight, 0);
        data.totalFinalWeight = data.allTransactions.reduce((sum, t) => sum + t.weight, 0);
        data.totalKartaWeight = data.allTransactions.reduce((sum, t) => sum + (t.kartaWeight || 0), 0);
        data.totalNetWeight = data.allTransactions.reduce((sum, t) => sum + t.netWeight, 0);
        data.totalKartaAmount = data.allTransactions.reduce((sum, t) => sum + (t.kartaAmount || 0), 0);
        data.totalLabouryAmount = data.allTransactions.reduce((sum, t) => sum + (t.labouryAmount || 0), 0);
        data.totalKanta = data.allTransactions.reduce((sum, t) => sum + t.kanta, 0);
        data.totalTransactions = data.allTransactions.length;
        
        data.totalPaid = data.allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        data.totalCdAmount = data.allPayments.reduce((sum, p) => sum + (p.cdAmount || 0), 0);
        
        data.totalOutstanding = data.totalOriginalAmount - data.totalPaid - data.totalCdAmount;
        
        data.totalOutstandingTransactions = updatedTransactions.filter(t => (t.netAmount || 0) >= 1).length;
        
        data.averageRate = data.totalFinalWeight! > 0 ? data.totalAmount / data.totalFinalWeight! : 0;
        data.averageOriginalPrice = data.totalNetWeight! > 0 ? data.totalOriginalAmount / data.totalNetWeight! : 0;
        data.paymentHistory = data.allPayments;
        
        const validRates = data.allTransactions.map(t => t.rate).filter(rate => rate > 0);
        data.minRate = validRates.length > 0 ? Math.min(...validRates) : 0;
        data.maxRate = validRates.length > 0 ? Math.max(...validRates) : 0;
        
        const rateData = data.allTransactions.reduce((acc, s) => {
            if(s.rate > 0) {
                acc.karta += s.kartaPercentage;
                acc.laboury += s.labouryRate;
                acc.count++;
            }
            return acc;
        }, { karta: 0, laboury: 0, count: 0 });

        if(rateData.count > 0) {
            data.averageKartaPercentage = rateData.karta / rateData.count;
            data.averageLabouryRate = rateData.laboury / rateData.count;
        }

        data.transactionsByVariety = data.allTransactions.reduce((acc, s) => {
            const variety = toTitleCase(s.variety) || 'Unknown';
            acc[variety] = (acc[variety] || 0) + 1;
            return acc;
        }, {} as {[key: string]: number});
    });

    const millSummary: CustomerSummary = Array.from(summary.values()).reduce((acc, s) => {
        acc.totalOriginalAmount += s.totalOriginalAmount;
        acc.totalPaid += s.totalPaid;
        acc.totalCashPaid += s.totalCashPaid;
        acc.totalRtgsPaid += s.totalRtgsPaid;
        acc.totalCdAmount! += s.totalCdAmount!;
        acc.totalGrossWeight! += s.totalGrossWeight!;
        acc.totalTeirWeight! += s.totalTeirWeight!;
        acc.totalFinalWeight! += s.totalFinalWeight!;
        acc.totalKartaWeight! += s.totalKartaWeight!;
        acc.totalNetWeight! += s.totalNetWeight!;
        acc.totalKartaAmount! += s.totalKartaAmount!;
        acc.totalLabouryAmount! += s.totalLabouryAmount!;
        acc.totalKanta! += s.totalKanta!;
        acc.totalOtherCharges! += s.totalOtherCharges!;
        acc.totalTransactions! += s.totalTransactions!;
        acc.totalOutstandingTransactions! += s.totalOutstandingTransactions!;
        acc.totalAmount += s.totalAmount;
        Object.entries(s.transactionsByVariety!).forEach(([variety, count]) => {
            acc.transactionsByVariety![variety] = (acc.transactionsByVariety![variety] || 0) + count;
        });
        return acc;
    }, {
        name: 'Mill (Total Overview)', contact: '', totalAmount: 0, totalPaid: 0, totalOutstanding: 0, totalOriginalAmount: 0,
        paymentHistory: [], outstandingEntryIds: [], totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0, totalKartaWeight: 0, totalNetWeight: 0,
        totalKartaAmount: 0, totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0, totalCdAmount: 0, totalDeductions: 0,
        averageRate: 0, minRate: 0, maxRate: 0, averageOriginalPrice: 0, totalTransactions: 0, totalOutstandingTransactions: 0, allTransactions: filteredSuppliers, 
        allPayments: filteredPayments, transactionsByVariety: {}, averageKartaPercentage: 0, averageLabouryRate: 0,
        totalBrokerage: 0, totalCd: 0, so: '', totalCashPaid: 0, totalRtgsPaid: 0
    });
    
    millSummary.totalOutstanding = millSummary.totalOriginalAmount - millSummary.totalPaid - millSummary.totalCdAmount!;
    millSummary.averageRate = millSummary.totalFinalWeight! > 0 ? millSummary.totalAmount / millSummary.totalFinalWeight! : 0;
    millSummary.averageOriginalPrice = millSummary.totalNetWeight! > 0 ? millSummary.totalOriginalAmount / millSummary.totalNetWeight! : 0;
    const allValidRates = filteredSuppliers.map(s => s.rate).filter(rate => rate > 0);
    millSummary.minRate = allValidRates.length > 0 ? Math.min(...allValidRates) : 0;
    millSummary.maxRate = allValidRates.length > 0 ? Math.max(...allValidRates) : 0;
    
    const totalRateData = filteredSuppliers.reduce((acc, s) => {
        if(s.rate > 0) {
            acc.karta += s.kartaPercentage;
            acc.laboury += s.labouryRate;
            acc.count++;
        }
        return acc;
    }, { karta: 0, laboury: 0, count: 0 });

    if(totalRateData.count > 0) {
        millSummary.averageKartaPercentage = totalRateData.karta / totalRateData.count;
        millSummary.averageLabouryRate = totalRateData.laboury / totalRateData.count;
    }
     
    const finalSummaryMap = new Map<string, CustomerSummary>();
    finalSummaryMap.set(MILL_OVERVIEW_KEY, millSummary);
    summary.forEach((value, key) => finalSummaryMap.set(key, value));

    return finalSummaryMap;
  }, [filteredData]);

  const selectedSupplierData = selectedSupplierKey ? supplierSummaryMap.get(selectedSupplierKey) : null;
  
  if (!isClient || loading) {
    return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-3 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold">Select Profile</h3>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button variant={"outline"} className={cn("w-full sm:w-[200px] justify-start text-left font-normal h-9", !startDate && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate ? format(startDate, "PPP") : <span>Start Date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus /></PopoverContent>
                </Popover>
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button variant={"outline"} className={cn("w-full sm:w-[200px] justify-start text-left font-normal h-9", !endDate && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, "PPP") : <span>End Date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus /></PopoverContent>
                </Popover>
                
                <div className="w-full sm:w-[300px]">
                    <CustomDropdown
                        options={Array.from(supplierSummaryMap.entries()).map(([key, data]) => ({ value: key, label: `${toTitleCase(data.name)} ${data.contact ? `(${data.contact})` : ''}`.trim() }))}
                        value={selectedSupplierKey}
                        onChange={(value: string | null) => setSelectedSupplierKey(value)}
                        placeholder="Search and select profile..."
                    />
                </div>
            </div>
        </CardContent>
      </Card>

      <SupplierProfileView 
        selectedSupplierData={selectedSupplierData}
        isMillSelected={selectedSupplierKey === MILL_OVERVIEW_KEY}
        onShowDetails={setDetailsCustomer}
        onShowPaymentDetails={setSelectedPaymentForDetails}
        onGenerateStatement={() => setIsStatementOpen(true)}
      />

      <Dialog open={isStatementOpen} onOpenChange={setIsStatementOpen}>
        <DialogContent className="max-w-5xl p-0 printable-statement-container">
            <ScrollArea className="max-h-[90vh] printable-statement-scroll-area">
                <StatementPreview data={selectedSupplierData} />
            </ScrollArea>
        </DialogContent>
      </Dialog>
      
      <DetailsDialog 
          isOpen={!!detailsCustomer}
          onOpenChange={(open) => !open && setDetailsCustomer(null)}
          customer={detailsCustomer}
          paymentHistory={paymentHistory}
      />
      
      <PaymentDetailsDialog
        payment={selectedPaymentForDetails}
        suppliers={suppliers}
        onOpenChange={() => setSelectedPaymentForDetails(null)}
        onShowEntryDetails={setDetailsCustomer}
      />
      
    </div>
  );
}
