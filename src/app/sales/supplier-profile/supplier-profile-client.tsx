
"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Customer as Supplier, CustomerSummary, Payment } from "@/lib/definitions";
import { toTitleCase, cn, formatCurrency } from "@/lib/utils";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Home, Phone, User, Banknote, Landmark, Hash, UserCircle, Briefcase, Building, Info, Scale, Weight, Calculator, Percent, Server, Milestone, FileText, Users, Download, Printer, ChevronsUpDown, Check } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { SupplierProfileView } from "./supplier-profile-view";
import { DetailsDialog } from "@/components/sales/details-dialog";
import { PaymentDetailsDialog } from "@/components/sales/supplier-payments/payment-details-dialog";

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
                                .summary-grid-container {
                                    display: flex !important;
                                    flex-wrap: nowrap !important;
                                }
                                .summary-grid-container > div {
                                    flex: 1;
                                }
                             }
                        </style>
                    </head>
                    <body>
                    </body>
                </html>
            `);

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
        <div ref={statementRef} className="printable-statement bg-white p-4 sm:p-6 font-sans text-black">
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
            <div className="summary-grid-container grid grid-cols-3 gap-x-4">
                 <Card className="bg-white border-gray-200">
                    <CardHeader className="p-2 pb-1">
                        <h3 className="font-semibold text-black text-base border-b border-gray-300 pb-1">Operational</h3>
                    </CardHeader>
                    <CardContent className="p-2 pt-1 text-xs space-y-0.5">
                        <div className="flex justify-between items-baseline"><span className="text-gray-600">Gross Wt</span><span className="font-semibold text-black">{`${(data.totalGrossWeight || 0).toFixed(2)} kg`}</span></div>
                        <div className="flex justify-between items-baseline"><span className="text-gray-600">Teir Wt</span><span className="font-semibold text-black">{`${(data.totalTeirWeight || 0).toFixed(2)} kg`}</span></div>
                        <div className="flex justify-between items-baseline font-bold border-t border-gray-200 pt-1 mt-1"><span className="text-black">Final Wt</span><span className="font-semibold text-black">{`${(data.totalFinalWeight || 0).toFixed(2)} kg`}</span></div>
                        <div className="flex justify-between items-baseline"><span className="text-gray-600">Karta Wt</span><span className="font-semibold text-black">{`${(data.totalKartaWeight || 0).toFixed(2)} kg`}</span></div>
                        <div className="flex justify-between items-baseline font-bold text-primary border-t border-gray-200 pt-1 mt-1"><span>Net Wt</span><span>{`${(data.totalNetWeight || 0).toFixed(2)} kg`}</span></div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-gray-200">
                    <CardHeader className="p-2 pb-1"><h3 className="font-semibold text-black text-base border-b border-gray-300 pb-1">Deductions</h3></CardHeader>
                    <CardContent className="p-2 pt-1 text-xs space-y-0.5">
                        <div className="flex justify-between items-baseline"><span className="text-gray-600">Total Amount</span><span className="font-semibold text-black">{`${formatCurrency(data.totalAmount || 0)}`}</span></div>
                        <div className="flex justify-between items-baseline border-t border-gray-200 pt-1 mt-1"><span className="text-gray-600">Karta</span><span className="font-semibold text-black">{`- ${formatCurrency(data.totalKartaAmount || 0)}`}</span></div>
                        <div className="flex justify-between items-baseline"><span className="text-gray-600">Laboury</span><span className="font-semibold text-black">{`- ${formatCurrency(data.totalLabouryAmount || 0)}`}</span></div>
                        <div className="flex justify-between items-baseline"><span className="text-gray-600">Kanta</span><span className="font-semibold text-black">{`- ${formatCurrency(data.totalKanta || 0)}`}</span></div>
                        <div className="flex justify-between items-baseline"><span className="text-gray-600">Other</span><span className="font-semibold text-black">{`- ${formatCurrency(data.totalOtherCharges || 0)}`}</span></div>
                        <div className="flex justify-between items-baseline font-bold text-primary border-t border-gray-200 pt-1 mt-1"><span>Original Amount</span><span>{formatCurrency(data.totalOriginalAmount || 0)}</span></div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-gray-200">
                    <CardHeader className="p-2 pb-1"><h3 className="font-semibold text-black text-base border-b border-gray-300 pb-1">Financial</h3></CardHeader>
                    <CardContent className="p-2 pt-1 text-xs space-y-0.5">
                        <div className="flex justify-between items-baseline"><span className="text-gray-600">Original Purchases</span><span className="font-semibold text-black">{formatCurrency(data.totalOriginalAmount || 0)}</span></div>
                        <div className="flex justify-between items-baseline border-t border-gray-200 pt-1 mt-1"><span className="text-gray-600">Total Paid</span><span className="font-semibold text-green-600">{`${formatCurrency(data.totalPaid || 0)}`}</span></div>
                        <div className="flex justify-between items-baseline"><span className="text-gray-600">Total CD Granted</span><span className="font-semibold text-black">{`${formatCurrency(data.totalCdAmount || 0)}`}</span></div>
                        <div className="flex justify-between items-baseline font-bold text-destructive border-t border-gray-200 pt-1 mt-1"><span>Outstanding</span><span>{`${formatCurrency(data.totalOutstanding)}`}</span></div>
                    </CardContent>
                </Card>
            </div>


            {/* Transaction Table */}
            <div className="mt-6">
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

export default function SupplierProfilePage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [selectedSupplierKey, setSelectedSupplierKey] = useState<string | null>(MILL_OVERVIEW_KEY);
  const [openCombobox, setOpenCombobox] = useState(false);

  const [detailsCustomer, setDetailsCustomer] = useState<Supplier | null>(null);
  const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState<Payment | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setLoading(true);

    const unsubscribeSuppliers = onSnapshot(collection(db, "suppliers"), (snapshot) => {
        const fetchedSuppliers: Supplier[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
        setSuppliers(fetchedSuppliers);
        setLoading(false);
    }, (error) => {
        console.error("Failed to load suppliers from Firestore", error);
        setSuppliers([]);
        setLoading(false);
    });

    const unsubscribePayments = onSnapshot(collection(db, "payments"), (snapshot) => {
        const fetchedPayments: Payment[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
        setPaymentHistory(fetchedPayments);
    }, (error) => {
        console.error("Failed to load payments from Firestore", error);
        setPaymentHistory([]);
    });

    return () => { 
        unsubscribeSuppliers(); 
        unsubscribePayments(); 
    };
  }, []);

  const supplierSummaryMap = useMemo(() => {
    const summary = new Map<string, CustomerSummary>();

    suppliers.forEach(s => {
        if (s.customerId && !summary.has(s.customerId)) {
            summary.set(s.customerId, {
                name: s.name, contact: s.contact, so: s.so, address: s.address,
                acNo: s.acNo, ifscCode: s.ifscCode, bank: s.bank, branch: s.branch,
                totalAmount: 0, totalPaid: 0, totalOutstanding: 0, totalOriginalAmount: 0,
                paymentHistory: [], outstandingEntryIds: [], allTransactions: [], allPayments: [],
                transactionsByVariety: {}, totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0, 
                totalKartaWeight: 0, totalNetWeight: 0, totalKartaAmount: 0, totalLabouryAmount: 0, 
                totalKanta: 0, totalOtherCharges: 0, totalCdAmount: 0, averageRate: 0, 
                averageOriginalPrice: 0, totalTransactions: 0, totalOutstandingTransactions: 0,
                averageKartaPercentage: 0, averageLabouryRate: 0, totalDeductions: 0,
            });
        }
    });

    let supplierRateSum: { [key: string]: { rate: number, karta: number, laboury: number, count: number } } = {};

    suppliers.forEach(s => {
        if (!s.customerId) return;
        const data = summary.get(s.customerId)!;
        data.totalAmount += s.amount || 0;
        data.totalOriginalAmount += s.originalNetAmount || 0;
        data.totalGrossWeight! += s.grossWeight;
        data.totalTeirWeight! += s.teirWeight;
        data.totalFinalWeight! += s.weight;
        data.totalKartaWeight! += s.kartaWeight;
        data.totalNetWeight! += s.netWeight;
        data.totalKartaAmount! += s.kartaAmount;
        data.totalLabouryAmount! += s.labouryAmount;
        data.totalKanta! += s.kanta;
        data.totalOtherCharges! += s.otherCharges || 0;
        data.totalTransactions! += 1;
        if (!supplierRateSum[s.customerId]) {
            supplierRateSum[s.customerId] = { rate: 0, karta: 0, laboury: 0, count: 0 };
        }
        if (s.rate > 0) {
            supplierRateSum[s.customerId].rate += s.rate;
            supplierRateSum[s.customerId].karta += s.kartaPercentage;
            supplierRateSum[s.customerId].laboury += s.labouryRate;
            supplierRateSum[s.customerId].count++;
        }
        data.allTransactions!.push(s);
        const variety = toTitleCase(s.variety) || 'Unknown';
        data.transactionsByVariety![variety] = (data.transactionsByVariety![variety] || 0) + 1;
    });

    paymentHistory.forEach(p => {
        if (p.customerId && summary.has(p.customerId)) {
            const data = summary.get(p.customerId)!;
            data.totalPaid += p.amount;
            data.totalCdAmount! += (p.cdAmount || 0);
            data.paymentHistory.push(p);
            data.allPayments!.push(p);
        }
    });

    summary.forEach((data, key) => {
        data.totalDeductions = data.totalKartaAmount! + data.totalLabouryAmount! + data.totalKanta! + data.totalOtherCharges!;
        data.totalOutstanding = data.totalOriginalAmount - data.totalPaid - data.totalCdAmount!;
        data.outstandingEntryIds = (data.allTransactions || []).filter(t => parseFloat(String(t.netAmount)) >= 1).map(t => t.id);
        data.totalOutstandingTransactions = data.outstandingEntryIds.length;
        data.averageRate = data.totalFinalWeight! > 0 ? data.totalAmount / data.totalFinalWeight! : 0;
        data.averageOriginalPrice = data.totalNetWeight! > 0 ? data.totalOriginalAmount / data.totalNetWeight! : 0;
        const rates = supplierRateSum[key];
        if (rates && rates.count > 0) {
            data.averageKartaPercentage = rates.karta / rates.count;
            data.averageLabouryRate = rates.laboury / rates.count;
        }
    });

    const millSummary: CustomerSummary = Array.from(summary.values()).reduce((acc, s) => {
        acc.totalAmount += s.totalAmount;
        acc.totalOriginalAmount += s.totalOriginalAmount;
        acc.totalPaid += s.totalPaid;
        acc.totalGrossWeight! += s.totalGrossWeight!;
        acc.totalTeirWeight! += s.totalTeirWeight!;
        acc.totalFinalWeight! += s.totalFinalWeight!;
        acc.totalKartaWeight! += s.totalKartaWeight!;
        acc.totalNetWeight! += s.totalNetWeight!;
        acc.totalKartaAmount! += s.totalKartaAmount!;
        acc.totalLabouryAmount! += s.totalLabouryAmount!;
        acc.totalKanta! += s.totalKanta!;
        acc.totalOtherCharges! += s.totalOtherCharges!;
        acc.totalCdAmount! += s.totalCdAmount!;
        return acc;
    }, {
        name: 'Mill (Total Overview)', contact: '', totalAmount: 0, totalPaid: 0, totalOutstanding: 0, totalOriginalAmount: 0,
        paymentHistory: [], outstandingEntryIds: [], totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0, totalKartaWeight: 0, totalNetWeight: 0,
        totalKartaAmount: 0, totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0, totalCdAmount: 0, totalDeductions: 0,
        averageRate: 0, averageOriginalPrice: 0, totalTransactions: 0, totalOutstandingTransactions: 0, allTransactions: suppliers, 
        allPayments: paymentHistory, transactionsByVariety: {}, averageKartaPercentage: 0, averageLabouryRate: 0
    });
    
    millSummary.totalDeductions = millSummary.totalKartaAmount! + millSummary.totalLabouryAmount! + millSummary.totalKanta! + millSummary.totalOtherCharges!;
    millSummary.totalOutstanding = millSummary.totalOriginalAmount - millSummary.totalPaid - millSummary.totalCdAmount!;
    millSummary.totalTransactions = suppliers.length;
    millSummary.totalOutstandingTransactions = suppliers.filter(c => parseFloat(String(c.netAmount)) >= 1).length;
    millSummary.averageRate = millSummary.totalFinalWeight! > 0 ? millSummary.totalAmount / millSummary.totalFinalWeight! : 0;
    millSummary.averageOriginalPrice = millSummary.totalNetWeight! > 0 ? millSummary.totalOriginalAmount / millSummary.totalNetWeight! : 0;
    const totalRateData = suppliers.reduce((acc, s) => {
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
    millSummary.transactionsByVariety = suppliers.reduce((acc, s) => {
        const variety = toTitleCase(s.variety) || 'Unknown';
        acc[variety] = (acc[variety] || 0) + 1;
        return acc;
    }, {} as {[key: string]: number});
    
    const finalSummaryMap = new Map<string, CustomerSummary>();
    finalSummaryMap.set(MILL_OVERVIEW_KEY, millSummary);
    summary.forEach((value, key) => finalSummaryMap.set(key, value));

    return finalSummaryMap;
  }, [suppliers, paymentHistory]);

  const selectedSupplierData = selectedSupplierKey ? supplierSummaryMap.get(selectedSupplierKey) : null;
  
  if (!isClient || loading) {
    return (
        <div className="flex items-center justify-center h-64">
            <p>Loading Profiles...</p>
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
            <div className="w-full sm:w-auto sm:min-w-64">
                 <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                    <PopoverTrigger asChild>
                        <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openCombobox}
                        className="w-full justify-between h-9 text-sm font-normal"
                        >
                        {selectedSupplierKey
                            ? toTitleCase(supplierSummaryMap.get(selectedSupplierKey)?.name || '')
                            : "Search and select profile..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                        <CommandInput placeholder="Search supplier..." />
                        <CommandList>
                            <CommandEmpty>No supplier found.</CommandEmpty>
                            <CommandGroup>
                            {Array.from(supplierSummaryMap.entries()).map(([key, data]) => (
                                <CommandItem
                                key={key}
                                value={`${data.name} ${data.contact}`}
                                onSelect={() => {
                                    setSelectedSupplierKey(key);
                                    setOpenCombobox(false);
                                }}
                                >
                                <Check
                                    className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedSupplierKey === key ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                {toTitleCase(data.name)} {data.contact && `(${data.contact})`}
                                </CommandItem>
                            ))}
                            </CommandGroup>
                        </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
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

