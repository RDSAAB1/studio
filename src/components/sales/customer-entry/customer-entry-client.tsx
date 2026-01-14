
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Customer, CustomerPayment, OptionItem, ReceiptSettings, DocumentType, ConsolidatedReceiptData, CustomerDocument } from "@/lib/definitions";
import { formatSrNo, toTitleCase, formatCurrency, calculateCustomerEntry, formatDateLocal } from "@/lib/utils";

import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { addCustomer, updateCustomer, deleteCustomer, bulkUpsertCustomers, getOptionsRealtime, addOption, updateOption, deleteOption, updateReceiptSettings, deleteCustomerPaymentsForSrNo, addCustomerDocument, updateCustomerDocument, deleteCustomerDocument } from "@/lib/firestore";
import { useGlobalData } from '@/contexts/global-data-context';
import { format } from "date-fns";

import { CustomerForm } from "@/components/sales/customer-form";
import { CalculatedSummary } from "@/components/sales/calculated-summary";
import { EntryTable } from "@/components/sales/entry-table";
import { CustomerEntryDialogs } from "./components/customer-entry-dialogs";
import { useCustomerImportExport } from "./hooks/use-customer-import-export";


export const formSchema = z.object({
    srNo: z.string().optional().or(z.literal('')),
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
    kartaPercentage: z.coerce.number().min(0),
    cd: z.coerce.number().min(0),
    cdAmount: z.coerce.number().min(0).optional(),
    brokerage: z.coerce.number().min(0),
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
    hsnCode: z.string().optional(),
    taxRate: z.coerce.number().optional(),
    isGstIncluded: z.boolean().optional(),
    nineRNo: z.string().optional(),
    gatePassNo: z.string().optional(),
    grNo: z.string().optional(),
    grDate: z.string().optional(),
    transport: z.string().optional(),
    transportationRate: z.coerce.number().min(0).default(0),
    baseReport: z.coerce.number().min(0).optional(),
    collectedReport: z.coerce.number().min(0).optional(),
    riceBranGst: z.coerce.number().min(0).optional(),
});

export type FormValues = z.infer<typeof formSchema>;

const getInitialFormState = (lastVariety?: string, lastPaymentType?: string): Customer => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateStr = formatDateLocal(today);
  
  // Set default values for RICE BRAN
  const isRiceBran = (lastVariety || '').toUpperCase().trim() === 'RICE BRAN';
  const defaultBaseReport = isRiceBran ? 15 : 0;
  const defaultRiceBranGst = isRiceBran ? 5 : 0;
  const defaultBagWeightKg = isRiceBran ? 0.2 : 0;

  return {
    id: "", srNo: 'C----', date: dateStr, term: '0', dueDate: dateStr, 
    name: '', companyName: '', address: '', contact: '', gstin: '', stateName: '', stateCode: '', vehicleNo: '', variety: lastVariety || '', grossWeight: 0, teirWeight: 0,
    weight: 0, rate: 0, amount: 0, bags: 0, bagWeightKg: defaultBagWeightKg, bagRate: 0, bagAmount: 0,
    brokerage: 0, brokerageRate: 0, cd: 0, cdRate: 0, isBrokerageIncluded: false,
    netWeight: 0, originalNetAmount: 0, netAmount: 0, barcode: '',
    receiptType: 'Cash', paymentType: lastPaymentType || 'Full', customerId: '',
    so: '', kartaPercentage: 0, kartaWeight: 0, kartaAmount: 0, labouryRate: 0, labouryAmount: 0,
    transportationRate: 0, transportAmount: 0, cdAmount: 0,
    baseReport: defaultBaseReport, collectedReport: 0, riceBranGst: defaultRiceBranGst, calculatedRate: 0,
  };
};

