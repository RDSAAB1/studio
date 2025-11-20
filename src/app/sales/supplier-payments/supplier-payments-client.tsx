
"use client";

import { useMemo, useState, useCallback, useEffect } from 'react';
import type { Customer, Payment, ReceiptSettings } from "@/lib/definitions";
import { toTitleCase, formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSupplierPayments } from '@/hooks/use-supplier-payments';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Banknote, Scale, FileText } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";


import { PaymentForm } from '@/components/sales/supplier-payments/payment-form';
import { PaymentHistory } from '@/components/sales/supplier-payments/payment-history';
import { TransactionTable } from '@/components/sales/supplier-payments/transaction-table';
import { PaymentDetailsDialog } from '@/components/sales/supplier-payments/payment-details-dialog';
import { BankSettingsDialog } from '@/components/sales/supplier-payments/bank-settings-dialog';
import { RTGSReceiptDialog } from '@/components/sales/supplier-payments/rtgs-receipt-dialog';
import { DetailsDialog } from "@/components/sales/details-dialog";
import { SupplierEntryEditDialog } from '@/components/sales/supplier-payments/supplier-entry-edit-dialog';
import { usePaymentCombination } from '@/hooks/use-payment-combination';
import { PaymentCombinationGenerator, PaymentCombinationResults } from '@/components/sales/supplier-payments/payment-combination-generator';
import { RtgsForm } from '@/components/sales/supplier-payments/rtgs-form';
import { useSupplierFiltering } from "../supplier-profile/hooks/use-supplier-filtering";
import { useSupplierSummary } from "../supplier-profile/hooks/use-supplier-summary";
import { useSupplierData } from "@/hooks/use-supplier-data";
import { StatementPreview } from "../supplier-profile/components/statement-preview";
import { PaymentHistoryCompact } from '@/components/sales/supplier-payments/payment-history-compact';


// Helper functions for formatting
const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

