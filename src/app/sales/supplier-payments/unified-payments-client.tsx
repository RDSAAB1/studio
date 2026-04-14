
"use client";

import React, { useMemo, useState, useCallback, useEffect, useTransition, useDeferredValue } from 'react';
import type { Customer, Payment, ReceiptSettings, PaidFor } from "@/lib/definitions";
import { toTitleCase, formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSupplierPayments } from '@/hooks/use-supplier-payments';
import { useCustomerPayments } from '@/hooks/use-customer-payments';
import { useGlobalData } from '@/contexts/global-data-context';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Banknote, Scale, FileText, User, MapPin, Phone, UserCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";


import { PaymentForm } from '@/components/sales/supplier-payments/payment-form';
import { PaymentHistory } from '@/components/sales/supplier-payments/payment-history';
import { TransactionTable } from '@/components/sales/supplier-payments/supplier-transaction-table';
import { PaymentFilters } from '@/components/sales/supplier-payments/payment-filters';
import { SupplierSummaryCards } from '@/components/sales/supplier-payments/supplier-summary-cards';
import { GeneratePaymentOptions } from '@/components/sales/supplier-payments/generate-payment-options';
import { PaymentDialogs } from "../../../components/sales/supplier-payments/payment-dialogs";
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
import { useFilteredSummary } from "../supplier-profile/hooks/use-filtered-summary";
import { useOutsiderData } from "@/hooks/use-outsider-data";
import { useOutsiderPayments } from "@/hooks/use-outsider-payments";
import { GovHistoryTableDirect } from '@/components/sales/supplier-payments/gov-history-table-direct';
import { usePaymentFilters } from "./hooks/use-payment-filters";
import { PaymentHistoryCompact } from '@/components/sales/supplier-payments/payment-history-compact';
import { ProcessingOverlay } from "@/components/ui/processing-overlay";


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

type UnifiedPaymentsHook = {
  suppliers: Customer[];
  paymentHistory: Payment[];
  customerSummaryMap: Map<string, any>;
  selectedCustomerKey: string | null;
  selectedEntryIds: Set<string>;
  selectedEntries: Customer[];
  serialNoSearch: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  handleCustomerSelect: (key: string | null) => void;
  handleEditPayment?: (p: Payment) => void;
  handleDeletePayment?: (p: Payment) => void;
  handleProcessPayment?: () => void | Promise<void>;
  processPayment?: () => void | Promise<void>;
  resetPaymentForm?: () => void;
  isProcessing?: boolean;
  setPaymentMethod?: (method: 'Cash' | 'Online' | 'Ledger' | 'RTGS' | 'Gov.') => void;
  paymentMethod?: 'Cash' | 'Online' | 'Ledger' | 'RTGS' | 'Gov.';
  govRate?: number;
  minRate?: number;
  maxRate?: number;
  banks?: any[];
  bankBranches?: any[];
  bankAccounts?: any[];
  receiptSettings: ReceiptSettings | null;
  detailsSupplierEntry?: any | null;
  setDetailsSupplierEntry: (entry: any | null) => void;
  setParchiNo?: (value: string) => void;
  parchiNo?: string;
  isBankSettingsOpen: boolean;
  setIsBankSettingsOpen: (open: boolean) => void;
  selectedPaymentForDetails?: any | null;
  setSelectedPaymentForDetails: (p: any | null) => void;
  rtgsReceiptData?: any | null;
  setRtgsReceiptData: (p: any | null) => void;
  bankDetails: { bank?: string; branch?: string; ifscCode?: string; acNo?: string };
  setBankDetails: React.Dispatch<React.SetStateAction<{ bank?: string; branch?: string; ifscCode?: string; acNo?: string }>>;
  supplierDetails?: { name?: string; [key: string]: unknown };
  setSupplierDetails?: (details: { name?: string; [key: string]: unknown }) => void;
  editingPayment?: Payment | null;
  handleSerialNoSearch?: (value: string) => void;
  handleSerialNoBlur?: () => void;
  setSelectedEntryIds: (ids: Set<string>) => void;
  centerName?: string;
  setCenterName?: (value: string) => void;
  centerNameOptions?: any[];
  cdEnabled?: boolean;
  cdAt?: string;
  setCdAt?: (value: string) => void;
  cdPercent?: number;
  setCdPercent?: (value: number) => void;
  calculatedCdAmount?: number;
  setCdAmount?: (value: number) => void;
  rtgsQuantity?: number;
  setRtgsQuantity?: (value: number) => void;
  rtgsRate?: number;
  setRtgsRate?: (value: number) => void;
  rtgsAmount?: number;
  setRtgsAmount?: (value: number) => void;
  setMinRate?: (value: number) => void;
  setMaxRate?: (value: number) => void;
  selectPaymentAmount?: (option: { quantity: number; rate: number; calculatedAmount: number; amountRemaining: number; bags?: number | null }) => void;
  govQuantity?: number;
  setGovQuantity?: (value: number) => void;
  govAmount?: number;
  setGovAmount?: (value: number) => void;
  govExtraAmount?: number;
  setGovExtraAmount?: (value: number) => void;
  setGovRate?: (value: number) => void;
  selectedPaymentOption?: { quantity?: number; rate?: number; calculatedAmount?: number; amountRemaining?: number; bags?: number | null } | null;
};

