
"use client";

import React, { useMemo, useState, useCallback, useEffect, useTransition, useDeferredValue } from 'react';
import type { Customer, Payment, ReceiptSettings, PaidFor } from "@/lib/definitions";
import { toTitleCase, formatCurrency, levenshteinDistance } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSupplierPayments } from '@/hooks/use-supplier-payments';
import { useCustomerPayments } from '@/hooks/use-customer-payments';
import { useGlobalData } from '@/contexts/global-data-context';
import { db } from "@/lib/database";
import { useLiveQuery } from "@/lib/use-live-query";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Banknote, Scale, FileText, User, MapPin, Phone, UserCircle, Receipt } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


import { PaymentForm } from '@/components/sales/supplier-payments/payment-form';
import { PaymentHistory } from '@/components/sales/supplier-payments/payment-history';
import { TransactionTable } from '@/components/sales/supplier-payments/supplier-transaction-table';
import { PaymentFilters } from '@/components/sales/supplier-payments/payment-filters';
import { GeneratePaymentOptions } from '@/components/sales/supplier-payments/generate-payment-options';
import { PaymentDialogs } from "../../../components/sales/supplier-payments/payment-dialogs";
import { PaymentDetailsDialog } from '@/components/sales/supplier-payments/payment-details-dialog';
import { BankSettingsDialog } from '@/components/sales/supplier-payments/bank-settings-dialog';
import { RTGSReceiptDialog } from '@/components/sales/supplier-payments/rtgs-receipt-dialog';
import { DetailsDialog } from "@/components/sales/details-dialog";
import { DocumentPreviewDialog } from "@/components/sales/document-preview-dialog";
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
import { generateBulkStatementHtml, type BulkStatementProgress } from "../supplier-profile/utils/bulk-statement-printer";


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
  const globalData = useGlobalData();
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const [, startTransition] = useTransition();
  const [searchType, setSearchType] = useState<'name' | 'fatherName' | 'address' | 'contact'>('name');
  const [highlightEntryId, setHighlightEntryId] = useState<string | null>(null);
  const [isDeleteProcessing, setIsDeleteProcessing] = useState(false);
  const [showProcessingOverlay, setShowProcessingOverlay] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkStatementProgress | null>(null);
  
  // Statement Options state
  const [isStatementOptionsOpen, setIsStatementOptionsOpen] = useState(false);
  const [printScope, setPrintScope] = useState<'selected' | 'all'>('selected');
  const [sortOrder, setSortOrder] = useState<'name' | 'outstanding' | 'netAmount'>('name');

  const processingStartRef = React.useRef<number | null>(null);
  const MIN_PROCESS_OVERLAY_MS = 1000;
  const { toast } = useToast();

  const [isDocumentPreviewOpen, setIsDocumentPreviewOpen] = useState(false);
  const [documentPreviewCustomer, setDocumentPreviewCustomer] = useState<any | null>(null);
  const [documentType, setDocumentType] = useState<any>('tax-invoice');

  const enrichEntryWithPartyDetails = useCallback((entry: any) => {
    if (!entry) return entry;
    
    // Find all transactions/entries for the same party in the system
    const partyName = entry.name?.trim().toLowerCase();
    const fatherName = (entry.so || entry.fatherName || '').trim().toLowerCase();
    const entryCompany = entry.companyName?.trim().toLowerCase();
    
    // 1. Search in the Accounts/Parties database (db.accounts) with robust exact and fuzzy matching
    let matchedAccount = accounts.find((acc: any) => {
      const accName = acc.name?.trim().toLowerCase();
      const accCompany = acc.companyName?.trim().toLowerCase();
      return (
        (partyName && (accName === partyName || accCompany === partyName)) ||
        (entryCompany && (accName === entryCompany || accCompany === entryCompany))
      );
    });
    
    if (!matchedAccount && (partyName || entryCompany)) {
      // Fuzzy matching fallback (substring check and Levenshtein edit distance)
      matchedAccount = accounts.find((acc: any) => {
        const accName = acc.name?.trim().toLowerCase();
        const accCompany = acc.companyName?.trim().toLowerCase();
        
        const checkFuzzy = (s1: string, s2: string) => {
          if (!s1 || !s2) return false;
          if (s1.includes(s2) || s2.includes(s1)) return true;
          return levenshteinDistance(s1, s2) <= 3;
        };
        
        return (
          (partyName && (checkFuzzy(accName, partyName) || checkFuzzy(accCompany, partyName))) ||
          (entryCompany && (checkFuzzy(accName, entryCompany) || checkFuzzy(accCompany, entryCompany)))
        );
      });
    }
    
    let gstin = entry.gstin || matchedAccount?.gstin || '';
    let stateName = entry.stateName || matchedAccount?.stateName || '';
    let stateCode = entry.stateCode || matchedAccount?.stateCode || '';
    let companyName = entry.companyName || matchedAccount?.companyName || matchedAccount?.name || '';
    let address = entry.address || matchedAccount?.address || '';
    let contact = entry.contact || matchedAccount?.contact || '';
    
    let shippingName = entry.shippingName || '';
    let shippingCompanyName = entry.shippingCompanyName || '';
    let shippingAddress = entry.shippingAddress || '';
    let shippingContact = entry.shippingContact || '';
    let shippingGstin = entry.shippingGstin || '';
    let shippingStateName = entry.shippingStateName || '';
    let shippingStateCode = entry.shippingStateCode || '';
    
    // 2. If details are still missing, search in the transaction collections (globalData)
    const searchPool = type === 'customer' ? globalData.customers : globalData.suppliers;
    
    if (searchPool && searchPool.length > 0) {
      const partyEntries = searchPool.filter((item: any) => {
        const itemFather = (item.so || item.fatherName || '').trim().toLowerCase();
        return item.name?.trim().toLowerCase() === partyName && (!fatherName || !itemFather || itemFather === fatherName);
      });
      
      const sortedEntries = [...partyEntries].sort((a: any, b: any) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
      });
      
      if (!gstin) {
        const entryWithGst = sortedEntries.find((item: any) => item.gstin && item.gstin.trim() !== '');
        if (entryWithGst) gstin = entryWithGst.gstin;
      }
      
      if (!stateName) {
        const entryWithState = sortedEntries.find((item: any) => item.stateName && item.stateName.trim() !== '');
        if (entryWithState) {
          stateName = entryWithState.stateName;
          stateCode = entryWithState.stateCode || stateCode;
        }
      }
      
      if (!companyName) {
        const entryWithCompany = sortedEntries.find((item: any) => item.companyName && item.companyName.trim() !== '');
        if (entryWithCompany) companyName = entryWithCompany.companyName;
      }

      if (!address) {
        const entryWithAddress = sortedEntries.find((item: any) => item.address && item.address.trim() !== '');
        if (entryWithAddress) address = entryWithAddress.address;
      }

      if (!contact) {
        const entryWithContact = sortedEntries.find((item: any) => item.contact && item.contact.trim() !== '');
        if (entryWithContact) contact = entryWithContact.contact;
      }

      if (!shippingName) {
        const entryWithShipping = sortedEntries.find((item: any) => item.shippingName && item.shippingName.trim() !== '');
        if (entryWithShipping) {
          shippingName = entryWithShipping.shippingName;
          shippingCompanyName = entryWithShipping.shippingCompanyName || shippingCompanyName;
          shippingAddress = entryWithShipping.shippingAddress || shippingAddress;
          shippingContact = entryWithShipping.shippingContact || shippingContact;
          shippingGstin = entryWithShipping.shippingGstin || shippingGstin;
          shippingStateName = entryWithShipping.shippingStateName || shippingStateName;
          shippingStateCode = entryWithShipping.shippingStateCode || shippingStateCode;
        }
      }
    }
    
    return {
      ...entry,
      gstin,
      stateName,
      stateCode,
      companyName,
      address,
      contact,
      shippingName,
      shippingCompanyName,
      shippingAddress,
      shippingContact,
      shippingGstin,
      shippingStateName,
      shippingStateCode
    };
  }, [type, accounts, globalData.customers, globalData.suppliers]);

  const handlePrintRow = useCallback((entry: any) => {
    const enriched = enrichEntryWithPartyDetails(entry);
    setDocumentPreviewCustomer(enriched);
    setDocumentType('tax-invoice');
    setIsDocumentPreviewOpen(true);
  }, [enrichEntryWithPartyDetails]);
    
  // Always call all hooks to maintain hook order (Rules of Hooks)
  // But only use the results based on type
  const supplierHook = useSupplierPayments();
  const customerHook = useCustomerPayments();
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
  const [govSuggestions, setGovSuggestions] = useState<any[]>([]);
  const [activeTransactionTab, setActiveTransactionTab] = useState<string>("all");
  const [historyTab, setHistoryTab] = useState<'cash' | 'gov' | 'rtgs' | 'online' | 'ledger'>('cash');
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedHistoryType, setSelectedHistoryType] = useState<'cash' | 'gov' | 'rtgs' | 'online' | 'ledger'>('cash');
  const [isGenerateOptionsOpen, setIsGenerateOptionsOpen] = useState(false);

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
    hook.selectedCustomerKey as string | null,
    type
  );
  
  // Force summary recalculation when supplier data refresh key changes
  useEffect(() => {
    // This effect will trigger when supplierDataRefreshKey changes,
    // causing the component to re-render and recalculate summaries
  }, [supplierDataRefreshKey]);

  const onSelectSupplierKey = useCallback((key: string | null) => {
    startTransition(() => {
      hook.handleCustomerSelect(key);
    });
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
  // Get filter state first (needed for useSupplierFiltering) - initialized from localStorage if available
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`payments_filterStartDate_${type}`);
      return saved ? new Date(saved) : undefined;
    }
    return undefined;
  });
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`payments_filterEndDate_${type}`);
      return saved ? new Date(saved) : undefined;
    }
    return undefined;
  });
  const [filterVariety, setFilterVariety] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`payments_filterVariety_${type}`) || "all";
    }
    return "all";
  });

  // Sync filters to localStorage when they change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (filterStartDate) {
      localStorage.setItem(`payments_filterStartDate_${type}`, filterStartDate.toISOString());
    } else {
      localStorage.removeItem(`payments_filterStartDate_${type}`);
    }
  }, [filterStartDate, type]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (filterEndDate) {
      localStorage.setItem(`payments_filterEndDate_${type}`, filterEndDate.toISOString());
    } else {
      localStorage.removeItem(`payments_filterEndDate_${type}`);
    }
  }, [filterEndDate, type]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`payments_filterVariety_${type}`, filterVariety);
  }, [filterVariety, type]);

  const { filteredSupplierOptions: rawOptions } = useSupplierFiltering(
    type === 'outsider' ? new Map() : supplierSummaryMap,
    hook.selectedCustomerKey as string | null,
    onSelectSupplierKey as (key: string | null) => void,
    filterStartDate,
    filterEndDate,
    type === 'outsider' ? undefined : MILL_OVERVIEW_KEY
  );

  const filteredSupplierOptions = useMemo(() => {
    return rawOptions.map(opt => {
      if (opt.value === MILL_OVERVIEW_KEY && type === 'customer') {
        return { ...opt, label: 'Total Customer Overview' };
      }
      return opt;
    });
  }, [rawOptions, type, MILL_OVERVIEW_KEY]);

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
    
    // Check varietyFilteredSupplierOptions first since it contains the merged profile summaries
    const matchedOption = varietyFilteredSupplierOptions.find(opt => opt.value === hook.selectedCustomerKey);
    if (matchedOption && matchedOption.data) {
      return matchedOption.data;
    }
    
    return supplierSummaryMap.get(hook.selectedCustomerKey) ?? null;
  }, [type, hook.selectedCustomerKey, varietyFilteredSupplierOptions, supplierSummaryMap]);

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

      const matchesSupplier =
        !hook.selectedCustomerKey ||
        (payment.supplierId === hook.selectedCustomerKey) ||
        ((payment as any).customerId === hook.selectedCustomerKey) ||
        (selectedSupplierSrNos.length > 0 && (
          paidSrNos.some((sr) => selectedSupplierSrNos.includes(sr)) ||
          String((payment as any).parchiNo || (payment as any).checkNo || "").trim().toLowerCase().split(/[,\s]+/g).some((token) => selectedSupplierSrNos.includes(token))
        ));

      const matchesDate = isWithinDateRange(payment.date);

      // Check variety match using linked receipts
      let matchesVariety = true;
      if (filterVariety && filterVariety !== "all") {
        const linkedSrNos = new Set<string>();
        paidSrNos.forEach(sr => linkedSrNos.add(sr.trim().toLowerCase()));
        
        const parchiNoRaw = String((payment as any).parchiNo || (payment as any).checkNo || "").trim().toLowerCase();
        if (parchiNoRaw) {
          parchiNoRaw.split(/[,\s]+/g).forEach(token => {
            if (token.trim()) linkedSrNos.add(token.trim());
          });
        }
        
        const allTransactions = selectedSupplierSummary?.allTransactions || [];
        const hasMatchingReceipt = allTransactions.some((t: Customer) => {
          const tSrNo = String(t.srNo || "").trim().toLowerCase();
          const tVariety = toTitleCase(t.variety || "");
          return linkedSrNos.has(tSrNo) && tVariety === filterVariety;
        });
        
        matchesVariety = hasMatchingReceipt;
      }

      return matchesSupplier && matchesDate && matchesVariety;
    },
    [selectedSupplierSrNos, isWithinDateRange, hook.selectedCustomerKey, filterVariety, selectedSupplierSummary]
  );

  const getPaymentIdForSort = (payment: Payment): string => {
    return (payment?.id || payment?.paymentId || '').toString();
  };

  const parsePaymentIdForSort = (id: string): { prefix: string; number: number } => {
    if (!id) return { prefix: '', number: 0 };
    const match = id.match(/^([A-Za-z]*)(\d+)$/);
    if (match) {
      const prefix = match[1] || '';
      const number = parseInt(match[2] || '0', 10);
      return { prefix, number };
    }
    return { prefix: id, number: 0 };
  };

  const govHistoryRows = useMemo(() => {
    if (!hook.paymentHistory || hook.paymentHistory.length === 0) return [];
    const filtered = hook.paymentHistory.filter((payment: Payment) => {
        const receiptType = (payment.receiptType || "").trim().toLowerCase();
        return receiptType === "gov." || receiptType === "gov" || receiptType.startsWith("gov");
      });
    const supplierFiltered = filtered.filter(payment => hook.selectedCustomerKey ? paymentMatchesSelection(payment) : true);
    const dateFiltered = supplierFiltered.filter(payment => (!filterStartDate && !filterEndDate) ? true : isWithinDateRange(payment.date));
    return [...dateFiltered].sort((a, b) => {
      const parsedA = parsePaymentIdForSort(getPaymentIdForSort(a));
      const parsedB = parsePaymentIdForSort(getPaymentIdForSort(b));
      const prefixCompare = parsedB.prefix.localeCompare(parsedA.prefix);
      if (prefixCompare !== 0) return prefixCompare;
      return parsedB.number - parsedA.number;
    });
  }, [hook.paymentHistory, hook.selectedCustomerKey, isWithinDateRange, filterStartDate, filterEndDate, paymentMatchesSelection]);

  const cashHistoryRows = useMemo(() => {
    const filtered = hook.paymentHistory.filter((payment: Payment) => (payment.receiptType || "").toLowerCase() === "cash").filter(paymentMatchesSelection);
    return [...filtered].sort((a, b) => {
      const parsedA = parsePaymentIdForSort(getPaymentIdForSort(a));
      const parsedB = parsePaymentIdForSort(getPaymentIdForSort(b));
      const prefixCompare = parsedB.prefix.localeCompare(parsedA.prefix);
      if (prefixCompare !== 0) return prefixCompare;
      return parsedB.number - parsedA.number;
    });
  }, [hook.paymentHistory, paymentMatchesSelection]);

  const onlineHistoryRows = useMemo(() => {
    const filtered = hook.paymentHistory.filter((payment: Payment) => (payment.receiptType || "").toLowerCase() === "online").filter(paymentMatchesSelection);
    return [...filtered].sort((a, b) => {
      const parsedA = parsePaymentIdForSort(getPaymentIdForSort(a));
      const parsedB = parsePaymentIdForSort(getPaymentIdForSort(b));
      const prefixCompare = parsedB.prefix.localeCompare(parsedA.prefix);
      if (prefixCompare !== 0) return prefixCompare;
      return parsedB.number - parsedA.number;
    });
  }, [hook.paymentHistory, paymentMatchesSelection]);

  const ledgerHistoryRows = useMemo(() => {
    const filtered = hook.paymentHistory.filter((payment: Payment) => (payment.receiptType || "").toLowerCase() === "ledger").filter(paymentMatchesSelection);
    return [...filtered].sort((a, b) => {
      const parsedA = parsePaymentIdForSort(getPaymentIdForSort(a));
      const parsedB = parsePaymentIdForSort(getPaymentIdForSort(b));
      const prefixCompare = parsedB.prefix.localeCompare(parsedA.prefix);
      if (prefixCompare !== 0) return prefixCompare;
      return parsedB.number - parsedA.number;
    });
  }, [hook.paymentHistory, paymentMatchesSelection]);

  const rtgsHistoryRows = useMemo(() => {
    const filtered = hook.paymentHistory.filter((payment: Payment) => {
        const isRtgs = (payment.receiptType || "").toLowerCase() === "rtgs";
        if (type === 'outsider') return isRtgs && payment.customerId === 'OUTSIDER';
        return isRtgs;
      }).filter(type === 'outsider' ? () => true : paymentMatchesSelection);
    return [...filtered].sort((a, b) => {
      const parsedA = parsePaymentIdForSort(getPaymentIdForSort(a));
      const parsedB = parsePaymentIdForSort(getPaymentIdForSort(b));
      const prefixCompare = parsedB.prefix.localeCompare(parsedA.prefix);
      if (prefixCompare !== 0) return prefixCompare;
      return parsedB.number - parsedA.number;
    });
  }, [hook.paymentHistory, paymentMatchesSelection, type]);

  const selectedSupplierPayments = useMemo(() => {
    if (!hook.selectedCustomerKey) return [];
    return hook.paymentHistory.filter(paymentMatchesSelection);
  }, [hook.paymentHistory, hook.selectedCustomerKey, paymentMatchesSelection]);

  const { setSelectedEntryIds, setParchiNo, setPaymentMethod } = hook;
  const handleSelectionChange = useCallback((newSelection: Set<string>) => {
    if (setSelectedEntryIds) {
        setSelectedEntryIds(newSelection);
        if (newSelection.size === 1 && setParchiNo) {
            const selectedId = Array.from(newSelection)[0];
            const entry = transactionsForSelectedSupplier?.find(t => t.id === selectedId);
            if (entry && entry.srNo) setParchiNo(entry.srNo);
        }
    }
  }, [setSelectedEntryIds, setParchiNo, transactionsForSelectedSupplier]);

  const handlePaymentMethodChange = useCallback((method: 'Cash' | 'Online' | 'Ledger' | 'RTGS' | 'Gov.') => {
    if (setPaymentMethod) setPaymentMethod(method);
  }, [setPaymentMethod]);

  // ── Global ← / → keyboard navigation across supplier list ──────────────────
  // Works from anywhere on the page as long as focus is NOT inside an
  // input / textarea / select element.
  useEffect(() => {
    if (type === 'outsider') return; // outsider tab has no supplier list
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      // Also ignore if a dialog/modal is open (skip navigation inside dialogs)
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;

      e.preventDefault();
      const options = varietyFilteredSupplierOptions;
      if (!options || options.length === 0) return;

      const currentIdx = hook.selectedCustomerKey
        ? options.findIndex((o: any) => o.value === hook.selectedCustomerKey)
        : -1;

      let nextIdx: number;
      if (currentIdx === -1) {
        nextIdx = e.key === 'ArrowRight' ? 0 : options.length - 1;
      } else {
        nextIdx =
          e.key === 'ArrowRight'
            ? (currentIdx + 1) % options.length
            : (currentIdx - 1 + options.length) % options.length;
      }
      const next = options[nextIdx];
      if (next) onSelectSupplierKey(next.value);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [type, varietyFilteredSupplierOptions, hook.selectedCustomerKey, onSelectSupplierKey]);

  const handleBulkPrint = useCallback(async (customSortOrder?: 'name' | 'outstanding' | 'netAmount') => {
    const currentSortOrder = customSortOrder || sortOrder;
    
    if (!varietyFilteredSupplierOptions || varietyFilteredSupplierOptions.length === 0) {
      toast({
        title: "No suppliers",
        description: "There are no suppliers in the current filtered list to print.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsBulkGenerating(true);
      setIsStatementOptionsOpen(false);
      
      // Filter out Mill Overview and get the summaries
      const suppliersToPrint = varietyFilteredSupplierOptions
        .filter(opt => opt.label !== 'Mill (Total Overview)' && opt.label !== 'Total Customer Overview' && opt.value !== MILL_OVERVIEW_KEY)
        .map(opt => opt.data)
        .filter(Boolean) as CustomerSummary[];

      // Sort the list based on user preference
      const sortedSuppliers = [...suppliersToPrint].sort((a, b) => {
        if (currentSortOrder === 'name') {
          return (a.name || '').localeCompare(b.name || '');
        } else if (currentSortOrder === 'outstanding') {
          return (b.totalOutstanding || 0) - (a.totalOutstanding || 0); // Highest outstanding first
        } else if (currentSortOrder === 'netAmount') {
          return (b.totalOriginalAmount || 0) - (a.totalOriginalAmount || 0); // Highest net amount first
        }
        return 0;
      });

      const html = await generateBulkStatementHtml(sortedSuppliers, (progress) => {
        setBulkProgress(progress);
      }, type as any);

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow?.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      } else {
        toast({
          title: "Pop-up Blocked",
          description: "Please allow pop-ups to view the bulk statements.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Bulk print error:", error);
      toast({
        title: "Print Failed",
        description: "An error occurred while generating bulk statements.",
        variant: "destructive"
      });
    } finally {
      setIsBulkGenerating(false);
      setBulkProgress(null);
    }
  }, [varietyFilteredSupplierOptions, supplierSummaryMap, toast, sortOrder, MILL_OVERVIEW_KEY]);

  const handleStatementClick = () => {
    setIsStatementOptionsOpen(true);
  };

  const handleExecutePrint = () => {
    if (printScope === 'selected') {
      setIsStatementOptionsOpen(false);
      setIsStatementOpen(true);
    } else {
      handleBulkPrint();
    }
  };

  return (
    <div className="space-y-2 text-[12px]">
      <ProcessingOverlay 
        show={showProcessingOverlay || isBulkGenerating} 
        isDeleting={isDeleteProcessing} 
        isSuccess={isSuccess}
        title={isBulkGenerating ? "Generating Statements" : undefined}
        description={isBulkGenerating ? `Processing ${bulkProgress?.current || 0} of ${bulkProgress?.total || 0}: ${bulkProgress?.supplierName || ''}` : undefined}
      />

      <Dialog open={isStatementOptionsOpen} onOpenChange={setIsStatementOptionsOpen}>
        <DialogContent className="max-w-md bg-card border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Statement Print Options</DialogTitle>
            <DialogDescription className="text-xs">
              Select which statements to print and how to organize them.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Print Scope</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant={printScope === 'selected' ? 'default' : 'outline'} 
                  onClick={() => setPrintScope('selected')}
                  disabled={!hook.selectedCustomerKey}
                  className="h-10 text-[11px] font-bold flex flex-col items-center justify-center gap-1"
                >
                  <User className="h-4 w-4" />
                  Selected {type === 'customer' ? 'Customer' : 'Supplier'}
                </Button>
                <Button 
                  variant={printScope === 'all' ? 'default' : 'outline'} 
                  onClick={() => setPrintScope('all')}
                  className="h-10 text-[11px] font-bold flex flex-col items-center justify-center gap-1"
                >
                  <UserCircle className="h-4 w-4" />
                  All {type === 'customer' ? 'Customers' : 'Suppliers'}
                </Button>
              </div>
              {printScope === 'all' && (
                <p className="text-[9px] text-muted-foreground italic px-1">
                  * {type === 'customer' ? 'Total Customer' : 'Mill'} Overview is excluded from individual statement stacks.
                </p>
              )}
            </div>

            {printScope === 'all' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Sort Order (Bulk Only)</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    variant={sortOrder === 'name' ? 'secondary' : 'outline'} 
                    onClick={() => setSortOrder('name')}
                    className={cn("h-14 text-[10px] font-bold flex flex-col gap-1 px-1", sortOrder === 'name' && "bg-primary/10 border-primary text-primary")}
                  >
                    Name
                  </Button>
                  <Button 
                    variant={sortOrder === 'outstanding' ? 'secondary' : 'outline'} 
                    onClick={() => setSortOrder('outstanding')}
                    className={cn("h-14 text-[10px] font-bold flex flex-col gap-1 px-1", sortOrder === 'outstanding' && "bg-primary/10 border-primary text-primary")}
                  >
                    Outstanding
                  </Button>
                  <Button 
                    variant={sortOrder === 'netAmount' ? 'secondary' : 'outline'} 
                    onClick={() => setSortOrder('netAmount')}
                    className={cn("h-14 text-[10px] font-bold flex flex-col gap-1 px-1", sortOrder === 'netAmount' && "bg-primary/10 border-primary text-primary")}
                  >
                    Net Amount
                  </Button>
                </div>
                <p className="text-[9px] text-muted-foreground mt-1">Note: Mill Overview is excluded from bulk print.</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsStatementOptionsOpen(false)} className="h-8 text-[11px] font-bold">Cancel</Button>
            <Button onClick={handleExecutePrint} className="h-8 text-[11px] font-bold px-6">
              {printScope === 'selected' ? 'Generate Preview' : 'Start Bulk Print'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {type === 'outsider' ? (
        <>
          <div className="sticky top-0 z-40 border-b border-border bg-card shadow-sm">
            <div className="w-full px-1.5 sm:px-2.5 py-0.5 flex flex-wrap gap-2 items-center text-[12px]">
              <div className="flex-1 flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
                <div className="flex items-center gap-2 md:pl-3">
                  <Button size="sm" className="h-7 text-[11px]" variant="outline" onClick={hook.resetPaymentForm ?? (() => {})} disabled={hook.isProcessing ?? false}>Clear</Button>
                  <Button size="sm" className="h-7 text-[11px]" onClick={() => void hook.processPayment?.()} disabled={hook.isProcessing ?? false}>
                    {hook.isProcessing ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Processing...</> : "Finalize"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
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
                  from={hook.from}
                  setFrom={hook.setFrom}
                  selectedAccountId={hook.selectedAccountId}
                  setSelectedAccountId={hook.setSelectedAccountId}
                  internalBankAccounts={globalData.bankAccounts}
                  financialState={supplierHook.financialState}
                />
              </div>
              <div className="w-full h-[195px] overflow-hidden">
                <PaymentHistoryCompact payments={hook.paymentHistory.filter(p => p.customerId === 'OUTSIDER' && (p.receiptType || "").toLowerCase() === "rtgs")} onEdit={handleEditPayment} onDelete={handleDeletePayment} />
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm shadow-sm">
            <div className="w-full px-2 md:px-2.5 py-1.5 md:py-2.5">
              <div className="hidden lg:grid grid-cols-2 gap-3 items-start">
                {/* Left Column: Transaction History (Payment History Compact) */}
                <div className="min-w-0 border-r border-slate-200 pr-3">
                  {hook.selectedCustomerKey && (transactionsForSelectedSupplier.length > 0 || hook.editingPayment) ? (
                    <div className="w-full overflow-hidden rounded-lg border border-border/80 bg-card shadow-[0_4px_14px_0_rgba(0,0,0,0.08)] h-[195px]">
                      <PaymentHistoryCompact payments={selectedSupplierPayments} onEdit={handleEditPayment} onDelete={handleDeletePayment} />
                    </div>
                  ) : (
                    <div className="h-[195px] flex items-center justify-center border border-dashed border-slate-300 rounded-lg bg-slate-50/50">
                      <div className="flex flex-col items-center gap-2">
                        <Banknote className="h-5 w-5 text-slate-300" />
                        <span className="text-[11px] text-slate-400 font-medium italic">Payment History (Supplier Select Karein)</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Compact Filters + Supplier Select */}
                <div className="flex flex-col gap-1 min-w-0">
                  <div className={cn("grid gap-1 w-full", type === 'customer' ? "grid-cols-3" : "grid-cols-5")}>
                    <Button variant="outline" size="sm" onClick={() => { setSelectedHistoryType('cash'); setHistoryDialogOpen(true); }} className="h-6 text-[9px] font-bold w-full flex-shrink-0 justify-between px-1.5 rounded-md border-slate-200 bg-white/80 transition-all shadow-sm">
                      <span>Cash</span>
                      <span className="bg-slate-100 text-slate-700 border border-slate-200 px-1 py-0 rounded-[3px] text-[8px] font-bold">{cashHistoryRows.length}</span>
                    </Button>
                    
                    <Button variant="outline" size="sm" onClick={() => { setSelectedHistoryType('online'); setHistoryDialogOpen(true); }} className="h-6 text-[9px] font-bold w-full flex-shrink-0 justify-between px-1.5 rounded-md border-slate-200 bg-white/80 transition-all shadow-sm">
                      <span>Online</span>
                      <span className="bg-slate-100 text-slate-700 border border-slate-200 px-1 py-0 rounded-[3px] text-[8px] font-bold">{onlineHistoryRows.length}</span>
                    </Button>

                    <Button variant="outline" size="sm" onClick={() => { setSelectedHistoryType('ledger'); setHistoryDialogOpen(true); }} className="h-6 text-[9px] font-bold w-full flex-shrink-0 justify-between px-1.5 rounded-md border-slate-200 bg-white/80 transition-all shadow-sm">
                      <span>Ledger</span>
                      <span className="bg-slate-100 text-slate-700 border border-slate-200 px-1 py-0 rounded-[3px] text-[8px] font-bold">{ledgerHistoryRows.length}</span>
                    </Button>

                    {type !== 'customer' && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => { setSelectedHistoryType('gov'); setHistoryDialogOpen(true); }} className="h-6 text-[9px] font-bold w-full flex-shrink-0 justify-between px-1.5 rounded-md border-slate-200 bg-white/80 transition-all shadow-sm">
                          <span>Gov</span>
                          <span className="bg-slate-100 text-slate-700 border border-slate-200 px-1 py-0 rounded-[3px] text-[8px] font-bold">{govHistoryRows.length}</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setSelectedHistoryType('rtgs'); setHistoryDialogOpen(true); }} className="h-6 text-[9px] font-bold w-full flex-shrink-0 justify-between px-1.5 rounded-md border-slate-200 bg-white/80 transition-all shadow-sm">
                          <span>RTGS</span>
                          <span className="bg-slate-100 text-slate-700 border border-slate-200 px-1 py-0 rounded-[3px] text-[8px] font-bold">{rtgsHistoryRows.length}</span>
                        </Button>
                      </>
                    )}
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
                      <div className="flex items-center gap-1.5">
                        <Button onClick={handleStatementClick} size="sm" className="h-6 px-3 py-0 text-[10px] font-bold bg-primary text-primary-foreground hover:bg-primary/95 shadow-sm rounded-md transition-all border border-transparent flex items-center">
                          <FileText className="h-3 w-3 mr-1" />Statement
                        </Button>
                      </div>
                    }
                    type={type as any}
                    summary={filteredSupplierSummary}
                  />
                </div>
              </div>

              {/* Mobile View Filters (Remains Stacked) */}
              <div className="lg:hidden flex flex-col gap-1.5">
                <div className="grid grid-cols-3 gap-1.5 w-full">
                  <Button variant="outline" size="sm" onClick={() => { setSelectedHistoryType('cash'); setHistoryDialogOpen(true); }} className="h-7 text-[10px] font-bold flex-1 justify-between px-2 rounded-md border-slate-200 bg-white/80 transition-all shadow-sm">
                    <span>Cash</span>
                    <span className="bg-slate-100 text-slate-700 border border-slate-200 px-1 py-0.5 rounded-[4px] text-[8.5px] font-bold">{cashHistoryRows.length}</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setSelectedHistoryType('online'); setHistoryDialogOpen(true); }} className="h-7 text-[10px] font-bold flex-1 justify-between px-2 rounded-md border-slate-200 bg-white/80 transition-all shadow-sm">
                    <span>Online</span>
                    <span className="bg-slate-100 text-slate-700 border border-slate-200 px-1 py-0.5 rounded-[4px] text-[8.5px] font-bold">{onlineHistoryRows.length}</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setSelectedHistoryType('ledger'); setHistoryDialogOpen(true); }} className="h-7 text-[10px] font-bold flex-1 justify-between px-2 rounded-md border-slate-200 bg-white/80 transition-all shadow-sm">
                    <span>Ledger</span>
                    <span className="bg-slate-100 text-slate-700 border border-slate-200 px-1 py-0.5 rounded-[4px] text-[8.5px] font-bold">{ledgerHistoryRows.length}</span>
                  </Button>
                </div>
                {type !== 'customer' && (
                  <div className="grid grid-cols-2 gap-1.5 w-full">
                    <Button variant="outline" size="sm" onClick={() => { setSelectedHistoryType('gov'); setHistoryDialogOpen(true); }} className="h-7 text-[10px] font-bold flex-1 justify-between px-2 rounded-md border-slate-200 bg-white/80 transition-all shadow-sm">
                      <span>Gov</span>
                      <span className="bg-slate-100 text-slate-700 border border-slate-200 px-1 py-0.5 rounded-[4px] text-[8.5px] font-bold">{govHistoryRows.length}</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setSelectedHistoryType('rtgs'); setHistoryDialogOpen(true); }} className="h-7 text-[10px] font-bold flex-1 justify-between px-2 rounded-md border-slate-200 bg-white/80 transition-all shadow-sm">
                      <span>RTGS</span>
                      <span className="bg-slate-100 text-slate-700 border border-slate-200 px-1 py-0.5 rounded-[4px] text-[8.5px] font-bold">{rtgsHistoryRows.length}</span>
                    </Button>
                  </div>
                )}
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
                      <Button onClick={handleStatementClick} size="sm" className="h-7 px-2 py-0 text-[10px] font-bold bg-primary text-primary-foreground hover:bg-primary/95 shadow-sm rounded-md transition-all border border-transparent">
                        <FileText className="h-3.5 w-3.5 mr-1" />Statement
                      </Button>
                    </div>
                  }
                  type={type as any}
                  summary={filteredSupplierSummary}
                />
                {(hook.selectedCustomerKey || hook.editingPayment) && (
                  <div className="mt-2">
                    <PaymentForm {...hook} type={type} bankAccounts={hook.bankAccounts} bankBranches={hook.bankBranches} onPaymentMethodChange={handlePaymentMethodChange} hideRtgsToggle={false} centerName={hook.centerName} setCenterName={hook.setCenterName} centerNameOptions={hook.centerNameOptions} onClearPaymentForm={hook.resetPaymentForm ?? (() => {})} onProcessPayment={async () => {
                      try {
                        if (hook.processPayment) await hook.processPayment();
                        else if ((hook as any).handleProcessPayment) await (hook as any).handleProcessPayment();
                      } catch (error: any) {
                        console.error("Payment trigger failed:", error);
                        const { toast } = await import('@/hooks/use-toast');
                        toast({ title: "Critical Error", description: error.message || "Failed to initiate payment processing.", variant: "destructive" });
                      }
                    }} isProcessing={hook.isProcessing ?? false} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Desktop: Side-by-side — Outstanding (78% left) | Entry Form (22% right) */}
          <div className="hidden lg:flex gap-2" style={{ minHeight: '380px' }}>
            {/* LEFT: Outstanding Table — 78% */}
            <div className="min-w-0" style={{ width: '78%' }}>
              {hook.selectedCustomerKey && (transactionsForSelectedSupplier.length > 0 || hook.editingPayment) ? (
                <div className="w-full overflow-hidden rounded-lg border border-border/80 bg-card shadow-[0_4px_14px_0_rgba(0,0,0,0.08)] h-[380px]">
                  <TransactionTable suppliers={transactionsForSelectedSupplier} onShowDetails={hook.setDetailsSupplierEntry} selectedIds={hook.selectedEntryIds} onSelectionChange={handleSelectionChange} embed compact showTabsInHeader activeTab={activeTransactionTab} onTabChange={setActiveTransactionTab} onEditEntry={handleEditEntry} type={type} highlightEntryId={highlightEntryId} onPrintRow={handlePrintRow} />
                </div>
              ) : (
                <div className="w-full h-[380px]">
                  <Card className="h-full rounded-lg border border-slate-200/80 bg-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.10)] backdrop-blur-md flex items-center justify-center">
                    <CardContent className="p-6">
                      <div className="flex flex-col items-center text-center gap-4">
                        <div className="grid size-12 place-items-center rounded-[12px] bg-violet-50 text-violet-700 ring-1 ring-violet-900/[0.06] shadow-sm"><FileText className="h-6 w-6" /></div>
                        <div className="min-w-0">
                          <div className="text-[14px] font-semibold text-slate-900">{hook.selectedCustomerKey ? "No entries found" : "Entries Table"}</div>
                          <div className="mt-1 text-[12px] text-slate-600 max-w-[300px] leading-relaxed">{hook.selectedCustomerKey ? "Is supplier ke liye abhi outstanding entries nahi hain." : "Supplier select karte hi outstanding entries yahan dikhayi dengi."}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            {/* RIGHT: Entry Form — 22% */}
            <div className="min-w-0" style={{ width: '22%' }}>
              {(hook.selectedCustomerKey || hook.editingPayment) ? (
                <div className="w-full overflow-y-auto rounded-lg border border-border/80 bg-card shadow-[0_4px_14px_0_rgba(0,0,0,0.08)] h-[380px] p-2">
                  <PaymentForm {...hook} type={type} bankAccounts={hook.bankAccounts} bankBranches={hook.bankBranches} onPaymentMethodChange={handlePaymentMethodChange} hideRtgsToggle={false} centerName={hook.centerName} setCenterName={hook.setCenterName} centerNameOptions={hook.centerNameOptions} onClearPaymentForm={hook.resetPaymentForm ?? (() => {})} onProcessPayment={async () => {
                    try {
                      if (hook.processPayment) await hook.processPayment();
                      else if ((hook as any).handleProcessPayment) await (hook as any).handleProcessPayment();
                    } catch (error: any) {
                      console.error("Payment trigger failed:", error);
                      const { toast } = await import('@/hooks/use-toast');
                      toast({ title: "Critical Error", description: error.message || "Failed to initiate payment processing.", variant: "destructive" });
                    }
                  }} isProcessing={hook.isProcessing ?? false} />
                </div>
              ) : (
                <div className="w-full h-[380px]">
                  <Card className="h-full rounded-lg border border-slate-200/80 bg-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.10)] backdrop-blur-md flex items-center justify-center">
                    <CardContent className="p-4">
                      <div className="flex flex-col items-center text-center gap-3">
                        <div className="grid size-10 place-items-center rounded-[10px] bg-violet-50 text-violet-700 ring-1 ring-violet-900/[0.06] shadow-sm"><Scale className="h-5 w-5" /></div>
                        <div className="text-[12px] font-medium text-slate-400 italic">Payment Form</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>

            {/* RTGS / Gov Forms — rendered BELOW the tables on desktop */}
            <div className="hidden lg:block mt-3 mb-2">
              {type === 'supplier' && hook.paymentMethod === 'RTGS' && (
                <div className="grid grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)] xl:grid-cols-[450px_minmax(0,1fr)] gap-3">
                  <Card className="text-[10px] border border-slate-200/80 !bg-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.10)] backdrop-blur-lg h-full max-w-full lg:max-w-[400px] xl:max-w-[450px] rounded-md"><CardContent className="p-2.5 h-full"><RtgsForm {...hook} editingPayment={hook.editingPayment ?? undefined} bankAccounts={supplierBankAccounts} internalBankAccounts={globalData.bankAccounts} financialState={supplierHook.financialState} banks={banks} bankBranches={bankBranches} /></CardContent></Card>
                  <div className="h-full min-w-0">
                    <GeneratePaymentOptions rtgsQuantity={hook.rtgsQuantity || 0} setRtgsQuantity={hook.setRtgsQuantity || (() => {})} rtgsRate={hook.rtgsRate || 0} setRtgsRate={hook.setRtgsRate || (() => {})} rtgsAmount={hook.rtgsAmount || 0} setRtgsAmount={hook.setRtgsAmount || (() => {})} minRate={hook.minRate || 0} setMinRate={hook.setMinRate || (() => {})} maxRate={hook.maxRate || 0} setMaxRate={hook.setMaxRate || (() => {})} selectPaymentAmount={hook.selectPaymentAmount || (() => {})} combination={paymentCombination} paymentMethod={hook.paymentMethod || 'RTGS'} onGenerateClick={() => setIsGenerateOptionsOpen(true)} />
                  </div>
                </div>
              )}
              {type === 'supplier' && hook.paymentMethod === 'Gov.' && (
                <div className="space-y-2">
                  {hook.selectedCustomerKey && transactionsForSelectedSupplier.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)] xl:grid-cols-[450px_minmax(0,1fr)] gap-3">
                      <div className="h-full max-w-full lg:max-w-[400px] xl:max-w-[450px]">
                        <GovForm govQuantity={hook.govQuantity} setGovQuantity={hook.setGovQuantity} govRate={hook.govRate} setGovRate={hook.setGovRate} govAmount={hook.govAmount} setGovAmount={hook.setGovAmount} govExtraAmount={hook.govExtraAmount} setGovExtraAmount={hook.setGovExtraAmount} targetAmount={hook.rtgsAmount || 0} minRate={hook.minRate} selectedPaymentOption={hook.selectedPaymentOption} />
                      </div>
                      <GovReceiptSelector availableReceipts={transactionsForSelectedSupplier} govRate={hook.govRate || hook.minRate || 0} extraAmountPerQuintal={0} onSelectReceipts={(ids) => hook.setSelectedEntryIds(new Set(ids))} selectedReceiptIds={hook.selectedEntryIds} allowManualRsPerQtl={true} allowManualGovRate={true} calcTargetAmount={hook.rtgsAmount ?? 0} setCalcTargetAmount={hook.setRtgsAmount} combination={paymentCombination} selectPaymentAmount={hook.selectPaymentAmount} onSuggestionsChange={setGovSuggestions} onExtraAmountChange={hook.setGovExtraAmount} onGenerateClick={() => setIsGenerateOptionsOpen(true)} />
                    </div>
                  )}
                </div>
              )}
              {type === 'supplier' && hook.paymentMethod === 'Gov.' && govSuggestions.length > 0 && (
                <div className="mt-2 rounded-md border border-border/70 bg-card shadow-lg overflow-hidden flex flex-col h-[320px]">
                  <div className="px-3 py-2 bg-muted/70 border-b border-border/80 shrink-0"><span className="text-[11px] font-semibold text-primary">Suggested Combinations</span></div>
                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-[9px]"><thead className="bg-muted/50 border-b sticky top-0 z-10"><tr><th className="px-2 py-1 text-left w-[40px]">Select</th><th className="px-2 py-1 text-left w-[60px]">Type</th><th className="px-2 py-1 text-left">Entries</th><th className="px-2 py-1 text-right w-[70px]">Normal</th><th className="px-2 py-1 text-right w-[70px]">Extra</th><th className="px-2 py-1 text-right w-[80px]">To Pay</th><th className="px-2 py-1 text-right w-[70px]">Diff</th></tr></thead>
                      <tbody>{govSuggestions.map((comb, idx) => (
                        <tr key={idx} className="h-7 border-b border-border/60 hover:bg-muted/30">
                          <td className="px-2"><input type="checkbox" className="h-3 w-3" checked={Array.isArray(comb.receipts) && comb.receipts.every((r: any) => hook.selectedEntryIds.has(r.id || r.srNo))} onChange={() => { const ids = (comb.receipts || []).map((r: any) => r.id || r.srNo); hook.setSelectedEntryIds(new Set(ids)); hook.setGovAmount?.(comb.totalNormal); hook.setGovExtraAmount?.(comb.totalExtra); }} /></td>
                          <td className="px-2 font-medium">{comb.type}</td><td className="px-2 truncate max-w-[140px]">{(comb.details || []).map((d: any) => d.srNo).join(", ")}</td>
                          <td className="px-2 text-right tabular-nums">{formatCurrency(comb.totalNormal)}</td><td className="px-2 text-right text-primary tabular-nums">{formatCurrency(comb.totalExtra)}</td><td className="px-2 text-right font-bold text-primary tabular-nums">{formatCurrency(comb.totalGov)}</td>
                          <td className={cn("px-2 text-right tabular-nums", (comb.difference ?? 0) > 0 ? "text-primary" : "text-muted-foreground")}>{ (comb.difference ?? 0) > 0 ? `+${formatCurrency(comb.difference)}` : formatCurrency(comb.difference) }</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile View */}
            <div className="lg:hidden">
              <Tabs defaultValue="form" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-9 bg-muted/50 p-1">
                  <TabsTrigger value="form" className="text-[10px] py-1">Form</TabsTrigger>
                  <TabsTrigger value="entries" className="text-[10px] py-1">Entries</TabsTrigger>
                  <TabsTrigger value="history" className="text-[10px] py-1">History</TabsTrigger>
                </TabsList>
                <TabsContent value="form" className="mt-2 space-y-2">
                  {hook.selectedCustomerKey && (
                    <div className="w-full overflow-hidden rounded-xl border border-border/60 bg-card p-3 shadow-sm">
                      <PaymentForm {...hook} type={type} bankAccounts={hook.bankAccounts} bankBranches={hook.bankBranches} onPaymentMethodChange={handlePaymentMethodChange} hideRtgsToggle={false} centerName={hook.centerName} setCenterName={hook.setCenterName} centerNameOptions={hook.centerNameOptions} onClearPaymentForm={hook.resetPaymentForm ?? (() => {})} onProcessPayment={async () => {
                        try {
                          if (hook.processPayment) await hook.processPayment();
                          else if ((hook as any).handleProcessPayment) await (hook as any).handleProcessPayment();
                        } catch (error: any) {
                          console.error("Payment mobile failed:", error);
                          const { toast } = await import('@/hooks/use-toast');
                          toast({ title: "Critical Error", description: error.message || "Failed to initiate payment processing.", variant: "destructive" });
                        }
                      }} isProcessing={hook.isProcessing ?? false} />
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="entries" className="mt-2 text-[10px]">
                  {hook.selectedCustomerKey && transactionsForSelectedSupplier.length > 0 && (
                    <div className="min-w-0 h-[250px] overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
                      <TransactionTable suppliers={transactionsForSelectedSupplier} onShowDetails={hook.setDetailsSupplierEntry} selectedIds={hook.selectedEntryIds} onSelectionChange={handleSelectionChange} embed compact showTabsInHeader activeTab={activeTransactionTab} onTabChange={setActiveTransactionTab} onEditEntry={handleEditEntry} type={type} highlightEntryId={highlightEntryId} onPrintRow={handlePrintRow} />
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="history" className="mt-2">
                  <div className="w-full h-[250px] overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
                    <PaymentHistoryCompact payments={selectedSupplierPayments} onEdit={handleEditPayment} onDelete={handleDeletePayment} />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
        </>
      )}
      <Dialog open={isGenerateOptionsOpen} onOpenChange={setIsGenerateOptionsOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-4 bg-white rounded-lg shadow-xl">
          <DialogHeader className="border-b pb-2">
            <DialogTitle className="text-sm font-bold text-primary flex items-center justify-between">
              <span>Generated Payment Options</span>
              <span className="text-[10px] text-muted-foreground font-normal mr-6">{paymentCombination.sortedPaymentOptions.length} combinations found</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-2 min-h-0">
            <PaymentCombinationResults
              options={paymentCombination.sortedPaymentOptions}
              requestSort={paymentCombination.requestSort}
              onSelect={(option) => {
                hook.selectPaymentAmount(option);
                setIsGenerateOptionsOpen(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
       <DetailsDialog isOpen={!!hook.detailsSupplierEntry} onOpenChange={() => (hook.setDetailsSupplierEntry ? hook.setDetailsSupplierEntry(null) : void 0)} customer={hook.detailsSupplierEntry} paymentHistory={hook.paymentHistory} entryType={type === 'customer' ? 'Customer' : 'Supplier'} onPrint={handlePrintRow} />
      <DocumentPreviewDialog
        isOpen={isDocumentPreviewOpen}
        setIsOpen={setIsDocumentPreviewOpen}
        customer={documentPreviewCustomer}
        documentType={documentType}
        setDocumentType={setDocumentType}
        receiptSettings={globalData.receiptSettings}
      />
      <PaymentDetailsDialog payment={hook.selectedPaymentForDetails} suppliers={hook.suppliers} onOpenChange={() => (hook.setSelectedPaymentForDetails ? hook.setSelectedPaymentForDetails(null) : void 0)} onShowEntryDetails={hook.setDetailsSupplierEntry || (() => {})} />
      {type === 'supplier' && <RTGSReceiptDialog payment={hook.rtgsReceiptData} settings={globalData.receiptSettings} onOpenChange={() => hook.setRtgsReceiptData(null)} />}
      <BankSettingsDialog isOpen={!!hook.isBankSettingsOpen} onOpenChange={hook.setIsBankSettingsOpen || (() => {})} />
      {type === 'supplier' ? (
        <SupplierEntryEditDialog open={editEntryDialogOpen && !!selectedEntryForEdit} onOpenChange={handleEditEntryDialogOpenChange} entry={selectedEntryForEdit} onSuccess={async () => { if (selectedEntryForEdit?.id) { setHighlightEntryId(selectedEntryForEdit.id); setTimeout(() => setHighlightEntryId(null), 3000); } setSupplierDataRefreshKey(Date.now()); await new Promise(res => setTimeout(res, 300)); const key = hook.selectedCustomerKey; if (key) { hook.handleCustomerSelect(null); setTimeout(() => hook.handleCustomerSelect(key), 50); } }} />
      ) : (
        <CustomerEntryEditDialog open={editEntryDialogOpen && !!selectedEntryForEdit} onOpenChange={handleEditEntryDialogOpenChange} entry={selectedEntryForEdit} onSuccess={async () => { setSupplierDataRefreshKey(Date.now()); if (selectedEntryForEdit?.id) { setHighlightEntryId(selectedEntryForEdit.id); setTimeout(() => setHighlightEntryId(null), 3000); } await new Promise(res => setTimeout(res, 300)); const key = hook.selectedCustomerKey; if (key) { hook.handleCustomerSelect(null); setTimeout(() => hook.handleCustomerSelect(key), 50); } }} />
      )}
      <PaymentDialogs 
        isStatementOpen={isStatementOpen} 
        setIsStatementOpen={setIsStatementOpen} 
        selectedSupplierSummary={selectedSupplierSummary} 
        filteredSupplierSummary={filteredSupplierSummary} 
        historyDialogOpen={historyDialogOpen} 
        setHistoryDialogOpen={setHistoryDialogOpen} 
        selectedHistoryType={selectedHistoryType} 
        cashHistoryRows={cashHistoryRows} 
        rtgsHistoryRows={rtgsHistoryRows} 
        govHistoryRows={govHistoryRows} 
        onlineHistoryRows={onlineHistoryRows}
        ledgerHistoryRows={ledgerHistoryRows}
        onEditPayment={handleEditPayment} 
        onDeletePayment={handleDeletePayment} 
        type={type as any} 
        suppliers={hook.suppliers}
      />
    </div>
  );
}

export default React.memo(SupplierPaymentsClient);
