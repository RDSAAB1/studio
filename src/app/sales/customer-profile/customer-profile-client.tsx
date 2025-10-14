"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Customer, CustomerSummary, Payment, CustomerPayment } from "@/lib/definitions";
import { toTitleCase, cn, formatCurrency, levenshteinDistance } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';
import { format, startOfYear, endOfYear, subDays } from 'date-fns';
import { getCustomersRealtime, getCustomerPaymentsRealtime } from '@/lib/firestore';
import { usePersistedSelection, usePersistedState } from '@/hooks/use-persisted-state';

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
import { PaymentDetailsDialog } from "@/components/sales/supplier-payments/payment-details-dialog";
import { SupplierProfileView } from "@/app/sales/supplier-profile/supplier-profile-view";
import { StatementPreview } from "@/components/print-formats/statement-preview";
import { DetailsDialog } from '@/components/sales/details-dialog';


// Icons
import { Users, Calendar as CalendarIcon, Download, Printer, Loader2 } from "lucide-react";

const MILL_OVERVIEW_KEY = 'mill-overview';

export default function CustomerProfileClient() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
  const [selectedCustomerKey, setSelectedCustomerKey] = usePersistedSelection('customer-profile-selected', MILL_OVERVIEW_KEY);
  const [selectedVariety, setSelectedVariety] = usePersistedState<string>('customer-profile-variety-filter', 'All');
  
  const [detailsCustomer, setDetailsCustomer] = useState<any | null>(null);
  const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState<Payment | CustomerPayment | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [startDate, setStartDate] = usePersistedState<Date | undefined>(
    'customer-profile-start-date',
    undefined,
    {
        serialize: (date) => date ? date.toISOString() : '',
        deserialize: (str) => str ? new Date(str) : undefined
    }
  );
  const [endDate, setEndDate] = usePersistedState<Date | undefined>(
    'customer-profile-end-date',
    undefined,
    {
        serialize: (date) => date ? date.toISOString() : '',
        deserialize: (str) => str ? new Date(str) : undefined
    }
  );


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

    // Process all entries
    filteredCustomers.forEach(s => {
        if (!s.customerId) return;
        if (!summary.has(s.customerId)) {
            summary.set(s.customerId, {
                name: s.name, contact: s.contact, so: s.so, address: s.address, companyName: s.companyName,
                acNo: s.acNo, ifscCode: s.ifscCode, bank: s.bank, branch: s.branch,
                totalAmount: 0, totalPaid: 0, totalOutstanding: 0, totalOriginalAmount: 0, totalCdAmount: 0,
                paymentHistory: [], outstandingEntryIds: [], allTransactions: [], allPayments: [],
                transactionsByVariety: {}, totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0, 
                totalKartaWeight: 0, totalNetWeight: 0, totalKartaAmount: 0, totalLabouryAmount: 0, 
                totalKanta: 0, totalOtherCharges: 0, totalDeductions: 0,
                averageRate: 0, averageOriginalPrice: 0, totalTransactions: 0, totalOutstandingTransactions: 0,
                averageKartaPercentage: 0, averageLabouryRate: 0,
                totalBrokerage: 0, totalCd: 0,
            });
        }
        summary.get(s.customerId)!.allTransactions!.push(s);
    });

    // Attach payments to the correct group
    filteredCustomerPayments.forEach(p => {
        if (p.customerId && summary.has(p.customerId)) {
            summary.get(p.customerId)!.allPayments!.push(p);
        }
    });

    // Calculate totals for each group
    summary.forEach(data => {
        const updatedTransactions = (data.allTransactions || []).map(t => {
            const paymentsForThisEntry = (data.allPayments || []).filter(p => p.paidFor?.some(pf => pf.srNo === t.srNo));
            const totalPaidForEntry = paymentsForThisEntry.reduce((sum, p) => {
                const pf = p.paidFor!.find(pf => pf.srNo === t.srNo)!;
                return sum + pf.amount;
            }, 0);
            const newNetAmount = (t.originalNetAmount || 0) - totalPaidForEntry;
            return { ...t, netAmount: newNetAmount };
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
        data.totalNetWeight = data.allTransactions.reduce((sum, t) => sum + t.netWeight, 0);
        data.totalTransactions = data.allTransactions.length;
        
        data.totalPaid = data.allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        
        data.totalOutstanding = data.allTransactions.reduce((sum, t) => sum + (t.netAmount as number), 0);
        
        data.totalOutstandingTransactions = updatedTransactions.filter(t => (t.netAmount || 0) >= 1).length;
        
        data.averageRate = data.totalFinalWeight! > 0 ? data.totalAmount / data.totalFinalWeight! : 0;
        
        data.paymentHistory = data.allPayments!;
        
        data.transactionsByVariety = data.allTransactions.reduce((acc, s) => {
            const variety = toTitleCase(s.variety) || 'Unknown';
            acc[variety] = (acc[variety] || 0) + 1;
            return acc;
        }, {} as {[key: string]: number});
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
        acc.totalOutstanding += s.totalOutstanding;
        return acc;
    }, {
        name: 'Mill (Total Customers)', contact: '', totalAmount: 0, totalPaid: 0, totalOutstanding: 0, totalOriginalAmount: 0,
        paymentHistory: [], outstandingEntryIds: [], totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0, totalKartaWeight: 0, totalNetWeight: 0,
        totalKartaAmount: 0, totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0, totalDeductions: 0,
        averageRate: 0, averageOriginalPrice: 0, totalTransactions: 0, totalOutstandingTransactions: 0, allTransactions: filteredCustomers, 
        allPayments: filteredCustomerPayments, transactionsByVariety: {}, averageKartaPercentage: 0, averageLabouryRate: 0,
        totalBrokerage: 0, totalCd: 0, totalCdAmount: 0
    });
    
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

  // Get all unique varieties from customers for filter
  const availableVarieties = useMemo(() => {
    const varieties = new Set<string>();
    customers.forEach(c => {
      const variety = toTitleCase(c.variety) || 'Unknown';
      varieties.add(variety);
    });
    return ['All', ...Array.from(varieties).sort()];
  }, [customers]);

  // Filter customer data based on selected variety (only for Mill Overview)
  const filteredCustomerData = useMemo(() => {
    if (!selectedCustomerKey || selectedCustomerKey !== MILL_OVERVIEW_KEY || selectedVariety === 'All') {
      return selectedCustomerKey ? customerSummaryMap.get(selectedCustomerKey) : null;
    }

    // Filter Mill Overview data by variety
    const millData = customerSummaryMap.get(MILL_OVERVIEW_KEY);
    if (!millData) return null;

    const filteredTransactions = millData.allTransactions?.filter(t => {
      const variety = toTitleCase(t.variety) || 'Unknown';
      return variety === selectedVariety;
    }) || [];

    // Recalculate totals for filtered data
    const filteredData: CustomerSummary = {
      ...millData,
      allTransactions: filteredTransactions,
      totalOriginalAmount: filteredTransactions.reduce((sum, t) => sum + (t.originalNetAmount || 0), 0),
      totalAmount: filteredTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
      totalBrokerage: filteredTransactions.reduce((sum, t) => sum + (t.brokerage || 0), 0),
      totalCd: filteredTransactions.reduce((sum, t) => sum + (t.cd || 0), 0),
      totalOtherCharges: filteredTransactions.reduce((sum, t) => sum + (t.advanceFreight || 0), 0),
      totalGrossWeight: filteredTransactions.reduce((sum, t) => sum + t.grossWeight, 0),
      totalTeirWeight: filteredTransactions.reduce((sum, t) => sum + t.teirWeight, 0),
      totalFinalWeight: filteredTransactions.reduce((sum, t) => sum + t.weight, 0),
      totalNetWeight: filteredTransactions.reduce((sum, t) => sum + t.netWeight, 0),
      totalTransactions: filteredTransactions.length,
      totalPaid: filteredTransactions.reduce((sum, t) => sum + ((t as any).totalPaid || 0), 0),
      totalOutstanding: filteredTransactions.reduce((sum, t) => sum + (t.netAmount || 0), 0),
      totalOutstandingTransactions: filteredTransactions.filter(t => (t.netAmount || 0) >= 1).length,
    };

    filteredData.averageRate = filteredData.totalFinalWeight > 0 ? filteredData.totalAmount / filteredData.totalFinalWeight : 0;
    
    return filteredData;
  }, [customerSummaryMap, selectedCustomerKey, selectedVariety]);

  const selectedCustomerData = filteredCustomerData as CustomerSummary | null;
  
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
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={endDate} onSelect={setEndDate} /></PopoverContent>
                </Popover>
                <div className="w-full sm:flex-1">
                    <CustomDropdown
                        options={Array.from(customerSummaryMap.entries()).map(([key, data]) => ({ value: key, label: `${toTitleCase(data.name)} ${data.companyName ? `(${data.companyName})` : ''}`.trim() }))}
                        value={selectedCustomerKey}
                        onChange={(value: string | null) => setSelectedCustomerKey(value as string)}
                        placeholder="Search and select profile..."
                    />
                </div>

                {/* Variety Filter - Only show for Mill Overview */}
                {selectedCustomerKey === MILL_OVERVIEW_KEY && (
                    <div className="w-full sm:w-[200px]">
                        <CustomDropdown
                            options={availableVarieties.map(v => ({ value: v, label: v }))}
                            value={selectedVariety}
                            onChange={(value: string | null) => setSelectedVariety(value || 'All')}
                            placeholder="Filter by variety..."
                        />
                    </div>
                )}
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
      
      <DetailsDialog 
          isOpen={!!detailsCustomer}
          onOpenChange={(open) => !open && setDetailsCustomer(null)}
          customer={detailsCustomer}
          paymentHistory={customerPayments}
          entryType="Customer"
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


        acc.totalTeirWeight! += s.totalTeirWeight!;

        acc.totalFinalWeight! += s.totalFinalWeight!;

        acc.totalNetWeight! += s.totalNetWeight!;

        acc.totalTransactions! += s.totalTransactions!;

        acc.totalOutstandingTransactions! += s.totalOutstandingTransactions!;

        acc.totalAmount += s.totalAmount;

        acc.totalBrokerage! += s.totalBrokerage!;

        acc.totalCd! += s.totalCd!;

        acc.totalOtherCharges! += s.totalOtherCharges!;

        acc.totalOutstanding += s.totalOutstanding;

        return acc;

    }, {

        name: 'Mill (Total Customers)', contact: '', totalAmount: 0, totalPaid: 0, totalOutstanding: 0, totalOriginalAmount: 0,

        paymentHistory: [], outstandingEntryIds: [], totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0, totalKartaWeight: 0, totalNetWeight: 0,

        totalKartaAmount: 0, totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0, totalDeductions: 0,

        averageRate: 0, averageOriginalPrice: 0, totalTransactions: 0, totalOutstandingTransactions: 0, allTransactions: filteredCustomers, 

        allPayments: filteredCustomerPayments, transactionsByVariety: {}, averageKartaPercentage: 0, averageLabouryRate: 0,

        totalBrokerage: 0, totalCd: 0, totalCdAmount: 0

    });

    

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

                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={endDate} onSelect={setEndDate} /></PopoverContent>

                </Popover>

                <div className="w-full sm:w-[300px]">

                    <CustomDropdown

                        options={Array.from(customerSummaryMap.entries()).map(([key, data]) => ({ value: key, label: `${toTitleCase(data.name)} ${data.companyName ? `(${data.companyName})` : ''}`.trim() }))}

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

      

      <DetailsDialog 

          isOpen={!!detailsCustomer}

          onOpenChange={(open) => !open && setDetailsCustomer(null)}

          customer={detailsCustomer}

          paymentHistory={customerPayments}

          entryType="Customer"

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


