

"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Customer, CustomerSummary, Payment, CustomerPayment } from "@/lib/definitions";
import { toTitleCase, cn, formatCurrency } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { getCustomersRealtime, getCustomerPaymentsRealtime } from '@/lib/firestore';

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { CustomerDetailsDialog } from "@/components/sales/customer-details-dialog";
import { PaymentDetailsDialog } from "@/components/sales/supplier-payments/payment-details-dialog";
import { SupplierProfileView } from "@/app/sales/supplier-profile/supplier-profile-view";


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
            debit: parseFloat(String(t.originalNetAmount)) || 0,
            credit: 0,
        }));
        
        const mappedPayments = allPayments.map(p => ({
            date: p.date,
            particulars: `Payment (ID# ${p.paymentId})`,
            debit: 0,
            credit: (p.amount || 0),
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
                        <title>Print Statement for ${data.name}</title>
                        <style>
                            body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
                            table { width: 100%; border-collapse: collapse; }
                            th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
                            th { background-color: #f2f2f2; }
                            .no-print { display: none; }
                             @media print {
                                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                                .summary-grid-container { display: flex !important; flex-wrap: nowrap !important; gap: 1rem; }
                                .summary-grid-container > div { flex: 1; }
                             }
                        </style>
                    </head>
                    <body>
                    </body>
                </html>
            `);

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
             <DialogDescription className="sr-only">A detailed summary and transaction history for {data.name}.</DialogDescription>
        </DialogHeader>
        <div ref={statementRef} className="printable-area bg-white p-4 sm:p-6 font-sans text-black">
            {/* Header */}
            <div className="flex justify-between items-start pb-4 border-b border-gray-300 mb-4">
                <div>
                    <h2 className="text-xl font-bold text-black">BizSuite DataFlow</h2>
                    <p className="text-xs text-gray-600">{toTitleCase(data.name)}</p>
                    <p className="text-xs text-gray-600">{toTitleCase(data.address || '')}</p>
                    <p className="text-xs text-gray-600">{data.contact}</p>
                </div>
                <div className="text-right">
                        <h1 className="text-2xl font-bold text-black">Statement of Account</h1>
                        <div className="mt-2 text-sm">
                        <div className="flex justify-between"><span className="font-semibold text-black">Statement Date:</span> <span>{format(new Date(), 'dd-MMM-yyyy')}</span></div>
                        <div className="flex justify-between"><span className="font-semibold text-black">Closing Balance:</span> <span className="font-bold">{formatCurrency(data.totalOutstanding)}</span></div>
                        </div>
                </div>
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


export default function CustomerProfileClient() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(MILL_OVERVIEW_KEY);
  
  const [detailsCustomer, setDetailsCustomer] = useState<Customer | null>(null);
  const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState<Payment | CustomerPayment | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();


  useEffect(() => {
    setIsClient(true);
    const unsubCustomers = getCustomersRealtime(setCustomers, console.error);
    const unsubPayments = getCustomerPaymentsRealtime(setCustomerPayments, console.error);
    return () => {
        unsubCustomers();
        unsubPayments();
    };
  }, []);

  const filteredData = useMemo(() => {
    let filteredCustomers = customers;
    let filteredCustomerPayments = customerPayments;

    if (startDate || endDate) {
        const start = startDate ? new Date(startDate.setHours(0, 0, 0, 0)) : null;
        const end = endDate ? new Date(endDate.setHours(23, 59, 59, 999)) : null;
    
        const filterByDate = (date: Date) => {
            if (start && end) return date >= start && date <= end;
            if (start) return date >= start;
            if (end) return date <= end;
            return true;
        };
    
        filteredCustomers = customers.filter(c => filterByDate(new Date(c.date)));
        filteredCustomerPayments = customerPayments.filter(p => filterByDate(new Date(p.date)));
    }

    return { filteredCustomers, filteredCustomerPayments };
  }, [customers, customerPayments, startDate, endDate]);

  const customerSummaryMap = useMemo(() => {
    const { filteredCustomers, filteredCustomerPayments } = filteredData;
    const summary = new Map<string, CustomerSummary>();

    filteredCustomers.forEach(s => {
        if (s.customerId && !summary.has(s.customerId)) {
            summary.set(s.customerId, {
                name: s.name, contact: s.contact, so: s.so, address: s.address, companyName: s.companyName,
                acNo: s.acNo, ifscCode: s.ifscCode, bank: s.bank, branch: s.branch,
                totalAmount: 0, totalPaid: 0, totalOutstanding: 0, totalOriginalAmount: 0,
                paymentHistory: [], outstandingEntryIds: [], allTransactions: [], allPayments: [],
                transactionsByVariety: {}, totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0, 
                totalKartaWeight: 0, totalNetWeight: 0, totalKartaAmount: 0, totalLabouryAmount: 0, 
                totalKanta: 0, totalOtherCharges: 0, totalCdAmount: 0, averageRate: 0, 
                averageOriginalPrice: 0, totalTransactions: 0, totalOutstandingTransactions: 0,
                averageKartaPercentage: 0, averageLabouryRate: 0, totalDeductions: 0,
                totalBrokerage: 0, totalCd: 0,
            });
        }
    });

    let customerRateSum: { [key: string]: { rate: number, count: number } } = {};

    filteredCustomers.forEach(s => {
        if (!s.customerId) return;
        const data = summary.get(s.customerId)!;
        data.totalOriginalAmount += parseFloat(String(s.originalNetAmount)) || 0;
        data.totalAmount += s.amount || 0;
        data.totalBrokerage! += parseFloat(String(s.brokerage)) || 0;
        data.totalCd! += parseFloat(String(s.cd)) || 0;
        data.totalOtherCharges! += s.advanceFreight || 0;
        data.totalGrossWeight! += parseFloat(String(s.grossWeight)) || 0;
        data.totalTeirWeight! += parseFloat(String(s.teirWeight)) || 0;
        data.totalFinalWeight! += s.weight || 0;
        data.totalNetWeight! += s.netWeight || 0;
        data.totalTransactions! += 1;
        
        if (!customerRateSum[s.customerId]) {
            customerRateSum[s.customerId] = { rate: 0, count: 0 };
        }
        if (s.rate > 0) {
            customerRateSum[s.customerId].rate += s.rate;
            customerRateSum[s.customerId].count++;
        }
        data.allTransactions!.push(s);
        const variety = toTitleCase(s.variety) || 'Unknown';
        data.transactionsByVariety![variety] = (data.transactionsByVariety![variety] || 0) + 1;
    });

    filteredCustomerPayments.forEach(p => {
        if (p.customerId && summary.has(p.customerId)) {
            const data = summary.get(p.customerId)!;
            data.totalPaid += p.amount;
            data.paymentHistory.push(p);
            data.allPayments!.push(p);
        }
    });

    summary.forEach((data, key) => {
        data.totalOutstanding = data.totalOriginalAmount - data.totalPaid;
        data.averageRate = data.totalFinalWeight! > 0 ? data.totalAmount / data.totalFinalWeight! : 0;
        data.outstandingEntryIds = data.allTransactions!.filter(t => (t.netAmount || 0) > 0).map(t => t.id);
        data.totalOutstandingTransactions = data.outstandingEntryIds.length;
    });

    const millSummary: CustomerSummary = Array.from(summary.values()).reduce((acc, s) => {
        acc.totalOriginalAmount += s.totalOriginalAmount;
        acc.totalPaid += s.totalPaid;
        acc.totalGrossWeight! += s.totalGrossWeight!;
        acc.totalTeirWeight! += s.totalTeirWeight!;
        acc.totalFinalWeight! += s.totalFinalWeight!;
        acc.totalNetWeight! += s.totalNetWeight!;
        acc.totalTransactions! += s.totalTransactions!;
        acc.totalOutstandingTransactions! += s.totalOutstandingTransactions!;
        acc.totalAmount += s.totalAmount;
        acc.totalBrokerage! += s.totalBrokerage!;
        acc.totalCd! += s.totalCd!;
        acc.totalOtherCharges! += s.totalOtherCharges!;
        return acc;
    }, {
        name: 'Mill (Total Customers)', contact: '', totalAmount: 0, totalPaid: 0, totalOutstanding: 0, totalOriginalAmount: 0,
        paymentHistory: [], outstandingEntryIds: [], totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0, totalKartaWeight: 0, totalNetWeight: 0,
        totalKartaAmount: 0, totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0, totalCdAmount: 0, totalDeductions: 0,
        averageRate: 0, averageOriginalPrice: 0, totalTransactions: 0, totalOutstandingTransactions: 0, allTransactions: filteredCustomers, 
        allPayments: filteredCustomerPayments, transactionsByVariety: {}, averageKartaPercentage: 0, averageLabouryRate: 0,
        totalBrokerage: 0, totalCd: 0,
    });
    
    millSummary.totalOutstanding = millSummary.totalOriginalAmount - millSummary.totalPaid;
    millSummary.averageRate = millSummary.totalFinalWeight! > 0 ? millSummary.totalAmount / millSummary.totalFinalWeight! : 0;
    millSummary.transactionsByVariety = filteredCustomers.reduce((acc, s) => {
         const variety = toTitleCase(s.variety) || 'Unknown';
         acc[variety] = (acc[variety] || 0) + 1;
         return acc;
     }, {} as {[key: string]: number});
     
    const finalSummaryMap = new Map<string, CustomerSummary>();
    finalSummaryMap.set(MILL_OVERVIEW_KEY, millSummary);
    summary.forEach((value, key) => finalSummaryMap.set(key, value));

    return finalSummaryMap;
  }, [filteredData]);

  const selectedCustomerData = selectedCustomerKey ? customerSummaryMap.get(selectedCustomerKey) : null;
  
  if (!isClient) {
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
                    <PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full sm:w-[200px] justify-start text-left font-normal h-9", !startDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{startDate ? format(startDate, "PPP") : <span>Start Date</span>}</Button></PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus /></PopoverContent>
                </Popover>
                 <Popover>
                    <PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full sm:w-[200px] justify-start text-left font-normal h-9", !endDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{endDate ? format(endDate, "PPP") : <span>End Date</span>}</Button></PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus /></PopoverContent>
                </Popover>
                <div className="w-full sm:w-[300px]">
                    <CustomDropdown
                        options={Array.from(customerSummaryMap.entries()).map(([key, data]) => ({ value: key, label: `${toTitleCase(data.name)} ${data.contact ? `(${data.contact})` : ''}`.trim() }))}
                        value={selectedCustomerKey}
                        onChange={(value: string | null) => setSelectedCustomerKey(value as string)}
                        placeholder="Search and select profile..."
                    />
                </div>
            </div>
        </CardContent>
      </Card>

      <SupplierProfileView
        selectedSupplierData={selectedCustomerData}
        isMillSelected={selectedCustomerKey === MILL_OVERVIEW_KEY}
        onShowDetails={setDetailsCustomer}
        onShowPaymentDetails={setSelectedPaymentForDetails}
        onGenerateStatement={() => setIsStatementOpen(true)}
        isCustomerView={true}
      />
      
      <Dialog open={isStatementOpen} onOpenChange={setIsStatementOpen}>
        <DialogContent className="max-w-5xl p-0 printable-statement-container">
            <ScrollArea className="max-h-[90vh] printable-statement-scroll-area">
                <StatementPreview data={selectedCustomerData} />
            </ScrollArea>
        </DialogContent>
      </Dialog>
      
      <CustomerDetailsDialog
          customer={detailsCustomer}
          onOpenChange={(open: boolean) => !open && setDetailsCustomer(null)}
          paymentHistory={customerPayments}
          onPrint={() => {}} // Pass a dummy function or implement if needed
      />
      
      <PaymentDetailsDialog
        payment={selectedPaymentForDetails}
        suppliers={customers} // It expects suppliers, but customers have a similar structure for display
        onOpenChange={() => setSelectedPaymentForDetails(null)}
        onShowEntryDetails={setDetailsCustomer}
      />
      
    </div>
  );
}


    