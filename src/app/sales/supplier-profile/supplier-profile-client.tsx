
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
                  border: 1px solid #ccc;
                  padding: 8px;
                  border-radius: 8px;
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
            <div className="flex justify-between items-start pb-4 border-b mb-4">
                <div className="w-1/2">
                    <h2 className="text-xl font-bold">BizSuite DataFlow</h2>
                </div>
                <div className="text-right">
                    <h1 className="text-2xl font-bold text-primary">STATEMENT</h1>
                    <p className="text-xs">Date: {format(new Date(), 'dd-MMM-yyyy')}</p>
                </div>
            </div>

            {/* Consignee Details */}
            <div className="border border-gray-200 p-3 rounded-lg mb-4">
                <h3 className="font-bold text-gray-500 mb-2 uppercase tracking-wider text-xs">Supplier Details</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><strong>Name:</strong> {toTitleCase(data.name)}</p>
                    <p><strong>Contact:</strong> {data.contact}</p>
                    <p className="col-span-2"><strong>Address:</strong> {toTitleCase(data.address || '')}</p>
                </div>
            </div>

            {/* Transaction Table */}
            <div>
                <h2 className="text-lg font-semibold border-b pb-1 mb-2">TRANSACTIONS</h2>
                <div className="overflow-x-auto border rounded-lg">
                    <Table className="print-table min-w-full text-xs">
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="py-2 px-3">SR No.</TableHead>
                                <TableHead className="py-2 px-3">Date</TableHead>
                                <TableHead className="py-2 px-3">Variety</TableHead>
                                <TableHead className="py-2 px-3 text-right">Net Wt. (Qtl)</TableHead>
                                <TableHead className="py-2 px-3 text-right">Net Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(data.allTransactions || []).map((item, index) => (
                                <TableRow key={index} className="[&_td]:py-1 [&_td]:px-3">
                                    <TableCell>{item.srNo}</TableCell>
                                    <TableCell>{format(new Date(item.date), "dd-MMM-yy")}</TableCell>
                                    <TableCell>{toTitleCase(item.variety)}</TableCell>
                                    <TableCell className="text-right font-mono">{(item.netWeight || 0).toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(item.originalNetAmount || 0)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Summary Section */}
            <Card className="mt-4 mb-4 bg-white shadow-none border-t pt-4">
                <CardContent className="p-0">
                    <div className="summary-grid-container grid grid-cols-1 md:grid-cols-3 gap-x-6">
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

             {/* Footer */}
            <div className="border-t border-gray-300 pt-8 mt-8 flex justify-end">
                <div className="w-2/5 text-center">
                    <div className="h-16"></div>
                    <div className="border-t-2 border-gray-400 w-4/5 mx-auto pt-2">
                        <p className="font-bold text-sm">Authorised Signatory</p>
                    </div>
                </div>
            </div>
        </div>
        <DialogFooter className="p-4 border-t no-print">
            <Button variant="outline" onClick={() => (document.querySelector('.printable-statement-container [aria-label="Close"]') as HTMLElement)?.click()}>Close</Button>
            <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4"/> Print</Button>
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
