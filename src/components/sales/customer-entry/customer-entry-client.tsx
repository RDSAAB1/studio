
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Customer, CustomerPayment, OptionItem, ReceiptSettings, DocumentType, ConsolidatedReceiptData, CustomerDocument } from "@/lib/definitions";
import { formatSrNo, toTitleCase, formatCurrency, calculateCustomerEntry, formatDateLocal } from "@/lib/utils";
import * as XLSX from 'xlsx';

import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { addCustomer, updateCustomer, deleteCustomer, bulkUpsertCustomers, getOptionsRealtime, addOption, updateOption, deleteOption, updateReceiptSettings, deleteCustomerPaymentsForSrNo, addCustomerDocument, updateCustomerDocument, deleteCustomerDocument } from "@/lib/firestore";
import { useGlobalData } from '@/contexts/global-data-context';
import { format } from "date-fns";

import { CustomerForm } from "@/components/sales/customer-form";
import { CalculatedSummary } from "@/components/sales/calculated-summary";
import { EntryTable } from "@/components/sales/entry-table";
import { DocumentPreviewDialog } from "@/components/sales/document-preview-dialog";
import { CustomerDetailsDialog } from "@/components/sales/customer-details-dialog";
import { ReceiptPrintDialog, ConsolidatedReceiptPrintDialog } from "@/components/sales/print-dialogs";
import { UpdateConfirmDialog } from "@/components/sales/update-confirm-dialog";
import { ReceiptSettingsDialog } from "@/components/sales/receipt-settings-dialog";
import { Hourglass, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";


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

  // Import progress state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [importCurrent, setImportCurrent] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importStartTime, setImportStartTime] = useState<number | null>(null);

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

  const handleExport = useCallback(() => {
    if (!safeCustomers || safeCustomers.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }

    const dataToExport = safeCustomers.map(c => {
      const calculated = calculateCustomerEntry(c, paymentHistory);
      return {
        'SR NO.': c.srNo,
        'DATE': c.date,
        'BAGS': c.bags || 0,
        'NAME': c.name,
        'COMPANY NAME': c.companyName || '',
        'ADDRESS': c.address,
        'CONTACT': c.contact,
        'GSTIN': c.gstin || '',
        'STATE NAME': c.stateName || '',
        'STATE CODE': c.stateCode || '',
        'VEHICLE NO': c.vehicleNo,
        'VARIETY': c.variety,
        'GROSS WT': c.grossWeight,
        'TIER WT': c.teirWeight,
        'NET WT': calculated.netWeight,
        'RATE': c.rate,
        'CD RATE': c.cdRate || 0,
        'CD AMOUNT': calculated.cd || 0,
        'BROKERAGE RATE': c.brokerageRate || 0,
        'BROKERAGE AMOUNT': calculated.brokerage || 0,
        'BROKERAGE INCLUDED': c.isBrokerageIncluded ? 'Yes' : 'No',
        'BAG WEIGHT KG': c.bagWeightKg || 0,
        'BAG RATE': c.bagRate || 0,
        'BAG AMOUNT': calculated.bagAmount || 0,
        'KANTA': calculated.kanta || 0,
        'AMOUNT': calculated.amount || 0,
        'NET AMOUNT': calculated.originalNetAmount || 0,
        'PAYMENT TYPE': c.paymentType,
        'SHIPPING NAME': c.shippingName || '',
        'SHIPPING COMPANY NAME': c.shippingCompanyName || '',
        'SHIPPING ADDRESS': c.shippingAddress || '',
        'SHIPPING CONTACT': c.shippingContact || '',
        'SHIPPING GSTIN': c.shippingGstin || '',
        'SHIPPING STATE NAME': c.shippingStateName || '',
        'SHIPPING STATE CODE': c.shippingStateCode || '',
        'HSN CODE': c.hsnCode || '',
        'TAX RATE': c.taxRate || 0,
        'GST INCLUDED': c.isGstIncluded ? 'Yes' : 'No',
        '9R NO': c.nineRNo || '',
        'GATE PASS NO': c.gatePassNo || '',
        'GR NO': c.grNo || '',
        'GR DATE': c.grDate || '',
        'TRANSPORT': c.transport || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");
    XLSX.writeFile(workbook, "CustomerEntries.xlsx");
    toast({ title: "Exported", description: "Customer data has been exported." });
  }, [safeCustomers, paymentHistory, toast]);

  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast({ title: "No file selected", variant: "destructive" });
      return;
    }

    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast({ title: "Invalid file type", description: "Please select an Excel file (.xlsx or .xls)", variant: "destructive" });
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportStatus('Reading file...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          setIsImporting(false);
          toast({ title: "File read error", description: "Could not read the file.", variant: "destructive" });
          return;
        }

        setImportStatus('Parsing Excel file...');
        setImportProgress(5);

        const workbook = XLSX.read(data, { type: 'binary', cellNF: true, cellText: false });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          setIsImporting(false);
          toast({ title: "Invalid file", description: "The Excel file does not contain any sheets.", variant: "destructive" });
          return;
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          setIsImporting(false);
          toast({ title: "Invalid file", description: "Could not read the worksheet.", variant: "destructive" });
          return;
        }

        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });
        
        if (!json || json.length === 0) {
          setIsImporting(false);
          setImportStartTime(null);
          toast({ title: "Empty file", description: "The Excel file does not contain any data.", variant: "destructive" });
          return;
        }
        
        const totalRows = json.length;
        setImportTotal(totalRows);
        setImportStatus(`Processing ${totalRows} entries...`);
        setImportProgress(10);
        
        let nextSrNum = safeCustomers.length > 0 
          ? Math.max(...safeCustomers.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 
          : 1;

        const importedCustomers: Customer[] = [];
        const customersToUpdate: { id: string; data: Customer }[] = [];
        const processedSrNos = new Set<string>(); // Track processed SR Nos to avoid duplicates
        let successCount = 0;
        let updateCount = 0;
        let errorCount = 0;

        // Helper function to get value from multiple possible column names
        const getValue = (item: any, ...possibleKeys: string[]): any => {
          for (const key of possibleKeys) {
            if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
              return item[key];
            }
          }
          return undefined;
        };

        for (let index = 0; index < json.length; index++) {
          const item = json[index];
          
          // Calculate progress and time estimates
          const processed = index + 1;
          const remaining = totalRows - processed;
          const progress = 10 + Math.floor((index / totalRows) * 70);
          
          // Calculate estimated time remaining
          let timeRemaining = '';
          if (importStartTime && processed > 0) {
            const elapsed = (Date.now() - importStartTime) / 1000; // seconds
            const avgTimePerItem = elapsed / processed; // seconds per item
            const estimatedTotal = avgTimePerItem * totalRows; // total estimated time
            const remainingTime = estimatedTotal - elapsed; // time remaining
            
            if (remainingTime > 0) {
              if (remainingTime < 60) {
                timeRemaining = `${Math.ceil(remainingTime)}s`;
              } else if (remainingTime < 3600) {
                const minutes = Math.floor(remainingTime / 60);
                const seconds = Math.ceil(remainingTime % 60);
                timeRemaining = `${minutes}m ${seconds}s`;
              } else {
                const hours = Math.floor(remainingTime / 3600);
                const minutes = Math.floor((remainingTime % 3600) / 60);
                timeRemaining = `${hours}h ${minutes}m`;
              }
            }
          }
          
          setImportProgress(progress);
          setImportCurrent(processed);
          setImportStatus(`Processing entry ${processed} of ${totalRows}... ${remaining} remaining${timeRemaining ? ` (~${timeRemaining})` : ''}`);

          // Skip empty rows - check multiple possible column name formats
          const name = getValue(item, 'NAME', 'name', 'Name');
          const srNo = getValue(item, 'SR NO.', 'srNo', 'SR NO', 'sr_no', 'SR_NO');
          const contact = getValue(item, 'CONTACT', 'contact', 'Contact');
          
          if (!name && !srNo && !contact) {
            continue;
          }

          try {
            // Get date from multiple possible formats
            const dateValue = getValue(item, 'DATE', 'date', 'Date');
            let dateStr: string;
            if (dateValue instanceof Date) {
              dateStr = formatDateLocal(dateValue);
            } else if (typeof dateValue === 'string') {
              // Handle DD-MM-YYYY format
              if (dateValue.includes('-')) {
                const parts = dateValue.split('-');
                if (parts.length === 3) {
                  // Try DD-MM-YYYY format
                  const day = parseInt(parts[0]);
                  const month = parseInt(parts[1]) - 1; // Month is 0-indexed
                  const year = parseInt(parts[2]);
                  const parsedDate = new Date(year, month, day);
                  if (!isNaN(parsedDate.getTime())) {
                    dateStr = formatDateLocal(parsedDate);
                  } else {
                    // Try standard date parsing
                    const standardDate = new Date(dateValue);
                    dateStr = isNaN(standardDate.getTime()) 
                      ? formatDateLocal(new Date()) 
                      : formatDateLocal(standardDate);
                  }
                } else {
                  const standardDate = new Date(dateValue);
                  dateStr = isNaN(standardDate.getTime()) 
                    ? formatDateLocal(new Date()) 
                    : formatDateLocal(standardDate);
                }
              } else {
                const parsedDate = new Date(dateValue);
                dateStr = isNaN(parsedDate.getTime()) 
                  ? formatDateLocal(new Date()) 
                  : formatDateLocal(parsedDate);
              }
            } else {
              dateStr = formatDateLocal(new Date());
            }

            // Generate SR No if not provided - handle multiple formats
            const srNoValue = srNo || getValue(item, 'SR NO.', 'srNo', 'SR NO', 'sr_no', 'SR_NO') || formatSrNo(nextSrNum++, 'C');
            // Format SR No if it's just a number
            let finalSrNo = srNoValue;
            if (typeof srNoValue === 'number' || (typeof srNoValue === 'string' && /^\d+$/.test(srNoValue))) {
              finalSrNo = formatSrNo(parseInt(String(srNoValue)), 'C');
            }
            
            // Check if this SR No was already processed in this import batch
            if (processedSrNos.has(finalSrNo)) {
              console.warn(`Skipping duplicate SR No in import: ${finalSrNo}`);
              continue;
            }
            processedSrNos.add(finalSrNo);
            
            // Check if customer with this SR No already exists in database
            const existingCustomer = safeCustomers.find(c => c.srNo === finalSrNo || c.id === finalSrNo);
            
            // Calculate weight (gross - tier) - handle multiple column name formats
            // Excel file mein weights kg mein hain, unhe qtl mein convert karo (divide by 100)
            // 1 qtl = 100 kg, so 500 kg = 5 qtl
            const grossWeightKg = parseFloat(getValue(item, 'GROSS WT', 'grossWeight', 'GROSS WEIGHT', 'gross_weight', 'GROSS_WEIGHT') || 0) || 0;
            const teirWeightKg = parseFloat(getValue(item, 'TIER WT', 'teirWeight', 'TIER WEIGHT', 'teir_weight', 'TIER_WEIGHT', 'TIER WT', 'tierWeight') || 0) || 0;
            
            // Convert kg to qtl (always divide by 100)
            const grossWeight = grossWeightKg / 100;
            const teirWeight = teirWeightKg / 100;
            const calculatedWeight = grossWeight - teirWeight;

            const customerData: Customer = {
              id: finalSrNo,
              srNo: finalSrNo,
              date: dateStr,
              term: '0',
              dueDate: dateStr,
              name: toTitleCase(getValue(item, 'NAME', 'name', 'Name') || ''),
              companyName: toTitleCase(getValue(item, 'COMPANY NAME', 'companyName', 'COMPANY NAME', 'company_name', 'COMPANY_NAME') || ''),
              address: toTitleCase(getValue(item, 'ADDRESS', 'address', 'Address') || ''),
              contact: String(getValue(item, 'CONTACT', 'contact', 'Contact') || ''),
              gstin: getValue(item, 'GSTIN', 'gstin', 'GSTIN', 'gst_in', 'GST_IN') || '',
              stateName: getValue(item, 'STATE NAME', 'stateName', 'STATE NAME', 'state_name', 'STATE_NAME') || '',
              stateCode: getValue(item, 'STATE CODE', 'stateCode', 'STATE CODE', 'state_code', 'STATE_CODE') || '',
              vehicleNo: toTitleCase(getValue(item, 'VEHICLE NO', 'vehicleNo', 'VEHICLE NO', 'vehicle_no', 'VEHICLE_NO') || ''),
              variety: String(getValue(item, 'VARIETY', 'variety', 'Variety') || '').toUpperCase(),
              grossWeight: grossWeight,
              teirWeight: teirWeight,
              weight: calculatedWeight,
              netWeight: (() => {
                const netWeightValue = parseFloat(getValue(item, 'NET WT', 'netWeight', 'NET WEIGHT', 'net_weight', 'NET_WEIGHT') || calculatedWeight) || calculatedWeight;
                // Convert kg to qtl (always divide by 100)
                return netWeightValue / 100;
              })(),
              rate: parseFloat(getValue(item, 'RATE', 'rate', 'Rate') || 0) || 0,
              cdRate: parseFloat(getValue(item, 'CD RATE', 'cdRate', 'CD RATE', 'cd_rate', 'CD_RATE') || 0) || 0,
              brokerageRate: parseFloat(getValue(item, 'BROKERAGE RATE', 'brokerageRate', 'BROKERAGE RATE', 'brokerage_rate', 'BROKERAGE_RATE') || 0) || 0,
              isBrokerageIncluded: getValue(item, 'BROKERAGE INCLUDED', 'isBrokerageIncluded', 'BROKERAGE INCLUDED') === 'Yes' || 
                                   getValue(item, 'BROKERAGE INCLUDED', 'isBrokerageIncluded', 'BROKERAGE INCLUDED') === 'yes' || 
                                   getValue(item, 'BROKERAGE INCLUDED', 'isBrokerageIncluded', 'BROKERAGE INCLUDED') === true,
              bagWeightKg: (() => {
                const bagWeightValue = parseFloat(getValue(item, 'BAG WEIGHT KG', 'bagWeightKg', 'BAG WEIGHT KG', 'bag_weight_kg', 'BAG_WEIGHT_KG') || 0) || 0;
                // Convert kg to qtl (always divide by 100)
                // Note: bagWeightKg field stores value in qtl, so we convert from kg to qtl
                return bagWeightValue / 100;
              })(),
              bagRate: parseFloat(getValue(item, 'BAG RATE', 'bagRate', 'BAG RATE', 'bag_rate', 'BAG_RATE') || 0) || 0,
              bags: parseFloat(getValue(item, 'BAGS', 'bags', 'Bags') || 0) || 0,
              paymentType: getValue(item, 'PAYMENT TYPE', 'paymentType', 'PAYMENT TYPE', 'payment_type', 'PAYMENT_TYPE') || 'Full',
              customerId: `${toTitleCase(getValue(item, 'NAME', 'name', 'Name') || '').toLowerCase()}|${String(getValue(item, 'CONTACT', 'contact', 'Contact') || '').toLowerCase()}`,
              shippingName: toTitleCase(getValue(item, 'SHIPPING NAME', 'shippingName', 'SHIPPING NAME', 'shipping_name', 'SHIPPING_NAME') || ''),
              shippingCompanyName: toTitleCase(getValue(item, 'SHIPPING COMPANY NAME', 'shippingCompanyName', 'SHIPPING COMPANY NAME', 'shipping_company_name', 'SHIPPING_COMPANY_NAME') || ''),
              shippingAddress: toTitleCase(getValue(item, 'SHIPPING ADDRESS', 'shippingAddress', 'SHIPPING ADDRESS', 'shipping_address', 'SHIPPING_ADDRESS') || ''),
              shippingContact: getValue(item, 'SHIPPING CONTACT', 'shippingContact', 'SHIPPING CONTACT', 'shipping_contact', 'SHIPPING_CONTACT') || '',
              shippingGstin: getValue(item, 'SHIPPING GSTIN', 'shippingGstin', 'SHIPPING GSTIN', 'shipping_gstin', 'SHIPPING_GSTIN') || '',
              shippingStateName: getValue(item, 'SHIPPING STATE NAME', 'shippingStateName', 'SHIPPING STATE NAME', 'shipping_state_name', 'SHIPPING_STATE_NAME') || '',
              shippingStateCode: getValue(item, 'SHIPPING STATE CODE', 'shippingStateCode', 'SHIPPING STATE CODE', 'shipping_state_code', 'SHIPPING_STATE_CODE') || '',
              hsnCode: getValue(item, 'HSN CODE', 'hsnCode', 'HSN CODE', 'hsn_code', 'HSN_CODE') || '1006',
              taxRate: parseFloat(getValue(item, 'TAX RATE', 'taxRate', 'TAX RATE', 'tax_rate', 'TAX_RATE') || 5) || 5,
              isGstIncluded: getValue(item, 'GST INCLUDED', 'isGstIncluded', 'GST INCLUDED') === 'Yes' || 
                            getValue(item, 'GST INCLUDED', 'isGstIncluded', 'GST INCLUDED') === 'yes' || 
                            getValue(item, 'GST INCLUDED', 'isGstIncluded', 'GST INCLUDED') === true,
              nineRNo: getValue(item, '9R NO', 'nineRNo', '9R NO', 'nine_r_no', '9R_NO') || '',
              gatePassNo: getValue(item, 'GATE PASS NO', 'gatePassNo', 'GATE PASS NO', 'gate_pass_no', 'GATE_PASS_NO') || '',
              grNo: getValue(item, 'GR NO', 'grNo', 'GR NO', 'gr_no', 'GR_NO') || '',
              grDate: getValue(item, 'GR DATE', 'grDate', 'GR DATE', 'gr_date', 'GR_DATE') || '',
              transport: getValue(item, 'TRANSPORT', 'transport', 'Transport') || '',
              barcode: '',
              receiptType: 'Cash',
              so: '',
              kartaPercentage: 0,
              kartaWeight: 0,
              kartaAmount: 0,
              labouryRate: 0,
              labouryAmount: 0,
              amount: 0,
              netAmount: 0,
              originalNetAmount: 0,
              kanta: 0,
            };

            // Calculate all derived fields using calculateCustomerEntry
            const calculated = calculateCustomerEntry(customerData, paymentHistory);
            const finalCustomerData = { ...customerData, ...calculated };

            if (existingCustomer) {
              // Queue for batch update
              customersToUpdate.push({ id: existingCustomer.id, data: finalCustomerData });
              updateCount++;
            } else {
              // Queue for batch insert
              importedCustomers.push(finalCustomerData);
              successCount++;
            }
          } catch (error) {
            console.error(`Error importing row:`, item, error);
            errorCount++;
          }
        }
        
        setImportStatus(`Saving ${importedCustomers.length} new entries to database...`);
        setImportProgress(80);

        // Batch insert new customers
        if (importedCustomers.length > 0) {
          try {
            await bulkUpsertCustomers(importedCustomers);
            // Remove duplicates by id before adding to state
            setCustomers(prev => {
              const existingIds = new Set(prev.map(c => c.id));
              const newCustomers = importedCustomers.filter(c => !existingIds.has(c.id));
              return [...newCustomers, ...prev].sort((a, b) => b.srNo.localeCompare(a.srNo));
            });
          } catch (error) {
            console.error('Bulk insert error:', error);
            // Fallback to individual inserts
            for (const customer of importedCustomers) {
              try {
                await addCustomer(customer);
                setCustomers(prev => {
                  // Check if customer already exists before adding
                  if (prev.some(c => c.id === customer.id)) {
                    return prev;
                  }
                  return [customer, ...prev].sort((a, b) => b.srNo.localeCompare(a.srNo));
                });
              } catch (err) {
                console.error('Individual insert error:', err);
                errorCount++;
                successCount--;
              }
            }
          }
        }

        // Batch update existing customers
        if (customersToUpdate.length > 0) {
          setImportStatus(`Updating ${customersToUpdate.length} existing entries...`);
          setImportProgress(90);
          
          for (const { id, data } of customersToUpdate) {
            try {
              const { id: _, ...updateData } = data as any;
              const updateSuccess = await updateCustomer(id, updateData);
              
              if (updateSuccess) {
                const updatedCustomer = { ...data, id };
                setCustomers(prev => {
                  // Check if customer exists, update it; otherwise add it
                  const existingIndex = prev.findIndex(c => c.id === id);
                  if (existingIndex > -1) {
                    const newCustomers = [...prev];
                    newCustomers[existingIndex] = updatedCustomer;
                    return newCustomers;
                  }
                  return [updatedCustomer, ...prev].sort((a, b) => b.srNo.localeCompare(a.srNo));
                });
                successCount++;
              } else {
                errorCount++;
                updateCount--;
              }
            } catch (error) {
              console.error('Update error:', error);
              errorCount++;
              updateCount--;
            }
          }
        }
        
        setImportProgress(100);
        setImportCurrent(importTotal);
        
        // Calculate total time taken
        const totalTime = importStartTime ? ((Date.now() - importStartTime) / 1000).toFixed(1) : '0';
        setImportStatus(`Import completed! Total time: ${totalTime}s`);

        // Build success message
        let message = '';
        if (updateCount > 0 && importedCustomers.length > 0) {
          message = `${importedCustomers.length} entries imported, ${updateCount} entries updated.`;
        } else if (updateCount > 0) {
          message = `${updateCount} entries updated.`;
        } else if (importedCustomers.length > 0) {
          message = `${importedCustomers.length} entries imported.`;
        }
        
        // Close progress dialog after a short delay
        setTimeout(() => {
          setIsImporting(false);
          setImportProgress(0);
          setImportStatus('');
          setImportCurrent(0);
          setImportTotal(0);
          setImportStartTime(null);
        }, 1500);
        
        if (errorCount > 0) {
          toast({ 
            title: "Import Completed with Errors", 
            description: `${message} ${errorCount} failed.`, 
            variant: "destructive" 
          });
        } else {
          toast({ 
            title: "Import Successful", 
            description: message || `${successCount} customer entries processed.` 
          });
        }
      } catch (error) {
        console.error("Import error:", error);
        setIsImporting(false);
        setImportProgress(0);
        setImportStatus('');
        toast({ title: "Import Failed", description: "Please check the file format and content.", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
    
    // Reset file input
    if (event.target) {
      event.target.value = '';
    }
  }, [safeCustomers, toast]);

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

      {/* Import Progress Dialog */}
      <Dialog open={isImporting} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importing Customer Entries</DialogTitle>
            <DialogDescription>
              Please wait while we import your data...
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{importStatus}</span>
                <span className="font-medium">{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="h-2" />
            </div>
            
            {importTotal > 0 && (
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progress:</span>
                  <span className="font-medium text-foreground">
                    {importCurrent} / {importTotal} entries
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Remaining:</span>
                  <span className="font-medium text-foreground">
                    {importTotal - importCurrent} entries
                  </span>
                </div>
                {importStartTime && importCurrent > 0 && (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Time elapsed:</span>
                      <span className="font-medium text-foreground">
                        {((Date.now() - importStartTime) / 1000).toFixed(1)}s
                      </span>
                    </div>
                    {(() => {
                      const elapsed = (Date.now() - importStartTime) / 1000;
                      const avgTimePerItem = elapsed / importCurrent;
                      const estimatedTotal = avgTimePerItem * importTotal;
                      const remainingTime = estimatedTotal - elapsed;
                      
                      if (remainingTime > 0 && importCurrent < importTotal) {
                        let timeStr = '';
                        if (remainingTime < 60) {
                          timeStr = `${Math.ceil(remainingTime)}s`;
                        } else if (remainingTime < 3600) {
                          const minutes = Math.floor(remainingTime / 60);
                          const seconds = Math.ceil(remainingTime % 60);
                          timeStr = `${minutes}m ${seconds}s`;
                        } else {
                          const hours = Math.floor(remainingTime / 3600);
                          const minutes = Math.floor((remainingTime % 3600) / 60);
                          timeStr = `${hours}h ${minutes}m`;
                        }
                        return (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Estimated time remaining:</span>
                            <span className="font-medium text-primary">
                              ~{timeStr}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </>
                )}
              </div>
            )}
            
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing...</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
