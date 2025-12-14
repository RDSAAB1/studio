
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Customer, CustomerPayment, OptionItem, ReceiptSettings, DocumentType, ConsolidatedReceiptData, CustomerDocument } from "@/lib/definitions";
import { formatSrNo, toTitleCase, formatCurrency, calculateCustomerEntry } from "@/lib/utils";
import * as XLSX from 'xlsx';


import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { addCustomer, deleteCustomer, getOptionsRealtime, addOption, updateOption, deleteOption, updateReceiptSettings, deleteCustomerPaymentsForSrNo, getInitialCustomers, getMoreCustomers, getInitialCustomerPayments, getMoreCustomerPayments, addCustomerDocument, updateCustomerDocument, deleteCustomerDocument } from "@/lib/firestore";
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
    brokerage: 0, brokerageRate: 0, cd: 0, cdRate: 0, isBrokerageIncluded: false,
    netWeight: 0, originalNetAmount: 0, netAmount: 0, barcode: '',
    receiptType: 'Cash', paymentType: lastPaymentType || 'Full', customerId: '',
    so: '', kartaPercentage: 0, kartaWeight: 0, kartaAmount: 0, labouryRate: 0, labouryAmount: 0,
  };
};

export default function CustomerEntryClient() {
  const { toast } = useToast();
  // Use global context for receipt settings (customers and payment history are managed via pagination for now)
  const globalData = useGlobalData();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [lastVisibleCustomer, setLastVisibleCustomer] = useState<any>(null);
  const [hasMoreCustomers, setHasMoreCustomers] = useState(true);

  const [paymentHistory, setPaymentHistory] = useState<CustomerPayment[]>([]);
  const [lastVisiblePayment, setLastVisiblePayment] = useState<any>(null);
  const [hasMorePayments, setHasMorePayments] = useState(true);

  const [currentCustomer, setCurrentCustomer] = useState<Customer>(() => getInitialFormState());
  const [isEditing, setIsEditing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  // NO LOADING STATES - Data loads initially, then only CRUD updates
  
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

  // Use receipt settings from global context
  const receiptSettings = globalData.receiptSettings;
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);
  const [updateAction, setUpdateAction] = useState<((deletePayments: boolean) => void) | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const safeCustomers = useMemo(() => Array.isArray(customers) ? customers : [], [customers]);
  
  // All entries are now just customers
  const allEntries = useMemo(() => {
    return safeCustomers;
  }, [safeCustomers]);
  
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
      console.warn('Error restoring form state:', error);
    }
  }, [isClient, form]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsClient(true);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    // NO LOADING - Data loads initially via global context, this is just for pagination
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
    // Removed toast from dependencies - it's stable from useToast hook
    // form reference is stable, only need to include if form instance changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  useEffect(() => {
    if (isClient) {
      // Load data - NO loading states, instant UI
      loadInitialData();
    }
  }, [isClient, loadInitialData]);


  const loadMoreData = useCallback(async () => {
      if (!hasMoreCustomers) return;
      // NO LOADING STATE - Instant update
      try {
          const result = await getMoreCustomers(lastVisibleCustomer);
          setCustomers(prev => [...prev, ...result.data]);
          setLastVisibleCustomer(result.lastVisible);
          setHasMoreCustomers(result.hasMore);
      } catch (error) {
          console.error("Error loading more customers:", error);
          toast({ title: 'Error', description: 'Could not load more entries.', variant: 'destructive' });
      }
      // Removed toast from dependencies - it's stable from useToast hook
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastVisibleCustomer, hasMoreCustomers]);


  useEffect(() => {
    if (!isClient) return;

    // ✅ Global context handles customers and customerPayments realtime listeners - no duplicate listeners needed
    // Receipt settings are also provided by global context

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
                    console.warn('Error saving form state:', error);
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
    // Clear saved form state when creating new entry
    if (typeof window !== 'undefined') {
        localStorage.removeItem('customer-entry-form-state');
    }
    setTimeout(() => form.setFocus('srNo'), 50);
}, [safeCustomers, lastVariety, lastPaymentType, resetFormToState, form]);

  const handleEdit = (id: string) => {
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
    
    // Delete customer entry
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
            // Clear saved form state after successful save
            if (typeof window !== 'undefined' && !callback) {
                localStorage.removeItem('customer-entry-form-state');
            }
            if (callback) callback(savedEntry as Customer); else handleNew();
        }
    } catch (error) {
        console.error("Error saving customer:", error);
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
                <Button onClick={loadMoreData}>
                Load More
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
        existingKantaParchiSrNos={safeCustomers.map(c => c.srNo)}
        existingDocumentSrNos={[]} // TODO: Get existing document srNos if needed
      />
    </div>
  );
}
