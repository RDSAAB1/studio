
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
import { useGlobalData } from '@/contexts/global-data-context';
import { addSupplier, deleteSupplier, updateSupplier, getOptionsRealtime, addOption, updateOption, deleteOption, getReceiptSettings, updateReceiptSettings, deletePaymentsForSrNo, deleteAllSuppliers, deleteAllPayments, getHolidays, getDailyPaymentLimit } from "@/lib/firestore";
import { format, addDays, isSunday } from "date-fns";
import { Hourglass, Lightbulb } from "lucide-react";

import { SupplierForm } from "@/components/sales/supplier-form";
import { CalculatedSummary } from "@/components/sales/calculated-summary";
import { EntryTable } from "@/components/sales/entry-table";
import { DetailsDialog } from "@/components/sales/details-dialog";
import { ReceiptPrintDialog, ConsolidatedReceiptPrintDialog } from "@/components/sales/print-dialogs";
import { UpdateConfirmDialog } from "@/components/sales/update-confirm-dialog";
import { ReceiptSettingsDialog } from "@/components/sales/receipt-settings-dialog";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";


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
    id: "", srNo: 'S----', date: today.toISOString().split('T')[0], term: '20', dueDate: today.toISOString().split('T')[0], 
    name: '', so: '', address: '', contact: '', vehicleNo: '', variety: lastVariety || '', grossWeight: 0, teirWeight: 0,
    weight: 0, kartaPercentage: 1, kartaWeight: 0, kartaAmount: 0, netWeight: 0, rate: 0,
    labouryRate: 0, labouryAmount: 0, kanta: 50, amount: 0, netAmount: 0, originalNetAmount: 0, barcode: '',
    receiptType: 'Cash', paymentType: lastPaymentType || 'Full', customerId: '', searchValue: '',
  };
};