interface UnifiedPaymentsClientProps {
  type?: 'supplier' | 'customer' | 'outsider';
}

function SupplierPaymentsClient({ type = 'supplier' }: UnifiedPaymentsClientProps = {}) {
  const [, startTransition] = useTransition();
  const [searchType, setSearchType] = useState<'name' | 'fatherName' | 'address' | 'contact'>('name');
  const [highlightEntryId, setHighlightEntryId] = useState<string | null>(null);
  const [isDeleteProcessing, setIsDeleteProcessing] = useState(false);
  const [showProcessingOverlay, setShowProcessingOverlay] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const processingStartRef = React.useRef<number | null>(null);
  const MIN_PROCESS_OVERLAY_MS = 1000;
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
  const rawHook = type === 'supplier' ? supplierHook : 
                  type === 'customer' ? customerHook : 
                  type === 'outsider' ? outsiderHook : 
                  undefined;
  const defaultHook: UnifiedPaymentsHook = {
    suppliers: [],
    paymentHistory: [],
    customerSummaryMap: new Map(),
    selectedCustomerKey: null,
    selectedEntryIds: new Set(),
    selectedEntries: [],
    serialNoSearch: '',
    activeTab: 'process',
    setActiveTab: () => {},
    handleCustomerSelect: () => {},
    receiptSettings: null,
    setDetailsSupplierEntry: () => {},
    isBankSettingsOpen: false,
    setIsBankSettingsOpen: () => {},
    setSelectedPaymentForDetails: () => {},
    setRtgsReceiptData: () => {},
    bankDetails: {},
    setBankDetails: () => {},
    setSelectedEntryIds: () => {},
    setCdAmount: () => {},
    calculatedCdAmount: 0,
  };
  const hook: UnifiedPaymentsHook = { ...defaultHook, ...(rawHook as any) };

  // Keep the processing window visible for at least a few seconds
  // so the user can see the "Success" state clearly.
  useEffect(() => {
    const isBusy = Boolean(hook.isProcessing || isDeleteProcessing);
    if (isBusy) {
      if (!showProcessingOverlay) {
        processingStartRef.current = Date.now();
        setShowProcessingOverlay(true);
        setIsSuccess(false);
      }
      return;
    }

    if (!showProcessingOverlay) return;

    // When busy stops, we signal success
    setIsSuccess(true);

    const startedAt = processingStartRef.current ?? Date.now();
    const elapsed = Date.now() - startedAt;
    const SUCCESS_DISPLAY_MS = 2000;
    const remaining = Math.max(SUCCESS_DISPLAY_MS - elapsed, 0);

    const timer = window.setTimeout(() => {
      setShowProcessingOverlay(false);
      setIsSuccess(false);
      processingStartRef.current = null;
    }, remaining);

    return () => window.clearTimeout(timer);
  }, [hook.isProcessing, isDeleteProcessing, showProcessingOverlay]);

  const handleDeletePayment = useCallback(
    async (payment: Payment) => {
      if (!hook.handleDeletePayment) return;
      try {
        setIsDeleteProcessing(true);
        await Promise.resolve(hook.handleDeletePayment(payment));
      } finally {
        setIsDeleteProcessing(false);
      }
    },
    [hook.handleDeletePayment]
  );
  
  // Get data based on type
  const dataSource = type === 'supplier' ? supplierData : 
                     type === 'customer' ? customerData : 
                     type === 'outsider' ? outsiderData : 
                     null;
  const supplierBankAccounts = type === 'supplier' ? supplierData.supplierBankAccounts : [];
  const banks = (dataSource as any)?.banks ?? [];
  const bankBranches = (dataSource as any)?.bankBranches ?? [];
  const [supplierDataRefreshKey, setSupplierDataRefreshKey] = useState<number>(0);
  const [parchiNoRefreshKey, setParchiNoRefreshKey] = useState<number>(0);
  const { activeTab, setActiveTab } = hook;
  const [editEntryDialogOpen, setEditEntryDialogOpen] = useState(false);
  const [selectedEntryForEdit, setSelectedEntryForEdit] = useState<Customer | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [govSuggestions, setGovSuggestions] = useState<any[]>([]);
  const [activeTransactionTab, setActiveTransactionTab] = useState<string>("all");
  const [historyTab, setHistoryTab] = useState<'cash' | 'gov' | 'rtgs'>('cash');
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedHistoryType, setSelectedHistoryType] = useState<'cash' | 'gov' | 'rtgs'>('cash');

  const paymentCombination = usePaymentCombination({
    targetAmount: hook?.rtgsAmount || 0,
    minRate: hook?.paymentMethod === 'Gov.' ? (hook?.govRate || 0) : (hook?.minRate || 0),
    maxRate: hook?.paymentMethod === 'Gov.' ? (hook?.govRate || 0) : (hook?.maxRate || 0),
  });
  
  // Defer large supplier/payment arrays so heavy summaries recalculate in low-priority renders
  const deferredSuppliers = useDeferredValue(hook?.suppliers || []);
  const deferredPaymentHistory = useDeferredValue(hook?.paymentHistory || []);

  // Use the same supplier summary and filtering as supplier profile (skip for outsider)
  // Add supplierDataRefreshKey to force recalculation when entry is edited
  const sourceSuppliers = type === 'outsider' ? [] : deferredSuppliers;
  const sourcePayments = type === 'outsider' ? [] : deferredPaymentHistory;

  const { supplierSummaryMap, MILL_OVERVIEW_KEY } = useSupplierSummary(
    sourceSuppliers,
    sourcePayments,
    undefined,
    undefined,
    hook.selectedCustomerKey as string | null
  );
  
  // Force summary recalculation when supplier data refresh key changes
  useEffect(() => {
    // This effect will trigger when supplierDataRefreshKey changes,
    // causing the component to re-render and recalculate summaries
  }, [supplierDataRefreshKey]);

  const onSelectSupplierKey = useCallback((key: string | null) => {
    if (key) {
      startTransition(() => {
        hook.handleCustomerSelect(key);
      });
    }
  }, [hook, startTransition]);

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

  // Get filter state first (needed for useSupplierFiltering)
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>(undefined);
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(undefined);
  const [filterVariety, setFilterVariety] = useState<string>("all");

  const { filteredSupplierOptions } = useSupplierFiltering(
    type === 'outsider' ? new Map() : supplierSummaryMap,
    hook.selectedCustomerKey as string | null,
    onSelectSupplierKey as (key: string | null) => void,
    filterStartDate,
    filterEndDate,
    type === 'outsider' ? undefined : MILL_OVERVIEW_KEY
  );

  // Get filter logic from hook
  const {
    isWithinDateRange,
    varietyFilteredSupplierOptions,
    varietyOptions,
    hasActiveFilters: hasActiveSupplierFilters,
    handleClearFilters: handleClearSupplierFilters,
  } = usePaymentFilters({
    type,
    filteredSupplierOptions,
    supplierSummaryMap,
    filterStartDate,
    setFilterStartDate,
    filterEndDate,
    setFilterEndDate,
    filterVariety,
    setFilterVariety,
  });

  // Removed automatic Mill Overview selection - let user select manually

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

  const handleEditPayment = useCallback((payment: Payment) => {
    handleClearSupplierFilters();
    setSearchType('name');
    hook.handleEditPayment?.(payment);
    setHistoryDialogOpen(false); // Close history dialog when editing
    startTransition(() => {
      setActiveTab('process');
    });
    // Scroll to top to see the processing interface
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [handleClearSupplierFilters, hook.handleEditPayment, setActiveTab]);

  const handleEditEntry = useCallback((entry: any) => {
    if (!entry) return;
    setSelectedEntryForEdit(entry);
    setEditEntryDialogOpen(true);
  }, []);

  const handleEditEntryDialogOpenChange = useCallback((nextOpen: boolean) => {
    setEditEntryDialogOpen(nextOpen);
    if (!nextOpen) {
      setSelectedEntryForEdit(null);
    }
  }, []);

  const selectedSupplierSummary = useMemo(() => {
    if (type === 'outsider') return null;
    if (!hook.selectedCustomerKey) return null;
    return supplierSummaryMap.get(hook.selectedCustomerKey) ?? null;
    }, [type, hook.selectedCustomerKey, supplierSummaryMap]);

  const transactionsForSelectedSupplier = useMemo(() => {
    if (type === 'outsider') return [];
    const allTransactions = selectedSupplierSummary?.allTransactions || [];
    return allTransactions.filter((transaction: Customer) => {
      const matchesDate = isWithinDateRange(transaction?.date);
      const matchesVariety =
        !filterVariety ||
        filterVariety === "all" ||
        toTitleCase(transaction?.variety || "") === filterVariety;
      return matchesDate && matchesVariety;
    });
  }, [type, selectedSupplierSummary, filterVariety, isWithinDateRange]);

  // Create filtered summary based on selected receipt  
  const filteredSupplierSummary = useFilteredSummary({
    type,
    selectedSupplierSummary,
    selectedEntries: hook.selectedEntries,
    paymentHistory: hook.paymentHistory,
    transactionsForSelectedSupplier,
    isWithinDateRange,
    filterVariety,
    paymentMethod: hook.paymentMethod,
    govExtraAmount: hook.govExtraAmount,
    selectedCustomerKey: hook.selectedCustomerKey
  });

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
      
      // If receipts are selected, do NOT filter history by them. 
      // User wants to see all history for the supplier even when selecting bills to pay.
      // const matchesReceipts = selectedReceiptSrNos.length === 0 
      //   ? true // No receipts selected, show all payments for supplier
      //   : paidSrNos.some((sr) => selectedReceiptSrNos.includes(sr)); // Receipts selected, filter by them
      
      const parchiNoRaw = String((payment as any).parchiNo || (payment as any).checkNo || "").trim().toLowerCase();
      const parchiTokens = parchiNoRaw.split(/[,\s]+/g).map(t => t.trim()).filter(Boolean);

      const matchesSupplier =
        !hook.selectedCustomerKey ||
        (payment.supplierId === hook.selectedCustomerKey) ||
        ((payment as any).customerId === hook.selectedCustomerKey) ||
        (selectedSupplierSrNos.length > 0 && (
          paidSrNos.some((sr) => selectedSupplierSrNos.includes(sr)) ||
          parchiTokens.some((token) => selectedSupplierSrNos.includes(token))
        ));

      const matchesDate = isWithinDateRange(payment.date);

      // We do NOT filter history by serial number search. 
      // The search box is for finding bills to pay, not filtering history.
      // If we filter history by serial search, advance payments (which have no bill number) disappear.
      return matchesSupplier && matchesDate;
    },
    [selectedSupplierSrNos, isWithinDateRange, hook.selectedCustomerKey]
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
    // Single payments collection - filter by receiptType Gov
    if (!hook.paymentHistory || hook.paymentHistory.length === 0) {
      return [];
    }
    
    // Filter payments with receiptType Gov or gov-specific fields
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
        
        // If ANY gov-specific field exists, show it
        if (hasGovQuantity || hasGovRate || hasGovAmount) {
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


    const { setSelectedEntryIds, setParchiNo, setPaymentMethod } = hook;
    const handleSelectionChange = useCallback((newSelection: Set<string>) => {
      if (setSelectedEntryIds) {
          setSelectedEntryIds(newSelection);
          // Auto-populate Parchi No if single entry selected
          if (newSelection.size === 1 && setParchiNo) {
              const selectedId = Array.from(newSelection)[0];
              const entry = transactionsForSelectedSupplier?.find(t => t.id === selectedId);
              if (entry && entry.srNo) {
                  setParchiNo(entry.srNo);
              }
          }
      }
    }, [setSelectedEntryIds, setParchiNo, transactionsForSelectedSupplier]);

    const handlePaymentMethodChange = useCallback(
      (method: 'Cash' | 'Online' | 'Ledger' | 'RTGS' | 'Gov.') => {
        // Call the setPaymentMethod directly from the hook
        // It's already handleSetPaymentMethod which has all the logic
        if (setPaymentMethod) {
          setPaymentMethod(method);
        }
      },
      [setPaymentMethod]
    );
  
    return (
        <div className="space-y-2 text-[12px]">
             <ProcessingOverlay 
               show={showProcessingOverlay} 
               isDeleting={isDeleteProcessing} 
               isSuccess={isSuccess}
             />
             {type === 'outsider' ? (
                // For outsider: No tabs, just show payment content directly
                <>
                    <div className="sticky top-0 z-40 border-b border-border bg-card shadow-sm">
                        <div className="w-full px-1.5 sm:px-2.5 py-0.5 flex flex-wrap gap-2 items-center text-[12px]">
                            <div className="flex-1 flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
                                <div className="flex items-center gap-2 md:pl-3">
                                    <Button
                                      size="sm"
                                      className="h-7 text-[11px]"
                                      variant="outline"
                                      onClick={hook.resetPaymentForm ?? (() => {})}
                                      disabled={hook.isProcessing ?? false}
                                    >
                                      Clear
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="h-7 text-[11px]"
                                      onClick={() => void hook.processPayment?.()}
                                      disabled={hook.isProcessing ?? false}
                                    >
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
                          <div className="w-full max-w-full overflow-hidden space-y-2">
                            <div className="flex flex-col gap-2">
                              <div className="w-full">
                                <RtgsFormOutsider
                                  bankDetails={hook.bankDetails}
                                  setBankDetails={hook.setBankDetails}
                                  setIsBankSettingsOpen={hook.setIsBankSettingsOpen}
                                  supplierDetails={hook.supplierDetails}
                                  setSupplierDetails={hook.setSupplierDetails}
                                  rtgsAmount={hook.rtgsAmount}
                                  setRtgsAmount={hook.setRtgsAmount}
                                  handleProcessPayment={() => void hook.processPayment?.()}
                                  isProcessing={hook.isProcessing ?? false}
                                  bankAccounts={outsiderData?.bankAccounts || []}
                                  banks={outsiderData?.banks || []}
                                  bankBranches={outsiderData?.bankBranches || []}
                                />
                              </div>
                              <div className="w-full h-[310px] overflow-hidden">
                                <PaymentHistoryCompact
                                  payments={outsiderPayments}
                                  onEdit={handleEditPayment}
                                  onDelete={handleDeletePayment}
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
                    <div className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm shadow-sm">
                        <div className="w-full px-2 md:px-2.5 py-2.5">
                            <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] xl:grid-cols-[500px_minmax(0,1fr)] gap-2 items-start">
                                <div className="min-w-0 flex flex-col gap-2">
                                    <div className="flex items-center gap-1.5 w-full">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setSelectedHistoryType('cash');
                                                setHistoryDialogOpen(true);
                                            }}
                                            className="h-6 text-[10px] font-semibold flex-1 justify-between px-2"
                                        >
                                            <span>Cash History</span>
                                            <span className="bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded-md text-[7px] font-semibold">
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
                                            className="h-6 text-[10px] font-semibold flex-1 justify-between px-2"
                                        >
                                            <span>Gov History</span>
                                            <span className="bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded-md text-[7px] font-semibold">
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
                                            className="h-6 text-[10px] font-semibold flex-1 justify-between px-2"
                                        >
                                            <span>RTGS History</span>
                                            <span className="bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded-md text-[7px] font-semibold">
                                                {rtgsHistoryRows.length}
                                            </span>
                                        </Button>
                                    </div>

                                    <PaymentFilters
                                      searchType={searchType}
                                      onSearchTypeChange={setSearchType}
                                      supplierOptions={varietyFilteredSupplierOptions}
                                      selectedSupplierKey={hook.selectedCustomerKey}
                                      onSupplierSelect={onSelectSupplierKey}
                                      serialNoSearch={hook.serialNoSearch}
                                      onSerialNoSearch={hook.handleSerialNoSearch ?? (() => {})}
                                      onSerialNoBlur={hook.handleSerialNoBlur ?? (() => {})}
                                      filterStartDate={filterStartDate}
                                      filterEndDate={filterEndDate}
                                      filterVariety={filterVariety}
                                      varietyOptions={varietyOptions}
                                      hasActiveFilters={hasActiveSupplierFilters}
                                      onFilterStartDateChange={setFilterStartDate}
                                      onFilterEndDateChange={setFilterEndDate}
                                      onFilterVarietyChange={setFilterVariety}
                                      onClearFilters={handleClearSupplierFilters}
                                      extraActions={
                                        <div className="flex items-center gap-1">
                                          <Button
                                            onClick={() => setIsStatementOpen(true)}
                                            size="sm"
                                            disabled={!hook.selectedCustomerKey}
                                            className="h-6 px-2 py-0 text-[9px] font-bold bg-gradient-to-r from-primary via-primary/95 to-primary/90 hover:from-primary/95 hover:via-primary hover:to-primary/95 shadow-md hover:shadow-lg transition-all duration-300 border border-primary/40 hover:border-primary/60 disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            <FileText className="h-2 w-2 mr-1" />
                                            Generate Statement
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            className="h-6 px-2 text-[9px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                                            disabled={!hook.selectedCustomerKey}
                                            onClick={() => setIsSummaryOpen(true)}
                                          >
                                            Summary
                                          </Button>
                                        </div>
                                      }
                                    />

                                    {(hook.selectedCustomerKey || hook.editingPayment) &&
                                       ((transactionsForSelectedSupplier &&
                                         Array.isArray(transactionsForSelectedSupplier) &&
                                         transactionsForSelectedSupplier.length > 0) || hook.editingPayment) && (
                                        <div className="hidden lg:block w-full h-[300px] overflow-auto">
                                          <PaymentForm
                                            {...hook}
                                            bankAccounts={hook.bankAccounts}
                                            bankBranches={hook.bankBranches}
                                            onPaymentMethodChange={handlePaymentMethodChange}
                                            hideRtgsToggle={false}
                                            centerName={hook.centerName}
                                            setCenterName={hook.setCenterName}
                                            centerNameOptions={hook.centerNameOptions}
                                            onClearPaymentForm={hook.resetPaymentForm ?? (() => {})}
                                            onProcessPayment={async () => {
                                                 try {
                                                     if (hook.processPayment) {
                                                         await hook.processPayment();
                                                     } else if ((hook as any).handleProcessPayment) {
                                                         await (hook as any).handleProcessPayment();
                                                     }
                                                 } catch (error: any) {
                                                     console.error("Payment trigger failed:", error);
                                                     // Fallback toast in case hook doesn't show one
                                                     const { toast } = await import('@/hooks/use-toast');
                                                     toast({ 
                                                        title: "Critical Error", 
                                                        description: error.message || "Failed to initiate payment processing.", 
                                                        variant: "destructive" 
                                                     });
                                                 }
                                             }}
                                            isProcessing={hook.isProcessing ?? false}
                                          />
                                        </div>
                                      )}
                                </div>

                                {hook.selectedCustomerKey &&
                                  ((transactionsForSelectedSupplier &&
                                    Array.isArray(transactionsForSelectedSupplier) &&
                                    transactionsForSelectedSupplier.length > 0) || hook.editingPayment) && (
                                    <div className="hidden lg:flex min-w-0 flex-col gap-2">
                                      <div className="min-w-0 h-[220px] overflow-hidden rounded-xl border border-border/80 bg-card shadow-[0_4px_14px_0_rgba(0,0,0,0.08),0_1px_3px_0_rgba(0,0,0,0.06)]">
                                        <TransactionTable
                                          suppliers={transactionsForSelectedSupplier}
                                          onShowDetails={hook.setDetailsSupplierEntry}
                                          selectedIds={hook.selectedEntryIds}
                                          onSelectionChange={handleSelectionChange}
                                          embed
                                          compact
                                          showTabsInHeader
                                          activeTab={activeTransactionTab}
                                          onTabChange={setActiveTransactionTab}
                                          onEditEntry={handleEditEntry}
                                          type={type}
                                          highlightEntryId={highlightEntryId}
                                        />
                                      </div>
                                      <div className="w-full h-[170px] overflow-hidden rounded-xl border border-border/80 bg-card shadow-[0_4px_14px_0_rgba(0,0,0,0.08),0_1px_3px_0_rgba(0,0,0,0.06)] mt-1">
                                        <PaymentHistoryCompact
                                          payments={selectedSupplierPayments}
                                          onEdit={handleEditPayment}
                                          onDelete={handleDeletePayment}
                                        />
                                      </div>
                                    </div>
                                  )}
                            </div>
                        </div>
                    </div>
                    <div className="mt-0.5 px-1 sm:px-1.5 pb-1">
                            {hook.selectedCustomerKey && (
                              <div
                                className={`w-full overflow-hidden mb-2 rounded-xl border border-border/60 bg-card shadow-sm p-3 ${
                                  ((transactionsForSelectedSupplier &&
                                     Array.isArray(transactionsForSelectedSupplier) &&
                                     transactionsForSelectedSupplier.length > 0) || hook.editingPayment)
                                    ? "lg:hidden"
                                    : ""
                                }`}
                              >
                                <PaymentForm
                                  {...hook}
                                  bankAccounts={hook.bankAccounts}
                                  bankBranches={hook.bankBranches}
                                  onPaymentMethodChange={handlePaymentMethodChange}
                                  hideRtgsToggle={false}
                                  centerName={hook.centerName}
                                  setCenterName={hook.setCenterName}
                                  centerNameOptions={hook.centerNameOptions}
                                  onClearPaymentForm={hook.resetPaymentForm ?? (() => {})}
                                  onProcessPayment={async () => {
                                      try {
                                          if (hook.processPayment) {
                                              await hook.processPayment();
                                          } else if ((hook as any).handleProcessPayment) {
                                              await (hook as any).handleProcessPayment();
                                          }
                                      } catch (error: any) {
                                          console.error("Payment trigger failed (mobile):", error);
                                          const { toast } = await import('@/hooks/use-toast');
                                          toast({ 
                                             title: "Critical Error", 
                                             description: error.message || "Failed to initiate payment processing.", 
                                             variant: "destructive" 
                                          });
                                      }
                                  }}
                                  isProcessing={hook.isProcessing ?? false}
                                />
                              </div>
                            )}
                            
                            {/* TransactionTable - Only for supplier/customer, NOT for outsider - Outstanding entries table removed for outsider */}
                            {/* DO NOT RENDER TransactionTable for outsider type - it shows outstanding entries which we don't need */}
                            {/* EXPLICITLY CHECK: Never render this entire grid section for outsider type */}
                            {/* CRITICAL: This section is INSIDE the IIFE, so it will NOT execute for outsider type */}
                            {!hook.editingPayment && (!transactionsForSelectedSupplier ||
                              !Array.isArray(transactionsForSelectedSupplier) ||
                              transactionsForSelectedSupplier.length === 0) && (
                              <div className="space-y-2 w-full">
                                <Card className="rounded-[12px] border border-slate-200/80 bg-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.10)] backdrop-blur-[14px]">
                                  <CardContent className="p-3">
                                    <div className="flex items-start gap-3">
                                      <div className="grid size-9 place-items-center rounded-[12px] bg-violet-50 text-violet-700 ring-1 ring-violet-900/[0.06]">
                                        <FileText className="h-4 w-4" />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-[12px] font-semibold text-slate-900">
                                          {hook.selectedCustomerKey ? "No entries found" : "Supplier select karein"}
                                        </div>
                                        <div className="mt-0.5 text-[11px] text-slate-600">
                                          {hook.selectedCustomerKey
                                            ? "Is supplier ke liye abhi outstanding entries nahi hain."
                                            : "Upar search se supplier choose karte hi form, table aur summary yahin dikh jayegi."}
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            )}
                            
                            {/* Bank Details and Generate Options - Full Screen Half-Half (Only for Supplier Payments) */}
                                {type === 'supplier' && hook.paymentMethod === 'RTGS' && (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mt-2">
                                {/* Bank Details Section - Left Half */}
                                <Card className="text-[10px] border border-slate-200/80 !bg-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.10)] backdrop-blur-[20px]">
                                  <CardContent className="p-2.5">
                                    <RtgsForm
                                      {...hook}
                                      editingPayment={hook.editingPayment ?? undefined}
                                      bankAccounts={supplierBankAccounts}
                                      banks={banks}
                                      bankBranches={bankBranches}
                                    />
                                  </CardContent>
                                </Card>
                                {/* Generate Payment Options Section - Right Half */}
                                <GeneratePaymentOptions
                                  rtgsQuantity={hook.rtgsQuantity || 0}
                                  setRtgsQuantity={hook.setRtgsQuantity || (() => {})}
                                  rtgsRate={hook.rtgsRate || 0}
                                  setRtgsRate={hook.setRtgsRate || (() => {})}
                                  rtgsAmount={hook.rtgsAmount || 0}
                                  setRtgsAmount={hook.setRtgsAmount || (() => {})}
                                  minRate={hook.minRate || 0}
                                  setMinRate={hook.setMinRate || (() => {})}
                                  maxRate={hook.maxRate || 0}
                                  setMaxRate={hook.setMaxRate || (() => {})}
                                  selectPaymentAmount={hook.selectPaymentAmount || (() => {})}
                                  combination={paymentCombination}
                                  paymentMethod={hook.paymentMethod || 'RTGS'}
                                />
                              </div>
                                )}

                            {/* Gov. Payment Form - Similar to RTGS but without bank details */}
                                {type === 'supplier' && hook.paymentMethod === 'Gov.' && (
                              <div className="space-y-2 mt-2">
                                {/* Gov Receipt Selector Helper and Gov Details - Single Row */}
                                {hook.selectedCustomerKey && transactionsForSelectedSupplier && transactionsForSelectedSupplier.length > 0 && (
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                                    {/* Gov Receipt Selector Helper - Left Half */}
                                    <GovReceiptSelector
                                      availableReceipts={transactionsForSelectedSupplier}
                                      govRate={hook.govRate || hook.minRate || 0}
                                      extraAmountPerQuintal={0}
                                      onSelectReceipts={(receiptIds) => {
                                        hook.setSelectedEntryIds(new Set(receiptIds));
                                      }}
                                      selectedReceiptIds={hook.selectedEntryIds}
                                      allowManualRsPerQtl={true}
                                      allowManualGovRate={true}
                                      calcTargetAmount={hook.rtgsAmount ?? 0}
                                      setCalcTargetAmount={hook.setRtgsAmount}
                                      combination={paymentCombination}
                                      selectPaymentAmount={hook.selectPaymentAmount}
                                      onSuggestionsChange={setGovSuggestions}
                                      onExtraAmountChange={hook.setGovExtraAmount}
                                    />
                                    {/* Gov. Details Section - Right Half */}
                                    <Card className="text-[10px] border border-slate-200/80 !bg-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.10)] backdrop-blur-[20px]">
                                      <CardContent className="p-2.5">
                                        <GovForm 
                                          govQuantity={hook.govQuantity}
                                          setGovQuantity={hook.setGovQuantity}
                                          govRate={hook.govRate}
                                          setGovRate={hook.setGovRate}
                                          govAmount={hook.govAmount}
                                          setGovAmount={hook.setGovAmount}
                                          govExtraAmount={hook.govExtraAmount}
                                          setGovExtraAmount={hook.setGovExtraAmount}
                                          targetAmount={hook.rtgsAmount || 0}
                                          minRate={hook.minRate}
                                          selectedPaymentOption={hook.selectedPaymentOption}
                                        />
                                      </CardContent>
                                    </Card>
                                  </div>
                                )}
                              </div>
                                )}

            {/* GOV Suggested Combinations - full width below both helper and details */}
            {(type === 'supplier' && hook.paymentMethod === 'Gov.' && govSuggestions.length > 0) && (
              <div className="mt-3 rounded-xl border border-border/70 bg-card shadow-[0_4px_14px_rgba(15,23,42,0.10)] overflow-hidden">
                <div className="px-3 py-2 bg-muted/70 border-b border-border/80 flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-primary">Suggested Combinations</span>
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  <table className="w-full text-[9px]">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr className="h-7">
                        <th className="px-2 text-left font-bold w-[40px]">Select</th>
                        <th className="px-2 text-left font-bold w-[60px]">Type</th>
                        <th className="px-2 text-left font-bold">Entries</th>
                        <th className="px-2 text-right font-bold w-[70px]">Normal</th>
                        <th className="px-2 text-right font-bold w-[70px]">Gov Extra</th>
                        <th className="px-2 text-right font-bold w-[80px]">To Be Paid</th>
                        <th className="px-2 text-right font-bold w-[80px]">Total Amt</th>
                        <th className="px-2 text-right font-bold w-[70px]">Excess</th>
                      </tr>
                    </thead>
                    <tbody>
                      {govSuggestions.map((comb, idx) => {
                        const difference = comb.difference ?? 0;
                        const totalNormal = comb.totalNormal ?? 0;
                        const totalExtra = comb.totalExtra ?? 0;
                        const totalGov = comb.totalGov ?? 0;
                        return (
                          <tr key={idx} className="h-7 border-b border-border/60 hover:bg-muted/30 transition-colors">
                            <td className="px-2">
                              <input
                                type="checkbox"
                                className="h-3 w-3"
                                checked={Array.isArray(comb.receipts) && comb.receipts.every((r: any) => hook.selectedEntryIds.has(r.id || r.srNo))}
                                onChange={() => {
                                  const receiptIds = (comb.receipts || []).map((r: any) => r.id || r.srNo);
                                  hook.setSelectedEntryIds(new Set(receiptIds));
                                  hook.setGovAmount?.(totalNormal);
                                  hook.setGovExtraAmount?.(totalExtra);
                                }}
                              />
                            </td>
                            <td className="px-2 font-medium">{comb.type}</td>
                            <td className="px-2 truncate max-w-[140px]" title={(comb.details || []).map((d: any) => `${d.srNo}: Norm ${formatCurrency(d.normalAmount || 0)}, Extra ${formatCurrency(d.extraAmount || 0)}`).join(" | ")}>
                              {(comb.details || []).map((d: any) => d.srNo).join(", ")}
                            </td>
                            <td className="px-2 text-right font-semibold tabular-nums">{formatCurrency(totalNormal)}</td>
                            <td className="px-2 text-right font-semibold tabular-nums text-primary">{formatCurrency(totalExtra)}</td>
                            <td className="px-2 text-right font-bold text-primary tabular-nums" title="To Be Paid = Normal + Gov Extra (as-is)">{formatCurrency(totalGov)}</td>
                            <td className="px-2 text-right font-semibold tabular-nums" title="Total = Normal + Gov Extra (for balance)">{formatCurrency(totalGov)}</td>
                            <td
                              className={cn(
                                "px-2 text-right font-semibold tabular-nums",
                                difference > 0 ? "text-primary" : "text-muted-foreground"
                              )}
                            >
                              {difference > 0 ? `+${formatCurrency(difference)}` : formatCurrency(difference)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
                  onSelect={hook.selectPaymentAmount || (() => {})}
                />
              </div>
            )}

            {/* Summary at bottom when Cash or Gov selected – pic wala dashboard layout (supplier + customer) */}
            {(type === 'supplier' || type === 'customer') && (hook.paymentMethod === 'Cash' || hook.paymentMethod === 'Gov.') && filteredSupplierSummary && (
              <div className="mt-4 w-full min-w-0">
                <SupplierSummaryCards summary={filteredSupplierSummary} variant="dashboard" type={type} />
              </div>
            )}

 
            <DetailsDialog
              isOpen={!!hook.detailsSupplierEntry}
              onOpenChange={() => (hook.setDetailsSupplierEntry ? hook.setDetailsSupplierEntry(null) : void 0)}
              customer={hook.detailsSupplierEntry}
              paymentHistory={hook.paymentHistory}
              entryType="Supplier"
            />

            <PaymentDetailsDialog
              payment={hook.selectedPaymentForDetails}
              suppliers={hook.suppliers}
              onOpenChange={() => (hook.setSelectedPaymentForDetails ? hook.setSelectedPaymentForDetails(null) : void 0)}
              onShowEntryDetails={hook.setDetailsSupplierEntry || (() => {})}
            />
            
           <RTGSReceiptDialog
                payment={hook.rtgsReceiptData}
                settings={hook.receiptSettings}
                onOpenChange={() => hook.setRtgsReceiptData(null)}
           />

          <BankSettingsDialog
          isOpen={!!hook.isBankSettingsOpen}
          onOpenChange={hook.setIsBankSettingsOpen || (() => {})}
          />

          {/* Outstanding selection dialog removed as requested */}
          
          {/* Summary moved next to PaymentForm */}


          {type === 'supplier' ? (
            <SupplierEntryEditDialog
              open={editEntryDialogOpen && !!selectedEntryForEdit}
              onOpenChange={handleEditEntryDialogOpenChange}
              entry={selectedEntryForEdit}
              onSuccess={async () => {
                // Highlight and scroll to entry in table
                if (selectedEntryForEdit?.id) {
                  setHighlightEntryId(selectedEntryForEdit.id);
                  setTimeout(() => setHighlightEntryId(null), 3000);
                }
                
                // Force refresh of supplier data and summary
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
              open={editEntryDialogOpen && !!selectedEntryForEdit}
              onOpenChange={handleEditEntryDialogOpenChange}
              entry={selectedEntryForEdit}
              onSuccess={async () => {
                // Force immediate refresh of customer data and summary for hand-to-hand update
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

          <PaymentDialogs
            isStatementOpen={isStatementOpen}
            setIsStatementOpen={setIsStatementOpen}
            selectedSupplierSummary={selectedSupplierSummary}
            filteredSupplierSummary={filteredSupplierSummary}
            isSummaryOpen={isSummaryOpen}
            setIsSummaryOpen={setIsSummaryOpen}
            historyDialogOpen={historyDialogOpen}
            setHistoryDialogOpen={setHistoryDialogOpen}
            selectedHistoryType={selectedHistoryType}
            cashHistoryRows={cashHistoryRows}
            rtgsHistoryRows={rtgsHistoryRows}
            govHistoryRows={govHistoryRows}
            onEditPayment={handleEditPayment}
            onDeletePayment={hook.handleDeletePayment}
          />
        </div>
    );
}

export default React.memo(SupplierPaymentsClient);
