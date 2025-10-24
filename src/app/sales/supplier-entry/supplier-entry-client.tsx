
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Customer, Payment, OptionItem, ReceiptSettings, ConsolidatedReceiptData, Holiday } from "@/lib/definitions";
import { formatSrNo, toTitleCase, formatCurrency, calculateSupplierEntryWithValidation } from "@/lib/utils";
import * as XLSX from 'xlsx';

import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { addSupplier, deleteSupplier, updateSupplier, getOptionsRealtime, addOption, updateOption, deleteOption, getReceiptSettings, updateReceiptSettings, deletePaymentsForSrNo, deleteAllSuppliers, deleteAllPayments, getHolidays, getDailyPaymentLimit, getInitialSuppliers, getMoreSuppliers, getInitialPayments, getMorePayments, recalculateAndUpdateSuppliers, deleteMultipleSuppliers, recalculateAndUpdateAllSuppliers } from "@/lib/firestore";
import { format } from "date-fns";
import { Hourglass, Lightbulb } from "lucide-react";
import { handleDeletePaymentLogic } from "@/lib/payment-logic";


import { SupplierForm } from "@/components/sales/supplier-form";
import { CalculatedSummary } from "@/components/sales/calculated-summary";
import { EntryTable } from "@/components/sales/entry-table";
import { DetailsDialog } from "@/components/sales/details-dialog";
import { ReceiptPrintDialog, ConsolidatedReceiptPrintDialog } from "@/components/sales/print-dialogs";
import { UpdateConfirmDialog } from "@/components/sales/update-confirm-dialog";
import { ReceiptSettingsDialog } from "@/components/sales/receipt-settings-dialog";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/database';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";


const formSchema = z.object({
    srNo: z.string(),
    date: z.date(),
    term: z.coerce.number().min(0),
    name: z.string().min(1, "Name is required."),
    so: z.string(),
    address: z.string(),
    contact: z.string()
      .length(10, "Contact number must be exactly 10 digits.")
      .regex(/^\d+$/, "Contact number must only contain digits."),
    vehicleNo: z.string(),
    variety: z.string().min(1, "Variety is required."),
    grossWeight: z.coerce.number().min(0),
    teirWeight: z.coerce.number().min(0),
    rate: z.coerce.number().min(0),
    kartaPercentage: z.coerce.number().min(0),
    labouryRate: z.coerce.number().min(0),
    kanta: z.coerce.number().min(0),
    paymentType: z.string().min(1, "Payment type is required"),
    forceUnique: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const getInitialFormState = (lastVariety?: string, lastPaymentType?: string): Customer => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    id: "", srNo: 'S----', date: format(today, 'yyyy-MM-dd'), term: '20', dueDate: format(today, 'yyyy-MM-dd'), 
    name: '', so: '', address: '', contact: '', vehicleNo: '', variety: lastVariety || '', grossWeight: 0, teirWeight: 0,
    weight: 0, kartaPercentage: 1, kartaWeight: 0, kartaAmount: 0, netWeight: 0, rate: 0,
    labouryRate: 0, labouryAmount: 0, kanta: 50, amount: 0, netAmount: 0, originalNetAmount: 0, barcode: '',
    receiptType: 'Cash', paymentType: lastPaymentType || 'Full', customerId: '', searchValue: '',
  };
};

