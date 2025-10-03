
"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Customer as Supplier, CustomerSummary, Payment, CustomerPayment } from "@/lib/definitions";
import { toTitleCase, cn, formatCurrency } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { getSuppliersRealtime, getPaymentsRealtime, getCustomersRealtime } from '@/lib/firestore';


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
import { PaymentDetailsDialog } from "@/components/sales/supplier-payments/payment-details-dialog";
import { SupplierProfileView } from "@/app/sales/supplier-profile/supplier-profile-view";
import { StatementPreview } from '@/components/print-formats/statement-preview';


// Icons
import { Users, Calendar as CalendarIcon, Download, Printer, Loader2 } from "lucide-react";

const MILL_OVERVIEW_KEY = 'mill-overview';


export default function SupplierProfileClient() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Supplier[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  
  const [selectedSupplierKey, setSelectedSupplierKey] = useState<string | null>(MILL_OVERVIEW_KEY);
  
  const [detailsCustomer, setDetailsCustomer] = useState<any | null>(null);
  const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState<Payment | CustomerPayment | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();


  useEffect(() => {
    setIsClient(true);
    const unsubSuppliers = getSuppliersRealtime(setSuppliers, console.error);
    const unsubCustomers = getCustomersRealtime(setCustomers, console.error);
    const unsubPayments = getPaymentsRealtime(setPaymentHistory, console.error);
    return () => {
        unsubSuppliers();
        unsubCustomers();
        unsubPayments();
    };
  }, []);

  const filteredData = useMemo(() => {
    let allEntries = [...suppliers, ...customers];
    let filteredPayments = paymentHistory;

    if (startDate || endDate) {
        const start = startDate ? new Date(startDate.setHours(0, 0, 0, 0)) : null;
        const end = endDate ? new Date(endDate.setHours(23, 59, 59, 999)) : null;
    
        const filterByDate = (date: Date) => {
            if (start && end) return date >= start && date <= end;
            if (start) return date >= start;
            if (end) return date <= end;
            return true;
        };
    
        allEntries = allEntries.filter(s => filterByDate(new Date(s.date)));
        filteredPayments = paymentHistory.filter(p => filterByDate(new Date(p.date)));
    }

    return { allEntries, filteredPayments };
  }, [suppliers, customers, paymentHistory, startDate, endDate]);

  const supplierSummaryMap = useMemo(() => {
    const { allEntries, filteredPayments } = filteredData;
    const summary = new Map<string, CustomerSummary>();

    // Process all entries (suppliers and customers)
    allEntries.forEach(s => {
        if (!s.customerId) return;

        let data = summary.get(s.customerId);
        if (!data) {
            data = {
                name: s.name, contact: s.contact, so: s.so, address: s.address,
                acNo: s.acNo, ifscCode: s.ifscCode, bank: s.bank, branch: s.branch,
                totalAmount: 0, totalPaid: 0, totalOutstanding: 0, totalOriginalAmount: 0, totalCdAmount: 0,
                paymentHistory: [], outstandingEntryIds: [], allTransactions: [], allPayments: [],
                transactionsByVariety: {}, totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0,
                totalKartaWeight: 0, totalNetWeight: 0, totalKartaAmount: 0, totalLabouryAmount: 0,
                totalKanta: 0, totalOtherCharges: 0, totalDeductions: 0,
                averageRate: 0, averageOriginalPrice: 0, totalTransactions: 0, totalOutstandingTransactions: 0,
                averageKartaPercentage: 0, averageLabouryRate: 0,
            };
            summary.set(s.customerId, data);
        }
        data.allTransactions!.push(s);
    });

    // Attach payments to the correct group
    filteredPayments.forEach(p => {
        if (p.customerId && summary.has(p.customerId)) {
            summary.get(p.customerId)!.allPayments!.push(p);
        }
    });

    // Calculate totals for each group
    summary.forEach(data => {
        data.totalOriginalAmount = data.allTransactions!.reduce((sum, t) => sum + (t.originalNetAmount || 0), 0);
        data.totalAmount = data.allTransactions!.reduce((sum, t) => sum + (t.amount || 0), 0);
        data.totalGrossWeight = data.allTransactions!.reduce((sum, t) => sum + t.grossWeight, 0);
        data.totalTeirWeight = data.allTransactions!.reduce((sum, t) => sum + t.teirWeight, 0);
        data.totalFinalWeight = data.allTransactions!.reduce((sum, t) => sum + t.weight, 0);
        data.totalKartaWeight = data.allTransactions!.reduce((sum, t) => sum + t.kartaWeight, 0);
        data.totalNetWeight = data.allTransactions!.reduce((sum, t) => sum + t.netWeight, 0);
        data.totalKartaAmount = data.allTransactions!.reduce((sum, t) => sum + t.kartaAmount, 0);
        data.totalLabouryAmount = data.allTransactions!.reduce((sum, t) => sum + t.labouryAmount, 0);
        data.totalKanta = data.allTransactions!.reduce((sum, t) => sum + t.kanta, 0);
        data.totalOtherCharges = data.allTransactions!.reduce((sum, t) => sum + (t.otherCharges || 0), 0);
        data.totalTransactions = data.allTransactions!.length;
        
        data.totalPaid = data.allPayments!.reduce((sum, p) => sum + p.amount, 0);
        data.totalCdAmount = data.allPayments!.reduce((sum, p) => sum + (p.cdAmount || 0), 0);

        data.totalDeductions = data.totalKartaAmount! + data.totalLabouryAmount! + data.totalKanta! + data.totalOtherCharges!;
        
        // Correct outstanding calculation for each entry before summing up
        const outstandingEntries = data.allTransactions!.map(t => {
            const paymentsForThisEntry = data.allPayments!.filter(p => p.paidFor?.some(pf => pf.srNo === t.srNo));
            const totalPaidForEntry = paymentsForThisEntry.reduce((sum, p) => {
                const pf = p.paidFor!.find(pf => pf.srNo === t.srNo)!;
                return sum + pf.amount;
            }, 0);
             const totalCdForEntry = paymentsForThisEntry.reduce((sum, p) => {
                if (p.cdApplied) {
                    const totalPaidInPayment = p.paidFor!.reduce((s, i) => s + i.amount, 0);
                    if (totalPaidInPayment > 0) {
                        const proportion = (p.paidFor!.find(pf => pf.srNo === t.srNo)!.amount) / totalPaidInPayment;
                        return sum + (p.cdAmount || 0) * proportion;
                    }
                }
                return sum;
            }, 0);
            t.netAmount = (t.originalNetAmount || 0) - totalPaidForEntry - totalCdForEntry;
            return t;
        });

        data.allTransactions = outstandingEntries;
        data.totalOutstanding = outstandingEntries.reduce((sum, t) => sum + (t.netAmount as number), 0);

        data.totalOutstandingTransactions = outstandingEntries.filter(t => (t.netAmount || 0) >= 1).length;
        
        data.averageRate = data.totalFinalWeight! > 0 ? data.totalAmount / data.totalFinalWeight! : 0;
        data.averageOriginalPrice = data.totalNetWeight! > 0 ? data.totalOriginalAmount / data.totalNetWeight! : 0;
        
        const rateData = data.allTransactions!.reduce((acc, s) => {
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

        data.transactionsByVariety = data.allTransactions!.reduce((acc, s) => {
            const variety = toTitleCase(s.variety) || 'Unknown';
            acc[variety] = (acc[variety] || 0) + 1;
            return acc;
        }, {} as {[key: string]: number});
        
        data.paymentHistory = data.allPayments!;
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
         averageRate: 0, averageOriginalPrice: 0, totalTransactions: 0, totalOutstandingTransactions: 0, allTransactions: allEntries, 
         allPayments: filteredPayments, transactionsByVariety: {}, averageKartaPercentage: 0, averageLabouryRate: 0
     });
     
    millSummary.totalDeductions = millSummary.totalKartaAmount! + millSummary.totalLabouryAmount! + millSummary.totalKanta! + millSummary.totalOtherCharges!;
    millSummary.totalOutstanding = millSummary.totalOriginalAmount - millSummary.totalPaid - millSummary.totalCdAmount!;
    millSummary.totalTransactions = allEntries.length;
    millSummary.totalOutstandingTransactions = allEntries.filter(c => parseFloat(String(c.netAmount)) >= 1).length;
    millSummary.averageRate = millSummary.totalFinalWeight! > 0 ? millSummary.totalAmount / millSummary.totalFinalWeight! : 0;
    millSummary.averageOriginalPrice = millSummary.totalNetWeight! > 0 ? millSummary.totalOriginalAmount / millSummary.totalNetWeight! : 0;
    const totalRateData = allEntries.reduce((acc, s) => {
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
    millSummary.transactionsByVariety = allEntries.reduce((acc, s) => {
         const variety = toTitleCase(s.variety) || 'Unknown';
         acc[variety] = (acc[variety] || 0) + 1;
         return acc;
     }, {} as {[key: string]: number});
     
    const finalSummaryMap = new Map<string, CustomerSummary>();
    finalSummaryMap.set(MILL_OVERVIEW_KEY, millSummary);
    summary.forEach((value, key) => finalSummaryMap.set(key, value));

    return finalSummaryMap;
  }, [filteredData]);

  const selectedSupplierData = selectedSupplierKey ? supplierSummaryMap.get(selectedSupplierKey) : null;
  
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
        onShowDetails={(supplier) => {
            const supplierProfile = supplierSummaryMap.get(supplier.customerId);
            const fullData = {
                ...supplierProfile,
                allTransactions: [supplier],
                allPayments: paymentHistory.filter(p => p.paidFor?.some(pf => pf.srNo === supplier.srNo)),
                totalOutstanding: supplier.netAmount,
                totalOriginalAmount: supplier.originalNetAmount,
            };
            setDetailsCustomer(fullData);
        }}
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
      
      <Dialog open={!!detailsCustomer} onOpenChange={() => setDetailsCustomer(null)}>
        <DialogContent className="max-w-5xl p-0 printable-statement-container">
            <ScrollArea className="max-h-[90vh] printable-statement-scroll-area">
                <StatementPreview data={detailsCustomer} />
            </ScrollArea>
        </DialogContent>
      </Dialog>
      
      <PaymentDetailsDialog
        payment={selectedPaymentForDetails}
        suppliers={suppliers}
        onOpenChange={() => setSelectedPaymentForDetails(null)}
        onShowEntryDetails={(supplier: Supplier) => {
            const supplierProfile = supplierSummaryMap.get(supplier.customerId);
            const fullData = {
                ...supplierProfile,
                allTransactions: [supplier],
                allPayments: paymentHistory.filter(p => p.paidFor?.some(pf => pf.srNo === supplier.srNo)),
                totalOutstanding: supplier.netAmount,
                totalOriginalAmount: supplier.originalNetAmount,
            };
            setDetailsCustomer(fullData);
        }}
      />
      
    </div>
  );
}