export default function CustomerEntryClient() {
  const { toast } = useToast();
  // Use global context for receipt settings (customers and payment history are managed via pagination for now)
  const globalData = useGlobalData();
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [paymentHistory, setPaymentHistory] = useState<CustomerPayment[]>([]);

  const [currentCustomer, setCurrentCustomer] = useState<Customer>(() => getInitialFormState());
  const [isEditing, setIsEditing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  // NO LOADING STATES - Data loads initially, then only CRUD updates
  
  const [detailsCustomer, setDetailsCustomer] = useState<Customer | null>(null);
  const [documentPreviewCustomer, setDocumentPreviewCustomer] = useState<Customer | null>(null);
  const [receiptsToPrint, setReceiptsToPrint] = useState<Customer[]>([]);
  const [consolidatedReceiptData, setConsolidatedReceiptData] = useState<ConsolidatedReceiptData | null>(null);
  const [isDocumentPreviewOpen, setIsDocumentPreviewOpen] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>('tax-invoice');

  const [varietyOptions, setVarietyOptions] = useState<OptionItem[]>([]);
  const [paymentTypeOptions, setPaymentTypeOptions] = useState<OptionItem[]>([]);
  const [lastVariety, setLastVariety] = useState<string>('');
  const [lastPaymentType, setLastPaymentType] = useState<string>('');

  // Use receipt settings from global context
  const receiptSettings = globalData.receiptSettings;
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);
  const [updateAction, setUpdateAction] = useState<((deletePayments: boolean) => void) | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 10);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [highlightEntryId, setHighlightEntryId] = useState<string | null>(null);

  // Import/Export hook
  const {
    handleImport,
    handleExport,
    isImporting,
    importProgress,
    importStatus,
    importCurrent,
    importTotal,
    importStartTime,
  } = useCustomerImportExport({
    customers,
    paymentHistory,
    setCustomers,
  });

  const safeCustomers = useMemo(() => Array.isArray(customers) ? customers : [], [customers]);
  
  // Pre-index customers for faster search
  const indexedCustomers = useMemo(() => {
    return safeCustomers.map(customer => ({
      ...customer,
      searchIndex: [
        customer.name?.toLowerCase() || '',
        customer.contact || '',
        customer.srNo?.toLowerCase() || '',
        customer.companyName?.toLowerCase() || '',
        customer.address?.toLowerCase() || ''
      ].join(' ')
    }));
  }, [safeCustomers]);
  
  // Search result cache
  const searchCache = useRef(new Map<string, any[]>());
  
  // Clear cache when customers change
  useEffect(() => {
    searchCache.current.clear();
  }, [safeCustomers]);
  
  const filteredCustomers = useMemo(() => {
    // Immediate return for empty search - no processing needed
    if (!debouncedSearchTerm || !debouncedSearchTerm.trim()) {
      return safeCustomers;
    }
    
    const filter = debouncedSearchTerm.trim().toLowerCase();
    
    // Check cache first
    if (searchCache.current.has(filter)) {
      return searchCache.current.get(filter) || [];
    }
    
    // Use indexed search for faster filtering
    const results = indexedCustomers.filter(customer => 
      customer.searchIndex.includes(filter)
    );
    
    // Cache the results (limit cache size to prevent memory issues)
    if (searchCache.current.size < 50) {
      searchCache.current.set(filter, results);
    }
    
    return results;
  }, [safeCustomers, indexedCustomers, debouncedSearchTerm]);


  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getInitialFormState(lastVariety, lastPaymentType),
    shouldFocusError: false,
  });
  
  // Restore form state from localStorage after form is initialized
  useEffect(() => {
    if (!isClient) return;
    
    try {
      const saved = localStorage.getItem('customer-entry-form-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only restore if form has meaningful data
        if (parsed.name || parsed.srNo || parsed.variety || (parsed.grossWeight && parsed.grossWeight > 0)) {
          // Convert date string back to Date object
          if (parsed.date) {
            parsed.date = new Date(parsed.date);
          }
          // Restore form values
          Object.keys(parsed).forEach(key => {
            form.setValue(key as any, parsed[key], { shouldValidate: false });
          });
        }
      }
    } catch (error) {

    }
  }, [isClient, form]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsClient(true);
    }
  }, []);

  // Use global data context - NO duplicate listeners
  useEffect(() => {
    if (!isClient) return;
    // Sync customers from global context (which has real-time listener)
    setCustomers(globalData.customers);
    setPaymentHistory(globalData.customerPayments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, globalData.customers, globalData.customerPayments]);

  useEffect(() => {
    if (!isClient) return;

    // ✅ Global context handles customers and customerPayments realtime listeners - no duplicate listeners needed
    // Receipt settings are also provided by global context

    const unsubVarieties = getOptionsRealtime('varieties', setVarietyOptions, (err) => ("Error fetching varieties:", err));
    const unsubPaymentTypes = getOptionsRealtime('paymentTypes', setPaymentTypeOptions, (err) => ("Error fetching payment types:", err));

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
  };

  const handleSetLastPaymentType = (paymentType: string) => {
    setLastPaymentType(paymentType);
    if(isClient) {
        localStorage.setItem('lastSelectedPaymentType', paymentType);
    }
  };

  const performCalculations = useCallback((data: Partial<FormValues>) => {
    const calculatedState = calculateCustomerEntry(data, paymentHistory);
    setCurrentCustomer(prev => ({...prev, ...calculatedState}));
  }, [paymentHistory]);
  
  useEffect(() => {
    let saveTimer: NodeJS.Timeout;
    
    const subscription = form.watch((value) => {
        // Debounced save to localStorage (save after 500ms of no changes)
        if (typeof window !== 'undefined') {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
                try {
                    // Only save if form has meaningful data (not empty)
                    if (value.name || value.srNo || value.variety || (value.grossWeight && value.grossWeight > 0)) {
                        localStorage.setItem('customer-entry-form-state', JSON.stringify(value));
                    }
                } catch (error) {

                }
            }, 500);
        }
        
        performCalculations(value as Partial<FormValues>);
    });
    
    return () => {
        subscription.unsubscribe();
        clearTimeout(saveTimer);
    };
    // Only re-subscribe if form instance changes (rare)
    // performCalculations callback already handles paymentHistory updates internally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);


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
      kartaPercentage: customerState.kartaPercentage || 0,
      // For CD: prioritize cdRate (percentage), if not available and we have cd (amount) and amount, calculate percentage
      cd: customerState.cdRate !== undefined && customerState.cdRate !== null 
        ? customerState.cdRate 
        : (customerState.cd && customerState.amount && customerState.amount > 0 
          ? (customerState.cd / customerState.amount) * 100 
          : 0),
      cdAmount: (customerState as any).cdAmount || (customerState.cd || 0),
      // For Brokerage: prioritize brokerageRate (rate), if not available and we have brokerage (amount) and netWeight, calculate rate
      brokerage: customerState.brokerageRate !== undefined && customerState.brokerageRate !== null
        ? customerState.brokerageRate
        : (customerState.brokerage && customerState.netWeight && customerState.netWeight > 0
          ? customerState.brokerage / customerState.netWeight
          : 0),
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
      transportationRate: (customerState as any).transportationRate || 0,
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
      baseReport: customerState.baseReport || 0,
      collectedReport: customerState.collectedReport || 0,
      riceBranGst: customerState.riceBranGst || 0,
    };
    setCurrentCustomer(customerState);
    form.reset(formValues);
    performCalculations(formValues);
  }, [form, performCalculations]);

  const handleNew = useCallback(() => {
    setIsEditing(false);
    let nextSrNum = 1;
    if (safeCustomers.length > 0) {
        // Find highest SR No (same logic as executeSubmit)
        const maxSrNo = safeCustomers.reduce((max, c) => {
            const num = parseInt(c.srNo.substring(1)) || 0;
            return num > max ? num : max;
        }, 0);
        nextSrNum = maxSrNo + 1;
    }
    const newState = getInitialFormState(lastVariety, lastPaymentType);
    newState.srNo = formatSrNo(nextSrNum, 'C');
    const today = new Date();
    today.setHours(0,0,0,0);
    newState.date = formatDateLocal(today);
    newState.dueDate = formatDateLocal(today);
    resetFormToState(newState);
    // Clear saved form state when creating new entry
    if (typeof window !== 'undefined') {
        localStorage.removeItem('customer-entry-form-state');
    }
    
    // Set default values for RICE BRAN after form reset
    setTimeout(() => {
        const currentVariety = form.getValues('variety') || lastVariety || '';
        const isRiceBran = currentVariety.toUpperCase().trim() === 'RICE BRAN';
        
        if (isRiceBran) {
            form.setValue('baseReport', 15, { shouldValidate: false, shouldDirty: false });
            form.setValue('riceBranGst', 5, { shouldValidate: false, shouldDirty: false });
            form.setValue('bagWeightKg', 0.2, { shouldValidate: false, shouldDirty: false });
        }
        
        form.setFocus('srNo');
    }, 100);
}, [safeCustomers, lastVariety, lastPaymentType, resetFormToState, form]);

  const handleSrNoBlur = (srNoValue: string) => {
    let formattedSrNo = srNoValue.trim();
    // Skip processing if it's the placeholder 'C----' or empty
    if (formattedSrNo === 'C----' || formattedSrNo === '' || formattedSrNo === 'C') {
        return;
    }
    // If it's just a number, format it
    if (formattedSrNo && !isNaN(parseInt(formattedSrNo)) && isFinite(Number(formattedSrNo))) {
        formattedSrNo = formatSrNo(parseInt(formattedSrNo), 'C');
        form.setValue('srNo', formattedSrNo);
    }
    // If it already starts with 'C' and has numbers, use it as is
    else if (formattedSrNo.startsWith('C') && formattedSrNo.length > 1) {
        const numPart = formattedSrNo.substring(1);
        if (!isNaN(parseInt(numPart)) && isFinite(Number(numPart))) {
            // Already formatted, just use it
            form.setValue('srNo', formattedSrNo);
        }
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
          // Removed unnecessary toast message
      }
    }
  }

  const handleDeleteCurrent = async () => {
    if (!currentCustomer.id) {
      toast({ title: "Cannot delete: no entry selected.", variant: "destructive" });
      return;
    }
    
    const id = currentCustomer.id;
    // Optimistic delete - update UI immediately
    setCustomers(prev => prev.filter(c => c.id !== id));
    handleNew();
    toast({ title: "Entry and payments deleted.", variant: "success" });
    
    // Delete in background (non-blocking)
    setTimeout(() => {
      (async () => {
        try {
          await deleteCustomer(id);
          if (currentCustomer.srNo) {
            await deleteCustomerPaymentsForSrNo(currentCustomer.srNo);
          }
        } catch (error) {
          toast({ title: "Failed to delete entry.", variant: "destructive" });
        }
      })();
    }, 0);
  };

  const handleEdit = (id: string) => {
    const customerToEdit = safeCustomers.find(c => c.id === id);
    if (customerToEdit) {
      setIsEditing(true);
      resetFormToState(customerToEdit);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!id) {
      toast({ title: "Cannot delete: invalid ID.", variant: "destructive" });
      return;
    }
    
    // Optimistic delete - update UI immediately
    const customerToDelete = customers.find(c => c.id === id);
    setCustomers(prev => prev.filter(c => c.id !== id));
    if (currentCustomer.id === id) {
      handleNew();
    }
    
    // Delete in background (non-blocking)
    (async () => {
      try {
        await Promise.all([
          deleteCustomer(id),
          customerToDelete ? deleteCustomerPaymentsForSrNo(customerToDelete.srNo) : Promise.resolve()
        ]);
      } catch (error) {
        // Revert on error
        if (customerToDelete) {
          setCustomers(prev => [...prev, customerToDelete].sort((a, b) => b.srNo.localeCompare(a.srNo)));
        }
        toast({ title: "Failed to delete entry.", variant: "destructive" });
      }
    })();
  };

  const handleShowDetails = (customer: Customer) => {
    setDetailsCustomer(customer);
  };

  const handleSinglePrint = (entry: Customer) => {
    setReceiptsToPrint([entry]);
    setConsolidatedReceiptData(null);
  };


  const executeSubmit = async (deletePayments: boolean = false, callback?: (savedEntry: Customer) => void) => {
    const formValues = form.getValues();
    
    // Auto-generate SR No if missing or invalid (optimized - no sort)
    let srNo = formValues.srNo?.trim();
    if (!srNo || srNo === 'C----' || srNo === '') {
      // Generate next SR No (use max instead of sort for better performance)
      let nextSrNum = 1;
      if (safeCustomers.length > 0) {
        const maxSrNo = safeCustomers.reduce((max, c) => {
          const num = parseInt(c.srNo.substring(1)) || 0;
          return num > max ? num : max;
        }, 0);
        nextSrNum = maxSrNo + 1;
      }
      srNo = formatSrNo(nextSrNum, 'C');
      form.setValue('srNo', srNo);
    }
    
    const dataToSave: Omit<Customer, 'id'> = {
        ...currentCustomer,
        srNo: srNo,
        date: formatDateLocal(formValues.date),
        term: '0', 
        dueDate: formatDateLocal(formValues.date),
        name: toTitleCase(formValues.name),
        companyName: toTitleCase(formValues.companyName || ''),
        address: toTitleCase(formValues.address),
        contact: formValues.contact,
        gstin: formValues.gstin,
        stateName: formValues.stateName,
        stateCode: formValues.stateCode,
        vehicleNo: toTitleCase(formValues.vehicleNo),
        variety: formValues.variety ? String(formValues.variety).toUpperCase() : formValues.variety,
        paymentType: formValues.paymentType,
        customerId: `${toTitleCase(formValues.name).toLowerCase()}|${formValues.contact.toLowerCase()}`,
        grossWeight: formValues.grossWeight,
        teirWeight: formValues.teirWeight,
        rate: formValues.rate,
        bags: formValues.bags,
        bagWeightKg: formValues.bagWeightKg,
        bagRate: formValues.bagRate,
        isBrokerageIncluded: formValues.isBrokerageIncluded,
        shippingName: toTitleCase(formValues.shippingName || ''),
        shippingCompanyName: toTitleCase(formValues.shippingCompanyName || ''),
        shippingAddress: toTitleCase(formValues.shippingAddress || ''),
        shippingContact: formValues.shippingContact || '',
        shippingGstin: formValues.shippingGstin || '',
        shippingStateName: formValues.shippingStateName || '',
        shippingStateCode: formValues.shippingStateCode || '',
        hsnCode: formValues.hsnCode || '',
        taxRate: formValues.taxRate || 5,
        isGstIncluded: formValues.isGstIncluded || false,
        nineRNo: formValues.nineRNo || '',
        gatePassNo: formValues.gatePassNo || '',
        grNo: formValues.grNo || '',
        grDate: formValues.grDate || '',
        transport: formValues.transport || '',
        transportationRate: (formValues as any).transportationRate || 0,
        cdRate: formValues.cd || 0, // Save CD percentage as cdRate
        cd: currentCustomer.cd || 0, // Save calculated CD amount
        cdAmount: (formValues as any).cdAmount || 0, // Save CD amount if entered directly
        brokerageRate: formValues.brokerage || 0, // Save brokerage percentage as brokerageRate
        so: '',
        kartaPercentage: formValues.kartaPercentage || 0,
        kartaWeight: currentCustomer.kartaWeight || 0, // Use calculated value
        kartaAmount: currentCustomer.kartaAmount || 0, // Use calculated value
        bagWeightDeductionAmount: (currentCustomer as any).bagWeightDeductionAmount || 0, // Bag Weight deduction amount
        transportAmount: (currentCustomer as any).transportAmount || 0, // Transport Amount = Transportation Rate × Final Weight
        labouryRate: 0,
        labouryAmount: 0,
        barcode: '',
        receiptType: 'Cash',
        baseReport: formValues.baseReport || 0,
        collectedReport: formValues.collectedReport || 0,
        riceBranGst: formValues.riceBranGst || 0,
        calculatedRate: (currentCustomer as any).calculatedRate || undefined, // Store calculated rate for RICE BRAN
    };
    
    try {
        // If editing and SR No changed, delete old entry first (optimistic)
        if (isEditing && currentCustomer.id && currentCustomer.id !== dataToSave.srNo) {
            // Update UI immediately
            setCustomers(prev => prev.filter(c => c.id !== currentCustomer.id));
            
            // Write using sync system (triggers Firestore sync)
            deleteCustomer(currentCustomer.id).catch(() => {});
        }
        
        if (deletePayments) {
            const entryWithRestoredAmount = { ...dataToSave, netAmount: dataToSave.originalNetAmount, id: dataToSave.srNo };
            
            // If editing with same ID, use updateCustomer; otherwise addCustomer (optimistic)
            if (isEditing && currentCustomer.id === dataToSave.srNo) {
                const { id, ...updateData } = entryWithRestoredAmount as any;
                const updatedEntry = entryWithRestoredAmount as Customer;
                
                // Update UI immediately (optimistic)
                setCustomers(prev => {
                    const existingIndex = prev.findIndex(c => c.id === id);
                    if (existingIndex > -1) {
                        const newCustomers = [...prev];
                        newCustomers[existingIndex] = updatedEntry;
                        return newCustomers;
                    }
                    return [updatedEntry, ...prev];
                });
                // Highlight and scroll to entry in table
                setHighlightEntryId(updatedEntry.id);
                setTimeout(() => setHighlightEntryId(null), 3000);
                toast({ title: "Entry updated, payments deleted.", variant: "success" });
                if (callback) callback(updatedEntry); else handleNew();
                
                // Write using sync system (triggers Firestore sync)
                updateCustomer(id, updateData).catch(() => {});
                deleteCustomerPaymentsForSrNo(dataToSave.srNo!).catch(() => {});
            } else {
                // Update UI immediately (optimistic)
                setCustomers(prev => {
                    const existingIndex = prev.findIndex(c => c.id === entryWithRestoredAmount.id);
                    if (existingIndex > -1) {
                        const newCustomers = [...prev];
                        newCustomers[existingIndex] = entryWithRestoredAmount as Customer;
                        return newCustomers;
                    }
                    return [entryWithRestoredAmount as Customer, ...prev];
                });
                // Highlight and scroll to entry in table
                setHighlightEntryId(entryWithRestoredAmount.id);
                setTimeout(() => setHighlightEntryId(null), 3000);
                toast({ title: "Entry updated, payments deleted.", variant: "success" });
                if (callback) callback(entryWithRestoredAmount as Customer); else handleNew();
                
                // Write using sync system (triggers Firestore sync)
                addCustomer(entryWithRestoredAmount as Customer).catch(() => {});
                deleteCustomerPaymentsForSrNo(dataToSave.srNo!).catch(() => {});
            }
        } else {
            // Ensure ID is set to SR No
            const entryToSave = { ...dataToSave, id: srNo };
            
            // If editing, always use updateCustomer if we have an existing ID
            if (isEditing && currentCustomer.id) {
                // Check if SR No changed - if yes, we need to handle it differently
                if (currentCustomer.id !== srNo && currentCustomer.srNo && currentCustomer.srNo !== srNo) {
                    // SR No changed - delete old and create new (optimistic)
                    const tempEntry = { ...entryToSave, id: srNo } as Customer;
                    
                    // Update UI immediately (optimistic)
                    setCustomers(prev => {
                        const filtered = prev.filter(c => c.id !== currentCustomer.id);
                        const existingIndex = filtered.findIndex(c => c.id === tempEntry.id);
                        if (existingIndex > -1) {
                            const newCustomers = [...filtered];
                            newCustomers[existingIndex] = tempEntry;
                            return newCustomers;
                        }
                        return [tempEntry, ...filtered];
                    });
                    
                    // Highlight and scroll to entry in table
                    setHighlightEntryId(tempEntry.id);
                    setTimeout(() => setHighlightEntryId(null), 3000);
                    toast({ title: "Entry updated successfully.", variant: "success" });
                    if (typeof window !== 'undefined' && !callback) {
                        localStorage.removeItem('customer-entry-form-state');
                    }
                    if (callback) callback(tempEntry); else handleNew();
                    
                    // Write using sync system (triggers Firestore sync)
                    deleteCustomer(currentCustomer.id).catch(() => {});
                    addCustomer(tempEntry).catch(() => {});
                } else {
                    // Same ID or updating existing - use updateCustomer (optimistic update)
                    const updateId = currentCustomer.id || srNo;
                    const { id, ...updateData } = entryToSave as any;
                    const updatedEntry = { ...entryToSave, id: updateId } as Customer;
                    
                    // Update UI immediately (optimistic) - no sort for better performance
                    setCustomers(prev => {
                        const existingIndex = prev.findIndex(c => c.id === updateId);
                        if (existingIndex > -1) {
                            const newCustomers = [...prev];
                            newCustomers[existingIndex] = updatedEntry;
                            return newCustomers;
                        }
                        // Insert at beginning without sort (faster)
                        return [updatedEntry, ...prev];
                    });
                    // Highlight and scroll to entry in table
                    setHighlightEntryId(updatedEntry.id);
                    setTimeout(() => setHighlightEntryId(null), 3000);
                    toast({ title: "Entry updated successfully.", variant: "success" });
                    
                    // Defer form reset to avoid blocking
                    if (callback) {
                        callback(updatedEntry);
                    } else {
                        setTimeout(() => {
                            if (typeof window !== 'undefined') {
                                localStorage.removeItem('customer-entry-form-state');
                            }
                            handleNew();
                        }, 0);
                    }
                    
                    // Write using sync system (triggers Firestore sync)
                    updateCustomer(updateId, updateData).catch(() => {});
                }
            } else {
                // New entry - use addCustomer (optimistic add)
                const tempEntry = entryToSave as Customer;
                
                // Update UI immediately (optimistic)
                setCustomers(prev => {
                    const existingIndex = prev.findIndex(c => c.id === tempEntry.id);
                    if (existingIndex > -1) {
                        const newCustomers = [...prev];
                        newCustomers[existingIndex] = tempEntry;
                        return newCustomers;
                    }
                    return [tempEntry, ...prev];
                });
                // Highlight and scroll to entry in table
                setHighlightEntryId(tempEntry.id);
                setTimeout(() => setHighlightEntryId(null), 3000);
                toast({ title: "Entry saved successfully.", variant: "success" });
                if (typeof window !== 'undefined' && !callback) {
                    localStorage.removeItem('customer-entry-form-state');
                }
                if (callback) callback(tempEntry); else handleNew();
                
                // Write using sync system (triggers Firestore sync)
                addCustomer(tempEntry).catch(() => {});
            }
        }
    } catch (error) {

        toast({ title: "Failed to save entry.", variant: "destructive" });
    }
  };

  const onSubmit = async (callback?: (savedEntry: Customer) => void) => {
    await executeSubmit(false, callback);
  };

  const handleSaveAndPrint = async (docType: DocumentType) => {
    const formValues = form.getValues();
    const isValid = await form.trigger();
    
    if (!isValid) {
      toast({ title: "Invalid Form", description: "Please check for errors.", variant: "destructive" });
      return;
    }

    // Save to Customer collection and show preview
    await executeSubmit(false, (savedEntry) => {
      setDocumentPreviewCustomer(savedEntry);
      setDocumentType(docType);
      setIsDocumentPreviewOpen(true);
    });
  };
  

  const handleOpenPrintPreview = (customer: Customer) => {
    setDocumentPreviewCustomer(customer);
    setDocumentType('tax-invoice'); 
    setIsDocumentPreviewOpen(true);
  };

  // Import/Export handlers are now from useCustomerImportExport hook

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
                    handleDeleteCurrent();
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

  // Global Enter key handler to work as Tab everywhere
  useEffect(() => {
    const handleGlobalEnterKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        const activeElement = document.activeElement as HTMLElement;
        
        // Skip if it's inside a dialog, menu, or command palette
        if (activeElement.closest('[role="dialog"]') || 
            activeElement.closest('[role="menu"]') || 
            activeElement.closest('[cmdk-root]')) {
          return;
        }
        
        // Skip if dropdown is open
        if (activeElement.closest('[data-state="open"]')) {
          return;
        }
        
        // Skip submit buttons
        if (activeElement.tagName === 'BUTTON' && (activeElement as HTMLButtonElement).type === 'submit') {
          return;
        }
        
        // Skip if it's a form element (form-level handler will take care of it)
        if (activeElement.closest('form')) {
          return;
        }
        
        // For non-form elements, find next focusable element
        const allFocusable = Array.from(document.querySelectorAll(
          'input:not([type="hidden"]):not([disabled]):not([readonly]), ' +
          'textarea:not([disabled]):not([readonly]), ' +
          'select:not([disabled]), ' +
          'button:not([disabled]):not([type="submit"]), ' +
          '[tabindex]:not([tabindex="-1"])'
        )).filter(el => {
          const element = el as HTMLElement;
          return element.offsetParent !== null && 
                 !element.hasAttribute('disabled') &&
                 !element.closest('[role="dialog"]') &&
                 !element.closest('[role="menu"]');
        }) as HTMLElement[];
        
        const currentIndex = allFocusable.findIndex(el => el === activeElement || el.contains(activeElement));
        if (currentIndex > -1 && currentIndex < allFocusable.length - 1) {
          event.preventDefault();
          event.stopPropagation();
          allFocusable[currentIndex + 1].focus();
        }
      }
    };
    
    document.addEventListener('keydown', handleGlobalEnterKey, true);
    return () => {
      document.removeEventListener('keydown', handleGlobalEnterKey, true);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      const activeElement = document.activeElement as HTMLElement;
      
      // Skip if it's inside a dialog, menu, or command palette
      if (activeElement.closest('[role="dialog"]') || 
          activeElement.closest('[role="menu"]') || 
          activeElement.closest('[cmdk-root]')) {
        return;
      }
      
      // Skip if dropdown is open (let it handle its own Enter key)
      if (activeElement.closest('[role="combobox"]') && activeElement.closest('[data-state="open"]')) {
        return;
      }
      
      // For buttons, only skip if it's a submit button
      if (activeElement.tagName === 'BUTTON') {
        const button = activeElement as HTMLButtonElement;
        if (button.type === 'submit') {
          return;
        }
      }
      
      // Prevent form submission and stop propagation
      e.preventDefault();
      e.stopPropagation();
      
      const formEl = e.currentTarget;
      
      // Get all focusable elements in the form using tab order
      const getAllFocusableElements = (): HTMLElement[] => {
        const selectors = [
          'input:not([type="hidden"]):not([disabled]):not([readonly])',
          'textarea:not([disabled]):not([readonly])',
          'select:not([disabled])',
          'button:not([disabled]):not([type="submit"])',
          '[tabindex]:not([tabindex="-1"])',
          '[contenteditable="true"]'
        ].join(', ');
        
        return Array.from(formEl.querySelectorAll(selectors)).filter(el => {
          const element = el as HTMLElement;
          return element.offsetParent !== null && 
                 !element.hasAttribute('disabled') &&
                 !element.closest('[role="dialog"]') &&
                 !element.closest('[role="menu"]') &&
                 !element.closest('[data-state="open"]'); // Skip open dropdowns
        }) as HTMLElement[];
      };

      const formElements = getAllFocusableElements();
      
      // Sort by tab order (tabindex or natural order)
      formElements.sort((a, b) => {
        const aTabIndex = a.tabIndex || (a instanceof HTMLInputElement || a instanceof HTMLButtonElement || a instanceof HTMLSelectElement || a instanceof HTMLTextAreaElement ? 0 : 999);
        const bTabIndex = b.tabIndex || (b instanceof HTMLInputElement || b instanceof HTMLButtonElement || b instanceof HTMLSelectElement || b instanceof HTMLTextAreaElement ? 0 : 999);
        
        if (aTabIndex !== bTabIndex) {
          return aTabIndex - bTabIndex;
        }
        
        // If tabindex is same, use DOM order
        const position = a.compareDocumentPosition(b);
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
          return -1;
        }
        if (position & Node.DOCUMENT_POSITION_PRECEDING) {
          return 1;
        }
        return 0;
      });

      const currentElementIndex = formElements.findIndex(el => {
        return el === document.activeElement || 
               el.contains(document.activeElement) ||
               (document.activeElement && el.contains(document.activeElement));
      });
      
      if (currentElementIndex > -1 && currentElementIndex < formElements.length - 1) {
        // Find next focusable element
        const nextElement = formElements[currentElementIndex + 1];
        if (nextElement) {
          nextElement.focus();
          // If it's an input, select the text if it's 0 or 0.00
          if (nextElement instanceof HTMLInputElement && (nextElement.value === '0' || nextElement.value === '0.00')) {
            setTimeout(() => nextElement.select(), 0);
          }
        }
      } else if (currentElementIndex === -1 && formElements.length > 0) {
        // If current element not found, focus first element
        formElements[0].focus();
      }
    }
  };

  if (!isClient) {
    return null;
  }

  return (
    <div className="space-y-4">
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(() => onSubmit())} onKeyDown={handleKeyDown} className="space-y-4">
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
                onSearch={setSearchTerm}
                onClear={handleNew}
            />
        </form>
      </FormProvider>      

      <EntryTable 
        entries={filteredCustomers} 
        onEdit={handleEdit} 
        onDelete={handleDelete} 
        onShowDetails={handleShowDetails}
        selectedIds={selectedCustomerIds}
        onSelectionChange={setSelectedCustomerIds}
        onPrintRow={handleSinglePrint}
        entryType="Customer"
        highlightEntryId={highlightEntryId}
      />

      <CustomerEntryDialogs
        detailsCustomer={detailsCustomer}
        setDetailsCustomer={setDetailsCustomer}
        onPrintPreview={handleOpenPrintPreview}
        paymentHistory={paymentHistory}
        isDocumentPreviewOpen={isDocumentPreviewOpen}
        setIsDocumentPreviewOpen={setIsDocumentPreviewOpen}
        documentPreviewCustomer={documentPreviewCustomer}
        documentType={documentType}
        setDocumentType={setDocumentType}
        receiptSettings={receiptSettings}
        receiptsToPrint={receiptsToPrint}
        setReceiptsToPrint={setReceiptsToPrint}
        consolidatedReceiptData={consolidatedReceiptData}
        setConsolidatedReceiptData={setConsolidatedReceiptData}
        isUpdateConfirmOpen={isUpdateConfirmOpen}
        setIsUpdateConfirmOpen={setIsUpdateConfirmOpen}
        onUpdateConfirm={(deletePayments) => {
          if (updateAction) {
                updateAction(deletePayments);
            }
        }}
        isImporting={isImporting}
        importProgress={importProgress}
        importStatus={importStatus}
        importCurrent={importCurrent}
        importTotal={importTotal}
        importStartTime={importStartTime}
      />

    </div>
  );
}
