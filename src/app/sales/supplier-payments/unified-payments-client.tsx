
"use client";

import { useMemo, useState, useCallback, useEffect } from 'react';
import type { Customer, Payment, ReceiptSettings } from "@/lib/definitions";
import { toTitleCase, formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSupplierPayments } from '@/hooks/use-supplier-payments';
import { useCustomerPayments } from '@/hooks/use-customer-payments';
import { useGlobalData } from '@/contexts/global-data-context';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Banknote, Scale, FileText, Filter, Calendar as CalendarIcon, User, MapPin, Phone, UserCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";


import { PaymentForm } from '@/components/sales/supplier-payments/payment-form';
import { PaymentHistory } from '@/components/sales/supplier-payments/payment-history';
import { TransactionTable } from '@/components/sales/supplier-payments/transaction-table';
import { PaymentDetailsDialog } from '@/components/sales/supplier-payments/payment-details-dialog';
import { BankSettingsDialog } from '@/components/sales/supplier-payments/bank-settings-dialog';
import { RTGSReceiptDialog } from '@/components/sales/supplier-payments/rtgs-receipt-dialog';
import { DetailsDialog } from "@/components/sales/details-dialog";
import { SupplierEntryEditDialog } from '@/components/sales/supplier-payments/supplier-entry-edit-dialog';
import { CustomerEntryEditDialog } from '@/components/sales/customer-payments/customer-entry-edit-dialog';
import { usePaymentCombination } from '@/hooks/use-payment-combination';
import { PaymentCombinationGenerator, PaymentCombinationResults } from '@/components/sales/supplier-payments/payment-combination-generator';
import { RtgsForm } from '@/components/sales/supplier-payments/rtgs-form';
import { RtgsFormOutsider } from '@/components/sales/supplier-payments/rtgs-form-outsider';
import { GovForm } from '@/components/sales/supplier-payments/gov-form';
import { GovReceiptSelector } from '@/components/sales/supplier-payments/gov-receipt-selector';
import { useSupplierFiltering } from "../supplier-profile/hooks/use-supplier-filtering";
import { useSupplierSummary } from "../supplier-profile/hooks/use-supplier-summary";
import { useOutsiderData } from "@/hooks/use-outsider-data";
import { useOutsiderPayments } from "@/hooks/use-outsider-payments";
import { StatementPreview } from "../supplier-profile/components/statement-preview";
import { PaymentHistoryCompact } from '@/components/sales/supplier-payments/payment-history-compact';
import { GovHistoryTableDirect } from '@/components/sales/supplier-payments/gov-history-table-direct';


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

interface UnifiedPaymentsClientProps {
  type?: 'supplier' | 'customer' | 'outsider';
}

