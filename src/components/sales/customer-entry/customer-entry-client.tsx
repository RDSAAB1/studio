
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Customer, CustomerPayment, OptionItem, ReceiptSettings, DocumentType, ConsolidatedReceiptData, KantaParchi, CustomerDocument } from "@/lib/definitions";
import { formatSrNo, toTitleCase, formatCurrency, calculateCustomerEntry } from "@/lib/utils";
import * as XLSX from 'xlsx';


import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { addCustomer, deleteCustomer, getOptionsRealtime, addOption, updateOption, deleteOption, getReceiptSettings, updateReceiptSettings, deleteCustomerPaymentsForSrNo, getInitialCustomers, getMoreCustomers, getInitialCustomerPayments, getMoreCustomerPayments, addKantaParchi, updateKantaParchi, deleteKantaParchi, addCustomerDocument, updateCustomerDocument, deleteCustomerDocument, getKantaParchiBySrNo, getKantaParchiRealtime } from "@/lib/firestore";
import { format } from "date-fns";

import { CustomerForm } from "@/components/sales/customer-form";
import { CalculatedSummary } from "@/components/sales/calculated-summary";
import { EntryTable } from "@/components/sales/entry-table";
import { DocumentPreviewDialog } from "@/components/sales/document-preview-dialog";
import { CustomerDetailsDialog } from "@/components/sales/customer-details-dialog";
import { ReceiptPrintDialog, ConsolidatedReceiptPrintDialog } from "@/components/sales/print-dialogs";
import { UpdateConfirmDialog } from "@/components/sales/update-confirm-dialog";
import { ReceiptSettingsDialog } from "@/components/sales/receipt-settings-dialog";
import { CustomerImportDialog } from "./customer-import-dialog";
import { Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";


export const formSchema = z.object({
    srNo: z.string(),
    date: z.date(),
    bags: z.coerce.number().min(0),
    name: z.string().min(1, "Name is required."),
    companyName: z.string().optional(),
    address: z.string(),
    contact: z.string()
      .length(10, "Contact number must be exactly 10 digits.")
      .regex(/^\d+$/, "Contact number must only contain digits."),
    gstin: z.string().optional(),
    stateName: z.string().optional(),
    stateCode: z.string().optional(),
    vehicleNo: z.string(),
    variety: z.string().min(1, "Variety is required."),
    grossWeight: z.coerce.number().min(0),
    teirWeight: z.coerce.number().min(0),
    rate: z.coerce.number().min(0),
    cd: z.coerce.number().min(0),
    brokerage: z.coerce.number().min(0),
    kanta: z.coerce.number().min(0),
    paymentType: z.string().min(1, "Payment type is required"),
    isBrokerageIncluded: z.boolean(),
    bagWeightKg: z.coerce.number().min(0),
    bagRate: z.coerce.number().min(0),
    shippingName: z.string().optional(),
    shippingCompanyName: z.string().optional(),
    shippingAddress: z.string().optional(),
    shippingContact: z.string().optional(),
    shippingGstin: z.string().optional(),
    shippingStateName: z.string().optional(),
    shippingStateCode: z.string().optional(),
    advanceFreight: z.coerce.number().optional(),
    hsnCode: z.string().optional(),
    taxRate: z.coerce.number().optional(),
    isGstIncluded: z.boolean().optional(),
    nineRNo: z.string().optional(),
    gatePassNo: z.string().optional(),
    grNo: z.string().optional(),
    grDate: z.string().optional(),
    transport: z.string().optional(),
});

export type FormValues = z.infer<typeof formSchema>;

const getInitialFormState = (lastVariety?: string, lastPaymentType?: string): Customer => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateStr = today.toISOString().split('T')[0];

  return {
    id: "", srNo: 'C----', date: dateStr, term: '0', dueDate: dateStr, 
    name: '', companyName: '', address: '', contact: '', gstin: '', stateName: '', stateCode: '', vehicleNo: '', variety: lastVariety || '', grossWeight: 0, teirWeight: 0,
    weight: 0, rate: 0, amount: 0, bags: 0, bagWeightKg: 0, bagRate: 0, bagAmount: 0,
    kanta: 0, brokerage: 0, brokerageRate: 0, cd: 0, cdRate: 0, isBrokerageIncluded: false,
    netWeight: 0, originalNetAmount: 0, netAmount: 0, barcode: '',
    receiptType: 'Cash', paymentType: lastPaymentType || 'Full', customerId: '',
    so: '', kartaPercentage: 0, kartaWeight: 0, kartaAmount: 0, labouryRate: 0, labouryAmount: 0, advanceFreight: 0,
  };
};

