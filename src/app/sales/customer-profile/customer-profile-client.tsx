
"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Customer as Supplier, CustomerSummary, Payment, CustomerPayment } from "@/lib/definitions";
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
import { SupplierProfileView } from "@/app/sales/supplier-profile/supplier-profile-view";
import { DetailsDialog } from "@/components/sales/details-dialog";
import { PaymentDetailsDialog } from "@/components/sales/supplier-payments/payment-details-dialog";

const MILL_OVERVIEW_KEY = 'mill-overview';

export default function CustomerProfilePage() {
  const [customers, setCustomers] = useState<Supplier[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<CustomerPayment[]>([]);
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(MILL_OVERVIEW_KEY);
  const [openCombobox, setOpenCombobox] = useState(false);

  const [detailsCustomer, setDetailsCustomer] = useState<Supplier | null>(null);
  const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState<Payment | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setLoading(true);

    const unsubscribeCustomers = onSnapshot(collection(db, "customers"), (snapshot) => {
        const fetchedCustomers: Supplier[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
        setCustomers(fetchedCustomers);
        setLoading(false);
    }, (error) => {
        console.error("Failed to load customers from Firestore", error);
        setCustomers([]);
        setLoading(false);
    });

    const unsubscribePayments = onSnapshot(collection(db, "customer_payments"), (snapshot) => {
        const fetchedPayments: CustomerPayment[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerPayment));
        setPaymentHistory(fetchedPayments);
    }, (error) => {
        console.error("Failed to load customer payments from Firestore", error);
        setPaymentHistory([]);
    });

    return () => { 
        unsubscribeCustomers(); 
        unsubscribePayments(); 
    };
  }, []);

  const customerSummaryMap = useMemo(() => {
    const summary = new Map<string, CustomerSummary>();

    customers.forEach(s => {
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

    customers.forEach(s => {
        if (!s.customerId) return;
        const data = summary.get(s.customerId)!;
        data.totalOriginalAmount += s.originalNetAmount || 0;
        data.allTransactions!.push(s);
    });

    paymentHistory.forEach(p => {
        if (p.customerId && summary.has(p.customerId)) {
            const data = summary.get(p.customerId)!;
            data.totalPaid += p.amount;
            data.allPayments!.push(p);
        }
    });

    summary.forEach((data, key) => {
        data.totalAmount = data.totalOriginalAmount; // Total transactions is the sum of net payable
        data.totalOutstanding = data.totalOriginalAmount - data.totalPaid;
    });

    const millSummary: CustomerSummary = Array.from(summary.values()).reduce((acc, s) => {
        acc.totalOriginalAmount += s.totalOriginalAmount;
        acc.totalPaid += s.totalPaid;
        // Aggregate other fields if necessary for mill overview
        return acc;
    }, {
        name: 'Mill (Total Overview)', contact: '', totalAmount: 0, totalPaid: 0, totalOutstanding: 0, totalOriginalAmount: 0,
        paymentHistory: [], outstandingEntryIds: [], totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0, totalKartaWeight: 0, totalNetWeight: 0,
        totalKartaAmount: 0, totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0, totalCdAmount: 0, totalDeductions: 0,
        averageRate: 0, averageOriginalPrice: 0, totalTransactions: 0, totalOutstandingTransactions: 0, allTransactions: customers, 
        allPayments: paymentHistory, transactionsByVariety: {}, averageKartaPercentage: 0, averageLabouryRate: 0
    });
    
    millSummary.totalAmount = millSummary.totalOriginalAmount;
    millSummary.totalOutstanding = millSummary.totalOriginalAmount - millSummary.totalPaid;

    const finalSummaryMap = new Map<string, CustomerSummary>();
    finalSummaryMap.set(MILL_OVERVIEW_KEY, millSummary);
    summary.forEach((value, key) => finalSummaryMap.set(key, value));

    return finalSummaryMap;
  }, [customers, paymentHistory]);

  const selectedCustomerData = selectedCustomerKey ? customerSummaryMap.get(selectedCustomerKey) : null;
  
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
                        {selectedCustomerKey
                            ? toTitleCase(customerSummaryMap.get(selectedCustomerKey)?.name || '')
                            : "Search and select profile..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                        <CommandInput placeholder="Search customer..." />
                        <CommandList>
                            <CommandEmpty>No customer found.</CommandEmpty>
                            <CommandGroup>
                            {Array.from(customerSummaryMap.entries()).map(([key, data]) => (
                                <CommandItem
                                key={key}
                                value={`${data.name} ${data.contact}`}
                                onSelect={() => {
                                    setSelectedCustomerKey(key);
                                    setOpenCombobox(false);
                                }}
                                >
                                <Check
                                    className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedCustomerKey === key ? "opacity-100" : "opacity-0"
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
        selectedSupplierData={selectedCustomerData}
        isMillSelected={selectedCustomerKey === MILL_OVERVIEW_KEY}
        onShowDetails={setDetailsCustomer}
        onShowPaymentDetails={setSelectedPaymentForDetails}
        onGenerateStatement={() => setIsStatementOpen(true)}
      />
      
      <DetailsDialog 
          isOpen={!!detailsCustomer}
          onOpenChange={(open) => !open && setDetailsCustomer(null)}
          customer={detailsCustomer}
          paymentHistory={paymentHistory}
      />
      
      <PaymentDetailsDialog
        payment={selectedPaymentForDetails}
        suppliers={customers}
        onOpenChange={() => setSelectedPaymentForDetails(null)}
        onShowEntryDetails={setDetailsCustomer}
      />
      
    </div>
  );
}