const formatRate = (value: number | string | null | undefined) => {
  const numericValue = toNumber(value);
  return `₹${numericValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function SupplierPaymentsClient() {
    const { toast } = useToast();
    
  const hook = useSupplierPayments();
  const { supplierBankAccounts, banks, bankBranches } = useSupplierData();
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const { activeTab, setActiveTab } = hook;
  const [editEntryDialogOpen, setEditEntryDialogOpen] = useState(false);
  const [selectedEntryForEdit, setSelectedEntryForEdit] = useState<Customer | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [activeTransactionTab, setActiveTransactionTab] = useState<string>("all");

  const paymentCombination = usePaymentCombination({
    calcTargetAmount: hook?.calcTargetAmount || (() => 0),
    minRate: hook?.minRate || 0,
    maxRate: hook?.maxRate || 0,
  });

  // Use the same supplier summary and filtering as supplier profile
  const { supplierSummaryMap, MILL_OVERVIEW_KEY } = useSupplierSummary(
    hook?.suppliers || [],
    hook?.paymentHistory || [],
    undefined,
    undefined
  );

  const onSelectSupplierKey = useCallback((key: string | null) => {
    if (key) {
      hook.handleCustomerSelect(key);
    }
  }, [hook]);

  // Update the hook's customerSummaryMap to use our new supplierSummaryMap
  useEffect(() => {
    if (supplierSummaryMap.size > 0 && hook.customerSummaryMap) {
      // Replace the hook's customerSummaryMap with our new one
      hook.customerSummaryMap.clear();
      supplierSummaryMap.forEach((value, key) => {
        hook.customerSummaryMap.set(key, value);
      });
    }
  }, [supplierSummaryMap, hook.customerSummaryMap]);

  const { filteredSupplierOptions } = useSupplierFiltering(
    supplierSummaryMap,
    hook.selectedCustomerKey as string | null,
    onSelectSupplierKey as (key: string | null) => void,
    undefined,
    undefined,
    MILL_OVERVIEW_KEY
  );

  // Set Mill Overview as default if no supplier is selected
  useEffect(() => {
    if (!hook.selectedCustomerKey && MILL_OVERVIEW_KEY && hook.handleCustomerSelect) {
      hook.handleCustomerSelect(MILL_OVERVIEW_KEY);
    }
  }, [hook.selectedCustomerKey, MILL_OVERVIEW_KEY, hook.handleCustomerSelect]);

  // Force lightweight rerender of heavy tables when payments list changes
  useEffect(() => {
    setRefreshKey(Date.now());
  }, [hook.paymentHistory?.length]);

  // Check for editPaymentData from localStorage (when navigating from detail window)
  useEffect(() => {
    const editData = localStorage.getItem('editPaymentData');
    if (editData && hook.handleEditPayment) {
      try {
        const paymentData = JSON.parse(editData) as Payment;
        // Clear the localStorage
        localStorage.removeItem('editPaymentData');
        
        // Edit the payment
        hook.handleEditPayment(paymentData);
        
        toast({
          title: "Payment Loaded",
          description: `Loaded payment ${paymentData.paymentId || paymentData.id} for editing.`,
        });
      } catch (error) {
        console.error('Error loading edit payment data:', error);
        localStorage.removeItem('editPaymentData');
      }
    }
  }, [hook.handleEditPayment]);
    // Removed toast from dependencies - it's stable from useToast hook
    // eslint-disable-next-line react-hooks/exhaustive-deps

  const selectedSupplierSummary = useMemo(() => {
    if (!hook.selectedCustomerKey) return null;
    return supplierSummaryMap.get(hook.selectedCustomerKey) ?? null;
    }, [hook.selectedCustomerKey, supplierSummaryMap]);

  // Create filtered summary based on selected receipts
  const filteredSupplierSummary = useMemo(() => {
    if (!selectedSupplierSummary) return null;
    
    // If no receipts are selected, return full summary
    if (!hook.selectedEntries || hook.selectedEntries.length === 0) {
      return selectedSupplierSummary;
    }

    // Filter transactions to only selected receipts
    const selectedSrNos = new Set(
      hook.selectedEntries.map((e: Customer) => (e.srNo || "").toLowerCase()).filter(Boolean)
    );
    
    const filteredTransactions = selectedSupplierSummary.allTransactions.filter((t: Customer) => 
      selectedSrNos.has((t.srNo || "").toLowerCase())
    );

    // Recalculate summary totals from filtered transactions
    const totalGrossWeight = filteredTransactions.reduce((sum, t) => sum + (Number(t.grossWeight) || 0), 0);
    const totalTeirWeight = filteredTransactions.reduce((sum, t) => sum + (Number(t.teirWeight) || 0), 0);
    // Use 'weight' field for final weight (as per use-supplier-summary.ts line 237 and Customer type definition)
    const totalFinalWeight = filteredTransactions.reduce((sum, t) => sum + (Number((t as any).weight) || 0), 0);
    const totalKartaWeight = filteredTransactions.reduce((sum, t) => sum + (Number(t.kartaWeight) || 0), 0);
    const totalNetWeight = filteredTransactions.reduce((sum, t) => sum + (Number(t.netWeight) || 0), 0);
    
    const totalAmount = filteredTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalKartaAmount = filteredTransactions.reduce((sum, t) => sum + (Number(t.kartaAmount) || 0), 0);
    const totalLabouryAmount = filteredTransactions.reduce((sum, t) => sum + (Number(t.labouryAmount) || 0), 0);
    const totalKanta = filteredTransactions.reduce((sum, t) => sum + (Number(t.kanta) || 0), 0);
    const totalOther = filteredTransactions.reduce((sum, t) => sum + (Number(t.other) || 0), 0);
    const totalOriginalAmount = filteredTransactions.reduce((sum, t) => sum + (Number(t.originalNetAmount) || 0), 0);
    
    // Calculate paid amounts from payment history for filtered transactions
    const filteredSrNosSet = new Set(filteredTransactions.map((t: Customer) => t.srNo?.toLowerCase()).filter(Boolean));
    const filteredPayments = (hook.paymentHistory || []).filter((p: Payment) => 
      p.paidFor?.some(pf => filteredSrNosSet.has((pf.srNo || "").toLowerCase()))
    );
    
    let totalPaid = 0;
    let totalCd = 0;
    let totalCashPaid = 0;
    let totalRtgsPaid = 0;
    
    filteredTransactions.forEach((entry: Customer) => {
      const entrySrNo = (entry.srNo || "").toLowerCase();
      const paymentsForEntry = filteredPayments.filter((p: Payment) => 
        p.paidFor?.some(pf => (pf.srNo || "").toLowerCase() === entrySrNo)
      );
      
      paymentsForEntry.forEach((payment: Payment) => {
        const paidForEntry = payment.paidFor?.find(pf => (pf.srNo || "").toLowerCase() === entrySrNo);
        if (paidForEntry) {
          totalPaid += Number(paidForEntry.amount || 0);
          
          // CD amount calculation
          if ('cdAmount' in paidForEntry && paidForEntry.cdAmount !== undefined && paidForEntry.cdAmount !== null) {
            totalCd += Number(paidForEntry.cdAmount || 0);
          } else if (payment.cdAmount && payment.paidFor && payment.paidFor.length > 0) {
            const totalPaidForInPayment = payment.paidFor.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0);
            if (totalPaidForInPayment > 0) {
              const proportion = Number(paidForEntry.amount || 0) / totalPaidForInPayment;
              totalCd += Math.round(payment.cdAmount * proportion * 100) / 100;
            }
          }
          
          const receiptType = payment.receiptType?.toLowerCase();
          const actualPaidAmount = Number(paidForEntry.amount || 0);
          if (receiptType === 'cash') {
            totalCashPaid += actualPaidAmount;
          } else if (receiptType === 'rtgs') {
            totalRtgsPaid += actualPaidAmount;
          }
        }
      });
    });
    
    const totalOutstanding = totalOriginalAmount - totalPaid - totalCd;
    
    // Calculate outstanding entry IDs
    const outstandingEntryIds = filteredTransactions
      .filter((t: Customer) => {
        const entrySrNo = (t.srNo || "").toLowerCase();
        const paymentsForEntry = filteredPayments.filter((p: Payment) => 
          p.paidFor?.some(pf => (pf.srNo || "").toLowerCase() === entrySrNo)
        );
        let entryPaid = 0;
        let entryCd = 0;
        paymentsForEntry.forEach((payment: Payment) => {
          const paidForEntry = payment.paidFor?.find(pf => (pf.srNo || "").toLowerCase() === entrySrNo);
          if (paidForEntry) {
            entryPaid += Number(paidForEntry.amount || 0);
            if ('cdAmount' in paidForEntry && paidForEntry.cdAmount !== undefined && paidForEntry.cdAmount !== null) {
              entryCd += Number(paidForEntry.cdAmount || 0);
            } else if (payment.cdAmount && payment.paidFor && payment.paidFor.length > 0) {
              const totalPaidForInPayment = payment.paidFor.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0);
              if (totalPaidForInPayment > 0) {
                const proportion = Number(paidForEntry.amount || 0) / totalPaidForInPayment;
                entryCd += Math.round(payment.cdAmount * proportion * 100) / 100;
              }
            }
          }
        });
        const originalAmount = Number(t.originalNetAmount) || 0;
        const entryOutstanding = originalAmount - entryPaid - entryCd;
        return entryOutstanding > 0.01;
      })
      .map((t: Customer) => t.id)
      .filter(Boolean);
    
    // Calculate averages
    const totalRate = filteredTransactions.reduce((sum, t) => sum + (Number(t.rate) || 0), 0);
    const averageRate = filteredTransactions.length > 0 ? totalRate / filteredTransactions.length : 0;
    const minRate = filteredTransactions.length > 0 
      ? Math.min(...filteredTransactions.map(t => Number(t.rate) || 0).filter(r => r > 0))
      : 0;
    const maxRate = filteredTransactions.length > 0 
      ? Math.max(...filteredTransactions.map(t => Number(t.rate) || 0))
      : 0;
    
    const totalKartaPercentage = filteredTransactions.reduce((sum, t) => sum + (Number(t.kartaPercentage) || 0), 0);
    const averageKartaPercentage = filteredTransactions.length > 0 ? totalKartaPercentage / filteredTransactions.length : 0;
    
    const totalLabouryRate = filteredTransactions.reduce((sum, t) => sum + (Number(t.labouryRate) || 0), 0);
    const averageLabouryRate = filteredTransactions.length > 0 ? totalLabouryRate / filteredTransactions.length : 0;

    return {
      ...selectedSupplierSummary,
      allTransactions: filteredTransactions,
      allPayments: filteredPayments,
      totalGrossWeight,
      totalTeirWeight,
      totalFinalWeight,
      totalKartaWeight,
      totalNetWeight,
      totalAmount,
      totalKartaAmount,
      totalLabouryAmount,
      totalKanta,
      totalOther,
      totalOriginalAmount,
      totalPaid,
      totalCdAmount: totalCd,
      totalCashPaid,
      totalRtgsPaid,
      totalOutstanding,
      outstandingEntryIds,
      averageRate,
      minRate,
      maxRate,
      averageKartaPercentage,
      averageLabouryRate,
    };
  }, [selectedSupplierSummary, hook.selectedEntries, hook.paymentHistory]);

  const transactionsForSelectedSupplier = useMemo(() => {
    return selectedSupplierSummary?.allTransactions || [];
  }, [selectedSupplierSummary]);

  // Calculate transaction counts for status section
  const transactionCounts = useMemo(() => {
    // If receipts are selected, use only selected receipts; otherwise use all transactions
    const transactions = hook.selectedEntries && hook.selectedEntries.length > 0
      ? hook.selectedEntries
      : transactionsForSelectedSupplier;
    
    const outstanding = transactions.filter((t: any) => {
      const totalPaid = (t.totalPaidForEntry || t.totalPaid || 0);
      return totalPaid === 0 && (t.originalNetAmount || 0) > 0;
    });
    const running = transactions.filter((t: any) => {
      const outstanding = Number(t.outstandingForEntry || t.netAmount || 0);
      const totalPaid = (t.totalPaidForEntry || t.totalPaid || 0);
      return outstanding >= 200 && totalPaid > 0;
    });
    const profitable = transactions.filter((t: any) => {
      const outstanding = Number(t.outstandingForEntry || t.netAmount || 0);
      return outstanding >= 1 && outstanding < 200;
    });
    const paid = transactions.filter((t: any) => {
      const outstanding = Number(t.outstandingForEntry || t.netAmount || 0);
      return outstanding < 1;
    });
    return {
      all: transactions.length,
      outstanding: outstanding.length,
      running: running.length,
      profitable: profitable.length,
      paid: paid.length,
      total: transactions.length
    };
  }, [transactionsForSelectedSupplier, hook.selectedEntries]);

  const selectedSupplierSrNos = useMemo(() => {
    if (!selectedSupplierSummary?.allTransactions) return [];
    return selectedSupplierSummary.allTransactions
      .map((transaction: Customer) => (transaction.srNo || "").toLowerCase())
      .filter(Boolean);
  }, [selectedSupplierSummary]);

  // Get selected receipt serial numbers from selected entries
  const selectedReceiptSrNos = useMemo(() => {
    if (!hook.selectedEntries || hook.selectedEntries.length === 0) return [];
    return hook.selectedEntries
      .map((entry: Customer) => (entry.srNo || "").toLowerCase())
      .filter(Boolean);
  }, [hook.selectedEntries]);

  const normalizedSerialFilter = useMemo(() => {
    const raw = hook.serialNoSearch.trim().toLowerCase();
    if (!raw) return "";
    const numericPart = raw.startsWith("s") ? raw.slice(1) : raw;
    if (/^\d+$/.test(numericPart)) {
      return `s${numericPart.padStart(5, "0")}`;
    }
    return raw.startsWith("s") ? raw : `s${raw}`;
  }, [hook.serialNoSearch]);

  const paymentMatchesSelection = useCallback(
    (payment: Payment) => {
      const paidSrNos =
        payment.paidFor?.map((pf) => (pf.srNo || "").toLowerCase()).filter(Boolean) || [];

      const matchesSerial =
        !normalizedSerialFilter || paidSrNos.includes(normalizedSerialFilter);
      
      // If receipts are selected, only show payments for those receipts
      // Otherwise, show all payments for the selected supplier
      const matchesReceipts = selectedReceiptSrNos.length === 0 
        ? true // No receipts selected, show all payments for supplier
        : paidSrNos.some((sr) => selectedReceiptSrNos.includes(sr)); // Receipts selected, filter by them
      
      const matchesSupplier =
        !selectedSupplierSrNos.length ||
        paidSrNos.some((sr) => selectedSupplierSrNos.includes(sr));

      return matchesSerial && matchesReceipts && matchesSupplier;
    },
    [normalizedSerialFilter, selectedSupplierSrNos, selectedReceiptSrNos]
  );

  // Helper: normalize payment id for sorting
  const getPaymentIdForSort = (payment: Payment): string => {
    return (payment?.id || payment?.paymentId || '').toString();
  };

  const cashHistoryRows = useMemo(() => {
    const filtered = hook.paymentHistory
      .filter((payment: Payment) => (payment.receiptType || "").toLowerCase() === "cash")
      .filter(paymentMatchesSelection);
    // Sort by ID (descending - high to low)
    return [...filtered].sort((a, b) => {
      const idA = getPaymentIdForSort(a);
      const idB = getPaymentIdForSort(b);
      if (!idA && !idB) return 0;
      if (!idA) return 1;
      if (!idB) return -1;
      return idB.localeCompare(idA, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [hook.paymentHistory, paymentMatchesSelection]);

  const rtgsHistoryRows = useMemo(() => {
    const filtered = hook.paymentHistory
      .filter((payment: Payment) => (payment.receiptType || "").toLowerCase() === "rtgs")
      .filter(paymentMatchesSelection);
    // Sort by ID (descending - high to low)
    return [...filtered].sort((a, b) => {
      const idA = getPaymentIdForSort(a);
      const idB = getPaymentIdForSort(b);
      if (!idA && !idB) return 0;
      if (!idA) return 1;
      if (!idB) return -1;
      return idB.localeCompare(idA, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [hook.paymentHistory, paymentMatchesSelection]);

  // Get all payments for selected supplier (for compact history table)
  const selectedSupplierPayments = useMemo(() => {
    if (!hook.selectedCustomerKey) return [];
    return hook.paymentHistory.filter(paymentMatchesSelection);
  }, [hook.paymentHistory, hook.selectedCustomerKey, paymentMatchesSelection]);


    const handlePaymentMethodChange = useCallback(
      (method: 'Cash' | 'Online' | 'RTGS') => {
        // Call the setPaymentMethod directly from the hook
        // It's already handleSetPaymentMethod which has all the logic
        if (hook.setPaymentMethod) {
          hook.setPaymentMethod(method);
        }
      },
      [hook]
    );
  
    return (
        <div className="space-y-3 text-[12px]">
             <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="sticky top-0 z-40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 border-b">
                    <div className="w-full px-3 md:px-5 py-1 flex flex-wrap gap-2 md:gap-3 items-center text-[12px]">
                         <TabsList className="flex flex-none rounded-full border bg-background px-1 text-[12px]">
                            <TabsTrigger className="px-3 py-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" value="process">Payment</TabsTrigger>
                            <TabsTrigger className="px-3 py-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" value="cash">Cash History</TabsTrigger>
                            <TabsTrigger className="px-3 py-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" value="rtgs">RTGS History</TabsTrigger>
                </TabsList>
                        <div className="flex-1 flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
                            <div className="flex flex-1 min-w-[220px]">
                                        <CustomDropdown
                                            options={filteredSupplierOptions.map(({ value, data, label }) => {
                                                // If label already exists (e.g., for Mill Overview), use it
                                                if (label) {
                                                    return { value, label };
                                                }
                                                // Otherwise, create label from data
                                                return {
                                                value,
                                                label: `${toTitleCase(data.name || '')} | F:${toTitleCase(data.fatherName || data.so || '')} | ${toTitleCase(data.address || '')} | ${data.contact || ''}`.trim()
                                                };
                                            })}
                                            value={hook.selectedCustomerKey}
                                            onChange={onSelectSupplierKey}
                                    placeholder="Select supplier..."
                                        />
                                    </div>
                            <div className="relative w-full md:w-[180px]">
                                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                    placeholder="Serial No..."
                                                value={hook.serialNoSearch}
                                                onChange={(e) => hook.handleSerialNoSearch(e.target.value)}
                                                onBlur={hook.handleSerialNoBlur}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        hook.handleSerialNoBlur();
                                                        e.currentTarget.blur();
                                                    }
                                                }}
                                    className="pl-7 h-8"
                                            />
                                        </div>
                            <div className="flex items-center gap-2 md:pl-3">
                                <Button size="sm" className="h-7 text-[11px]" variant="outline" onClick={hook.resetPaymentForm}>Clear</Button>
                                <Button size="sm" className="h-7 text-[11px]" onClick={hook.processPayment}>Finalize</Button>
                                                        </div>
                                                        </div>
                                                    </div>
                                                </div>
                <TabsContent value="process" className="space-y-2">
                            {/* Tab Section (Left) and Name Section (Right) Row - Full Width, Custom Proportions */}
                            {((hook.selectedCustomerKey) || hook.rtgsFor === 'Outsider') && selectedSupplierSummary && (
                              <div className="grid grid-cols-[36%_64%] gap-2 mb-2">
                                {/* Tab Section - Left (35%) */}
                                <Card className="text-[10px]">
                                  <CardContent className="py-1.5 px-2">
                                    <div className="grid grid-cols-5 gap-x-2 items-center text-[10px]">
                                      <button
                                        type="button"
                                        onClick={() => setActiveTransactionTab("all")}
                                        className={`flex items-center justify-center gap-1 px-2 py-1 rounded-md transition-colors h-6 ${
                                          activeTransactionTab === "all"
                                            ? "bg-primary text-primary-foreground"
                                            : "hover:bg-muted"
                                        }`}
                                      >
                                        <span className="text-muted-foreground whitespace-nowrap">All:</span>
                                        <span className="font-bold bg-muted/50 px-1.5 py-0.5 rounded ml-1">{transactionCounts.all}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setActiveTransactionTab("outstanding")}
                                        className={`flex items-center justify-center gap-1 px-2 py-1 rounded-md transition-colors h-6 ${
                                          activeTransactionTab === "outstanding"
                                            ? "bg-primary text-primary-foreground"
                                            : "hover:bg-muted"
                                        }`}
                                      >
                                        <span className="text-muted-foreground whitespace-nowrap">Outstanding:</span>
                                        <span className="font-bold text-red-500 min-w-[2ch] text-right">{transactionCounts.outstanding}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setActiveTransactionTab("running")}
                                        className={`flex items-center justify-center gap-1 px-2 py-1 rounded-md transition-colors h-6 ${
                                          activeTransactionTab === "running"
                                            ? "bg-primary text-primary-foreground"
                                            : "hover:bg-muted"
                                        }`}
                                      >
                                        <span className="text-muted-foreground whitespace-nowrap">Running:</span>
                                        <span className="font-bold text-blue-500 min-w-[2ch] text-right">{transactionCounts.running}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setActiveTransactionTab("profitable")}
                                        className={`flex items-center justify-center gap-1 px-2 py-1 rounded-md transition-colors h-6 ${
                                          activeTransactionTab === "profitable"
                                            ? "bg-primary text-primary-foreground"
                                            : "hover:bg-muted"
                                        }`}
                                      >
                                        <span className="text-muted-foreground whitespace-nowrap">Profitable!:</span>
                                        <span className="font-bold text-yellow-500 min-w-[2ch] text-right">{transactionCounts.profitable}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setActiveTransactionTab("paid")}
                                        className={`flex items-center justify-center gap-1 px-2 py-1 rounded-md transition-colors h-6 ${
                                          activeTransactionTab === "paid"
                                            ? "bg-primary text-primary-foreground"
                                            : "hover:bg-muted"
                                        }`}
                                      >
                                        <span className="text-muted-foreground whitespace-nowrap">Paid:</span>
                                        <span className="font-bold text-green-500 min-w-[2ch] text-right">{transactionCounts.paid}</span>
                                      </button>
                                    </div>
                                  </CardContent>
                                </Card>
                                
                                {/* Name Section - Right (65%) */}
                                <Card className="text-[10px]">
                                  <CardContent className="py-1.5 px-2">
                                    <div className="flex items-center justify-between gap-x-3 gap-y-1 text-[10px]">
                                      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap flex-1 min-w-0">
                                        <div className="flex items-center gap-1 shrink-0">
                                          <span className="text-muted-foreground whitespace-nowrap">Name:</span>
                                          <span className="font-medium truncate">{toTitleCase(selectedSupplierSummary.name || '')}</span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <span className="text-muted-foreground whitespace-nowrap">F:</span>
                                          <span className="font-medium truncate">{toTitleCase(selectedSupplierSummary.so || selectedSupplierSummary.fatherName || '')}</span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <span className="text-muted-foreground whitespace-nowrap">Address:</span>
                                          <span className="font-medium truncate">{toTitleCase(selectedSupplierSummary.address || '')}</span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <span className="text-muted-foreground whitespace-nowrap">Contact:</span>
                                          <span className="font-medium truncate">{selectedSupplierSummary.contact || ''}</span>
                                        </div>
                                      </div>
                                      <Button 
                                        onClick={() => setIsStatementOpen(true)} 
                                        size="sm" 
                                        className="h-6 text-[9px] px-2 whitespace-nowrap shrink-0"
                                      >
                                        Generate Statement
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            )}
                            
                            <div className="grid gap-2 lg:grid-cols-[36%_36%_28%] w-full">
                              <div className="space-y-2 min-w-0 w-full h-[250px]">
                                <TransactionTable
                                  suppliers={transactionsForSelectedSupplier}
                                  onShowDetails={hook.setDetailsSupplierEntry}
                                  selectedIds={hook.selectedEntryIds}
                                  onSelectionChange={hook.setSelectedEntryIds}
                                  embed
                                  activeTab={activeTransactionTab}
                                  onTabChange={setActiveTransactionTab}
                                  onEditEntry={(entry) => {
                                    setSelectedEntryForEdit(entry);
                                    setEditEntryDialogOpen(true);
                                  }}
                                />
                              </div>
                              <div className="space-y-2 min-w-0 w-full h-[250px]">
                                {((hook.selectedCustomerKey) || hook.rtgsFor === 'Outsider') && (
                                  <PaymentHistoryCompact
                                    payments={selectedSupplierPayments}
                                    onEdit={hook.handleEditPayment}
                                    onDelete={hook.handleDeletePayment}
                                  />
                                )}
                              </div>
                              <div className="space-y-2 min-w-0 w-full max-w-full overflow-hidden h-[250px]">
                                {((hook.selectedCustomerKey) || hook.rtgsFor === 'Outsider') && (
                                  <div className="w-full max-w-full overflow-hidden h-full">
                                    <PaymentForm
                                      {...hook}
                                      bankAccounts={hook.bankAccounts}
                                      bankBranches={hook.bankBranches}
                                      onPaymentMethodChange={handlePaymentMethodChange}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* CD Form - Full Width, Single Row (when CD is enabled) */}
                            {hook.cdEnabled && (
                              <Card className="text-[10px] mt-2">
                                <CardContent className="p-2">
                                  <div className="flex items-end gap-2">
                                    <div className="space-y-0.5 flex-1">
                                      <Label className="text-[10px]">CD At</Label>
                                      <Select value={hook.cdAt} onValueChange={hook.setCdAt}>
                                        <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="partial_on_paid">Partial CD on Paid Amount</SelectItem>
                                          <SelectItem value="on_unpaid_amount">CD on Unpaid Amount</SelectItem>
                                          <SelectItem value="on_full_amount">Full CD on Full Amount</SelectItem>
                                          <SelectItem value="proportional_cd">Proportional CD (Exact Distribution)</SelectItem>
                                          <SelectItem value="on_previously_paid_no_cd">On Paid Amount (No CD)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-0.5 flex-1">
                                      <Label htmlFor="cd-percent" className="text-[10px]">CD%</Label>
                                      <Input 
                                        id="cd-percent" 
                                        type="number" 
                                        value={hook.cdPercent} 
                                        onChange={e => hook.setCdPercent(parseFloat(e.target.value) || 0)} 
                                        className="h-7 text-[10px]" 
                                      />
                                    </div>
                                    <div className="space-y-0.5 flex-1">
                                      <Label className="text-[10px]">CD Amt</Label>
                                      <div className="flex items-center gap-1.5">
                                        <Input
                                          type="number"
                                          inputMode="decimal"
                                          step="0.01"
                                          value={Number.isFinite(hook.calculatedCdAmount) ? hook.calculatedCdAmount : 0}
                                          onChange={e => hook.setCdAmount(parseFloat(e.target.value) || 0)}
                                          className="h-7 text-[10px] font-bold text-primary"
                                        />
                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                          {formatCurrency(hook.calculatedCdAmount)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                            
                            {/* Bank Details and Generate Options - Full Screen Half-Half */}
                                {hook.paymentMethod === 'RTGS' && (
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                {/* Bank Details Section - Left Half */}
                                <Card className="text-[10px]">
                                  <CardContent className="p-2">
                                    <RtgsForm {...hook} bankAccounts={supplierBankAccounts} banks={banks} bankBranches={bankBranches} />
                                  </CardContent>
                                </Card>
                                {/* Generate Payment Options Section - Right Half */}
                                <Card className="text-[10px]">
                                  <CardHeader className="pb-1 px-2 pt-2">
                                    <CardTitle className="text-[11px] font-semibold text-muted-foreground">Generate Payment Options</CardTitle>
                                    </CardHeader>
                                  <CardContent className="space-y-2 p-2">
                                    {/* Row 1 */}
                                    <div className="grid grid-cols-3 gap-1.5">
                                      <div className="space-y-0.5">
                                        <Label className="text-[10px]">Quantity</Label>
                                          <Input
                                            type="number"
                                            value={hook.rtgsQuantity}
                                            onChange={(e) => hook.setRtgsQuantity(Number(e.target.value) || 0)}
                                          className="h-7 text-[10px]"
                                          />
                                        </div>
                                      <div className="space-y-0.5">
                                        <Label className="text-[10px]">Rate</Label>
                                          <Input
                                            type="number"
                                            value={hook.rtgsRate}
                                            onChange={(e) => hook.setRtgsRate(Number(e.target.value) || 0)}
                                          className="h-7 text-[10px]"
                                          />
                                        </div>
                                      <div className="space-y-0.5">
                                        <Label className="text-[10px]">Amount</Label>
                                          <Input
                                            type="number"
                                            value={hook.rtgsAmount}
                                            onChange={(e) => hook.setRtgsAmount(Number(e.target.value) || 0)}
                                          className="h-7 text-[10px]"
                                            placeholder="Auto-filled from To Be Paid"
                                          />
                                        </div>
                                      </div>
                                    {/* Row 2 */}
                                      <PaymentCombinationGenerator
                                        calcTargetAmount={hook.calcTargetAmount}
                                        setCalcTargetAmount={hook.setCalcTargetAmount}
                                        minRate={hook.minRate}
                                        setMinRate={hook.setMinRate}
                                        maxRate={hook.maxRate}
                                        setMaxRate={hook.setMaxRate}
                                        selectPaymentAmount={hook.selectPaymentAmount}
                                        combination={paymentCombination}
                                        showResults={false}
                                      />
                                    </CardContent>
                                  </Card>
                              </div>
                                )}
                </TabsContent>
                <TabsContent value="cash" className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-muted-foreground">Cash Payments</h2>
                        <Badge variant="outline" className="text-xs font-medium">
                            {cashHistoryRows.length} {cashHistoryRows.length === 1 ? "entry" : "entries"}
                        </Badge>
                    </div>
                    <PaymentHistory
                        key={`cash-${refreshKey}`}
                        payments={cashHistoryRows}
                        onShowDetails={hook.setSelectedPaymentForDetails}
                        onPrintRtgs={hook.setRtgsReceiptData}
                        onEdit={hook.handleEditPayment}
                        onDelete={(payment: Payment) => hook.handleDeletePayment(payment)}
                        title="Cash Payment History"
                        suppliers={hook.suppliers}
                    />
                </TabsContent>
                <TabsContent value="rtgs" className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-muted-foreground">RTGS Payments</h2>
                        <Badge variant="outline" className="text-xs font-medium">
                            {rtgsHistoryRows.length} {rtgsHistoryRows.length === 1 ? "entry" : "entries"}
                        </Badge>
                    </div>
                    <PaymentHistory
                        key={`rtgs-${refreshKey}`}
                        payments={rtgsHistoryRows}
                        onShowDetails={hook.setSelectedPaymentForDetails}
                        onPrintRtgs={hook.setRtgsReceiptData}
                        onEdit={hook.handleEditPayment}
                        onDelete={(payment: Payment) => hook.handleDeletePayment(payment)}
                        title="RTGS Payment History"
                        suppliers={hook.suppliers}
                    />
                </TabsContent>
            </Tabs>

            {hook.paymentMethod === 'RTGS' && paymentCombination.sortedPaymentOptions.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground">Generated Payment Options</h3>
                  <span className="text-[11px] text-muted-foreground">{paymentCombination.sortedPaymentOptions.length} combinations</span>
                </div>
                <PaymentCombinationResults
                  options={paymentCombination.sortedPaymentOptions}
                  requestSort={paymentCombination.requestSort}
                  onSelect={hook.selectPaymentAmount}
                />
              </div>
            )}
 
            <DetailsDialog
                isOpen={!!hook.detailsSupplierEntry}
                onOpenChange={() => hook.setDetailsSupplierEntry(null)}
                customer={hook.detailsSupplierEntry}
                paymentHistory={hook.paymentHistory}
                entryType="Supplier"
            />

            <PaymentDetailsDialog
                payment={hook.selectedPaymentForDetails}
                suppliers={hook.suppliers}
                onOpenChange={() => hook.setSelectedPaymentForDetails(null)}
                onShowEntryDetails={hook.setDetailsSupplierEntry}
            />
            
           <RTGSReceiptDialog
                payment={hook.rtgsReceiptData}
                settings={hook.receiptSettings}
                onOpenChange={() => hook.setRtgsReceiptData(null)}
           />

          <BankSettingsDialog
            isOpen={hook.isBankSettingsOpen}
            onOpenChange={hook.setIsBankSettingsOpen}
          />

          {/* Outstanding selection dialog removed as requested */}
          
          {/* Summary Sections at the bottom - same as supplier profile */}
          {filteredSupplierSummary && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4">
              {/* Operational Summary Card */}
              <Card className="border border-gray-400/50">
                <CardHeader className="pb-1 px-2 pt-2">
                  <CardTitle className="text-[12px] font-semibold flex items-center gap-1.5">
                    <Scale size={12} className="text-muted-foreground"/>
                    Operational Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0.5 px-2 pb-2 text-[11px]">
                  <div className="space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gross Wt:</span>
                      <span className="font-medium">{formatWeight(filteredSupplierSummary.totalGrossWeight)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Teir Wt:</span>
                      <span className="font-medium">{formatWeight(filteredSupplierSummary.totalTeirWeight)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Final Wt:</span>
                      <span className="font-bold">{formatWeight(filteredSupplierSummary.totalFinalWeight)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Karta Wt (@{formatPercentage(filteredSupplierSummary.averageKartaPercentage)}):</span>
                      <span className="font-medium">{formatWeight(filteredSupplierSummary.totalKartaWeight)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Net Wt:</span>
                      <span className="font-bold text-primary">{formatWeight(filteredSupplierSummary.totalNetWeight)}</span>
                    </div>
                  </div>
                  <Separator className="my-1"/>
                  <div className="space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Average Rate:</span>
                      <span className="font-medium">{formatRate(filteredSupplierSummary.averageRate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Min Rate:</span>
                      <span className="font-medium">{formatRate(filteredSupplierSummary.minRate || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max Rate:</span>
                      <span className="font-medium">{formatRate(filteredSupplierSummary.maxRate || 0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Deduction Summary Card */}
              <Card className="border border-gray-400/50">
                <CardHeader className="pb-1 px-2 pt-2">
                  <CardTitle className="text-[12px] font-semibold flex items-center gap-1.5">
                    <FileText size={12} className="text-muted-foreground"/>
                    Deduction Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0.5 px-2 pb-2 text-[11px]">
                  <div className="space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Amount (@{formatRate(filteredSupplierSummary.averageRate)}/kg):</span>
                      <span className="font-medium">{formatCurrency(filteredSupplierSummary.totalAmount || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Karta (@{formatPercentage(filteredSupplierSummary.averageKartaPercentage)}):</span>
                      <span className="font-medium text-red-500 dark:text-red-400">- {formatCurrency(filteredSupplierSummary.totalKartaAmount || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Laboury (@{formatDecimal(filteredSupplierSummary.averageLabouryRate)}):</span>
                      <span className="font-medium text-red-500 dark:text-red-400">- {formatCurrency(filteredSupplierSummary.totalLabouryAmount || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Kanta:</span>
                      <span className="font-medium text-red-500 dark:text-red-400">- {formatCurrency(filteredSupplierSummary.totalKanta || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Other:</span>
                      <span className="font-medium text-red-500 dark:text-red-400">- {formatCurrency(filteredSupplierSummary.totalBrokerage || 0)}</span>
                    </div>
                  </div>
                  <Separator className="my-1"/>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Original Amount:</span>
                    <span className="font-bold text-primary">{formatCurrency(filteredSupplierSummary.totalOriginalAmount || 0)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Summary Card */}
              <Card className="border border-gray-400/50">
                <CardHeader className="pb-1 px-2 pt-2">
                  <CardTitle className="text-[12px] font-semibold flex items-center gap-1.5">
                    <Banknote size={12} className="text-muted-foreground"/>
                    Financial Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0.5 px-2 pb-2 text-[11px]">
                  <div className="space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Net Payable:</span>
                      <span className="font-medium">{formatCurrency(filteredSupplierSummary.totalOriginalAmount || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Cash Paid:</span>
                      <span className="font-medium text-green-500">{formatCurrency(filteredSupplierSummary.totalCashPaid || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total RTGS Paid:</span>
                      <span className="font-medium text-green-500">{formatCurrency(filteredSupplierSummary.totalRtgsPaid || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total CD Granted:</span>
                      <span className="font-medium">{formatCurrency(filteredSupplierSummary.totalCdAmount || 0)}</span>
                    </div>
                  </div>
                  <Separator className="my-1"/>
                  <div className="space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Transactions:</span>
                      <span className="font-medium">{filteredSupplierSummary.allTransactions?.length || 0} Entries</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Outstanding Entries:</span>
                      <span className="font-medium text-red-500 dark:text-red-400">{filteredSupplierSummary.outstandingEntryIds?.length || 0} Entries</span>
                    </div>
                  </div>
                  <Separator className="my-1"/>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Outstanding:</span>
                    <span className="font-bold text-red-500 dark:text-red-400">{formatCurrency(filteredSupplierSummary.totalOutstanding || 0)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <SupplierEntryEditDialog
            open={editEntryDialogOpen}
            onOpenChange={setEditEntryDialogOpen}
            entry={selectedEntryForEdit}
            onSuccess={() => {
              setRefreshKey(Date.now());
              // Refresh data if needed
            }}
          />

          <Dialog open={isStatementOpen} onOpenChange={setIsStatementOpen}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 printable-statement-container bg-card">
              <DialogHeader className="sr-only">
                <DialogTitle>Statement Preview</DialogTitle>
              </DialogHeader>
              <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto bg-background">
                {selectedSupplierSummary ? (
                  <StatementPreview data={filteredSupplierSummary} />
                ) : (
                  <div className="p-4 text-center text-muted-foreground">No supplier selected</div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
    );
}