export default function SupplierPaymentsClient({ type = 'supplier' }: UnifiedPaymentsClientProps = {}) {
    const [searchType, setSearchType] = useState<'name' | 'fatherName' | 'address' | 'contact'>('name');
    const [highlightEntryId, setHighlightEntryId] = useState<string | null>(null);
    const { toast } = useToast();
    
  // Always call all hooks to maintain hook order (Rules of Hooks)
  // But only use the results based on type
  const supplierHook = useSupplierPayments();
  const customerHook = useCustomerPayments();
  // Use global data context - NO duplicate listeners
  const globalData = useGlobalData();
  const supplierData = {
    suppliers: globalData.suppliers,
    paymentHistory: globalData.paymentHistory,
    banks: globalData.banks,
    bankBranches: globalData.bankBranches,
    bankAccounts: globalData.bankAccounts,
    supplierBankAccounts: globalData.supplierBankAccounts,
    receiptSettings: globalData.receiptSettings,
  };
  const customerData = {
    customers: globalData.customers,
    paymentHistory: globalData.customerPayments as any,
    banks: globalData.banks,
    bankBranches: globalData.bankBranches,
    bankAccounts: globalData.bankAccounts,
    receiptSettings: globalData.receiptSettings,
  };
  const outsiderData = useOutsiderData();
  const outsiderHook = useOutsiderPayments(outsiderData);
  
  // Use appropriate hook based on type
  const hook = type === 'supplier' ? supplierHook : 
               type === 'customer' ? customerHook : 
               type === 'outsider' ? outsiderHook : 
               {
    suppliers: [],
    paymentHistory: [],
    customerSummaryMap: new Map(),
    selectedCustomerKey: null,
    selectedEntryIds: new Set(),
    handleCustomerSelect: () => {},
    handleEditPayment: () => {},
    calcTargetAmount: () => 0,
    minRate: 0,
    maxRate: 0,
    serialNoSearch: '',
    activeTab: 'process',
    setActiveTab: () => {},
    selectedEntries: [],
    setParchiNo: () => {},
    setDetailsSupplierEntry: () => {},
    detailsSupplierEntry: null,
  };
  
  // Get data based on type
  const dataSource = type === 'supplier' ? supplierData : 
                     type === 'customer' ? customerData : 
                     type === 'outsider' ? outsiderData : 
                     null;
  const { supplierBankAccounts, banks, bankBranches } = dataSource || { supplierBankAccounts: [], banks: [], bankBranches: [] };
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [supplierDataRefreshKey, setSupplierDataRefreshKey] = useState<number>(0);
  const [parchiNoRefreshKey, setParchiNoRefreshKey] = useState<number>(0);
  const { activeTab, setActiveTab } = hook;
  const [editEntryDialogOpen, setEditEntryDialogOpen] = useState(false);
  const [selectedEntryForEdit, setSelectedEntryForEdit] = useState<Customer | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [activeTransactionTab, setActiveTransactionTab] = useState<string>("all");
  const [historyTab, setHistoryTab] = useState<'cash' | 'gov' | 'rtgs'>('cash');
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>(undefined);
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(undefined);
  const [filterVariety, setFilterVariety] = useState<string>("all");
  const [rsValue, setRsValue] = useState<number>(0);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedHistoryType, setSelectedHistoryType] = useState<'cash' | 'gov' | 'rtgs'>('cash');

  const paymentCombination = usePaymentCombination({
    calcTargetAmount: hook?.calcTargetAmount || (() => 0),
    minRate: hook?.paymentMethod === 'Gov.' ? (hook?.govRate || 0) : (hook?.minRate || 0),
    maxRate: hook?.paymentMethod === 'Gov.' ? (hook?.govRate || 0) : (hook?.maxRate || 0),
    rsValue: rsValue,
  });

  // Use the same supplier summary and filtering as supplier profile (skip for outsider)
  // Add supplierDataRefreshKey to force recalculation when entry is edited
  const { supplierSummaryMap, MILL_OVERVIEW_KEY } = useSupplierSummary(
    type === 'outsider' ? [] : (hook?.suppliers || []),
    type === 'outsider' ? [] : (hook?.paymentHistory || []),
    undefined,
    undefined
  );
  
  // Force summary recalculation when supplier data refresh key changes
  useEffect(() => {
    // This effect will trigger when supplierDataRefreshKey changes,
    // causing the component to re-render and recalculate summaries
  }, [supplierDataRefreshKey]);

  const onSelectSupplierKey = useCallback((key: string | null) => {
    if (key) {
      hook.handleCustomerSelect(key);
    }
  }, [hook]);

  // Update the hook's customerSummaryMap to use our new supplierSummaryMap (skip for outsider)
  useEffect(() => {
    if (type === 'outsider') return;
    if (supplierSummaryMap.size > 0 && hook.customerSummaryMap) {
      // Replace the hook's customerSummaryMap with our new one
      hook.customerSummaryMap.clear();
      supplierSummaryMap.forEach((value, key) => {
        hook.customerSummaryMap.set(key, value);
      });
    }
  }, [type, supplierSummaryMap, hook.customerSummaryMap]);

  const { filteredSupplierOptions } = useSupplierFiltering(
    type === 'outsider' ? new Map() : supplierSummaryMap,
    hook.selectedCustomerKey as string | null,
    onSelectSupplierKey as (key: string | null) => void,
    filterStartDate,
    filterEndDate,
    type === 'outsider' ? null : MILL_OVERVIEW_KEY
  );

  const isWithinDateRange = useCallback(
    (dateString?: string | Date) => {
      if (!filterStartDate && !filterEndDate) return true;
      if (!dateString) return false;
      const date =
        typeof dateString === "string" ? new Date(dateString) : dateString;
      if (Number.isNaN(date.getTime())) return false;
      if (filterStartDate && date < filterStartDate) return false;
      if (filterEndDate && date > filterEndDate) return false;
      return true;
    },
    [filterStartDate, filterEndDate]
  );

  const varietyFilteredSupplierOptions = useMemo(() => {
    if (type === 'outsider') return [];
    if (!filterVariety || filterVariety === "all") {
      return filteredSupplierOptions;
    }
    return filteredSupplierOptions.filter((option) => {
      const transactions = option.data?.allTransactions || [];
      return transactions.some(
        (transaction: any) =>
          toTitleCase(transaction?.variety || "") === filterVariety
      );
    });
  }, [type, filteredSupplierOptions, filterVariety]);

  const varietyOptions = useMemo(() => {
    if (type === 'outsider') return [];
    const varieties = new Set<string>();
    supplierSummaryMap.forEach((summary) => {
      summary?.allTransactions?.forEach((transaction: any) => {
        if (transaction?.variety) {
          varieties.add(toTitleCase(transaction.variety));
        }
      });
    });
    return Array.from(varieties).sort();
  }, [type, supplierSummaryMap]);

  const hasActiveSupplierFilters = Boolean(
    filterStartDate ||
    filterEndDate ||
    filterVariety !== "all"
  );

  const handleClearSupplierFilters = () => {
    setFilterStartDate(undefined);
    setFilterEndDate(undefined);
    setFilterVariety("all");
  };

  // Removed automatic Mill Overview selection - let user select manually

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

        localStorage.removeItem('editPaymentData');
      }
    }
  }, [hook.handleEditPayment]);
    // Removed toast from dependencies - it's stable from useToast hook
    // eslint-disable-next-line react-hooks/exhaustive-deps

  const selectedSupplierSummary = useMemo(() => {
    if (type === 'outsider') return null;
    if (!hook.selectedCustomerKey) return null;
    return supplierSummaryMap.get(hook.selectedCustomerKey) ?? null;
    }, [type, hook.selectedCustomerKey, supplierSummaryMap]);

  const transactionsForSelectedSupplier = useMemo(() => {
    if (type === 'outsider') return [];
    const allTransactions = selectedSupplierSummary?.allTransactions || [];
    return allTransactions.filter((transaction: any) => {
      const matchesDate = isWithinDateRange(transaction?.date);
      const matchesVariety =
        !filterVariety ||
        filterVariety === "all" ||
        toTitleCase(transaction?.variety || "") === filterVariety;
      return matchesDate && matchesVariety;
    });
  }, [type, selectedSupplierSummary, filterVariety, isWithinDateRange]);

  // Create filtered summary based on selected receipts
  const filteredSupplierSummary = useMemo(() => {
    if (type === 'outsider') return null;
    if (!selectedSupplierSummary) return null;
    
    // Determine base transactions depending on selection
    const selectedSrNos = new Set(
      hook.selectedEntries.map((e: Customer) => (e.srNo || "").toLowerCase()).filter(Boolean)
    );
    
    const filteredTransactions = hook.selectedEntries && hook.selectedEntries.length > 0
      ? transactionsForSelectedSupplier.filter((t: Customer) =>
          selectedSrNos.has((t.srNo || "").toLowerCase())
        )
      : transactionsForSelectedSupplier;
    
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
    let totalExtraAmount = 0; // Total extra amount from Gov. payments
    
    filteredTransactions.forEach((entry: Customer) => {
      const entrySrNo = (entry.srNo || "").toLowerCase();
      const paymentsForEntry = filteredPayments.filter((p: Payment) => 
        p.paidFor?.some(pf => (pf.srNo || "").toLowerCase() === entrySrNo)
      );
      
      // IMPORTANT: Find ALL Gov payments for this entry and sum ALL their extraAmounts
      // If one receipt has multiple Gov payments, each payment's extraAmount is added separately
      // Example: If receipt S001 has 3 Gov payments (RT001, RT002, RT003), all 3 extraAmounts will be summed
      const allGovPayments = paymentsForEntry.filter(p => {
        const receiptType = ((p as any).receiptType || '').trim().toLowerCase();
        const isGovByType = receiptType === 'gov.' || receiptType === 'gov' || receiptType.startsWith('gov');
        const hasGovFields = (p as any).govQuantity !== undefined || 
                            (p as any).govRate !== undefined || 
                            (p as any).govAmount !== undefined ||
                            (p as any).extraAmount !== undefined ||
                            (p as any).govRequiredAmount !== undefined;
        return (isGovByType || hasGovFields) && p.paidFor?.some(pf => (pf.srNo || "").toLowerCase() === entrySrNo);
      });
      
      // Sum extraAmount from ALL Gov payments for this entry
      allGovPayments.forEach(govPayment => {
        const paidForThisEntry = govPayment.paidFor?.find(pf => (pf.srNo || "").toLowerCase() === entrySrNo);
        if (paidForThisEntry) {
          // Get extra amount from paidFor entry - each payment contributes separately
          if (paidForThisEntry.adjustedOriginal !== undefined) {
            const extra = paidForThisEntry.adjustedOriginal - (Number(entry.originalNetAmount) || 0);
            totalExtraAmount += extra;
          } else if (paidForThisEntry.extraAmount !== undefined) {
            // Add extraAmount from THIS payment (each payment counted separately)
            totalExtraAmount += (paidForThisEntry.extraAmount || 0);
          } else if ((govPayment as any).extraAmount !== undefined) {
            totalExtraAmount += ((govPayment as any).extraAmount || 0);
          }
        }
      });
      
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
    
    // Calculate adjusted original (base original + extra amount from Gov. payments)
    const totalAdjustedOriginal = totalOriginalAmount + totalExtraAmount;
    
    // Outstanding = Adjusted Original - Paid - CD
    const totalOutstanding = totalAdjustedOriginal - totalPaid - totalCd;
    
    // Calculate outstanding entry IDs (using adjusted original for Gov. payments)
    const outstandingEntryIds = filteredTransactions
      .filter((t: Customer) => {
        const entrySrNo = (t.srNo || "").toLowerCase();
        const paymentsForEntry = filteredPayments.filter((p: Payment) => 
          p.paidFor?.some(pf => (pf.srNo || "").toLowerCase() === entrySrNo)
        );
        let entryPaid = 0;
        let entryCd = 0;
        
        // IMPORTANT: Check for ALL Gov payments' extra amounts for this entry
        // If one receipt has multiple Gov payments, sum all their extraAmounts
        let adjustedOriginal = Number(t.originalNetAmount) || 0;
        let totalExtraForEntry = 0;
        
        const allGovPaymentsForEntry = paymentsForEntry.filter(p => {
          const receiptType = ((p as any).receiptType || '').trim().toLowerCase();
          const isGovByType = receiptType === 'gov.' || receiptType === 'gov' || receiptType.startsWith('gov');
          const hasGovFields = (p as any).govQuantity !== undefined || 
                              (p as any).govRate !== undefined || 
                              (p as any).govAmount !== undefined ||
                              (p as any).extraAmount !== undefined ||
                              (p as any).govRequiredAmount !== undefined;
          return (isGovByType || hasGovFields) && p.paidFor?.some(pf => (pf.srNo || "").toLowerCase() === entrySrNo);
        });
        
        // Sum extraAmount from ALL Gov payments for this entry
        allGovPaymentsForEntry.forEach(govPayment => {
          const paidForThisEntry = govPayment.paidFor?.find(pf => (pf.srNo || "").toLowerCase() === entrySrNo);
          if (paidForThisEntry) {
            if (paidForThisEntry.adjustedOriginal !== undefined) {
              // Use adjustedOriginal from the first/latest Gov payment
              adjustedOriginal = paidForThisEntry.adjustedOriginal;
            } else if (paidForThisEntry.extraAmount !== undefined) {
              // Sum all extraAmounts from all Gov payments
              totalExtraForEntry += (paidForThisEntry.extraAmount || 0);
            } else if ((govPayment as any).extraAmount !== undefined) {
              totalExtraForEntry += ((govPayment as any).extraAmount || 0);
            }
          }
        });
        
        // If we summed extraAmounts, add to original
        if (totalExtraForEntry > 0 && adjustedOriginal === Number(t.originalNetAmount)) {
          adjustedOriginal = (Number(t.originalNetAmount) || 0) + totalExtraForEntry;
        }
        
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
        
        // Outstanding = Adjusted Original - Paid - CD
        const entryOutstanding = adjustedOriginal - entryPaid - entryCd;
        return entryOutstanding > 0.01;
      })
      .map((t: Customer) => t.id)
      .filter(Boolean);
    
    // Calculate averages - use weighted average for rate (rate * weight / total weight)
    const totalWeightedRate = filteredTransactions.reduce((sum, t) => {
      const rate = Number(t.rate) || 0;
      const netWeight = Number(t.netWeight) || 0;
      return sum + rate * netWeight;
    }, 0);
    
    const safeNetWeight = totalNetWeight || 0;
    const averageRate = safeNetWeight > 0 ? totalWeightedRate / safeNetWeight : 0;
    
    // Calculate average original price (adjusted original / net weight)
    const totalAdjustedOriginalForAvg = totalAdjustedOriginal || totalOriginalAmount || 0;
    const averageOriginalPrice = safeNetWeight > 0 ? totalAdjustedOriginalForAvg / safeNetWeight : 0;
    
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
      totalExtraAmount, // Add extra amount for display
      totalAdjustedOriginal, // Add adjusted original for display
      totalPaid,
      totalCdAmount: totalCd,
      totalCashPaid,
      totalRtgsPaid,
      totalOutstanding,
      outstandingEntryIds,
      averageRate,
      averageOriginalPrice, // Add average original price
      minRate,
      maxRate,
      averageKartaPercentage,
      averageLabouryRate,
    };
  }, [selectedSupplierSummary, hook.selectedEntries, hook.paymentHistory, transactionsForSelectedSupplier]);

  // Calculate transaction counts for status section (skip for outsider - no supplier data)
  const transactionCounts = useMemo(() => {
    // Skip calculation for outsider type - no supplier/outstanding data needed
    if (type === 'outsider') {
      return {
        all: 0,
        outstanding: 0,
        running: 0,
        profitable: 0,
        paid: 0,
        total: 0
      };
    }
    
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
  }, [type, transactionsForSelectedSupplier, hook.selectedEntries]);

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

      const matchesDate = isWithinDateRange(payment.date);

      return matchesSerial && matchesReceipts && matchesSupplier && matchesDate;
    },
    [normalizedSerialFilter, selectedSupplierSrNos, selectedReceiptSrNos, isWithinDateRange]
  );

  // Helper: normalize payment id for sorting
  const getPaymentIdForSort = (payment: Payment): string => {
    return (payment?.id || payment?.paymentId || '').toString();
  };

  // Helper: parse ID into prefix and numeric part for proper sorting
  const parsePaymentIdForSort = (id: string): { prefix: string; number: number } => {
    if (!id) return { prefix: '', number: 0 };
    
    // Extract prefix (letters) and number
    const match = id.match(/^([A-Za-z]*)(\d+)$/);
    if (match) {
      const prefix = match[1] || '';
      const number = parseInt(match[2] || '0', 10);
      return { prefix, number };
    }
    
    // Fallback: if no match, treat as string
    return { prefix: id, number: 0 };
  };

  const govHistoryRows = useMemo(() => {
    // Load directly from IndexedDB governmentFinalizedPayments table
    // Show ALL entries from this table without any filtering conditions
    const loadGovPaymentsDirect = async () => {
      try {
        const { db } = await import('@/lib/database');
        if (db && db.governmentFinalizedPayments) {
          // Get all payments from governmentFinalizedPayments table
          let allGovPayments: Payment[] = [];
          try {
            allGovPayments = await db.governmentFinalizedPayments
              .orderBy('date')
              .reverse()
              .toArray();
          } catch (dateError) {
            try {
              allGovPayments = await db.governmentFinalizedPayments
                .orderBy('id')
                .reverse()
                .toArray();
            } catch (idError) {
              allGovPayments = await db.governmentFinalizedPayments.toArray();
            }
          }
          
          // Force set receiptType for all
          return allGovPayments.map(p => ({
            ...p,
            receiptType: 'Gov.' as const
          })) as Payment[];
        }
      } catch (error) {
        console.error('Error loading gov payments directly:', error);
      }
      return [];
    };
    
    // For now, use paymentHistory but filter to show ALL payments that might be gov
    // In the future, we can use the direct load above
    if (!hook.paymentHistory || hook.paymentHistory.length === 0) {
      return [];
    }
    
    // Show ALL payments from governmentFinalizedPayments table
    // Check if payment has ANY gov-specific field OR receiptType is Gov.
    const filtered = hook.paymentHistory
      .filter((payment: Payment) => {
        // Check 1: receiptType (case-insensitive)
        const receiptType = (payment.receiptType || "").trim().toLowerCase();
        if (receiptType === "gov." || receiptType === "gov" || receiptType.startsWith("gov")) {
          return true;
        }
        
        // Check 2: Gov-specific fields - if ANY gov field exists, show it
        const hasGovQuantity = (payment as any).govQuantity !== undefined && (payment as any).govQuantity !== null;
        const hasGovRate = (payment as any).govRate !== undefined && (payment as any).govRate !== null;
        const hasGovAmount = (payment as any).govAmount !== undefined && (payment as any).govAmount !== null;
        const hasGovRequiredAmount = (payment as any).govRequiredAmount !== undefined && (payment as any).govRequiredAmount !== null;
        const hasExtraAmount = (payment as any).extraAmount !== undefined && (payment as any).extraAmount !== null;
        
        // If ANY gov-specific field exists, show it
        if (hasGovQuantity || hasGovRate || hasExtraAmount || hasGovAmount || hasGovRequiredAmount) {
          return true;
        }
        
        return false;
      });
    
    // Filter by selected supplier if supplier is selected
    const supplierFiltered = filtered.filter(payment => {
      // If no supplier selected, show all (or filter based on requirement)
      if (!hook.selectedCustomerKey) {
        return true;
      }
      // Apply supplier filter using paymentMatchesSelection
      return paymentMatchesSelection(payment);
    });
    
    // Only apply date filter if dates are selected
    const dateFiltered = supplierFiltered.filter(payment => {
      if (!filterStartDate && !filterEndDate) {
        return true;
      }
      return isWithinDateRange(payment.date);
    });
    
    // Sort by ID (descending - high to low)
    return [...dateFiltered].sort((a, b) => {
      const idA = getPaymentIdForSort(a);
      const idB = getPaymentIdForSort(b);
      if (!idA && !idB) return 0;
      if (!idA) return 1;
      if (!idB) return -1;
      
      const parsedA = parsePaymentIdForSort(idA);
      const parsedB = parsePaymentIdForSort(idB);
      
      // First compare prefix (alphabetically)
      const prefixCompare = parsedB.prefix.localeCompare(parsedA.prefix);
      if (prefixCompare !== 0) return prefixCompare;
      
      // If prefix is same, compare numeric part (descending)
      return parsedB.number - parsedA.number;
    });
  }, [hook.paymentHistory, hook.selectedCustomerKey, isWithinDateRange, filterStartDate, filterEndDate, paymentMatchesSelection]);

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
      
      const parsedA = parsePaymentIdForSort(idA);
      const parsedB = parsePaymentIdForSort(idB);
      
      // First compare prefix (alphabetically)
      const prefixCompare = parsedB.prefix.localeCompare(parsedA.prefix);
      if (prefixCompare !== 0) return prefixCompare;
      
      // If prefix is same, compare numeric part (descending)
      return parsedB.number - parsedA.number;
    });
  }, [hook.paymentHistory, paymentMatchesSelection]);

  const rtgsHistoryRows = useMemo(() => {
    const filtered = hook.paymentHistory
      .filter((payment: Payment) => {
        const isRtgs = (payment.receiptType || "").toLowerCase() === "rtgs";
        // For outsider, only show payments where customerId === 'OUTSIDER'
        if (type === 'outsider') {
          return isRtgs && payment.customerId === 'OUTSIDER';
        }
        return isRtgs;
      })
      .filter(type === 'outsider' ? () => true : paymentMatchesSelection); // No filtering needed for outsider
    // Sort by ID (descending - high to low)
    return [...filtered].sort((a, b) => {
      const idA = getPaymentIdForSort(a);
      const idB = getPaymentIdForSort(b);
      if (!idA && !idB) return 0;
      if (!idA) return 1;
      if (!idB) return -1;
      
      const parsedA = parsePaymentIdForSort(idA);
      const parsedB = parsePaymentIdForSort(idB);
      
      // First compare prefix (alphabetically)
      const prefixCompare = parsedB.prefix.localeCompare(parsedA.prefix);
      if (prefixCompare !== 0) return prefixCompare;
      
      // If prefix is same, compare numeric part (descending)
      return parsedB.number - parsedA.number;
    });
  }, [hook.paymentHistory, paymentMatchesSelection]);

  // Get all payments for selected supplier (for compact history table)
  const selectedSupplierPayments = useMemo(() => {
    if (!hook.selectedCustomerKey) return [];
    return hook.paymentHistory.filter(paymentMatchesSelection);
  }, [hook.paymentHistory, hook.selectedCustomerKey, paymentMatchesSelection]);


    const handlePaymentMethodChange = useCallback(
      (method: 'Cash' | 'Online' | 'RTGS' | 'Gov.') => {
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
             {type === 'outsider' ? (
                // For outsider: No tabs, just show payment content directly
                <>
                    <div className="sticky top-0 z-40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 border-b">
                        <div className="w-full px-3 md:px-5 py-1 flex flex-wrap gap-2 md:gap-3 items-center text-[12px]">
                            <div className="flex-1 flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
                                <div className="flex items-center gap-2 md:pl-3">
                                    <Button size="sm" className="h-7 text-[11px]" variant="outline" onClick={hook.resetPaymentForm} disabled={hook.isProcessing}>Clear</Button>
                                    <Button size="sm" className="h-7 text-[11px]" onClick={hook.processPayment} disabled={hook.isProcessing}>
                                        {hook.isProcessing ? (
                                            <>
                                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            "Finalize"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                    {(() => {
                        // Get outsider payments (where customerId === 'OUTSIDER')
                        const outsiderPayments = hook.paymentHistory.filter((payment: Payment) => 
                          payment.customerId === 'OUTSIDER' && 
                          (payment.receiptType || "").toLowerCase() === "rtgs"
                        );
                        
                        return (
                          <div className="w-full max-w-full overflow-hidden space-y-3">
                            <div className="flex flex-col gap-3">
                              <div className="w-full">
                                <RtgsFormOutsider {...hook} bankAccounts={outsiderData?.bankAccounts || []} banks={outsiderData?.banks || []} bankBranches={outsiderData?.bankBranches || []} />
                              </div>
                              <div className="w-full h-[310px] overflow-hidden">
                                <PaymentHistoryCompact
                                  payments={outsiderPayments}
                                  onEdit={hook.handleEditPayment}
                                  onDelete={hook.handleDeletePayment}
                                />
                              </div>
                            </div>
                          </div>
                        );
                    })()}
                </>
             ) : (
                // For non-outsider: Show payment interface
                <>
                    <div className="sticky top-0 z-40 bg-card/98 backdrop-blur-md supports-[backdrop-filter]:bg-card/95 border-b-2 border-primary/20 shadow-lg">
                        <div className="w-full px-3 md:px-4 py-1.5 space-y-1.5">
                            {type !== 'outsider' && (
                            <>
                            {/* Two columns: Tabs/Filters (65%) and Supplier Details (35%) */}
                            <div className="grid grid-cols-[65%_35%] gap-3">
                                {/* Left Column: Tabs and Search/Filter Section (50%) */}
                                <div className="flex flex-col gap-2">
                                    {/* History Tabs - Cash, Gov, RTGS */}
                                    <div className="flex items-center gap-1.5 w-full">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setSelectedHistoryType('cash');
                                                setHistoryDialogOpen(true);
                                            }}
                                            className="h-7 text-[10px] font-semibold flex-1 justify-between px-2"
                                        >
                                            <span>Cash History</span>
                                            <span className="bg-gray-800 dark:bg-gray-700 text-white px-1.5 py-0.5 rounded-md text-[9px] font-bold">
                                                {cashHistoryRows.length}
                                            </span>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setSelectedHistoryType('gov');
                                                setHistoryDialogOpen(true);
                                            }}
                                            className="h-7 text-[10px] font-semibold flex-1 justify-between px-2"
                                        >
                                            <span>Gov History</span>
                                            <span className="bg-gray-800 dark:bg-gray-700 text-white px-1.5 py-0.5 rounded-md text-[9px] font-bold">
                                                {govHistoryRows.length}
                                            </span>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setSelectedHistoryType('rtgs');
                                                setHistoryDialogOpen(true);
                                            }}
                                            className="h-7 text-[10px] font-semibold flex-1 justify-between px-2"
                                        >
                                            <span>RTGS History</span>
                                            <span className="bg-gray-800 dark:bg-gray-700 text-white px-1.5 py-0.5 rounded-md text-[9px] font-bold">
                                                {rtgsHistoryRows.length}
                                            </span>
                                        </Button>
                                    </div>
                                    
                                    {/* Search and Filter Section */}
                                    <div className="flex flex-col gap-2.5">
                                    {/* Single Row: All elements in one row */}
                                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
                                        {/* Name Dropdown (Search Type) */}
                                        <div className="w-full lg:w-[120px] flex-shrink-0">
                                            <Select value={searchType} onValueChange={(value) => setSearchType(value as typeof searchType)}>
                                                <SelectTrigger className="h-8 text-[11px] border-2 border-primary/20 focus:border-primary font-semibold">
                                                    <SelectValue placeholder="Name" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="name">Name</SelectItem>
                                                    <SelectItem value="fatherName">Father Name</SelectItem>
                                                    <SelectItem value="address">Address</SelectItem>
                                                    <SelectItem value="contact">Contact</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        
                                        {/* Search Supplier Input */}
                                        <div className="flex-1 min-w-0">
                                            <CustomDropdown
                                                options={varietyFilteredSupplierOptions.map(({ value, data, label }) => {
                                                    // If label already exists (e.g., for Mill Overview), use it but still pass data
                                                    if (label) {
                                                        return { value, label, data: data || {} };
                                                    }
                                                    // Otherwise, create label from data
                                                    return {
                                                    value,
                                                    label: `${toTitleCase(data.name || '')} | F:${toTitleCase(data.fatherName || data.so || '')} | ${toTitleCase(data.address || '')} | ${data.contact || ''}`.trim(),
                                                    data: data || {}
                                                    };
                                                })}
                                                value={hook.selectedCustomerKey}
                                                onChange={onSelectSupplierKey}
                                                placeholder="Search supplier..."
                                                inputClassName="h-8 border-2 border-primary/20 focus:border-primary text-[11px] font-semibold"
                                                searchType={searchType}
                                                onSearchTypeChange={undefined}
                                            />
                                        </div>
                                        
                                        {/* Serial Number Search */}
                                        <div className="w-full lg:w-[180px] flex-shrink-0">
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary/70" />
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
                                                    className="pl-8 h-8 border-2 border-primary/20 focus:border-primary text-[11px] font-semibold"
                                                />
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className={`h-8 w-8 border-2 transition-all ${hasActiveSupplierFilters ? "text-primary border-primary bg-primary/10 shadow-md" : "border-primary/20 hover:border-primary/30 hover:bg-primary/5"}`}
                                        title="Filter suppliers"
                                      >
                                        <Filter className="h-4 w-4" />
                                      </Button>
                                    </PopoverTrigger>
                                <PopoverContent className="w-64 space-y-3 text-[11px] z-50 border-2 border-primary/20 shadow-xl" align="end">
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] font-semibold">Start Date</Label>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          className={cn(
                                            "w-full justify-start text-left font-normal h-8 text-[11px] border-2 border-primary/20 focus:border-primary",
                                            !filterStartDate && "text-muted-foreground"
                                          )}
                                        >
                                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                          {filterStartDate ? format(filterStartDate, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0 z-[60]" align="start">
                                        <Calendar
                                          mode="single"
                                          selected={filterStartDate}
                                          onSelect={setFilterStartDate}
                                          initialFocus
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] font-semibold">End Date</Label>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          className={cn(
                                            "w-full justify-start text-left font-normal h-8 text-[11px] border-2 border-primary/20 focus:border-primary",
                                            !filterEndDate && "text-muted-foreground"
                                          )}
                                        >
                                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                          {filterEndDate ? format(filterEndDate, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0 z-[60]" align="start">
                                        <Calendar
                                          mode="single"
                                          selected={filterEndDate}
                                          onSelect={setFilterEndDate}
                                          initialFocus
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] font-semibold">Variety</Label>
                                    <Select
                                      value={filterVariety}
                                      onValueChange={(value) => setFilterVariety(value)}
                                    >
                                      <SelectTrigger className="h-8 text-[11px] border-2 border-primary/20 focus:border-primary">
                                        <SelectValue placeholder="All varieties" />
                                      </SelectTrigger>
                                      <SelectContent className="z-[60]">
                                        <SelectItem value="all">All varieties</SelectItem>
                                        {varietyOptions.map((variety) => (
                                          <SelectItem key={variety} value={variety}>
                                            {variety}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="flex items-center justify-between pt-1 border-t border-border/30">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-[11px] font-semibold hover:bg-primary/10 hover:text-primary"
                                      onClick={handleClearSupplierFilters}
                                    >
                                      Reset
                                    </Button>
                                    <span className="text-[10px] text-muted-foreground font-medium">
                                      Filters apply instantly
                                    </span>
                                  </div>
                                </PopoverContent>
                              </Popover>
                                <Button size="sm" className="h-8 text-[11px] font-semibold border-2 border-primary/20 hover:border-primary/30 hover:bg-primary/5" variant="outline" onClick={hook.resetPaymentForm} disabled={hook.isProcessing}>Clear</Button>
                                <Button size="sm" className="h-8 text-[11px] font-bold bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg" onClick={hook.processPayment} disabled={hook.isProcessing}>
                                    {hook.isProcessing ? (
                                        <>
                                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        "Finalize"
                                    )}
                                </Button>
                                        </div>
                                    </div>
                                    </div>
                                    
                                    {/* Transaction Tabs: All, Outstanding, Running, Profitable, Paid + Generate Statement */}
                                    {hook.selectedCustomerKey && selectedSupplierSummary && (
                                        <div className="flex items-center gap-2">
                                            {/* Transaction Tabs - Narrower width */}
                                            <div className="flex items-center gap-1.5 flex-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveTransactionTab("all")}
                                                    className={`flex items-center justify-between gap-2 px-1.5 py-1 rounded-xl transition-all duration-300 border shadow-md hover:shadow-lg hover:scale-[1.02] flex-1 ${
                                                        activeTransactionTab === "all"
                                                            ? "bg-gradient-to-br from-background/60 via-background/50 to-background/40 border-primary/40 text-primary shadow-lg scale-[1.02]"
                                                            : "bg-gradient-to-br from-background/60 via-background/50 to-background/40 border-border/30 hover:bg-primary/10 hover:border-primary/25"
                                                    }`}
                                                >
                                                    <span className="text-[9px] font-bold text-muted-foreground">All</span>
                                                    <span className="bg-gray-800 dark:bg-gray-700 text-white px-1.5 py-0.5 rounded-md text-[10px] font-bold">{transactionCounts.all}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveTransactionTab("outstanding")}
                                                    className={`flex items-center justify-between gap-2 px-1.5 py-1 rounded-xl transition-all duration-300 border shadow-md hover:shadow-lg hover:scale-[1.02] flex-1 ${
                                                        activeTransactionTab === "outstanding"
                                                            ? "bg-gradient-to-br from-background/60 via-background/50 to-background/40 border-primary/40 text-primary shadow-lg scale-[1.02]"
                                                            : "bg-gradient-to-br from-background/60 via-background/50 to-background/40 border-border/30 hover:bg-primary/10 hover:border-primary/25"
                                                    }`}
                                                >
                                                    <span className="text-[9px] font-bold text-muted-foreground">Outstanding</span>
                                                    <span className="bg-gray-800 dark:bg-gray-700 text-white px-1.5 py-0.5 rounded-md text-[10px] font-bold">{transactionCounts.outstanding}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveTransactionTab("running")}
                                                    className={`flex items-center justify-between gap-2 px-1.5 py-1 rounded-xl transition-all duration-300 border shadow-md hover:shadow-lg hover:scale-[1.02] flex-1 ${
                                                        activeTransactionTab === "running"
                                                            ? "bg-gradient-to-br from-background/60 via-background/50 to-background/40 border-primary/40 text-primary shadow-lg scale-[1.02]"
                                                            : "bg-gradient-to-br from-background/60 via-background/50 to-background/40 border-border/30 hover:bg-primary/10 hover:border-primary/25"
                                                    }`}
                                                >
                                                    <span className="text-[9px] font-bold text-muted-foreground">Running</span>
                                                    <span className="bg-gray-800 dark:bg-gray-700 text-white px-1.5 py-0.5 rounded-md text-[10px] font-bold">{transactionCounts.running}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveTransactionTab("profitable")}
                                                    className={`flex items-center justify-between gap-2 px-1.5 py-1 rounded-xl transition-all duration-300 border shadow-md hover:shadow-lg hover:scale-[1.02] flex-1 ${
                                                        activeTransactionTab === "profitable"
                                                            ? "bg-gradient-to-br from-background/60 via-background/50 to-background/40 border-primary/40 text-primary shadow-lg scale-[1.02]"
                                                            : "bg-gradient-to-br from-background/60 via-background/50 to-background/40 border-border/30 hover:bg-primary/10 hover:border-primary/25"
                                                    }`}
                                                >
                                                    <span className="text-[9px] font-bold text-muted-foreground">Profitable</span>
                                                    <span className="bg-gray-800 dark:bg-gray-700 text-white px-1.5 py-0.5 rounded-md text-[10px] font-bold">{transactionCounts.profitable}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveTransactionTab("paid")}
                                                    className={`flex items-center justify-between gap-2 px-1.5 py-1 rounded-xl transition-all duration-300 border shadow-md hover:shadow-lg hover:scale-[1.02] flex-1 ${
                                                        activeTransactionTab === "paid"
                                                            ? "bg-gradient-to-br from-background/60 via-background/50 to-background/40 border-primary/40 text-primary shadow-lg scale-[1.02]"
                                                            : "bg-gradient-to-br from-background/60 via-background/50 to-background/40 border-border/30 hover:bg-primary/10 hover:border-primary/25"
                                                    }`}
                                                >
                                                    <span className="text-[9px] font-bold text-muted-foreground">Paid</span>
                                                    <span className="bg-gray-800 dark:bg-gray-700 text-white px-1.5 py-0.5 rounded-md text-[10px] font-bold">{transactionCounts.paid}</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Right Column: Supplier Details Section (50%) */}
                                <div className="flex flex-col gap-2">
                                    {hook.selectedCustomerKey && selectedSupplierSummary && (
                                        <div className="bg-gray-950 border-2 border-primary/20 rounded-lg p-2.5 space-y-1.5">
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                                                {/* Left Column: Basic Info */}
                                                <div className="space-y-1">
                                                    <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                                                        <span className="font-semibold text-gray-400">Name:</span>
                                                        <span className="font-medium text-white">{toTitleCase(selectedSupplierSummary.name || '-')}</span>
                                                        
                                                        <span className="font-semibold text-gray-400">F:</span>
                                                        <span className="font-medium text-white">{toTitleCase(selectedSupplierSummary.so || selectedSupplierSummary.fatherName || '-')}</span>
                                                        
                                                        <span className="font-semibold text-gray-400">Address:</span>
                                                        <span className="font-medium text-white">{toTitleCase(selectedSupplierSummary.address || '-')}</span>
                                                        
                                                        <span className="font-semibold text-gray-400">Contact:</span>
                                                        <span className="font-medium text-white">{selectedSupplierSummary.contact || '-'}</span>
                                                    </div>
                                                </div>
                                                
                                                {/* Right Column: Figures */}
                                                {filteredSupplierSummary && (
                                                    <div className="space-y-1">
                                                        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                                                            <span className="font-semibold text-gray-400">Total Outstanding:</span>
                                                            <span className="font-medium text-white">{formatDecimal(filteredSupplierSummary.totalOutstanding || 0)}</span>
                                                            
                                                            <span className="font-semibold text-gray-400">Total CD:</span>
                                                            <span className="font-medium text-white">{formatDecimal(filteredSupplierSummary.totalCdAmount || 0)}</span>
                                                            
                                                            <span className="font-semibold text-gray-400">Total QTL:</span>
                                                            <span className="font-medium text-white">{formatDecimal(filteredSupplierSummary.totalNetWeight || 0)}</span>
                                                        </div>
                                                        {/* Generate Statement Button */}
                                                        <div className="-mt-1.5 pt-0.5 border-t border-primary/20">
                                                            <Button 
                                                                onClick={() => setIsStatementOpen(true)} 
                                                                size="sm" 
                                                                className="w-auto min-w-[140px] h-6 px-3 py-0.5 text-[9px] font-bold bg-gradient-to-r from-primary via-primary/95 to-primary/90 hover:from-primary/95 hover:via-primary hover:to-primary/95 shadow-md hover:shadow-lg transition-all duration-300 border border-primary/40 hover:border-primary/60"
                                                            >
                                                                <FileText className="h-2.5 w-2.5 mr-1" />
                                                                Generate Statement
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            </>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2 mt-2 px-3 md:px-4">
                            
                            {/* TransactionTable - Only for supplier/customer, NOT for outsider - Outstanding entries table removed for outsider */}
                            {/* DO NOT RENDER TransactionTable for outsider type - it shows outstanding entries which we don't need */}
                            {/* EXPLICITLY CHECK: Never render this entire grid section for outsider type */}
                            {/* CRITICAL: This section is INSIDE the IIFE, so it will NOT execute for outsider type */}
                            {transactionsForSelectedSupplier && Array.isArray(transactionsForSelectedSupplier) && transactionsForSelectedSupplier.length > 0 && (
                            <div className="flex gap-2 w-full">
                              {/* Left Side: Tables (74% width) */}
                              <div className="flex flex-col gap-2 w-[74%]">
                                <div className="space-y-2 min-w-0 w-full h-[180px]">
                                  {/* Never render TransactionTable for outsider - shows outstanding entries table */}
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
                                    type={type}
                                    highlightEntryId={highlightEntryId}
                                  />
                                </div>
                                {/* Payment History - Below Outstanding Table */}
                                {type !== 'outsider' && hook.selectedCustomerKey && (
                                  <div className="space-y-2 min-w-0 w-full h-[180px]">
                                    <PaymentHistoryCompact
                                      payments={selectedSupplierPayments}
                                      onEdit={hook.handleEditPayment}
                                      onDelete={hook.handleDeletePayment}
                                    />
                                  </div>
                                )}
                              </div>
                              {/* Right Side: Payment Form (26% width, covers both tables height) */}
                              <div className="w-[26%] flex-shrink-0">
                                {hook.selectedCustomerKey && (
                                  <div className="w-full h-full overflow-hidden">
                                    <PaymentForm
                                      key={`payment-form-${parchiNoRefreshKey}`}
                                      {...hook}
                                      bankAccounts={hook.bankAccounts}
                                      bankBranches={hook.bankBranches}
                                      onPaymentMethodChange={handlePaymentMethodChange}
                                      hideRtgsToggle={type === 'outsider'}
                                      centerName={hook.centerName}
                                      setCenterName={hook.setCenterName}
                                      centerNameOptions={hook.centerNameOptions}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            )}
                            
                            {/* CD Form - Full Width, Single Row (when CD is enabled) */}
                            {hook.cdEnabled && (
                              <Card className="text-[10px] mt-2 border-2 border-primary/20 shadow-lg bg-gradient-to-br from-card via-card/95 to-card/90">
                                <CardContent className="p-2.5">
                                  <div className="flex items-end gap-2.5">
                                    <div className="space-y-1 flex-1">
                                      <Label className="text-[10px] font-bold">CD At</Label>
                                      <Select value={hook.cdAt} onValueChange={hook.setCdAt}>
                                        <SelectTrigger className="h-8 text-[10px] border-2 border-primary/20 focus:border-primary"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="partial_on_paid">Partial CD on Paid Amount</SelectItem>
                                          <SelectItem value="on_unpaid_amount">CD on Unpaid Amount</SelectItem>
                                          <SelectItem value="on_full_amount">Full CD on Full Amount</SelectItem>
                                          <SelectItem value="proportional_cd">Proportional CD (Exact Distribution)</SelectItem>
                                          <SelectItem value="on_previously_paid_no_cd">On Paid Amount (No CD)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1 flex-1">
                                      <Label htmlFor="cd-percent" className="text-[10px] font-bold">CD%</Label>
                                      <Input 
                                        id="cd-percent" 
                                        type="number" 
                                        value={hook.cdPercent} 
                                        onChange={e => hook.setCdPercent(parseFloat(e.target.value) || 0)} 
                                        className="h-8 text-[10px] border-2 border-primary/20 focus:border-primary" 
                                      />
                                    </div>
                                    <div className="space-y-1 flex-1">
                                      <Label className="text-[10px] font-bold">CD Amt</Label>
                                      <div className="flex items-center gap-1.5">
                                        <Input
                                          type="number"
                                          inputMode="decimal"
                                          step="0.01"
                                          value={Number.isFinite(hook.calculatedCdAmount) ? hook.calculatedCdAmount : 0}
                                          onChange={e => hook.setCdAmount(parseFloat(e.target.value) || 0)}
                                          className="h-8 text-[10px] font-extrabold text-primary border-2 border-primary/30 bg-primary/10 focus:border-primary"
                                        />
                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap font-bold px-2 py-1 rounded-md bg-background/60 border border-border/30">
                                          {formatCurrency(hook.calculatedCdAmount)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                            
                            {/* Bank Details and Generate Options - Full Screen Half-Half (Only for Supplier Payments) */}
                                {type === 'supplier' && hook.paymentMethod === 'RTGS' && (
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                {/* Bank Details Section - Left Half */}
                                <Card className="text-[10px] border-2 border-primary/20 shadow-lg bg-gradient-to-br from-card via-card/95 to-card/90">
                                  <CardContent className="p-2.5">
                                    <RtgsForm {...hook} bankAccounts={supplierBankAccounts} banks={banks} bankBranches={bankBranches} />
                                  </CardContent>
                                </Card>
                                {/* Generate Payment Options Section - Right Half */}
                                <Card className="text-[10px] border-2 border-primary/20 shadow-lg bg-gradient-to-br from-card via-card/95 to-card/90">
                                  <CardHeader className="pb-2 px-2.5 pt-2.5 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-b-2 border-primary/20">
                                    <CardTitle className="text-[11px] font-extrabold text-foreground">Generate Payment Options</CardTitle>
                                    </CardHeader>
                                  <CardContent className="space-y-2 p-2.5">
                                    {/* Row 1 */}
                                    <div className="grid grid-cols-3 gap-2">
                                      <div className="space-y-1">
                                        <Label className="text-[10px] font-bold">Quantity</Label>
                                          <Input
                                            type="number"
                                            value={hook.rtgsQuantity}
                                            onChange={(e) => hook.setRtgsQuantity(Number(e.target.value) || 0)}
                                          className="h-8 text-[10px] border-2 border-primary/20 focus:border-primary"
                                          />
                                        </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px] font-bold">Rate</Label>
                                          <Input
                                            type="number"
                                            value={hook.rtgsRate}
                                            onChange={(e) => hook.setRtgsRate(Number(e.target.value) || 0)}
                                          className="h-8 text-[10px] border-2 border-primary/20 focus:border-primary"
                                          />
                                        </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px] font-bold">Amount</Label>
                                          <Input
                                            type="number"
                                            value={hook.rtgsAmount}
                                            onChange={(e) => hook.setRtgsAmount(Number(e.target.value) || 0)}
                                          className="h-8 text-[10px] border-2 border-primary/20 focus:border-primary"
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
                                        rsValue={rsValue}
                                        setRsValue={setRsValue}
                                        selectPaymentAmount={hook.selectPaymentAmount}
                                        combination={paymentCombination}
                                        showResults={false}
                                        paymentMethod={hook.paymentMethod}
                                      />
                                    </CardContent>
                                  </Card>
                              </div>
                                )}

                            {/* Gov. Payment Form - Similar to RTGS but without bank details */}
                                {type === 'supplier' && hook.paymentMethod === 'Gov.' && (
                              <div className="space-y-2 mt-2">
                                {/* Gov Receipt Selector Helper and Gov Details - Single Row */}
                                {hook.selectedCustomerKey && transactionsForSelectedSupplier && transactionsForSelectedSupplier.length > 0 && (
                                  <div className="grid grid-cols-2 gap-2">
                                    {/* Gov Receipt Selector Helper - Left Half */}
                                    <GovReceiptSelector
                                      availableReceipts={transactionsForSelectedSupplier}
                                      govRate={hook.govRate || hook.minRate || 0}
                                      extraAmountPerQuintal={
                                        hook.govQuantity > 0 && hook.extraAmount > 0 
                                          ? hook.extraAmount / hook.govQuantity 
                                          : (hook.calcTargetAmount > 0 && hook.govQuantity > 0 && hook.govAmount > 0
                                              ? (hook.govAmount + (hook.govRequiredAmount - hook.govAmount) - hook.calcTargetAmount) / hook.govQuantity
                                              : 0)
                                      }
                                      onSelectReceipts={(receiptIds) => {
                                        hook.setSelectedEntryIds(new Set(receiptIds));
                                      }}
                                      selectedReceiptIds={hook.selectedEntryIds}
                                      allowManualRsPerQtl={true}
                                      allowManualGovRate={true}
                                      calcTargetAmount={hook.calcTargetAmount}
                                      setCalcTargetAmount={hook.setCalcTargetAmount}
                                      combination={paymentCombination}
                                      selectPaymentAmount={hook.selectPaymentAmount}
                                    />
                                    {/* Gov. Details Section - Right Half */}
                                    <Card className="text-[10px] border-2 border-primary/20 shadow-lg bg-gradient-to-br from-card via-card/95 to-card/90">
                                      <CardContent className="p-2.5">
                                        <GovForm 
                                          govQuantity={hook.govQuantity}
                                          setGovQuantity={hook.setGovQuantity}
                                          govRate={hook.govRate}
                                          setGovRate={hook.setGovRate}
                                          govAmount={hook.govAmount}
                                          setGovAmount={hook.setGovAmount}
                                          govRequiredAmount={hook.govRequiredAmount}
                                          setGovRequiredAmount={hook.setGovRequiredAmount}
                                          extraAmount={hook.extraAmount}
                                          setExtraAmount={hook.setExtraAmount}
                                          calcTargetAmount={hook.calcTargetAmount}
                                          minRate={hook.minRate}
                                          selectedPaymentOption={hook.selectedPaymentOption}
                                          extraAmountBaseType={hook.extraAmountBaseType}
                                          setExtraAmountBaseType={hook.setExtraAmountBaseType}
                                        />
                                      </CardContent>
                                    </Card>
                                  </div>
                                )}
                              </div>
                                )}
                </div>
                </>
             )}

            {(type === 'supplier' && (hook.paymentMethod === 'RTGS' || hook.paymentMethod === 'Gov.') && paymentCombination.sortedPaymentOptions.length > 0) && (
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
          
          {/* Summary Sections at the bottom - same as supplier profile - HIDDEN for outsider (no supplier data, no outstanding entries) */}
          {type !== 'outsider' && filteredSupplierSummary && (
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
                    {((filteredSupplierSummary as any).averageOriginalPrice || 0) > 0 && (
                      <div className="flex justify-between pt-0.5 border-t border-muted">
                        <span className="text-muted-foreground text-[10px]">Avg. Original Price:</span>
                        <span className="font-medium text-[10px]">{formatRate((filteredSupplierSummary as any).averageOriginalPrice || 0)}</span>
                      </div>
                    )}
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
                    <div className="flex justify-between pt-0.5 border-t border-muted">
                      <span className="text-muted-foreground text-[10px]">Total Deductions:</span>
                      <span className="font-semibold text-red-500 dark:text-red-400 text-[10px]">
                        - {formatCurrency(
                          (filteredSupplierSummary.totalKartaAmount || 0) +
                          (filteredSupplierSummary.totalLabouryAmount || 0) +
                          (filteredSupplierSummary.totalKanta || 0) +
                          (filteredSupplierSummary.totalBrokerage || 0)
                        )}
                      </span>
                    </div>
                  </div>
                  <Separator className="my-1"/>
                  <div className="space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base Original Amount:</span>
                      <span className="font-semibold text-primary">{formatCurrency(filteredSupplierSummary.totalOriginalAmount || 0)}</span>
                    </div>
                    {((filteredSupplierSummary as any).totalExtraAmount || 0) > 0 && (
                      <>
                        <div className="flex justify-between pl-2">
                          <span className="text-muted-foreground text-[10px]">+ Extra Amount (Gov.):</span>
                          <span className="font-semibold text-green-600 text-[10px]">{formatCurrency((filteredSupplierSummary as any).totalExtraAmount || 0)}</span>
                        </div>
                        <div className="flex justify-between pt-0.5 border-t border-primary/20">
                          <span className="text-muted-foreground font-medium">Adjusted Original:</span>
                          <span className="font-bold text-primary">{formatCurrency((filteredSupplierSummary as any).totalAdjustedOriginal || filteredSupplierSummary.totalOriginalAmount || 0)}</span>
                        </div>
                      </>
                    )}
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
                <CardContent className="space-y-1 px-2 pb-2 text-[11px]">
                  {/* Original Amount Section */}
                  <div className="space-y-0.5 bg-primary/5 p-1.5 rounded border border-primary/20">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground font-medium">Base Original Amount:</span>
                      <span className="font-semibold text-primary">{formatCurrency(filteredSupplierSummary.totalOriginalAmount || 0)}</span>
                    </div>
                    {((filteredSupplierSummary as any).totalExtraAmount || 0) > 0 && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground text-[10px]">Extra Amount (Gov.):</span>
                          <span className="font-semibold text-green-600 text-[10px]">+ {formatCurrency((filteredSupplierSummary as any).totalExtraAmount || 0)}</span>
                        </div>
                        <Separator className="my-0.5"/>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground font-medium">Adjusted Original:</span>
                          <span className="font-bold text-primary text-xs">{formatCurrency((filteredSupplierSummary as any).totalAdjustedOriginal || filteredSupplierSummary.totalOriginalAmount || 0)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Payment Breakdown */}
                  <div className="space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Paid:</span>
                      <span className="font-medium text-green-600">{formatCurrency(filteredSupplierSummary.totalPaid || 0)}</span>
                    </div>
                    <div className="flex justify-between pl-2">
                      <span className="text-muted-foreground text-[10px]">• Cash Paid:</span>
                      <span className="font-medium text-green-500 text-[10px]">{formatCurrency(filteredSupplierSummary.totalCashPaid || 0)}</span>
                    </div>
                    <div className="flex justify-between pl-2">
                      <span className="text-muted-foreground text-[10px]">• RTGS Paid:</span>
                      <span className="font-medium text-green-500 text-[10px]">{formatCurrency(filteredSupplierSummary.totalRtgsPaid || 0)}</span>
                    </div>
                    {(() => {
                      // IMPORTANT: Sum ALL paidFor amounts for Gov payments, not just one entry per payment
                      // This ensures all entries in a single Gov payment are counted
                      const govPaid = (filteredSupplierSummary.allPayments || [])
                        .filter((p: Payment) => {
                          const receiptType = ((p as any).receiptType || '').trim();
                          return receiptType === 'Gov.' || receiptType.toLowerCase() === 'gov' || receiptType.toLowerCase().startsWith('gov');
                        })
                        .reduce((sum: number, p: Payment) => {
                          // Sum ALL paidFor amounts for this Gov payment that match filtered transactions
                          const matchingPaidFor = p.paidFor?.filter(pf => 
                            (filteredSupplierSummary.allTransactions || []).some((t: Customer) => t.srNo === pf.srNo)
                          ) || [];
                          
                          // Sum ALL matching paidFor amounts, not just one
                          const govPaidForThisPayment = matchingPaidFor.reduce((paymentSum, pf) => 
                            paymentSum + (pf.amount || 0), 0
                          );
                          
                          return sum + govPaidForThisPayment;
                        }, 0);
                      if (govPaid > 0) {
                        return (
                          <div className="flex justify-between pl-2">
                            <span className="text-muted-foreground text-[10px]">• Gov. Paid:</span>
                            <span className="font-medium text-green-500 text-[10px]">{formatCurrency(govPaid)}</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total CD Granted:</span>
                      <span className="font-medium text-blue-600">{formatCurrency(filteredSupplierSummary.totalCdAmount || 0)}</span>
                    </div>
                  </div>
                  
                  <Separator className="my-1"/>
                  
                  {/* Transaction Stats */}
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
                  
                  {/* Final Outstanding */}
                  <div className="bg-red-50 dark:bg-red-950/20 p-1.5 rounded border border-red-200 dark:border-red-800">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground font-semibold">Final Outstanding:</span>
                      <span className="font-bold text-red-600 dark:text-red-400 text-sm">{formatCurrency(filteredSupplierSummary.totalOutstanding || 0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {type === 'supplier' ? (
            <SupplierEntryEditDialog
              open={editEntryDialogOpen}
              onOpenChange={setEditEntryDialogOpen}
              entry={selectedEntryForEdit}
              onSuccess={async () => {
                // Highlight and scroll to entry in table
                if (selectedEntryForEdit?.id) {
                  setHighlightEntryId(selectedEntryForEdit.id);
                  setTimeout(() => setHighlightEntryId(null), 3000);
                }
                
                // Force refresh of supplier data and summary
                setRefreshKey(Date.now());
                setSupplierDataRefreshKey(Date.now());
                
                // Wait a bit for the local update to propagate to IndexedDB
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Force a recalculation by temporarily clearing and resetting the selected supplier
                const currentKey = hook.selectedCustomerKey;
                if (currentKey) {
                  // Temporarily clear to force summary recalculation
                  hook.handleCustomerSelect(null);
                  // Reset immediately to trigger recalculation with updated data
                  setTimeout(() => {
                    hook.handleCustomerSelect(currentKey);
                  }, 50);
                }
              }}
            />
          ) : (
            <CustomerEntryEditDialog
              open={editEntryDialogOpen}
              onOpenChange={setEditEntryDialogOpen}
              entry={selectedEntryForEdit}
              onSuccess={async () => {
                // Force immediate refresh of customer data and summary for hand-to-hand update
                setRefreshKey(Date.now());
                setSupplierDataRefreshKey(Date.now());
                
                // Highlight and scroll to entry in table
                if (selectedEntryForEdit?.id) {
                  setHighlightEntryId(selectedEntryForEdit.id);
                  setTimeout(() => setHighlightEntryId(null), 3000);
                }
                
                // Wait for local update to complete and sync to Firestore
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Force a recalculation by temporarily clearing and resetting the selected customer
                const currentKey = hook.selectedCustomerKey;
                if (currentKey) {
                  // Temporarily clear to force summary recalculation
                  hook.handleCustomerSelect(null);
                  // Reset immediately to trigger recalculation with updated data
                  setTimeout(() => {
                    hook.handleCustomerSelect(currentKey);
                  }, 50);
                }
                
                // If using customer hook, force refresh of customer data
                if (type === 'customer' && customerHook) {
                  // The hook will automatically refresh via realtime listeners
                  // But we can trigger a manual refresh if needed

                }
              }}
            />
          )}

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

          {/* Full Screen History Dialog */}
          <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
            <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full flex flex-col p-0">
              <DialogHeader className="px-6 pt-6 pb-4 border-b">
                <DialogTitle className="text-lg font-semibold">
                  {selectedHistoryType === 'cash' && 'Cash History'}
                  {selectedHistoryType === 'rtgs' && 'RTGS History'}
                  {selectedHistoryType === 'gov' && 'Gov History'}
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 min-h-0 overflow-auto p-6">
                {selectedHistoryType === 'cash' && (
                  <PaymentHistoryCompact
                    payments={cashHistoryRows}
                    onEdit={hook.handleEditPayment}
                    onDelete={hook.handleDeletePayment}
                    historyType="cash"
                  />
                )}
                {selectedHistoryType === 'rtgs' && (
                  <PaymentHistoryCompact
                    payments={rtgsHistoryRows}
                    onEdit={hook.handleEditPayment}
                    onDelete={hook.handleDeletePayment}
                    historyType="rtgs"
                  />
                )}
                {selectedHistoryType === 'gov' && (
                  <PaymentHistoryCompact
                    payments={govHistoryRows}
                    onEdit={hook.handleEditPayment}
                    onDelete={hook.handleDeletePayment}
                    historyType="gov"
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
    );
}