export default function CustomerEntryClient() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [lastVisibleCustomer, setLastVisibleCustomer] = useState<any>(null);
  const [hasMoreCustomers, setHasMoreCustomers] = useState(true);

  const [paymentHistory, setPaymentHistory] = useState<CustomerPayment[]>([]);
  const [lastVisiblePayment, setLastVisiblePayment] = useState<any>(null);
  const [hasMorePayments, setHasMorePayments] = useState(true);

  const [currentCustomer, setCurrentCustomer] = useState<Customer>(() => getInitialFormState());
  const [currentKantaParchi, setCurrentKantaParchi] = useState<KantaParchi | null>(null);
  const [allKantaParchi, setAllKantaParchi] = useState<KantaParchi[]>([]);
  const [selectedKantaParchiSrNo, setSelectedKantaParchiSrNo] = useState<string>('');
  const [currentDocument, setCurrentDocument] = useState<CustomerDocument | null>(null);
  const [activeTab, setActiveTab] = useState<"weight" | "document">("weight");
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingKantaParchi, setIsEditingKantaParchi] = useState(false);
  const [isEditingDocument, setIsEditingDocument] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const [detailsCustomer, setDetailsCustomer] = useState<Customer | null>(null);
  const [documentPreviewCustomer, setDocumentPreviewCustomer] = useState<Customer | null>(null);
  const [receiptsToPrint, setReceiptsToPrint] = useState<Customer[]>([]);
  const [consolidatedReceiptData, setConsolidatedReceiptData] = useState<ConsolidatedReceiptData | null>(null);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [isDocumentPreviewOpen, setIsDocumentPreviewOpen] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>('tax-invoice');
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const [varietyOptions, setVarietyOptions] = useState<OptionItem[]>([]);
  const [paymentTypeOptions, setPaymentTypeOptions] = useState<OptionItem[]>([]);
  const [lastVariety, setLastVariety] = useState<string>('');
  const [lastPaymentType, setLastPaymentType] = useState<string>('');

  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);
  const [updateAction, setUpdateAction] = useState<((deletePayments: boolean) => void) | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const safeCustomers = useMemo(() => Array.isArray(customers) ? customers : [], [customers]);
  
  // Convert Kanta Parchi entries to Customer format for table display
  const kantaParchiAsCustomers = useMemo(() => {
    return allKantaParchi.map((kp: KantaParchi) => ({
      id: kp.id || kp.srNo,
      srNo: kp.srNo,
      date: kp.date,
      name: kp.name,
      variety: kp.variety,
      netWeight: kp.netWeight,
      netAmount: kp.netAmount,
      originalNetAmount: kp.originalNetAmount,
      contact: kp.contact,
      vehicleNo: kp.vehicleNo,
      grossWeight: kp.grossWeight,
      teirWeight: kp.teirWeight,
      weight: kp.weight,
      rate: kp.rate,
      bags: kp.bags,
      bagWeightKg: kp.bagWeightKg,
      bagRate: kp.bagRate,
      bagAmount: kp.bagAmount,
      amount: kp.amount,
      cdRate: kp.cdRate,
      cdAmount: kp.cdAmount,
      brokerageRate: kp.brokerageRate,
      brokerageAmount: kp.brokerageAmount,
      isBrokerageIncluded: kp.isBrokerageIncluded,
      kanta: kp.kanta,
      advanceFreight: kp.advanceFreight,
      paymentType: kp.paymentType,
      customerId: kp.customerId,
      isKantaParchi: true, // Flag to identify kanta parchi entries
    } as Customer));
  }, [allKantaParchi]);
  
  // Combine customers and kanta parchi entries
  const allEntries = useMemo(() => {
    return [...safeCustomers, ...kantaParchiAsCustomers];
  }, [safeCustomers, kantaParchiAsCustomers]);
  
  const filteredCustomers = useMemo(() => {
    const entriesToFilter = allEntries;
    if (!debouncedSearchTerm) {
      return entriesToFilter;
    }
    const lowercasedFilter = debouncedSearchTerm.toLowerCase();
    return entriesToFilter.filter(customer => {
      return (
        customer.name?.toLowerCase().startsWith(lowercasedFilter) ||
        customer.contact?.startsWith(lowercasedFilter) ||
        customer.srNo?.toLowerCase().startsWith(lowercasedFilter)
      );
    });
  }, [safeCustomers, debouncedSearchTerm]);


  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...getInitialFormState(lastVariety, lastPaymentType),
      advanceFreight: 0,
    },
    shouldFocusError: false,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsClient(true);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
        const [custResult, paymentResult] = await Promise.all([
            getInitialCustomers(),
            getInitialCustomerPayments()
        ]);
        setCustomers(custResult.data);
        setLastVisibleCustomer(custResult.lastVisible);
        setHasMoreCustomers(custResult.hasMore);
        
        setPaymentHistory(paymentResult.data);
        setLastVisiblePayment(paymentResult.lastVisible);
        setHasMorePayments(paymentResult.hasMore);
        
        const nextSrNum = custResult.data.length > 0 ? Math.max(...custResult.data.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 : 1;
        const initialSrNo = formatSrNo(nextSrNum, 'C');
        form.setValue('srNo', initialSrNo);
        setCurrentCustomer(prev => ({ ...prev, srNo: initialSrNo }));

    } catch (error) {
        console.error("Error loading initial data:", error);
        toast({ title: 'Error', description: 'Could not load initial data.', variant: 'destructive' });
    }
    setIsLoading(false);
    // Removed toast from dependencies - it's stable from useToast hook
    // form reference is stable, only need to include if form instance changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  useEffect(() => {
    if (isClient) {
      loadInitialData();
    }
  }, [isClient, loadInitialData]);

  // Load all Kanta Parchi entries for dropdown selection
  useEffect(() => {
    if (!isClient) return;
    
    const unsubscribe = getKantaParchiRealtime(
      (kantaParchiList) => {
        setAllKantaParchi(kantaParchiList);
      },
      (error) => {
        console.error("Error loading Kanta Parchi list:", error);
        toast({ title: 'Error', description: 'Could not load Kanta Parchi list.', variant: 'destructive' });
      }
    );

    return () => unsubscribe();
    // Removed toast from dependencies - it's stable from useToast hook
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient]);

  const loadMoreData = useCallback(async () => {
      if (!hasMoreCustomers || isLoadingMore) return;
      setIsLoadingMore(true);
      try {
          const result = await getMoreCustomers(lastVisibleCustomer);
          setCustomers(prev => [...prev, ...result.data]);
          setLastVisibleCustomer(result.lastVisible);
          setHasMoreCustomers(result.hasMore);
      } catch (error) {
          console.error("Error loading more customers:", error);
          toast({ title: 'Error', description: 'Could not load more entries.', variant: 'destructive' });
      }
      setIsLoadingMore(false);
      // Removed toast from dependencies - it's stable from useToast hook
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastVisibleCustomer, hasMoreCustomers, isLoadingMore]);


  useEffect(() => {
    if (!isClient) return;

    const fetchSettings = async () => {
        const settings = await getReceiptSettings();
        if (settings) {
            setReceiptSettings(settings);
        }
    };
    fetchSettings();


    const unsubVarieties = getOptionsRealtime('varieties', setVarietyOptions, (err) => console.error("Error fetching varieties:", err));
    const unsubPaymentTypes = getOptionsRealtime('paymentTypes', setPaymentTypeOptions, (err) => console.error("Error fetching payment types:", err));

    const savedVariety = localStorage.getItem('lastSelectedVariety');
    if (savedVariety) {
      setLastVariety(savedVariety);
      form.setValue('variety', savedVariety);
    }

    const savedPaymentType = localStorage.getItem('lastSelectedPaymentType');
    if (savedPaymentType) {
      setLastPaymentType(savedPaymentType);
      form.setValue('paymentType', savedPaymentType);
    }

    form.setValue('date', new Date());

    return () => {
      unsubVarieties();
      unsubPaymentTypes();
    };
    // Removed form and toast from dependencies - form is stable, toast is stable from useToast
    // This prevents re-subscribing to getOptionsRealtime on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient]);
  
  const handleSetLastVariety = (variety: string) => {
    setLastVariety(variety);
    if(isClient) {
        localStorage.setItem('lastSelectedVariety', variety);
    }
  }

  const handleSetLastPaymentType = (paymentType: string) => {
    setLastPaymentType(paymentType);
    if(isClient) {
        localStorage.setItem('lastSelectedPaymentType', paymentType);
    }
  }

  const performCalculations = useCallback((data: Partial<FormValues>) => {
    const calculatedState = calculateCustomerEntry(data, paymentHistory);
    setCurrentCustomer(prev => ({...prev, ...calculatedState}));
  }, [paymentHistory]);
  
  useEffect(() => {
    const subscription = form.watch((value) => {
        performCalculations(value as Partial<FormValues>);
    });
    return () => subscription.unsubscribe();
    // Only re-subscribe if form instance changes (rare)
    // performCalculations callback already handles paymentHistory updates internally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  // Load selected Kanta Parchi data when selection changes
  useEffect(() => {
    const loadSelectedKantaParchi = async () => {
      if (selectedKantaParchiSrNo && selectedKantaParchiSrNo !== '') {
        try {
          const kantaParchi = await getKantaParchiBySrNo(selectedKantaParchiSrNo);
          if (kantaParchi) {
            setCurrentKantaParchi(kantaParchi);
            // Load Kanta Parchi data into form (read-only reference for basic fields)
            form.setValue('srNo', kantaParchi.srNo);
            form.setValue('name', kantaParchi.name);
            form.setValue('contact', kantaParchi.contact);
            form.setValue('vehicleNo', kantaParchi.vehicleNo);
            form.setValue('variety', kantaParchi.variety);
            form.setValue('grossWeight', kantaParchi.grossWeight);
            form.setValue('teirWeight', kantaParchi.teirWeight);
            form.setValue('rate', kantaParchi.rate);
            form.setValue('bags', kantaParchi.bags);
            form.setValue('bagWeightKg', kantaParchi.bagWeightKg);
            form.setValue('bagRate', kantaParchi.bagRate);
            // Set date from Kanta Parchi
            if (kantaParchi.date) {
              form.setValue('date', new Date(kantaParchi.date));
            }
            // CD, Brokerage Rate, Kanta, and Advance/Freight should be filled in Create Document tab, not from Kanta Parchi
            form.setValue('isBrokerageIncluded', kantaParchi.isBrokerageIncluded);
          }
        } catch (error) {
          console.error("Error loading selected Kanta Parchi:", error);
          toast({ title: 'Error', description: 'Could not load selected Kanta Parchi.', variant: 'destructive' });
        }
      } else {
        setCurrentKantaParchi(null);
      }
    };
    
    if (activeTab === "document") {
      loadSelectedKantaParchi();
    }
    // Removed form and toast from dependencies - form is stable, toast is stable from useToast
    // This prevents re-running this effect on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKantaParchiSrNo, activeTab]);

  const resetFormToState = useCallback((customerState: Customer) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let formDate;
    try {
        formDate = customerState.date ? new Date(customerState.date) : today;
        if (isNaN(formDate.getTime())) formDate = today;
    } catch {
        formDate = today;
    }
    const formValues: FormValues = {
      srNo: customerState.srNo, date: formDate, bags: customerState.bags || 0,
      name: customerState.name, companyName: customerState.companyName || '', address: customerState.address,
      contact: customerState.contact, gstin: customerState.gstin || '', stateName: customerState.stateName || '', stateCode: customerState.stateCode || '',
      vehicleNo: customerState.vehicleNo, variety: customerState.variety,
      grossWeight: customerState.grossWeight || 0, teirWeight: customerState.teirWeight || 0,
      rate: customerState.rate || 0, 
      // For CD: prioritize cdRate (percentage), if not available and we have cd (amount) and amount, calculate percentage
      cd: customerState.cdRate !== undefined && customerState.cdRate !== null 
        ? customerState.cdRate 
        : (customerState.cd && customerState.amount && customerState.amount > 0 
          ? (customerState.cd / customerState.amount) * 100 
          : 0),
      // For Brokerage: prioritize brokerageRate (rate), if not available and we have brokerage (amount) and netWeight, calculate rate
      brokerage: customerState.brokerageRate !== undefined && customerState.brokerageRate !== null
        ? customerState.brokerageRate
        : (customerState.brokerage && customerState.netWeight && customerState.netWeight > 0
          ? customerState.brokerage / customerState.netWeight
          : 0),
      kanta: customerState.kanta || 0,
      paymentType: customerState.paymentType || 'Full',
      isBrokerageIncluded: customerState.isBrokerageIncluded || false,
      hsnCode: (customerState as any).hsnCode || '1006',
      taxRate: (customerState as any).taxRate || 5,
      isGstIncluded: customerState.isGstIncluded || false,
      nineRNo: (customerState as any).nineRNo || '',
      gatePassNo: customerState.gatePassNo || '',
      grNo: customerState.grNo || '',
      grDate: customerState.grDate || '',
      transport: customerState.transport || '',
      bagWeightKg: customerState.bagWeightKg || 0,
      bagRate: customerState.bagRate || 0,
      shippingName: customerState.shippingName || '',
      shippingCompanyName: customerState.shippingCompanyName || '',
      shippingAddress: customerState.shippingAddress || '',
      shippingContact: customerState.shippingContact || '',
      shippingGstin: customerState.shippingGstin || '',
      stateName: customerState.stateName || '',
      stateCode: customerState.stateCode || '',
      shippingStateName: customerState.shippingStateName || '',
      shippingStateCode: customerState.shippingStateCode || '',
      advanceFreight: customerState.advanceFreight || 0,
    };
    setCurrentCustomer(customerState);
    form.reset(formValues);
    performCalculations(formValues);
  }, [form, performCalculations]);

  const handleNew = useCallback(() => {
    setIsEditing(false);
    let nextSrNum = 1;
    if (safeCustomers.length > 0) {
        const lastSrNo = safeCustomers.sort((a, b) => a.srNo.localeCompare(b.srNo)).pop()?.srNo || 'C00000';
        nextSrNum = parseInt(lastSrNo.substring(1)) + 1;
    }
    const newState = getInitialFormState(lastVariety, lastPaymentType);
    newState.srNo = formatSrNo(nextSrNum, 'C');
    const today = new Date();
    today.setHours(0,0,0,0);
    newState.date = today.toISOString().split('T')[0];
    newState.dueDate = today.toISOString().split('T')[0];
    resetFormToState(newState);
    setTimeout(() => form.setFocus('srNo'), 50);
}, [safeCustomers, lastVariety, lastPaymentType, resetFormToState, form]);

  const handleEdit = (id: string) => {
    // Check if it's a kanta parchi entry
    const kantaParchiToEdit = allKantaParchi.find(kp => (kp.id || kp.srNo) === id);
    if (kantaParchiToEdit) {
      // Edit kanta parchi - switch to weight tab and load kanta parchi data
      setActiveTab("weight");
      setSelectedKantaParchiSrNo(kantaParchiToEdit.srNo);
      setIsEditingKantaParchi(true);
      setCurrentKantaParchi(kantaParchiToEdit);
      
      // Load kanta parchi data into form
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let formDate;
      try {
        formDate = kantaParchiToEdit.date ? new Date(kantaParchiToEdit.date) : today;
        if (isNaN(formDate.getTime())) formDate = today;
      } catch {
        formDate = today;
      }
      
      const formValues: FormValues = {
        srNo: kantaParchiToEdit.srNo,
        date: formDate,
        bags: kantaParchiToEdit.bags || 0,
        name: kantaParchiToEdit.name,
        so: '',
        address: '',
        contact: kantaParchiToEdit.contact,
        vehicleNo: kantaParchiToEdit.vehicleNo,
        variety: kantaParchiToEdit.variety,
        grossWeight: kantaParchiToEdit.grossWeight || 0,
        teirWeight: kantaParchiToEdit.teirWeight || 0,
        rate: kantaParchiToEdit.rate || 0,
        cd: kantaParchiToEdit.cdRate || 0,
        brokerage: kantaParchiToEdit.brokerageRate || 0,
        kanta: kantaParchiToEdit.kanta || 0,
        paymentType: kantaParchiToEdit.paymentType || 'Full',
        isBrokerageIncluded: kantaParchiToEdit.isBrokerageIncluded || false,
        bagWeightKg: kantaParchiToEdit.bagWeightKg || 0,
        bagRate: kantaParchiToEdit.bagRate || 0,
        advanceFreight: kantaParchiToEdit.advanceFreight || 0,
        forceUnique: false,
      };
      
      const customerState = {
        ...kantaParchiToEdit,
        id: kantaParchiToEdit.id || kantaParchiToEdit.srNo,
        so: '',
        address: '',
        companyName: '',
      } as Customer;
      
      setCurrentCustomer(customerState);
      form.reset(formValues);
      performCalculations(formValues);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
    // Otherwise, edit regular customer entry
    const customerToEdit = safeCustomers.find(c => c.id === id);
    if (customerToEdit) {
      setIsEditing(true);
      resetFormToState(customerToEdit);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSrNoBlur = (srNoValue: string) => {
    let formattedSrNo = srNoValue.trim();
    if (formattedSrNo && !isNaN(parseInt(formattedSrNo)) && isFinite(Number(formattedSrNo))) {
        formattedSrNo = formatSrNo(parseInt(formattedSrNo), 'C');
        form.setValue('srNo', formattedSrNo);
    }
    const foundCustomer = safeCustomers.find(c => c.srNo === formattedSrNo);
    if (foundCustomer) {
        setIsEditing(true);
        resetFormToState(foundCustomer);
    }
  }

  const handleContactBlur = (contactValue: string) => {
    if (contactValue.length === 10 && customers) {
      const latestEntryForContact = customers
          .filter(c => c.contact === contactValue)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          
      if (latestEntryForContact && latestEntryForContact.id !== currentCustomer.id) {
          form.setValue('name', latestEntryForContact.name);
          form.setValue('companyName', latestEntryForContact.companyName || '');
          form.setValue('address', latestEntryForContact.address);
          form.setValue('gstin', latestEntryForContact.gstin || '');
          form.setValue('stateName', latestEntryForContact.stateName || '');
          form.setValue('stateCode', latestEntryForContact.stateCode || '');
          
          form.setValue('shippingName', latestEntryForContact.shippingName || latestEntryForContact.name);
          form.setValue('shippingCompanyName', latestEntryForContact.shippingCompanyName || latestEntryForContact.companyName || '');
          form.setValue('shippingAddress', latestEntryForContact.shippingAddress || latestEntryForContact.address);
          form.setValue('shippingContact', latestEntryForContact.shippingContact || latestEntryForContact.contact);
          form.setValue('shippingGstin', latestEntryForContact.shippingGstin || latestEntryForContact.gstin || '');
          form.setValue('shippingStateName', latestEntryForContact.shippingStateName || latestEntryForContact.stateName || '');
          form.setValue('shippingStateCode', latestEntryForContact.shippingStateCode || latestEntryForContact.stateCode || '');
          toast({ title: "Customer Found: Details auto-filled from last entry." });
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!id) {
      toast({ title: "Cannot delete: invalid ID.", variant: "destructive" });
      return;
    }
    
    // Check if it's a kanta parchi entry
    const kantaParchiToDelete = allKantaParchi.find(kp => (kp.id || kp.srNo) === id);
    if (kantaParchiToDelete) {
      try {
        await deleteKantaParchi(kantaParchiToDelete.srNo);
        setAllKantaParchi(prev => prev.filter(kp => (kp.id || kp.srNo) !== id));
        toast({ title: "Kanta Parchi deleted successfully.", variant: "success" });
        if (currentKantaParchi && (currentKantaParchi.id || currentKantaParchi.srNo) === id) {
          handleNewKantaParchi();
        }
        return;
      } catch (error) {
        console.error("Error deleting Kanta Parchi:", error);
        toast({ title: "Failed to delete Kanta Parchi.", variant: "destructive" });
        return;
      }
    }
    
    // Otherwise, delete regular customer entry
    try {
      const customerToDelete = safeCustomers.find(c => c.id === id);
      await deleteCustomer(id);
      if (customerToDelete) {
        await deleteCustomerPaymentsForSrNo(customerToDelete.srNo);
      }
      setCustomers(prev => prev.filter(c => c.id !== id));
      toast({ title: "Entry and payments deleted.", variant: "success" });
      if (currentCustomer.id === id) {
        handleNew();
      }
    } catch (error) {
      console.error("Error deleting customer and payments: ", error);
      toast({ title: "Failed to delete entry.", variant: "destructive" });
    }
  };

  // Handle New Kanta Parchi - Reset form for new entry
  const handleNewKantaParchi = useCallback(() => {
    setIsEditingKantaParchi(false);
    setCurrentKantaParchi(null);
    
    // Generate next srNo from allKantaParchi
    let nextSrNum = 1;
    if (allKantaParchi.length > 0) {
      const sortedKantaParchi = [...allKantaParchi].sort((a, b) => {
        // Extract number from srNo (assuming format like C0001 or KP0001)
        const numA = parseInt(a.srNo.replace(/[^\d]/g, '')) || 0;
        const numB = parseInt(b.srNo.replace(/[^\d]/g, '')) || 0;
        return numB - numA; // Sort descending
      });
      const lastSrNo = sortedKantaParchi[0]?.srNo || 'C00000';
      const lastNum = parseInt(lastSrNo.replace(/[^\d]/g, '')) || 0;
      nextSrNum = lastNum + 1;
    }
    
    const newState = getInitialFormState(lastVariety, lastPaymentType);
    newState.srNo = formatSrNo(nextSrNum, 'C');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    newState.date = today.toISOString().split('T')[0];
    newState.dueDate = today.toISOString().split('T')[0];
    
    resetFormToState(newState);
    setTimeout(() => form.setFocus('srNo'), 50);
  }, [allKantaParchi, lastVariety, lastPaymentType, resetFormToState, form]);

  // Save Kanta Parchi (Weight Details tab)
  const saveKantaParchi = async () => {
    const formValues = form.getValues();
    const calculated = calculateCustomerEntry(formValues, paymentHistory);
    
    const kantaParchiData: KantaParchi = {
      id: formValues.srNo,
      srNo: formValues.srNo,
      date: formValues.date.toISOString().split('T')[0],
      name: toTitleCase(formValues.name),
      contact: formValues.contact,
      vehicleNo: toTitleCase(formValues.vehicleNo),
      variety: toTitleCase(formValues.variety),
      grossWeight: formValues.grossWeight,
      teirWeight: formValues.teirWeight,
      weight: calculated.weight || 0,
      netWeight: calculated.netWeight || 0,
      rate: formValues.rate,
      bags: formValues.bags,
      bagWeightKg: formValues.bagWeightKg,
      bagRate: formValues.bagRate,
      bagAmount: calculated.bagAmount || 0,
      amount: calculated.amount || 0,
      cdRate: formValues.cd || 0,
      cdAmount: calculated.cd || 0,
      brokerageRate: formValues.brokerage || 0,
      brokerageAmount: calculated.brokerage || 0,
      isBrokerageIncluded: formValues.isBrokerageIncluded,
      kanta: formValues.kanta,
      advanceFreight: formValues.advanceFreight || 0,
      originalNetAmount: calculated.originalNetAmount || 0,
      netAmount: calculated.netAmount || 0,
      paymentType: formValues.paymentType,
      customerId: `${toTitleCase(formValues.name).toLowerCase()}|${formValues.contact.toLowerCase()}`,
    };

    try {
      if (isEditingKantaParchi && currentKantaParchi) {
        await updateKantaParchi(currentKantaParchi.srNo, kantaParchiData);
        toast({ title: "Kanta Parchi updated successfully.", variant: "success" });
      } else {
        await addKantaParchi(kantaParchiData);
        toast({ title: "Kanta Parchi saved successfully.", variant: "success" });
      }
      setCurrentKantaParchi(kantaParchiData);
      setIsEditingKantaParchi(true);
    } catch (error) {
      console.error("Error saving Kanta Parchi:", error);
      toast({ title: "Failed to save Kanta Parchi.", variant: "destructive" });
    }
  };

  // Save Customer Document (Create Document tab) - References Kanta Parchi srNo
  const saveCustomerDocument = async (docType: DocumentType = 'tax-invoice') => {
    const formValues = form.getValues();
    
    // Validate that Kanta Parchi is selected
    if (!selectedKantaParchiSrNo || !currentKantaParchi) {
      toast({ 
        title: "Kanta Parchi Required", 
        description: "Please select a Kanta Parchi before creating document.",
        variant: "destructive" 
      });
      return;
    }

    const calculated = calculateCustomerEntry(formValues, paymentHistory);
    
    // Calculate tax amounts
    const tableTotalAmount = (calculated.netWeight || 0) * formValues.rate;
    const taxRate = formValues.taxRate || 5;
    const isGstIncluded = formValues.isGstIncluded || false;
    
    let taxableAmount: number;
    let totalTaxAmount: number;
    let totalInvoiceValue: number;

    if (isGstIncluded) {
      taxableAmount = tableTotalAmount / (1 + (taxRate / 100));
      totalTaxAmount = tableTotalAmount - taxableAmount;
      totalInvoiceValue = tableTotalAmount + (formValues.advanceFreight || 0);
    } else {
      taxableAmount = tableTotalAmount;
      totalTaxAmount = taxableAmount * (taxRate / 100);
      totalInvoiceValue = taxableAmount + totalTaxAmount + (formValues.advanceFreight || 0);
    }

    const cgstAmount = totalTaxAmount / 2;
    const sgstAmount = totalTaxAmount / 2;

    // Generate document serial number
    const documentSrNo = currentDocument?.documentSrNo || `DOC${Date.now()}`;

    const documentData: CustomerDocument = {
      id: documentSrNo,
      documentSrNo: documentSrNo,
      kantaParchiSrNo: selectedKantaParchiSrNo, // Reference to selected Kanta Parchi
      documentType: docType,
      date: formValues.date.toISOString().split('T')[0],
      name: toTitleCase(formValues.name),
      companyName: toTitleCase(formValues.companyName || ''),
      address: toTitleCase(formValues.address),
      contact: formValues.contact,
      gstin: formValues.gstin || '',
      stateName: formValues.stateName || '',
      stateCode: formValues.stateCode || '',
      hsnCode: formValues.hsnCode || '1006',
      taxRate: taxRate,
      isGstIncluded: isGstIncluded,
      nineRNo: formValues.nineRNo || '',
      gatePassNo: formValues.gatePassNo || '',
      grNo: formValues.grNo || '',
      grDate: formValues.grDate || '',
      transport: formValues.transport || '',
      shippingName: toTitleCase(formValues.shippingName || ''),
      shippingCompanyName: toTitleCase(formValues.shippingCompanyName || ''),
      shippingAddress: toTitleCase(formValues.shippingAddress || ''),
      shippingContact: formValues.shippingContact || '',
      shippingGstin: formValues.shippingGstin || '',
      shippingStateName: formValues.shippingStateName || '',
      shippingStateCode: formValues.shippingStateCode || '',
      netWeight: calculated.netWeight || 0,
      rate: formValues.rate,
      amount: calculated.amount || 0,
      cdAmount: calculated.cd || 0,
      brokerageAmount: calculated.brokerage || 0,
      kanta: formValues.kanta,
      bagAmount: calculated.bagAmount || 0,
      advanceFreight: formValues.advanceFreight || 0,
      taxableAmount: taxableAmount,
      cgstAmount: cgstAmount,
      sgstAmount: sgstAmount,
      totalTaxAmount: totalTaxAmount,
      totalInvoiceValue: totalInvoiceValue,
    };

    try {
      if (isEditingDocument && currentDocument) {
        await updateCustomerDocument(currentDocument.documentSrNo, documentData);
        toast({ title: "Document updated successfully.", variant: "success" });
      } else {
        await addCustomerDocument(documentData);
        toast({ title: "Document saved successfully.", variant: "success" });
      }
      setCurrentDocument(documentData);
      setIsEditingDocument(true);
    } catch (error) {
      console.error("Error saving Customer Document:", error);
      toast({ title: "Failed to save document.", variant: "destructive" });
    }
  };

  const executeSubmit = async (deletePayments: boolean = false, callback?: (savedEntry: Customer) => void) => {
    const formValues = form.getValues();
    
    const dataToSave: Omit<Customer, 'id'> = {
        ...currentCustomer,
        srNo: formValues.srNo,
        date: formValues.date.toISOString().split('T')[0],
        term: '0', 
        dueDate: formValues.date.toISOString().split('T')[0],
        name: toTitleCase(formValues.name),
        companyName: toTitleCase(formValues.companyName || ''),
        address: toTitleCase(formValues.address),
        contact: formValues.contact,
        gstin: formValues.gstin,
        stateName: formValues.stateName,
        stateCode: formValues.stateCode,
        vehicleNo: toTitleCase(formValues.vehicleNo),
        variety: toTitleCase(formValues.variety),
        paymentType: formValues.paymentType,
        customerId: `${toTitleCase(formValues.name).toLowerCase()}|${formValues.contact.toLowerCase()}`,
        grossWeight: formValues.grossWeight,
        teirWeight: formValues.teirWeight,
        rate: formValues.rate,
        bags: formValues.bags,
        bagWeightKg: formValues.bagWeightKg,
        bagRate: formValues.bagRate,
        kanta: formValues.kanta,
        isBrokerageIncluded: formValues.isBrokerageIncluded,
        shippingName: toTitleCase(formValues.shippingName || ''),
        shippingCompanyName: toTitleCase(formValues.shippingCompanyName || ''),
        shippingAddress: toTitleCase(formValues.shippingAddress || ''),
        shippingContact: formValues.shippingContact || '',
        shippingGstin: formValues.shippingGstin || '',
        shippingStateName: formValues.shippingStateName || '',
        shippingStateCode: formValues.shippingStateCode || '',
        advanceFreight: formValues.advanceFreight || 0,
        hsnCode: formValues.hsnCode || '',
        taxRate: formValues.taxRate || 5,
        isGstIncluded: formValues.isGstIncluded || false,
        nineRNo: formValues.nineRNo || '',
        gatePassNo: formValues.gatePassNo || '',
        grNo: formValues.grNo || '',
        grDate: formValues.grDate || '',
        transport: formValues.transport || '',
        cdRate: formValues.cd || 0, // Save CD percentage as cdRate
        brokerageRate: formValues.brokerage || 0, // Save brokerage percentage as brokerageRate
        so: '',
        kartaPercentage: 0,
        kartaWeight: 0,
        kartaAmount: 0,
        labouryRate: 0,
        labouryAmount: 0,
        barcode: '',
        receiptType: 'Cash'
    };
    
    try {
        if (isEditing && currentCustomer.id && currentCustomer.id !== dataToSave.srNo) {
            await deleteCustomer(currentCustomer.id);
            setCustomers(prev => prev.filter(c => c.id !== currentCustomer.id));
        }
        
        if (deletePayments) {
            await deleteCustomerPaymentsForSrNo(dataToSave.srNo!);
            const entryWithRestoredAmount = { ...dataToSave, netAmount: dataToSave.originalNetAmount, id: dataToSave.srNo };
            const savedEntry = await addCustomer(entryWithRestoredAmount as Customer);
            setCustomers(prev => {
                const existingIndex = prev.findIndex(c => c.id === savedEntry.id);
                if (existingIndex > -1) {
                    const newCustomers = [...prev];
                    newCustomers[existingIndex] = savedEntry;
                    return newCustomers;
                }
                return [savedEntry, ...prev].sort((a,b) => b.srNo.localeCompare(a.srNo));
            });
            toast({ title: "Entry updated, payments deleted.", variant: "success" });
            if (callback) callback(entryWithRestoredAmount as Customer); else handleNew();
        } else {
            const entryToSave = { ...dataToSave, id: dataToSave.srNo };
            const savedEntry = await addCustomer(entryToSave as Customer);
            setCustomers(prev => {
                const existingIndex = prev.findIndex(c => c.id === savedEntry.id);
                if (existingIndex > -1) {
                    const newCustomers = [...prev];
                    newCustomers[existingIndex] = savedEntry;
                    return newCustomers;
                }
                return [savedEntry, ...prev].sort((a,b) => b.srNo.localeCompare(a.srNo));
            });
            toast({ title: `Entry ${isEditing ? 'updated' : 'saved'} successfully.`, variant: "success" });
            if (callback) callback(savedEntry as Customer); else handleNew();
        }
    } catch (error) {
        console.error("Error saving customer:", error);
        toast({ title: "Failed to save entry.", variant: "destructive" });
    }
  };

  const onSubmit = async (callback?: (savedEntry: Customer) => void) => {
    const formValues = form.getValues();
    const isValid = await form.trigger();
    
    if (!isValid) {
      toast({ title: "Invalid Form", description: "Please check for errors.", variant: "destructive" });
      return;
    }

    // Based on active tab, save to appropriate collection
    if (activeTab === "weight") {
      // Save Kanta Parchi
      await saveKantaParchi();
      if (callback) {
        // Convert Kanta Parchi to Customer format for callback compatibility
        const customerFormat = {
          ...currentCustomer,
          srNo: formValues.srNo,
          date: formValues.date.toISOString().split('T')[0],
          name: toTitleCase(formValues.name),
          contact: formValues.contact,
        } as Customer;
        callback(customerFormat);
      }
    } else if (activeTab === "document") {
      // Save Customer Document
      await saveCustomerDocument('tax-invoice');
      if (callback && currentDocument) {
        // Convert Document to Customer format for callback compatibility
        const customerFormat = {
          ...currentCustomer,
          srNo: currentDocument.kantaParchiSrNo,
          name: currentDocument.name,
          contact: currentDocument.contact,
        } as Customer;
        callback(customerFormat);
      }
    }
  };

  const handleSaveAndPrint = async (docType: DocumentType) => {
    const formValues = form.getValues();
    const isValid = await form.trigger();
    
    if (!isValid) {
      toast({ title: "Invalid Form", description: "Please check for errors.", variant: "destructive" });
      return;
    }

    // If on Create Document tab, save document first
    if (activeTab === "document") {
      // Ensure Kanta Parchi exists
      if (!currentKantaParchi && !formValues.srNo) {
        toast({ 
          title: "Kanta Parchi Required", 
          description: "Please save Kanta Parchi first before creating document.",
          variant: "destructive" 
        });
        return;
      }
      
      // If Kanta Parchi not saved yet, save it first
      if (!currentKantaParchi) {
        await saveKantaParchi();
      }
      
      // Save document with specified type
      await saveCustomerDocument(docType);
      
      // Load document data for preview
      if (currentDocument) {
        setDocumentPreviewCustomer({
          ...currentCustomer,
          ...currentDocument,
          srNo: currentDocument.kantaParchiSrNo,
        } as Customer);
        setDocumentType(docType);
        setIsDocumentPreviewOpen(true);
      }
    } else {
      // If on Weight Details tab, save Kanta Parchi and show preview
      await saveKantaParchi();
      if (currentKantaParchi) {
        setDocumentPreviewCustomer({
          ...currentCustomer,
          ...currentKantaParchi,
        } as Customer);
        setDocumentType(docType);
        setIsDocumentPreviewOpen(true);
      }
    }
  };
  
  const handleShowDetails = (customer: Customer) => {
    setDetailsCustomer(customer);
  };

  const handlePrint = (entriesToPrint: Customer[]) => {
    if (!entriesToPrint || entriesToPrint.length === 0) {
        toast({ title: "No entries selected to print.", variant: "destructive" });
        return;
    }

    if (entriesToPrint.length === 1) {
        setReceiptsToPrint(entriesToPrint);
        setConsolidatedReceiptData(null);
    } else {
        const firstCustomerId = entriesToPrint[0].customerId;
        const allSameCustomer = entriesToPrint.every(e => e.customerId === firstCustomerId);

        if (!allSameCustomer) {
            toast({ title: "Consolidated receipts are for a single customer.", variant: "destructive" });
            return;
        }
        
        const customer = entriesToPrint[0];
        const totalAmount = entriesToPrint.reduce((sum, entry) => sum + (Number(entry.netAmount) || 0), 0);
        
        setConsolidatedReceiptData({
            supplier: { 
                name: customer.name,
                so: customer.so,
                address: customer.address,
                contact: customer.contact,
            },
            entries: entriesToPrint,
            totalAmount: totalAmount,
            date: format(new Date(), "dd-MMM-yy"),
        });
        setReceiptsToPrint([]);
    }
  };

  const handleOpenPrintPreview = (customer: Customer) => {
    setDocumentPreviewCustomer(customer);
    setDocumentType('tax-invoice'); 
    setIsDocumentPreviewOpen(true);
  };

    const handleExport = () => {
        if (!customers) return;
        const dataToExport = customers.map(c => ({
            srNo: c.srNo,
            date: c.date,
            name: c.name,
            companyName: c.companyName,
            address: c.address,
            contact: c.contact,
            gstin: c.gstin,
            vehicleNo: c.vehicleNo,
            variety: c.variety,
            grossWeight: c.grossWeight,
            teirWeight: c.teirWeight,
            rate: c.rate,
            bags: c.bags,
            bagWeightKg: c.bagWeightKg,
            bagRate: c.bagRate,
            kanta: c.kanta,
            cd: c.cd,
            brokerage: c.brokerage,
            isBrokerageIncluded: c.isBrokerageIncluded,
            paymentType: c.paymentType,
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");
        XLSX.writeFile(workbook, "CustomerEntries.xlsx");
        toast({title: "Exported", description: "Customer data has been exported."});
    }

    const handleImport = () => {
        setIsImportDialogOpen(true);
    };

  const handleKeyboardShortcuts = useCallback((event: KeyboardEvent) => {
    if (event.ctrlKey) {
        switch (event.key.toLowerCase()) {
            case 's':
                event.preventDefault();
                form.handleSubmit(() => onSubmit())();
                break;
            case 'p':
                event.preventDefault();
                handleSaveAndPrint('tax-invoice'); // Default to tax-invoice
                break;
            case 'n':
                event.preventDefault();
                handleNew();
                break;
            case 'd':
                event.preventDefault();
                if (isEditing && currentCustomer.id) {
                    handleDelete(currentCustomer.id);
                }
                break;
        }
    }
  }, [form, onSubmit, handleSaveAndPrint, handleNew, isEditing, currentCustomer]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcuts);
    return () => {
        document.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, [handleKeyboardShortcuts]);

  if (!isClient) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <p className="text-muted-foreground flex items-center"><Hourglass className="w-5 h-5 mr-2 animate-spin"/>Loading data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(() => onSubmit())} className="space-y-4">
            <CustomerForm 
                form={form}
                handleSrNoBlur={handleSrNoBlur}
                handleContactBlur={handleContactBlur}
                varietyOptions={varietyOptions}
                paymentTypeOptions={paymentTypeOptions}
                setLastVariety={handleSetLastVariety}
                setLastPaymentType={handleSetLastPaymentType}
                handleAddOption={addOption}
                handleUpdateOption={updateOption}
                handleDeleteOption={deleteOption}
                allCustomers={safeCustomers}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                allKantaParchi={allKantaParchi}
                selectedKantaParchiSrNo={selectedKantaParchiSrNo}
                onKantaParchiSelect={setSelectedKantaParchiSrNo}
                onNewKantaParchi={handleNewKantaParchi}
                documentType={documentType}
                onDocumentTypeChange={setDocumentType}
                receiptSettings={receiptSettings}
            />
            
            <CalculatedSummary
                customer={currentCustomer}
                onSave={() => form.handleSubmit(() => onSubmit())()}
                onSaveAndPrint={handleSaveAndPrint}
                isEditing={isEditing}
                isCustomerForm={true}
                isBrokerageIncluded={form.watch('isBrokerageIncluded')}
                onBrokerageToggle={(checked: boolean) => form.setValue('isBrokerageIncluded', checked)}
                onImport={handleImport}
                onExport={handleExport}
                activeTab={activeTab}
            />
        </form>
      </FormProvider>      
      
      <EntryTable
        entries={filteredCustomers} 
        onEdit={handleEdit} 
        onDelete={handleDelete} 
        onShowDetails={handleShowDetails}
        onPrint={handlePrint}
        selectedIds={selectedCustomerIds}
        onSelectionChange={setSelectedCustomerIds}
        entryType="Customer"
        onPrintRow={(entry: Customer) => handlePrint([entry])}
      />
      {hasMoreCustomers && (
        <div className="text-center">
            <Button onClick={loadMoreData} disabled={isLoadingMore}>
                {isLoadingMore ? "Loading..." : "Load More"}
            </Button>
        </div>
       )}

      <CustomerDetailsDialog
        customer={detailsCustomer}
        onOpenChange={() => setDetailsCustomer(null)}
        onPrint={handleOpenPrintPreview}
        paymentHistory={paymentHistory}
      />
        
      <DocumentPreviewDialog
        isOpen={isDocumentPreviewOpen}
        setIsOpen={setIsDocumentPreviewOpen}
        customer={documentPreviewCustomer}
        documentType={documentType}
        setDocumentType={setDocumentType}
        receiptSettings={receiptSettings}
      />
      
       <ReceiptPrintDialog
        receipts={receiptsToPrint}
        settings={receiptSettings}
        onOpenChange={() => setReceiptsToPrint([])}
        isCustomer={true}
      />
      
      <ConsolidatedReceiptPrintDialog
        data={consolidatedReceiptData}
        settings={receiptSettings}
        onOpenChange={() => setConsolidatedReceiptData(null)}
        isCustomer={true}
      />

      <UpdateConfirmDialog
        isOpen={isUpdateConfirmOpen}
        onOpenChange={setIsUpdateConfirmOpen}
        onConfirm={(deletePayments) => {
            if(updateAction) {
                updateAction(deletePayments);
            }
        }}
      />

      <CustomerImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImportComplete={() => {
          // Refresh data after import
          loadInitialData();
        }}
        existingKantaParchiSrNos={allKantaParchi.map(kp => kp.srNo)}
        existingDocumentSrNos={[]} // TODO: Get existing document srNos if needed
      />
    </div>
  );
}