export default function SupplierEntryClient() {
  const { toast } = useToast();
  const suppliers = useLiveQuery(() => db.suppliers.orderBy('srNo').reverse().toArray(), []);
  const paymentHistory = useLiveQuery(() => db.payments.toArray(), []);

  const [currentSupplier, setCurrentSupplier] = useState<Customer>(() => getInitialFormState());
  const [isEditing, setIsEditing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [detailsSupplier, setDetailsSupplier] = useState<any | null>(null);
  const [receiptsToPrint, setReceiptsToPrint] = useState<Customer[]>([]);
  const [consolidatedReceiptData, setConsolidatedReceiptData] = useState<ConsolidatedReceiptData | null>(null);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(new Set());

  const [varietyOptions, setVarietyOptions] = useState<OptionItem[]>([]);
  const [paymentTypeOptions, setPaymentTypeOptions] = useState<OptionItem[]>([]);
  const [lastVariety, setLastVariety] = useState<string>('');
  const [lastPaymentType, setLastPaymentType] = useState<string>('');
  const isInitialLoad = useRef(true);

  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);
  const [updateAction, setUpdateAction] = useState<((deletePayments: boolean) => void) | null>(null);

  const [searchTerm, setSearchTerm] = usePersistedState('supplier-entry-search', '');
  const debouncedSearchTerm = useDebounce(searchTerm, 10);
  
  // Handle search with immediate clearing and performance optimization
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    // If clearing search, immediately show all results
    if (!value.trim()) {
      setSearchTerm('');
      // Clear cache for fresh start
      searchCache.current.clear();
    }
  };

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [dailyPaymentLimit, setDailyPaymentLimit] = useState(800000);

  const [suggestedSupplier, setSuggestedSupplier] = useState<Customer | null>(null);
  const [isManageOptionsOpen, setIsManageOptionsOpen] = useState(false);

  const safeSuppliers = useMemo(() => Array.isArray(suppliers) ? suppliers : [], [suppliers]);
  const safePaymentHistory = useMemo(() => Array.isArray(paymentHistory) ? paymentHistory : [], [paymentHistory]);
  
  // Pre-index suppliers for faster search
  const indexedSuppliers = useMemo(() => {
    return safeSuppliers.map(supplier => ({
      ...supplier,
      searchIndex: [
        supplier.name?.toLowerCase() || '',
        supplier.contact || '',
        supplier.srNo?.toLowerCase() || '',
        supplier.so?.toLowerCase() || '',
        supplier.address?.toLowerCase() || ''
      ].join(' ')
    }));
  }, [safeSuppliers]);
  
  // Search result cache
  const searchCache = useRef(new Map<string, any[]>());
  
  // Clear cache when suppliers change
  useEffect(() => {
    searchCache.current.clear();
  }, [safeSuppliers]);
  
  const filteredSuppliers = useMemo(() => {
    // Immediate return for empty search - no processing needed
    if (!debouncedSearchTerm || !debouncedSearchTerm.trim()) {
      return safeSuppliers;
    }
    
    const filter = debouncedSearchTerm.trim().toLowerCase();
    
    // Check cache first
    if (searchCache.current.has(filter)) {
      return searchCache.current.get(filter) || [];
    }
    
    // Use indexed search for faster filtering
    const results = indexedSuppliers.filter(supplier => 
      supplier.searchIndex.includes(filter)
    );
    
    // Cache the results (limit cache size to prevent memory issues)
    if (searchCache.current.size < 50) {
      searchCache.current.set(filter, results);
    }
    
    return results;
  }, [safeSuppliers, indexedSuppliers, debouncedSearchTerm]);
  
  // Search performance stats
  const searchStats = useMemo(() => ({
    total: safeSuppliers.length,
    filtered: filteredSuppliers.length,
    isSearching: debouncedSearchTerm && debouncedSearchTerm.trim().length > 0
  }), [safeSuppliers.length, filteredSuppliers.length, debouncedSearchTerm]);


  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...getInitialFormState(lastVariety, lastPaymentType),
    },
    shouldFocusError: false,
  });

  const performCalculations = useCallback((data: Partial<FormValues>, showWarning: boolean = false) => {
      const { warning, suggestedTerm, ...calculatedState } = calculateSupplierEntryWithValidation(data, safePaymentHistory, holidays, dailyPaymentLimit, safeSuppliers || []);
      setCurrentSupplier(prev => ({...prev, ...calculatedState}));
      if (showWarning && warning) {
        let title = 'Date Warning';
        let description = warning;
        if (warning.includes('holiday')) {
            title = 'Holiday on Due Date';
            description = `Try Term: ${String(suggestedTerm)} days`;
        } else if (warning.includes('limit')) {
            title = 'Daily Limit Reached';
            description = `Try Term: ${String(suggestedTerm)} days`;
        }
        
        toast({ title, description, variant: 'destructive', duration: 7000 });
      }
  }, [safePaymentHistory, holidays, dailyPaymentLimit, safeSuppliers, toast]);

  const handleCalculationFieldChange = useCallback((fieldName: string, value: string) => {
    // Run calculations in background to prevent UI lag
    setTimeout(() => {
      const currentValues = form.getValues();
      const updatedValues = { ...currentValues, [fieldName]: parseFloat(value) || 0 };
      performCalculations(updatedValues, false);
    }, 0);
  }, [form, performCalculations]);

  const handleTermBlur = useCallback((value: string) => {
    // Trigger due date calculation when term changes
    setTimeout(() => {
      const currentValues = form.getValues();
      const updatedValues = { ...currentValues, term: value };
      performCalculations(updatedValues, true); // Show warnings for term changes
    }, 0);
  }, [form, performCalculations]);

  const resetFormToState = useCallback((customerState: Customer) => {
    setSuggestedSupplier(null);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let formDate: Date;
    try {
        formDate = customerState.date ? new Date(customerState.date) : today;
        if (isNaN(formDate.getTime())) formDate = today;
    } catch {
        formDate = today;
    }
    
    const formValues: FormValues = {
        srNo: customerState.srNo,
        date: formDate,
        term: Number(customerState.term) || 0,
        name: customerState.name,
        so: customerState.so,
        address: customerState.address,
        contact: customerState.contact,
        vehicleNo: customerState.vehicleNo,
        variety: customerState.variety,
        grossWeight: customerState.grossWeight || 0,
        teirWeight: customerState.teirWeight || 0,
        rate: customerState.rate || 0,
        kartaPercentage: customerState.kartaPercentage,
        labouryRate: customerState.labouryRate,
        kanta: customerState.kanta,
        paymentType: customerState.paymentType || 'Full',
        forceUnique: customerState.forceUnique || false,
    };
    
    setCurrentSupplier(customerState);
    form.reset(formValues);
    performCalculations(formValues, false);
  }, [form, performCalculations]);

  const handleNew = useCallback(() => {
      setIsEditing(false);
      setSuggestedSupplier(null);
      let nextSrNum = 1;
      if (safeSuppliers && safeSuppliers.length > 0) {
        const highestSrNo = safeSuppliers.reduce((max, s) => {
            return s.srNo > max ? s.srNo : max;
        }, 'S00000');
        nextSrNum = parseInt(highestSrNo.substring(1)) + 1;
      }
      const newState = getInitialFormState(lastVariety, lastPaymentType);
      newState.srNo = formatSrNo(nextSrNum, 'S');
      const today = new Date();
      today.setHours(0,0,0,0);
      newState.date = format(today, 'yyyy-MM-dd');
      newState.dueDate = format(today, 'yyyy-MM-dd');
      resetFormToState(newState);
      form.setValue('date', new Date()); // Set today's date
      setTimeout(() => form.setFocus('srNo'), 50);
  }, [safeSuppliers, lastVariety, lastPaymentType, resetFormToState, form]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsClient(true);
    }
  }, []);
  
  useEffect(() => {
    if (suppliers !== undefined) {
        setIsLoading(false);
        if (isInitialLoad.current) {
            handleNew();
            isInitialLoad.current = false;
        }
    }
}, [suppliers, handleNew]);


  useEffect(() => {
    if (!isClient) return;
    
    const fetchSettings = async () => {
        const settings = await getReceiptSettings();
        if (settings) {
            setReceiptSettings(settings);
        }
        const fetchedHolidays = await getHolidays();
        setHolidays(fetchedHolidays);
        const limit = await getDailyPaymentLimit();
        setDailyPaymentLimit(limit);
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
  }, [isClient, form, toast]);
  
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
  
  // REMOVED: form.watch subscription to eliminate lag
  // Calculations are now only triggered by specific field changes via handleCalculationFieldChange
  // useEffect(() => {
  //   const subscription = form.watch((value) => {
  //       performCalculations(value as Partial<FormValues>, false);
  //   });
  //   return () => subscription.unsubscribe();
  // }, [form, performCalculations]);

  
  const handleEdit = (id: string) => {
    const customerToEdit = safeSuppliers.find(c => c.id === id);
    if (customerToEdit) {
      setIsEditing(true);
      resetFormToState(customerToEdit);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSrNoBlur = (srNoValue: string) => {
    let formattedSrNo = srNoValue.trim();
    if (formattedSrNo && !isNaN(parseInt(formattedSrNo)) && isFinite(Number(formattedSrNo))) {
        formattedSrNo = formatSrNo(parseInt(formattedSrNo), 'S');
        form.setValue('srNo', formattedSrNo);
    }
    const foundCustomer = safeSuppliers.find(c => c.srNo === formattedSrNo);
    if (foundCustomer) {
        setIsEditing(true);
        resetFormToState(foundCustomer);
    } else if (isEditing) {
        // Keep the form data but switch to "new entry" mode for that SR No.
        setIsEditing(false);
        const currentData = form.getValues();
        setCurrentSupplier(prev => ({
            ...prev,
            srNo: formattedSrNo,
            id: formattedSrNo // The new ID will be the SR No
        }));
        form.setValue('srNo', formattedSrNo);
    }
  }

  const onContactChange = (contactValue: string) => {
    form.setValue('contact', contactValue);
    // Only search when contact is complete (10 digits) to reduce lag
    if (contactValue.length === 10 && suppliers) {
      const latestEntryForContact = suppliers
          .filter(c => c.contact === contactValue)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          
      if (latestEntryForContact && latestEntryForContact.id !== currentSupplier.id) {
          form.setValue('name', latestEntryForContact.name);
          form.setValue('so', latestEntryForContact.so);
          form.setValue('address', latestEntryForContact.address);
          toast({ title: "Supplier Found: Details auto-filled from last entry." });
      }
    }
  };

  // REMOVED: findAndSuggestSimilarSupplier to eliminate lag
  // This function was running expensive Levenshtein distance calculations on every keystroke
  const findAndSuggestSimilarSupplier = () => {
    // No-op function to prevent errors
        setSuggestedSupplier(null);
  };
  
  const applySuggestion = () => {
    if (suggestedSupplier) {
        form.setValue('name', toTitleCase(suggestedSupplier.name));
        form.setValue('so', toTitleCase(suggestedSupplier.so));
        form.setValue('address', toTitleCase(suggestedSupplier.address));
        form.setValue('contact', suggestedSupplier.contact);
        setSuggestedSupplier(null);
        toast({ title: "Details Updated", description: "Supplier details have been corrected." });
    }
  };

const handleDelete = async (id: string) => {
    if (!id) {
      toast({ title: "Cannot delete: invalid ID.", variant: "destructive" });
      return;
    }

    try {
        const entryToDelete = safeSuppliers.find(s => s.id === id);
        if (!entryToDelete) {
            toast({ title: "Entry not found.", variant: "destructive" });
            return;
        }

        const associatedPayments = safePaymentHistory.filter(p =>
            p.paidFor?.some(pf => pf.srNo === entryToDelete.srNo)
        );

        for (const payment of associatedPayments) {
            await handleDeletePaymentLogic(payment, safeSuppliers);
        }

        await deleteSupplier(id);

        toast({ title: "Entry and associated payments deleted.", variant: "success" });
        if (currentSupplier.id === id) {
            handleNew();
        }
    } catch (error) {
        console.error("Error deleting supplier and payments: ", error);
        toast({ title: "Failed to delete entry.", variant: "destructive" });
    }
};

  const executeSubmit = async (values: FormValues, deletePayments: boolean = false, callback?: (savedEntry: Customer) => void) => {
    
    const isForcedUnique = values.forceUnique || false;

    const completeEntry: Customer = {
        ...currentSupplier,
        ...values,
        id: values.srNo, // Use srNo as ID
        date: format(values.date, 'yyyy-MM-dd'),
        dueDate: currentSupplier.dueDate, // Use the adjusted due date from state
        term: String(values.term),
        name: toTitleCase(values.name),
        so: toTitleCase(values.so),
        address: toTitleCase(values.address),
        vehicleNo: toTitleCase(values.vehicleNo),
        variety: toTitleCase(values.variety),
        customerId: isForcedUnique 
            ? `${toTitleCase(values.name).toLowerCase()}|${toTitleCase(values.so).toLowerCase()}|${Date.now()}` 
            : `${toTitleCase(values.name).toLowerCase()}|${toTitleCase(values.so).toLowerCase()}`,
        forceUnique: isForcedUnique,
    };


    try {
        if (isEditing && currentSupplier.id && currentSupplier.id !== completeEntry.id) {
          await deleteSupplier(currentSupplier.id);
        }

        if (deletePayments) {
            await deletePaymentsForSrNo(completeEntry.srNo);
            const updatedEntry = { ...completeEntry, netAmount: completeEntry.originalNetAmount };
            await addSupplier(updatedEntry);
            if (callback) callback(updatedEntry); else handleNew();
        } else {
            await addSupplier(completeEntry);
            if (callback) callback(completeEntry); else handleNew();
        }

        toast({ title: `Entry ${isEditing ? 'updated' : 'saved'} successfully.`, variant: "success" });

    } catch (error) {
        console.error("Error saving supplier:", error);
        toast({ title: "Failed to save entry.", variant: "destructive" });
    }
  };

  const onSubmit = async (values: FormValues, callback?: (savedEntry: Customer) => void) => {
    if (suggestedSupplier && !values.forceUnique) {
      return; // Do not submit if a suggestion is active and user hasn't chosen an action
    }
    if (isEditing) {
        const hasPayments = paymentHistory.some(p => p.paidFor?.some(pf => pf.srNo === currentSupplier.srNo));
        if (hasPayments) {
            setUpdateAction(() => (deletePayments: boolean) => executeSubmit(values, deletePayments, callback));
            setIsUpdateConfirmOpen(true);
            return;
        }
    }
    executeSubmit(values, false, callback);
  };

  const handleSaveAndPrint = async () => {
    const isValid = await form.trigger();
    if (isValid) {
      onSubmit(form.getValues(), (savedEntry) => {
        handleSinglePrint(savedEntry);
        handleNew();
      });
    } else {
      toast({ title: "Invalid Form", description: "Please check for errors.", variant: "destructive" });
    }
  };
  
  const handleShowDetails = (supplier: Customer) => {
    // Show details using existing DetailsDialog (same as supplier profile)
    setDetailsSupplier(supplier);
  };
  
  const handleSinglePrint = (entry: Customer) => {
    setReceiptsToPrint([entry]);
    setConsolidatedReceiptData(null);
  };
  
  const handlePrint = () => {
    if (selectedSupplierIds.size > 0) {
        const entriesToPrint = filteredSuppliers.filter(s => selectedSupplierIds.has(s.id));
        if (entriesToPrint.length === 0) {
            toast({ title: "No selected entries found.", variant: "destructive" });
            return;
        }

        if (entriesToPrint.length === 1) {
            setReceiptsToPrint(entriesToPrint);
            setConsolidatedReceiptData(null);
        } else {
            const firstCustomerId = entriesToPrint[0].customerId;
            const allSameCustomer = entriesToPrint.every(e => e.customerId === firstCustomerId);
    
            if (!allSameCustomer) {
                toast({ title: "Consolidated receipts are for a single supplier.", variant: "destructive" });
                return;
            }
            
            const supplier = entriesToPrint[0];
            const totalAmount = entriesToPrint.reduce((sum, entry) => sum + (Number(entry.netAmount) || 0), 0);
            
            setConsolidatedReceiptData({
                supplier: {
                    name: supplier.name,
                    so: supplier.so,
                    address: supplier.address,
                    contact: supplier.contact,
                },
                entries: entriesToPrint,
                totalAmount: totalAmount,
                date: format(new Date(), "dd-MMM-yy"),
            });
            setReceiptsToPrint([]);
        }
    } else {
      const formValues = form.getValues();
      const isValid = form.trigger();
      if(isValid && formValues.name && formValues.contact){
        handleSaveAndPrint();
      } else {
         toast({ title: "Please fill form or select entries to print.", variant: "destructive" });
      }
    }
  };

    const handleExport = () => {
        if (!suppliers) return;
        const dataToExport = suppliers.map(c => {
            const calculated = calculateSupplierEntryWithValidation(c as FormValues, paymentHistory || [], [], 800000, []);
            return {
                'SR NO.': c.srNo,
                'DATE': c.date,
                'TERM': c.term,
                'DUE DATE': calculated.dueDate,
                'NAME': c.name,
                'S/O': c.so,
                'ADDRESS': c.address,
                'CONTACT': c.contact,
                'VEHICLE NO': c.vehicleNo,
                'VARIETY': c.variety,
                'GROSS WT': c.grossWeight,
                'TEIR WT': c.teirWeight,
                'FINAL WT': calculated.weight,
                'KARTA %': c.kartaPercentage,
                'KARTA WT': calculated.kartaWeight,
                'NET WT': calculated.netWeight,
                'RATE': c.rate,
                'LABOURY RATE': c.labouryRate,
                'LABOURY AMT': calculated.labouryAmount,
                'KANTA': c.kanta,
                'AMOUNT': calculated.amount,
                'NET AMOUNT': calculated.originalNetAmount,
                'PAYMENT TYPE': c.paymentType,
            };
        });
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Suppliers");
        XLSX.writeFile(workbook, "SupplierEntries.xlsx");
        toast({title: "Exported", description: "Supplier data has been exported."});
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary', cellNF: true, cellText: false });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });
                
                let nextSrNum = (suppliers || []).length > 0 ? Math.max(...(suppliers || []).map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 : 1;

                for (const item of json) {
                     const supplierData: Customer = {
                        id: item['SR NO.'] || formatSrNo(nextSrNum++, 'S'),
                        srNo: item['SR NO.'] || formatSrNo(nextSrNum++, 'S'),
                        date: item['DATE'] ? format(new Date(item['DATE']), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                        term: String(item['TERM'] || '20'),
                        dueDate: item['DUE DATE'] ? format(new Date(item['DUE DATE']), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                        name: toTitleCase(item['NAME']),
                        so: toTitleCase(item['S/O'] || ''),
                        address: toTitleCase(item['ADDRESS'] || ''),
                        contact: String(item['CONTACT'] || ''),
                        vehicleNo: toTitleCase(item['VEHICLE NO'] || ''),
                        variety: toTitleCase(item['VARIETY'] || ''),
                        grossWeight: parseFloat(item['GROSS WT']) || 0,
                        teirWeight: parseFloat(item['TEIR WT']) || 0,
                        weight: parseFloat(item['FINAL WT']) || 0,
                        kartaPercentage: parseFloat(item['KARTA %']) || 0,
                        kartaWeight: parseFloat(item['KARTA WT']) || 0,
                        kartaAmount: parseFloat(item['KARTA AMT']) || 0,
                        netWeight: parseFloat(item['NET WT']) || 0,
                        rate: parseFloat(item['RATE']) || 0,
                        labouryRate: parseFloat(item['LABOURY RATE']) || 0,
                        labouryAmount: parseFloat(item['LABOURY AMT']) || 0,
                        kanta: parseFloat(item['KANTA']) || 0,
                        amount: parseFloat(item['AMOUNT']) || 0,
                        originalNetAmount: parseFloat(item['NET AMOUNT']) || 0,
                        netAmount: parseFloat(item['NET AMOUNT']) || 0,
                        paymentType: item['PAYMENT TYPE'] || 'Full',
                        customerId: `${toTitleCase(item['NAME']).toLowerCase()}|${String(item['CONTACT'] || '').toLowerCase()}`,
                        barcode: '',
                        receiptType: 'Cash',
                    };

                    await addSupplier(supplierData);
                }
                toast({title: "Import Successful", description: `${json.length} supplier entries have been imported.`});
            } catch (error) {
                console.error("Import failed:", error);
                toast({title: "Import Failed", description: "Please check the file format and content.", variant: "destructive"});
            }
        };
        reader.readAsBinaryString(file);
    };
  
    const handleDeleteAll = async () => {
        try {
            await deleteAllSuppliers();
            await deleteAllPayments();
            handleNew();
        } catch (error) {
            console.error("Error deleting all entries:", error);
            toast({ title: "Failed to delete all entries", variant: "destructive" });
        }
    };

    const handleUpdateSelected = async () => {
        if (selectedSupplierIds.size === 0) {
            toast({ title: "No entries selected", variant: "destructive" });
            return;
        }
        toast({ title: "Updating selected entries...", description: `Updating ${selectedSupplierIds.size} entries.` });
        try {
            const updatedCount = await recalculateAndUpdateSuppliers(Array.from(selectedSupplierIds));
            toast({ title: "Update Complete", description: `${updatedCount} entries were re-calculated and saved.`, variant: "success" });
            setSelectedSupplierIds(new Set()); // Clear selection after update
        } catch (error) {
            console.error("Error updating selected entries:", error);
            toast({ title: "Update Failed", variant: "destructive" });
        }
    };
    
    const handleDeleteSelected = async () => {
      if (selectedSupplierIds.size === 0) {
        toast({ title: "No entries selected", variant: "destructive" });
        return;
      }
      toast({ title: "Deleting selected entries...", description: `Deleting ${selectedSupplierIds.size} entries.` });
      try {
        await deleteMultipleSuppliers(Array.from(selectedSupplierIds));
        toast({ title: "Delete Complete", description: `${selectedSupplierIds.size} entries and their associated payments have been deleted.`, variant: "success" });
        setSelectedSupplierIds(new Set()); // Clear selection after delete
      } catch (error) {
        console.error("Error deleting selected entries:", error);
        toast({ title: "Delete Failed", variant: "destructive" });
      }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
        if (e.key === 'Enter') {
            const activeElement = document.activeElement as HTMLElement;
            if (activeElement.tagName === 'BUTTON' || activeElement.closest('[role="dialog"]') || activeElement.closest('[role="menu"]') || activeElement.closest('[cmdk-root]')) {
                return;
            }
            e.preventDefault(); // Prevent form submission
            const formEl = e.currentTarget;
            const formElements = Array.from(formEl.elements).filter(el => 
                (el instanceof HTMLInputElement || el instanceof HTMLButtonElement || el instanceof HTMLTextAreaElement) && 
                !el.hasAttribute('disabled') && 
                (el as HTMLElement).offsetParent !== null
            ) as (HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement)[];

            const currentElementIndex = formElements.findIndex(el => el === document.activeElement);
            
            if (currentElementIndex > -1 && currentElementIndex < formElements.length - 1) {
                formElements[currentElementIndex + 1].focus();
            } else if (currentElementIndex === formElements.length - 1) {
                // Optional: loop back to the first element or submit
                // formElements[0].focus();
            }
        }
    };
    
  const handleKeyboardShortcuts = useCallback((event: KeyboardEvent) => {
      if (event.ctrlKey) {
          switch (event.key.toLowerCase()) {
              case 's':
                  event.preventDefault();
                  form.handleSubmit((values) => onSubmit(values))();
                  break;
              case 'p':
                  event.preventDefault();
                  handleSaveAndPrint();
                  break;
              case 'n':
                  event.preventDefault();
                  handleNew();
                  break;
              case 'd':
                  event.preventDefault();
                  if (isEditing && currentSupplier.id) {
                      handleDelete(currentSupplier.id);
                  }
                  break;
          }
      }
  }, [form, onSubmit, handleSaveAndPrint, handleNew, isEditing, currentSupplier]);

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
        <form onSubmit={form.handleSubmit((values) => onSubmit(values))} onKeyDown={handleKeyDown} className="space-y-4">
            <SupplierForm 
                form={form}
                handleSrNoBlur={handleSrNoBlur}
                onContactChange={onContactChange}
                handleNameOrSoBlur={findAndSuggestSimilarSupplier}
                handleTermBlur={handleTermBlur}
                varietyOptions={varietyOptions}
                paymentTypeOptions={paymentTypeOptions}
                setLastVariety={handleSetLastVariety}
                setLastPaymentType={handleSetLastPaymentType}
                handleAddOption={addOption}
                handleUpdateOption={updateOption}
                handleDeleteOption={deleteOption}
                allSuppliers={safeSuppliers}
                handleCalculationFieldChange={handleCalculationFieldChange}
            />
            
            <CalculatedSummary 
                customer={currentSupplier}
                onSave={() => form.handleSubmit((values) => onSubmit(values))()}
                onSaveAndPrint={handleSaveAndPrint}
                onNew={handleNew}
                isEditing={isEditing}
                onSearch={handleSearchChange}
                onPrint={handlePrint}
                selectedIdsCount={selectedSupplierIds.size}
                onImport={handleImport}
                onExport={handleExport}
                onUpdateSelected={handleUpdateSelected}
                onDeleteSelected={handleDeleteSelected}
                onDeleteAll={handleDeleteAll}
            />
        </form>
      </FormProvider>      

      <AlertDialog open={!!suggestedSupplier} onOpenChange={() => setSuggestedSupplier(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                    Did you mean this supplier?
                </AlertDialogTitle>
                <AlertDialogDescription>
                    A supplier with a very similar name already exists. Is this the same person?
                </AlertDialogDescription>
                <div className="mt-4 p-4 bg-muted rounded-lg text-sm text-foreground">
                    <span className="block"><strong>Name:</strong> {toTitleCase(suggestedSupplier?.name || '')}</span>
                    <span className="block"><strong>S/O:</strong> {toTitleCase(suggestedSupplier?.so || '')}</span>
                    <span className="block"><strong>Address:</strong> {toTitleCase(suggestedSupplier?.address || '')}</span>
                </div>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogAction onClick={() => {
                    form.setValue('forceUnique', true);
                    setSuggestedSupplier(null);
                }}>No, Create New</AlertDialogAction>
                <AlertDialogAction onClick={applySuggestion}>Yes, Use This One</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <EntryTable 
        entries={filteredSuppliers} 
        onEdit={handleEdit} 
        onDelete={handleDelete} 
        onShowDetails={handleShowDetails}
        selectedIds={selectedSupplierIds}
        onSelectionChange={setSelectedSupplierIds}
        onPrintRow={handleSinglePrint}
      />
        
      <DetailsDialog 
        isOpen={!!detailsSupplier}
        onOpenChange={() => setDetailsSupplier(null)}
        customer={detailsSupplier}
        paymentHistory={paymentHistory}
      />
      
      <ReceiptPrintDialog
        receipts={receiptsToPrint}
        settings={receiptSettings}
        onOpenChange={() => setReceiptsToPrint([])}
      />
      
      <ConsolidatedReceiptPrintDialog
        data={consolidatedReceiptData}
        settings={receiptSettings}
        onOpenChange={() => setConsolidatedReceiptData(null)}
      />

      <ReceiptSettingsDialog
        settings={receiptSettings}
        setSettings={setReceiptSettings}
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
    </div>
  );
}
    

  };



  const onSubmit = async (values: FormValues, callback?: (savedEntry: Customer) => void) => {

    if (suggestedSupplier && !values.forceUnique) {

      return; // Do not submit if a suggestion is active and user hasn't chosen an action

    }

    if (isEditing) {

        const hasPayments = paymentHistory.some(p => p.paidFor?.some(pf => pf.srNo === currentSupplier.srNo));

        if (hasPayments) {

            setUpdateAction(() => (deletePayments: boolean) => executeSubmit(values, deletePayments, callback));

            setIsUpdateConfirmOpen(true);

            return;

        }

    }

    executeSubmit(values, false, callback);

  };



  const handleSaveAndPrint = async () => {

    const isValid = await form.trigger();

    if (isValid) {

      onSubmit(form.getValues(), (savedEntry) => {

        handleSinglePrint(savedEntry);

        handleNew();

      });

    } else {

      toast({ title: "Invalid Form", description: "Please check for errors.", variant: "destructive" });

    }

  };

  

  const handleShowDetails = (supplier: Customer) => {

    // Show details using existing DetailsDialog (same as supplier profile)
    setDetailsSupplier(supplier);
  };

  
  
  const handleSinglePrint = (entry: Customer) => {

    setReceiptsToPrint([entry]);

    setConsolidatedReceiptData(null);

  };

  
  
  const handlePrint = () => {

    if (selectedSupplierIds.size > 0) {

        const entriesToPrint = filteredSuppliers.filter(s => selectedSupplierIds.has(s.id));

        if (entriesToPrint.length === 0) {

            toast({ title: "No selected entries found.", variant: "destructive" });

            return;

        }



        if (entriesToPrint.length === 1) {

            setReceiptsToPrint(entriesToPrint);

            setConsolidatedReceiptData(null);

        } else {

            const firstCustomerId = entriesToPrint[0].customerId;

            const allSameCustomer = entriesToPrint.every(e => e.customerId === firstCustomerId);

    
    
            if (!allSameCustomer) {

                toast({ title: "Consolidated receipts are for a single supplier.", variant: "destructive" });

                return;

            }

            
            
            const supplier = entriesToPrint[0];

            const totalAmount = entriesToPrint.reduce((sum, entry) => sum + (Number(entry.netAmount) || 0), 0);

            
            
            setConsolidatedReceiptData({

                supplier: {

                    name: supplier.name,

                    so: supplier.so,

                    address: supplier.address,

                    contact: supplier.contact,

                },

                entries: entriesToPrint,

                totalAmount: totalAmount,

                date: format(new Date(), "dd-MMM-yy"),

            });

            setReceiptsToPrint([]);

        }

    } else {

      const formValues = form.getValues();

      const isValid = form.trigger();

      if(isValid && formValues.name && formValues.contact){

        handleSaveAndPrint();

      } else {

         toast({ title: "Please fill form or select entries to print.", variant: "destructive" });

      }

    }

  };



    const handleExport = () => {

        if (!suppliers) return;

        const dataToExport = suppliers.map(c => {

            const calculated = calculateSupplierEntry(c as FormValues, paymentHistory, [], 800000, []);

            return {

                'SR NO.': c.srNo,

                'DATE': c.date,

                'TERM': c.term,

                'DUE DATE': calculated.dueDate,

                'NAME': c.name,

                'S/O': c.so,

                'ADDRESS': c.address,

                'CONTACT': c.contact,

                'VEHICLE NO': c.vehicleNo,

                'VARIETY': c.variety,

                'GROSS WT': c.grossWeight,

                'TEIR WT': c.teirWeight,

                'FINAL WT': calculated.weight,

                'KARTA %': c.kartaPercentage,

                'KARTA WT': calculated.kartaWeight,

                'NET WT': calculated.netWeight,

                'RATE': c.rate,

                'LABOURY RATE': c.labouryRate,

                'LABOURY AMT': calculated.labouryAmount,

                'KANTA': c.kanta,

                'AMOUNT': calculated.amount,

                'NET AMOUNT': calculated.originalNetAmount,

                'PAYMENT TYPE': c.paymentType,

            };

        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);

        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(workbook, worksheet, "Suppliers");

        XLSX.writeFile(workbook, "SupplierEntries.xlsx");

        toast({title: "Exported", description: "Supplier data has been exported."});

    };



    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {

        const file = event.target.files?.[0];

        if (!file) return;



        const reader = new FileReader();

        reader.onload = async (e) => {

            try {

                const data = e.target?.result;

                const workbook = XLSX.read(data, { type: 'binary', cellNF: true, cellText: false });

                const sheetName = workbook.SheetNames[0];

                const worksheet = workbook.Sheets[sheetName];

                const json: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });

                
                
                let nextSrNum = (suppliers || []).length > 0 ? Math.max(...(suppliers || []).map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 : 1;



                for (const item of json) {

                     const supplierData: Customer = {

                        id: item['SR NO.'] || formatSrNo(nextSrNum++, 'S'),

                        srNo: item['SR NO.'] || formatSrNo(nextSrNum++, 'S'),

                        date: item['DATE'] ? format(new Date(item['DATE']), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),

                        term: String(item['TERM'] || '20'),

                        dueDate: item['DUE DATE'] ? format(new Date(item['DUE DATE']), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),

                        name: toTitleCase(item['NAME']),

                        so: toTitleCase(item['S/O'] || ''),

                        address: toTitleCase(item['ADDRESS'] || ''),

                        contact: String(item['CONTACT'] || ''),

                        vehicleNo: toTitleCase(item['VEHICLE NO'] || ''),

                        variety: toTitleCase(item['VARIETY'] || ''),

                        grossWeight: parseFloat(item['GROSS WT']) || 0,

                        teirWeight: parseFloat(item['TEIR WT']) || 0,

                        weight: parseFloat(item['FINAL WT']) || 0,

                        kartaPercentage: parseFloat(item['KARTA %']) || 0,

                        kartaWeight: parseFloat(item['KARTA WT']) || 0,

                        kartaAmount: parseFloat(item['KARTA AMT']) || 0,

                        netWeight: parseFloat(item['NET WT']) || 0,

                        rate: parseFloat(item['RATE']) || 0,

                        labouryRate: parseFloat(item['LABOURY RATE']) || 0,

                        labouryAmount: parseFloat(item['LABOURY AMT']) || 0,

                        kanta: parseFloat(item['KANTA']) || 0,

                        amount: parseFloat(item['AMOUNT']) || 0,

                        originalNetAmount: parseFloat(item['NET AMOUNT']) || 0,

                        netAmount: parseFloat(item['NET AMOUNT']) || 0,

                        paymentType: item['PAYMENT TYPE'] || 'Full',

                        customerId: `${toTitleCase(item['NAME']).toLowerCase()}|${String(item['CONTACT'] || '').toLowerCase()}`,

                        barcode: '',

                        receiptType: 'Cash',

                    };



                    await addSupplier(supplierData);

                }

                toast({title: "Import Successful", description: `${json.length} supplier entries have been imported.`});

            } catch (error) {

                console.error("Import failed:", error);

                toast({title: "Import Failed", description: "Please check the file format and content.", variant: "destructive"});

            }

        };

        reader.readAsBinaryString(file);

    };

  
  
    const handleDeleteAll = async () => {

        try {

            await deleteAllSuppliers();

            await deleteAllPayments();

            handleNew();

        } catch (error) {

            console.error("Error deleting all entries:", error);

            toast({ title: "Failed to delete all entries", variant: "destructive" });

        }

    };



    const handleUpdateSelected = async () => {

        if (selectedSupplierIds.size === 0) {

            toast({ title: "No entries selected", variant: "destructive" });

            return;

        }

        toast({ title: "Updating selected entries...", description: `Updating ${selectedSupplierIds.size} entries.` });

        try {

            const updatedCount = await recalculateAndUpdateSuppliers(Array.from(selectedSupplierIds));

            toast({ title: "Update Complete", description: `${updatedCount} entries were re-calculated and saved.`, variant: "success" });

            setSelectedSupplierIds(new Set()); // Clear selection after update

        } catch (error) {

            console.error("Error updating selected entries:", error);

            toast({ title: "Update Failed", variant: "destructive" });

        }

    };

    
    
    const handleDeleteSelected = async () => {

      if (selectedSupplierIds.size === 0) {

        toast({ title: "No entries selected", variant: "destructive" });

        return;

      }

      toast({ title: "Deleting selected entries...", description: `Deleting ${selectedSupplierIds.size} entries.` });

      try {

        await deleteMultipleSuppliers(Array.from(selectedSupplierIds));

        toast({ title: "Delete Complete", description: `${selectedSupplierIds.size} entries and their associated payments have been deleted.`, variant: "success" });

        setSelectedSupplierIds(new Set()); // Clear selection after delete

      } catch (error) {

        console.error("Error deleting selected entries:", error);

        toast({ title: "Delete Failed", variant: "destructive" });

      }

    };

    
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {

        if (e.key === 'Enter') {

            const activeElement = document.activeElement as HTMLElement;

            if (activeElement.tagName === 'BUTTON' || activeElement.closest('[role="dialog"]') || activeElement.closest('[role="menu"]') || activeElement.closest('[cmdk-root]')) {

                return;

            }

            e.preventDefault(); // Prevent form submission

            const formEl = e.currentTarget;

            const formElements = Array.from(formEl.elements).filter(el => 

                (el instanceof HTMLInputElement || el instanceof HTMLButtonElement || el instanceof HTMLTextAreaElement) && 

                !el.hasAttribute('disabled') && 

                (el as HTMLElement).offsetParent !== null

            ) as (HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement)[];



            const currentElementIndex = formElements.findIndex(el => el === document.activeElement);

            
            
            if (currentElementIndex > -1 && currentElementIndex < formElements.length - 1) {

                formElements[currentElementIndex + 1].focus();

            } else if (currentElementIndex === formElements.length - 1) {

                // Optional: loop back to the first element or submit

                // formElements[0].focus();

            }

        }

    };
    
    

  const handleKeyboardShortcuts = useCallback((event: KeyboardEvent) => {

      if (event.ctrlKey) {

          switch (event.key.toLowerCase()) {

              case 's':

                  event.preventDefault();

                  form.handleSubmit((values) => onSubmit(values))();

                  break;

              case 'p':

                  event.preventDefault();

                  handleSaveAndPrint();

                  break;

              case 'n':

                  event.preventDefault();

                  handleNew();

                  break;

              case 'd':

                  event.preventDefault();

                  if (isEditing && currentSupplier.id) {

                      handleDelete(currentSupplier.id);

                  }

                  break;

          }

      }

  }, [form, onSubmit, handleSaveAndPrint, handleNew, isEditing, currentSupplier]);



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

        <form onSubmit={form.handleSubmit((values) => onSubmit(values))} onKeyDown={handleKeyDown} className="space-y-4">

            <SupplierForm 

                form={form}

                handleSrNoBlur={handleSrNoBlur}

                onContactChange={onContactChange}

                handleNameOrSoBlur={findAndSuggestSimilarSupplier}

                varietyOptions={varietyOptions}

                paymentTypeOptions={paymentTypeOptions}

                setLastVariety={handleSetLastVariety}

                setLastPaymentType={handleSetLastPaymentType}

                handleAddOption={addOption}

                handleUpdateOption={updateOption}

                handleDeleteOption={deleteOption}

                allSuppliers={safeSuppliers}

                handleCalculationFieldChange={handleCalculationFieldChange}
            />

            
            
            <CalculatedSummary 

                customer={currentSupplier}

                onSave={() => form.handleSubmit((values) => onSubmit(values))()}

                onSaveAndPrint={handleSaveAndPrint}

                onNew={handleNew}

                isEditing={isEditing}

                onSearch={handleSearchChange}
                onPrint={handlePrint}

                selectedIdsCount={selectedSupplierIds.size}

                onImport={handleImport}

                onExport={handleExport}

                onUpdateSelected={handleUpdateSelected}

                onDeleteSelected={handleDeleteSelected}

                onDeleteAll={handleDeleteAll}

            />

        </form>

      </FormProvider>      



      <AlertDialog open={!!suggestedSupplier} onOpenChange={() => setSuggestedSupplier(null)}>

        <AlertDialogContent>

            <AlertDialogHeader>

                <AlertDialogTitle className="flex items-center gap-2">

                    <Lightbulb className="h-5 w-5 text-yellow-500" />

                    Did you mean this supplier?

                </AlertDialogTitle>

                <AlertDialogDescription>

                    A supplier with a very similar name already exists. Is this the same person?

                </AlertDialogDescription>

                <div className="mt-4 p-4 bg-muted rounded-lg text-sm text-foreground">

                    <span className="block"><strong>Name:</strong> {toTitleCase(suggestedSupplier?.name || '')}</span>

                    <span className="block"><strong>S/O:</strong> {toTitleCase(suggestedSupplier?.so || '')}</span>

                    <span className="block"><strong>Address:</strong> {toTitleCase(suggestedSupplier?.address || '')}</span>

                </div>

            </AlertDialogHeader>

            <AlertDialogFooter>

                <AlertDialogAction onClick={() => {

                    form.setValue('forceUnique', true);

                    setSuggestedSupplier(null);

                }}>No, Create New</AlertDialogAction>

                <AlertDialogAction onClick={applySuggestion}>Yes, Use This One</AlertDialogAction>

            </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

      
      
      <EntryTable 

        entries={filteredSuppliers} 

        onEdit={handleEdit} 

        onDelete={handleDelete} 

        onShowDetails={handleShowDetails}

        selectedIds={selectedSupplierIds}

        onSelectionChange={setSelectedSupplierIds}

        onPrintRow={handleSinglePrint}

      />

        

      <DetailsDialog 
        isOpen={!!detailsSupplier}
        onOpenChange={() => setDetailsSupplier(null)}
        customer={detailsSupplier}
        paymentHistory={paymentHistory}
      />
      
      
      <ReceiptPrintDialog

        receipts={receiptsToPrint}

        settings={receiptSettings}

        onOpenChange={() => setReceiptsToPrint([])}

      />

      
      
      <ConsolidatedReceiptPrintDialog

        data={consolidatedReceiptData}

        settings={receiptSettings}

        onOpenChange={() => setConsolidatedReceiptData(null)}

      />



      <ReceiptSettingsDialog

        settings={receiptSettings}

        setSettings={setReceiptSettings}

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

    </div>

  );

}

    
    