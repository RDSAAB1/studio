
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Customer, Payment, OptionItem, ReceiptSettings, ConsolidatedReceiptData, Holiday } from "@/lib/definitions";
import { formatSrNo, toTitleCase, formatCurrency, calculateSupplierEntry } from "@/lib/utils";
import * as XLSX from 'xlsx';
import { useLiveQuery } from "dexie-react-hooks";
import { db } from '@/lib/database';


import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { addSupplier, deleteSupplier, updateSupplier, getOptionsRealtime, addOption, updateOption, deleteOption, getReceiptSettings, updateReceiptSettings, deletePaymentsForSrNo, deleteAllSuppliers, deleteAllPayments, getHolidays, getDailyPaymentLimit } from "@/lib/firestore";
import { format, addDays, isSunday } from "date-fns";
import { Hourglass } from "lucide-react";

import { SupplierForm } from "@/components/sales/supplier-form";
import { CalculatedSummary } from "@/components/sales/calculated-summary";
import { EntryTable } from "@/components/sales/entry-table";
import { DetailsDialog } from "@/components/sales/details-dialog";
import { ReceiptPrintDialog, ConsolidatedReceiptPrintDialog } from "@/components/sales/print-dialogs";
import { UpdateConfirmDialog } from "@/components/sales/update-confirm-dialog";
import { ReceiptSettingsDialog } from "@/components/sales/receipt-settings-dialog";

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
});

type FormValues = z.infer<typeof formSchema>;

const getInitialFormState = (lastVariety?: string, lastPaymentType?: string): Customer => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    id: "", srNo: 'S----', date: today.toISOString().split('T')[0], term: '20', dueDate: today.toISOString().split('T')[0], 
    name: '', so: '', address: '', contact: '', vehicleNo: '', variety: lastVariety || '', grossWeight: 0, teirWeight: 0,
    weight: 0, kartaPercentage: 1, kartaWeight: 0, kartaAmount: 0, netWeight: 0, rate: 0,
    labouryRate: 2, labouryAmount: 0, kanta: 50, amount: 0, netAmount: 0, originalNetAmount: 0, barcode: '',
    receiptType: 'Cash', paymentType: lastPaymentType || 'Full', customerId: '', searchValue: '',
  };
};