export default function SupplierEntryClient() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Customer[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);

  const [currentSupplier, setCurrentSupplier] = useState<Customer>(() => getInitialFormState());
  const [isEditing, setIsEditing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [detailsSupplier, setDetailsSupplier] = useState<Customer | null>(null);
  const [receiptsToPrint, setReceiptsToPrint] = useState<Customer[]>([]);
  const [consolidatedReceiptData, setConsolidatedReceiptData] = useState<ConsolidatedReceiptData | null>(null);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(new Set());

  const [varietyOptions, setVarietyOptions] = useState<OptionItem[]>([]);
  const [paymentTypeOptions, setPaymentTypeOptions] = useState<OptionItem[]>([]);
  const [lastVariety, setLastVariety] = useState<string>('');
  const [lastPaymentType, setLastPaymentType] = useState<string>('');

  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);
  const [updateAction, setUpdateAction] = useState<((deletePayments: boolean) => void) | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 10);
  
  // Handle search with immediate clearing
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    // If clearing search, immediately show all results
    if (!value.trim()) {
      setSearchTerm('');
    }
  };

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [dailyPaymentLimit, setDailyPaymentLimit] = useState(800000);

  const [suggestedSupplier, setSuggestedSupplier] = useState<Customer | null>(null);
  const [highlightEntryId, setHighlightEntryId] = useState<string | null>(null);

  const safeSuppliers = useMemo(() => Array.isArray(suppliers) ? suppliers : [], [suppliers]);
  
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


  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...getInitialFormState(lastVariety, lastPaymentType),
    },
    shouldFocusError: false,
  });

  const performCalculations = useCallback((data: Partial<FormValues>, showWarning: boolean = false) => {
      const { warning, suggestedTerm, ...calculatedState } = calculateSupplierEntryWithValidation(data, paymentHistory, holidays, dailyPaymentLimit, suppliers || []);
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
  }, [paymentHistory, holidays, dailyPaymentLimit, suppliers, toast]);

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
    let formDate;
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
          const maxSrNoNum = safeSuppliers.reduce((maxNum, s) => {
              const currentNum = parseInt(s.srNo.substring(1), 10);
              return isNaN(currentNum) ? maxNum : Math.max(maxNum, currentNum);
          }, 0);
          nextSrNum = maxSrNoNum + 1;
      }
      const newState = getInitialFormState(lastVariety, lastPaymentType);
      newState.srNo = formatSrNo(nextSrNum, 'S');
      const today = new Date();
      today.setHours(0,0,0,0);
      newState.date = today.toISOString().split('T')[0];
      newState.dueDate = today.toISOString().split('T')[0];
      resetFormToState(newState);
      form.setValue('date', new Date()); // Set today's date
      setTimeout(() => form.setFocus('srNo'), 50);
  }, [safeSuppliers, lastVariety, lastPaymentType, resetFormToState, form]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsClient(true);
    }
  }, []);

  // Use global data context - NO duplicate listeners
  const globalData = useGlobalData();
  
  useEffect(() => {
    if (!isClient) return;
    setSuppliers(globalData.suppliers);
    setPaymentHistory(globalData.paymentHistory);
    setIsLoading(false);
    handleNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, globalData.suppliers, globalData.paymentHistory]);


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
          // Removed unnecessary toast message
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
        // Removed unnecessary toast message
    }
  };


  const handleDelete = async (id: string) => {
    if (!id) {
      toast({ title: "Cannot delete: invalid ID.", variant: "destructive" });
      return;
    }
    
    // Optimistic delete - update UI immediately
    const supplierToDelete = suppliers.find(s => s.id === id);
    setSuppliers(prev => prev.filter(s => s.id !== id));
    if (currentSupplier.id === id) {
      handleNew();
    }
    // Removed unnecessary toast message
    
    // Delete in background (non-blocking)
    (async () => {
      try {
        await Promise.all([
          deleteSupplier(id),
          supplierToDelete ? deletePaymentsForSrNo(supplierToDelete.srNo) : Promise.resolve()
        ]);
      } catch (error) {
        // Revert on error
        if (supplierToDelete) {
          setSuppliers(prev => [...prev, supplierToDelete].sort((a, b) => b.srNo.localeCompare(a.srNo)));
        }
        toast({ title: "Failed to delete entry.", variant: "destructive" });
      }
    })();
  };

  const executeSubmit = async (values: FormValues, deletePayments: boolean = false, callback?: (savedEntry: Customer) => void) => {
    // Prepare entry data IMMEDIATELY (minimal processing)
    const isForcedUnique = values.forceUnique || false;
    const dateStr = values.date.toISOString().split("T")[0];
    const nameLower = values.name.toLowerCase();
    const soLower = values.so.toLowerCase();
    
    const completeEntry: Customer = {
        ...currentSupplier,
        ...values,
        id: values.srNo, // Use srNo as ID
        date: dateStr,
        dueDate: currentSupplier.dueDate, // Use the adjusted due date from state
        term: String(values.term),
        name: toTitleCase(values.name),
        so: toTitleCase(values.so),
        address: toTitleCase(values.address),
        vehicleNo: toTitleCase(values.vehicleNo),
        variety: toTitleCase(values.variety),
        customerId: isForcedUnique 
            ? `${nameLower}|${soLower}|${Date.now()}` 
            : `${nameLower}|${soLower}`,
        forceUnique: isForcedUnique,
    };


    try {
        // If editing and SR No changed, delete old entry first (optimistic)
        if (isEditing && currentSupplier.id && currentSupplier.id !== completeEntry.id) {
          // Update UI immediately
          setSuppliers(prev => prev.filter(s => s.id !== currentSupplier.id));
          
          // Delete in background (non-blocking)
          (async () => {
            try {
              await deleteSupplier(currentSupplier.id);
            } catch (error) {
              // Revert on error
              setSuppliers(prev => [...prev, currentSupplier].sort((a, b) => b.srNo.localeCompare(a.srNo)));
            }
          })();
        }

        if (deletePayments) {
            const updatedEntry = { ...completeEntry, netAmount: completeEntry.originalNetAmount };
            
            // Update UI immediately (optimistic)
            setSuppliers(prev => [updatedEntry, ...prev.filter(s => s.id !== updatedEntry.id)].sort((a,b) => b.srNo.localeCompare(a.srNo)));
            // Removed unnecessary toast message
            // Highlight and scroll to entry in table
            setHighlightEntryId(updatedEntry.id);
            setTimeout(() => setHighlightEntryId(null), 3000);
            if (callback) callback(updatedEntry); else handleNew();
            
            // Save and delete payments in background (non-blocking)
            (async () => {
              try {
                await Promise.all([
                  addSupplier(updatedEntry),
                  deletePaymentsForSrNo(completeEntry.srNo)
                ]);
              } catch (error) {
                console.error('Background save/delete failed:', error);
              }
            })();
        } else {
            // If editing with same ID, use updateSupplier; otherwise addSupplier (optimistic)
            if (isEditing && currentSupplier.id === completeEntry.id) {
              // Update UI immediately (optimistic)
              setSuppliers(prev => {
                const existingIndex = prev.findIndex(s => s.id === completeEntry.id);
                if (existingIndex > -1) {
                  const newSuppliers = [...prev];
                  newSuppliers[existingIndex] = completeEntry;
                  return newSuppliers;
                }
                return [completeEntry, ...prev.filter(s => s.id !== completeEntry.id)].sort((a,b) => b.srNo.localeCompare(a.srNo));
              });
              // Removed unnecessary toast message
              // Highlight and scroll to entry in table
              setHighlightEntryId(completeEntry.id);
              setTimeout(() => setHighlightEntryId(null), 3000);
              if (callback) callback(completeEntry); else handleNew();
              
              // Update in background (non-blocking)
              (async () => {
                try {
                  const { id, ...updateData } = completeEntry as any;
                  await updateSupplier(id, updateData);
                } catch (error) {
                  console.error('Background update failed:', error);
                }
              })();
            } else {
              // New entry or SR No changed - use addSupplier (optimistic)
              setSuppliers(prev => [completeEntry, ...prev.filter(s => s.id !== completeEntry.id)].sort((a,b) => b.srNo.localeCompare(a.srNo)));
              // Removed unnecessary toast message
              // Highlight and scroll to entry in table
              setHighlightEntryId(completeEntry.id);
              setTimeout(() => setHighlightEntryId(null), 3000);
              if (callback) callback(completeEntry); else handleNew();
              
              // Save in background (non-blocking)
              (async () => {
                try {
                  await addSupplier(completeEntry);
                } catch (error) {
                  console.error('Background save failed:', error);
                }
              })();
            }
        }
    } catch (error) {
        console.error('Save error:', error);
        toast({ title: "Failed to save entry.", variant: "destructive" });
    }
  };

  const onSubmit = async (values: FormValues, callback?: (savedEntry: Customer) => void) => {
    if (suggestedSupplier && !values.forceUnique) {
      return; // Do not submit if a suggestion is active and user hasn't chosen an action
    }
    
    // Fast payment check (non-blocking) - only if editing
    if (isEditing && paymentHistory.length > 0) {
        // Quick check - if no payments array or empty, skip
        const srNoToCheck = currentSupplier.srNo;
        if (srNoToCheck) {
            // Use a quick find instead of nested some for better performance
            let hasPayments = false;
            for (let i = 0; i < paymentHistory.length; i++) {
                const p = paymentHistory[i];
                if (p.paidFor) {
                    for (let j = 0; j < p.paidFor.length; j++) {
                        if (p.paidFor[j].srNo === srNoToCheck) {
                            hasPayments = true;
                            break;
                        }
                    }
                    if (hasPayments) break;
                }
            }
            
            if (hasPayments) {
                setUpdateAction(() => (deletePayments: boolean) => executeSubmit(values, deletePayments, callback));
                setIsUpdateConfirmOpen(true);
                return;
            }
        }
    }
    
    // Execute immediately (optimistic) - no blocking operations
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
  
  const handleShowDetails = (customer: Customer) => {
    // Show details using existing DetailsDialog (same as supplier profile)
    setDetailsSupplier(customer);
  }
  
  const handleSinglePrint = (entry: Customer) => {
    setReceiptsToPrint([entry]);
    setConsolidatedReceiptData(null);
  };
  
  // Yield control to browser to prevent blocking
  const yieldToBrowser = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(() => resolve(), { timeout: 1 });
      } else {
        setTimeout(() => resolve(), 0);
      }
    });
  }, []);

  const handlePrint = useCallback(async () => {
    if (selectedSupplierIds.size > 0) {
        const entriesToPrint = filteredSuppliers.filter(s => selectedSupplierIds.has(s.id));
        if (entriesToPrint.length === 0) {
            toast({ title: "No selected entries found.", variant: "destructive" });
            return;
        }

        // Show loading toast for large datasets
        const isLargeDataset = entriesToPrint.length > 1000;
        if (isLargeDataset) {
            toast({
                title: "Processing Print Data",
                description: `Preparing ${entriesToPrint.length} entries for print. This may take a moment...`,
            });
        }

        try {
            // Determine chunk size based on dataset size
            let chunkSize = 100;
            if (entriesToPrint.length > 10000) {
                chunkSize = 200;
            } else if (entriesToPrint.length > 5000) {
                chunkSize = 150;
            } else if (entriesToPrint.length > 1000) {
                chunkSize = 100;
            } else {
                chunkSize = 50;
            }

            if (entriesToPrint.length === 1) {
                setReceiptsToPrint(entriesToPrint);
                setConsolidatedReceiptData(null);
            } else {
                // Process in chunks to check if all same customer
                const firstCustomerId = entriesToPrint[0].customerId;
                let allSameCustomer = true;
                
                for (let i = 0; i < entriesToPrint.length; i += chunkSize) {
                    const chunk = entriesToPrint.slice(i, i + chunkSize);
                    const chunkSameCustomer = chunk.every(e => e.customerId === firstCustomerId);
                    
                    if (!chunkSameCustomer) {
                        allSameCustomer = false;
                        break;
                    }
                    
                    // Yield to browser after each chunk
                    if (i + chunkSize < entriesToPrint.length) {
                        await yieldToBrowser();
                    }
                }
        
                if (!allSameCustomer) {
                    toast({ title: "Consolidated receipts are for a single supplier.", variant: "destructive" });
                    return;
                }
                
                // Calculate total amount in chunks
                let totalAmount = 0;
                for (let i = 0; i < entriesToPrint.length; i += chunkSize) {
                    const chunk = entriesToPrint.slice(i, i + chunkSize);
                    totalAmount += chunk.reduce((sum, entry) => sum + (Number(entry.netAmount) || 0), 0);
                    
                    // Yield to browser after each chunk
                    if (i + chunkSize < entriesToPrint.length) {
                        await yieldToBrowser();
                    }
                }
                
                const supplier = entriesToPrint[0];
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
        } catch (error) {

            toast({
                title: "Error",
                description: "Failed to process print data. Please try again.",
                variant: "destructive",
            });
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
  }, [selectedSupplierIds, filteredSuppliers, toast, yieldToBrowser, form]);

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
        // Removed unnecessary toast message
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
                        date: item['DATE'] ? new Date(item['DATE']).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                        term: String(item['TERM'] || '20'),
                        dueDate: item['DUE DATE'] ? new Date(item['DUE DATE']).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
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
                // Removed unnecessary toast message
            } catch (error) {

                toast({title: "Import Failed", description: "Please check the file format and content.", variant: "destructive"});
            }
        };
        reader.readAsBinaryString(file);
    };
  
    const handleDeleteAll = async () => {
        try {
            await deleteAllSuppliers();
            await deleteAllPayments();
            setSuppliers([]);
            setPaymentHistory([]);
            toast({ title: "All entries deleted successfully", variant: "success" });
            handleNew();
        } catch (error) {

            toast({ title: "Failed to delete all entries", variant: "destructive" });
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
                onSave={() => {
                    // Get values directly without blocking validation
                    const values = form.getValues();
                    // Validate in background, submit immediately (optimistic)
                    onSubmit(values);
                    // Run validation in background to show errors if any
                    form.trigger().catch(() => {});
                }}
                onSaveAndPrint={handleSaveAndPrint}
                onClear={handleNew}
                isEditing={isEditing}
                onSearch={handleSearchChange}
                onPrint={handlePrint}
                selectedIdsCount={selectedSupplierIds.size}
                onImport={handleImport}
                onExport={handleExport}
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
                    <div className="mt-4 p-4 bg-muted rounded-lg text-sm text-foreground">
                        <span className="block"><strong>Name:</strong> {toTitleCase(suggestedSupplier?.name || '')}</span>
                        <span className="block"><strong>S/O:</strong> {toTitleCase(suggestedSupplier?.so || '')}</span>
                        <span className="block"><strong>Address:</strong> {toTitleCase(suggestedSupplier?.address || '')}</span>
                    </div>
                </AlertDialogDescription>
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
        highlightEntryId={highlightEntryId}
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

        if (isEditing && currentSupplier.id && currentSupplier.id !== completeEntry.id) {

          await deleteSupplier(currentSupplier.id);

          setSuppliers(prev => prev.filter(s => s.id !== currentSupplier.id));

        }



        if (deletePayments) {

            await deletePaymentsForSrNo(completeEntry.srNo);

            const updatedEntry = { ...completeEntry, netAmount: completeEntry.originalNetAmount };

            const savedEntry = await addSupplier(updatedEntry);

            setSuppliers(prev => [savedEntry, ...prev.filter(s => s.id !== savedEntry.id)].sort((a,b) => b.srNo.localeCompare(a.srNo)));

            // Removed unnecessary toast message

            if (callback) callback(savedEntry); else handleNew();

        } else {

            const savedEntry = await addSupplier(completeEntry);

            setSuppliers(prev => [savedEntry, ...prev.filter(s => s.id !== savedEntry.id)].sort((a,b) => b.srNo.localeCompare(a.srNo)));

            // Removed unnecessary toast message

            if (callback) callback(savedEntry); else handleNew();

        }

    } catch (error) {

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

  

  const handleShowDetails = (customer: Customer) => {

    // Show details using existing DetailsDialog (same as supplier profile)
    setDetailsSupplier(customer);

  }

  

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

        // Removed unnecessary toast message

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

                        date: item['DATE'] ? new Date(item['DATE']).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],

                        term: String(item['TERM'] || '20'),

                        dueDate: item['DUE DATE'] ? new Date(item['DUE DATE']).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],

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

                // Removed unnecessary toast message

            } catch (error) {

                toast({title: "Import Failed", description: "Please check the file format and content.", variant: "destructive"});

            }

        };

        reader.readAsBinaryString(file);

    };

  

    const handleDeleteAll = async () => {

        try {

            await deleteAllSuppliers();

            await deleteAllPayments();

            setSuppliers([]);

            setPaymentHistory([]);

            // Removed unnecessary toast message

            handleNew();

        } catch (error) {

            toast({ title: "Failed to delete all entries", variant: "destructive" });

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

                onSave={() => {
                    // Get values directly without blocking validation
                    const values = form.getValues();
                    // Submit immediately (optimistic)
                    onSubmit(values);
                    // Run validation in background to show errors if any
                    form.trigger().catch(() => {});
                }}

                onSaveAndPrint={handleSaveAndPrint}

                onNew={handleNew}

                isEditing={isEditing}

                onSearch={handleSearchChange}
                onPrint={handlePrint}

                selectedIdsCount={selectedSupplierIds.size}

                onImport={handleImport}

                onExport={handleExport}

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

                    <div className="mt-4 p-4 bg-muted rounded-lg text-sm text-foreground">

                        <span className="block"><strong>Name:</strong> {toTitleCase(suggestedSupplier?.name || '')}</span>

                        <span className="block"><strong>S/O:</strong> {toTitleCase(suggestedSupplier?.so || '')}</span>

                        <span className="block"><strong>Address:</strong> {toTitleCase(suggestedSupplier?.address || '')}</span>

                    </div>

                </AlertDialogDescription>

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