export default function SupplierEntryClient() {
  const { toast } = useToast();
  const suppliers = useLiveQuery(() => db.mainDataStore.where('collection').equals('suppliers').sortBy('srNo')) || [];
  const paymentHistory = useLiveQuery(() => db.mainDataStore.where('collection').equals('payments').sortBy('date')) || [];
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
  const isInitialLoad = useRef(true);

  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);
  const [updateAction, setUpdateAction] = useState<((deletePayments: boolean) => void) | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [dailyPaymentLimit, setDailyPaymentLimit] = useState(800000);

  const safeSuppliers = useMemo(() => Array.isArray(suppliers) ? suppliers : [], [suppliers]);
  
  const filteredSuppliers = useMemo(() => {
    if (!debouncedSearchTerm) {
      return safeSuppliers;
    }
    const lowercasedFilter = debouncedSearchTerm.toLowerCase();
    return safeSuppliers.filter(supplier => {
      return (
        supplier.name?.toLowerCase().startsWith(lowercasedFilter) ||
        supplier.contact?.startsWith(lowercasedFilter) ||
        supplier.srNo?.toLowerCase().startsWith(lowercasedFilter)
      );
    });
  }, [safeSuppliers, debouncedSearchTerm]);


  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...getInitialFormState(lastVariety, lastPaymentType),
    },
    shouldFocusError: false,
  });

  const performCalculations = useCallback((data: Partial<FormValues>, showWarning: boolean = false) => {
      const { warning, suggestedTerm, ...calculatedState } = calculateSupplierEntry(data, paymentHistory, holidays, dailyPaymentLimit, suppliers);
      setCurrentSupplier(prev => ({...prev, ...calculatedState}));
      if (showWarning && warning) {
        let title = 'Date Warning';
        let description = warning;
        if (warning.includes('holiday')) {
            title = 'Holiday on Due Date';
            description = `Try Term: ${suggestedTerm} days`;
        } else if (warning.includes('limit')) {
            title = 'Daily Limit Reached';
            description = `Try Term: ${suggestedTerm} days`;
        }
        
        toast({ title, description, variant: 'destructive', duration: 7000 });
      }
  }, [paymentHistory, holidays, dailyPaymentLimit, suppliers, toast]);

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
    };

    setCurrentSupplier(customerState);
    form.reset(formValues);
    performCalculations(formValues, false);
  }, [form, performCalculations]);

  const handleNew = useCallback(() => {
    setIsEditing(false);
    let nextSrNum = 1;
    if (safeSuppliers.length > 0) {
      nextSrNum = Math.max(...safeSuppliers.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1;
    }
    const newState = getInitialFormState(lastVariety, lastPaymentType);
    newState.srNo = formatSrNo(nextSrNum, 'S');
    const today = new Date();
    today.setHours(0,0,0,0);
    newState.date = today.toISOString().split('T')[0];
    newState.dueDate = today.toISOString().split('T')[0];
    resetFormToState(newState);
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
        if (isInitialLoad.current && suppliers.length > 0) {
            const nextSrNum = Math.max(...suppliers.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1;
            const initialSrNo = formatSrNo(nextSrNum, 'S');
            form.setValue('srNo', initialSrNo);
            setCurrentSupplier(prev => ({ ...prev, srNo: initialSrNo }));
            isInitialLoad.current = false;
        } else if (isInitialLoad.current && suppliers.length === 0) {
            const initialSrNo = formatSrNo(1, 'S');
            form.setValue('srNo', initialSrNo);
            setCurrentSupplier(prev => ({ ...prev, srNo: initialSrNo }));
            isInitialLoad.current = false;
        }
    }
  }, [suppliers, form]);


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
  
  useEffect(() => {
    const subscription = form.watch((value) => {
        performCalculations(value as Partial<FormValues>, false);
    });
    return () => subscription.unsubscribe();
  }, [form, performCalculations]);

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
    } else {
        if (isEditing) {
            setIsEditing(false);
            const currentId = currentSupplier.srNo;
            const nextSrNum = safeSuppliers.length > 0 ? Math.max(...safeSuppliers.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 : 1;
            const newState = {...getInitialFormState(lastVariety, lastPaymentType), srNo: formattedSrNo || formatSrNo(nextSrNum, 'S'), id: currentId };
            resetFormToState(newState);
        }
    }
  }

  const handleContactBlur = (contactValue: string) => {
    if (contactValue.length === 10 && suppliers) {
      const foundCustomer = suppliers.find(c => c.contact === contactValue);
      if (foundCustomer && foundCustomer.id !== currentSupplier.id) {
        form.setValue('name', foundCustomer.name);
        form.setValue('so', foundCustomer.so);
        form.setValue('address', foundCustomer.address);
        toast({ title: "Supplier Found: Details auto-filled." });
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!id) {
      toast({ title: "Cannot delete: invalid ID.", variant: "destructive" });
      return;
    }
    try {
      await deleteSupplier(id);
      await deletePaymentsForSrNo(currentSupplier.srNo);
      toast({ title: "Entry and payments deleted.", variant: "success" });
      if (currentSupplier.id === id) {
        handleNew();
      }
    } catch (error) {
      console.error("Error deleting supplier and payments: ", error);
      toast({ title: "Failed to delete entry.", variant: "destructive" });
    }
  };

  const executeSubmit = async (values: FormValues, deletePayments: boolean = false, callback?: (savedEntry: Customer) => void) => {
    const completeEntry: Customer = {
        ...currentSupplier,
        ...values,
        id: values.srNo, // Use srNo as ID
        date: values.date.toISOString().split("T")[0],
        dueDate: currentSupplier.dueDate, // Use the adjusted due date from state
        term: String(values.term),
        name: toTitleCase(values.name), so: toTitleCase(values.so), address: toTitleCase(values.address), vehicleNo: toTitleCase(values.vehicleNo), variety: toTitleCase(values.variety),
        customerId: `${toTitleCase(values.name).toLowerCase()}|${values.contact.toLowerCase()}`,
    };

    try {
        if (isEditing && currentSupplier.id && currentSupplier.id !== completeEntry.id) {
          await deleteSupplier(currentSupplier.id);
        }

        if (deletePayments) {
            await deletePaymentsForSrNo(completeEntry.srNo);
            const updatedEntry = { ...completeEntry, netAmount: completeEntry.originalNetAmount };
            const savedEntry = await addSupplier(updatedEntry);
            toast({ title: "Entry updated and payments deleted.", variant: "success" });
            if (callback) callback(savedEntry); else handleNew();
        } else {
            const savedEntry = await addSupplier(completeEntry);
            toast({ title: `Entry ${isEditing ? 'updated' : 'saved'} successfully.`, variant: "success" });
            if (callback) callback(savedEntry); else handleNew();
        }
    } catch (error) {
        console.error("Error saving supplier:", error);
        toast({ title: "Failed to save entry.", variant: "destructive" });
    }
  };

  const onSubmit = async (values: FormValues, callback?: (savedEntry: Customer) => void) => {
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
            const calculated = calculateSupplierEntry(c as FormValues, paymentHistory, holidays, dailyPaymentLimit, suppliers);
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
            toast({ title: "All entries deleted successfully", variant: "success" });
            handleNew();
        } catch (error) {
            console.error("Error deleting all entries:", error);
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
                handleContactBlur={handleContactBlur}
                handleTermBlur={() => performCalculations(form.getValues(), true)}
                varietyOptions={varietyOptions}
                paymentTypeOptions={paymentTypeOptions}
                setLastVariety={handleSetLastVariety}
                setLastPaymentType={handleSetLastPaymentType}
                handleAddOption={addOption}
                handleUpdateOption={updateOption}
                handleDeleteOption={deleteOption}
                allSuppliers={safeSuppliers}
            />
            
            <CalculatedSummary 
                customer={currentSupplier}
                onSave={() => form.handleSubmit((values) => onSubmit(values))()}
                onSaveAndPrint={handleSaveAndPrint}
                onNew={handleNew}
                isEditing={isEditing}
                onSearch={setSearchTerm}
                onPrint={handlePrint}
                selectedIdsCount={selectedSupplierIds.size}
                onImport={handleImport}
                onExport={handleExport}
                onDeleteAll={handleDeleteAll}
            />
        </form>
      </FormProvider>      
      
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
