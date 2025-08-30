
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Customer, Payment, OptionItem, ReceiptSettings, ConsolidatedReceiptData } from "@/lib/definitions";
import { formatSrNo, toTitleCase, formatCurrency } from "@/lib/utils";

import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { addSupplier, deleteSupplier, getSuppliersRealtime, updateSupplier, getPaymentsRealtime, getOptionsRealtime, addOption, updateOption, deleteOption, getReceiptSettings, updateReceiptSettings, deletePaymentsForSrNo } from "@/lib/firestore";
import { format } from "date-fns";
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
    cd: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const getInitialFormState = (lastVariety?: string): Customer => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    id: "", srNo: 'S----', date: today.toISOString().split('T')[0], term: '0', dueDate: today.toISOString().split('T')[0], 
    name: '', so: '', address: '', contact: '', vehicleNo: '', variety: lastVariety || '', grossWeight: 0, teirWeight: 0,
    weight: 0, kartaPercentage: 1, kartaWeight: 0, kartaAmount: 0, netWeight: 0, rate: 0,
    labouryRate: 2, labouryAmount: 0, kanta: 50, amount: 0, netAmount: 0, originalNetAmount: 0, barcode: '',
    receiptType: 'Cash', paymentType: 'Full', customerId: '', searchValue: '', cd: 0
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
  const isInitialLoad = useRef(true);

  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);
  const [updateAction, setUpdateAction] = useState<((deletePayments: boolean) => void) | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

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
      ...getInitialFormState(lastVariety),
    },
    shouldFocusError: false,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsClient(true);
    }
  }, []);

  useEffect(() => {
    if (!isClient) return;

    setIsLoading(true);
    const unsubscribeSuppliers = getSuppliersRealtime((data: Customer[]) => {
      setSuppliers(data);
      if (isInitialLoad.current) {
          const nextSrNum = data.length > 0 ? Math.max(...data.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 : 1;
          const initialSrNo = formatSrNo(nextSrNum);
          form.setValue('srNo', initialSrNo);
          setCurrentSupplier(prev => ({ ...prev, srNo: initialSrNo }));
          isInitialLoad.current = false;
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching suppliers: ", error);
      toast({
        title: "Error",
        description: "Failed to load supplier data. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    });

    const unsubscribePayments = getPaymentsRealtime((data: Payment[]) => {
        setPaymentHistory(data);
    }, (error) => {
        console.error("Error fetching payments: ", error);
    });

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

    form.setValue('date', new Date());

    return () => {
      unsubscribeSuppliers();
      unsubscribePayments();
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

  const performCalculations = useCallback((data: Partial<FormValues>) => {
    const values = {...form.getValues(), ...data};
    const date = values.date;
    const termDays = Number(values.term) || 0;
    const newDueDate = new Date(date);
    newDueDate.setDate(newDueDate.getDate() + termDays);
    const grossWeight = values.grossWeight || 0;
    const teirWeight = values.teirWeight || 0;
    const weight = grossWeight - teirWeight;
    const kartaPercentage = values.kartaPercentage || 0;
    const rate = values.rate || 0;
    const kartaWeight = weight * (kartaPercentage / 100);
    const kartaAmount = kartaWeight * rate;
    const netWeight = weight - kartaWeight;
    const amount = netWeight * rate;
    const labouryRate = values.labouryRate || 0;
    const labouryAmount = weight * labouryRate;
    const kanta = values.kanta || 0;
    const cdAmount = values.cd || 0;
    
    const originalNetAmount = amount - labouryAmount - kanta - kartaAmount;

    const totalPaidForThisEntry = paymentHistory
      .filter(p => p.paidFor?.some(pf => pf.srNo === values.srNo))
      .reduce((sum, p) => {
          const paidForDetail = p.paidFor?.find(pf => pf.srNo === values.srNo);
          return sum + (paidForDetail?.amount || 0);
      }, 0);
      
    const netAmount = originalNetAmount - totalPaidForThisEntry - cdAmount;

    setCurrentSupplier(prev => ({
      ...prev, ...values,
      date: values.date instanceof Date ? values.date.toISOString().split("T")[0] : prev.date,
      term: String(values.term), dueDate: newDueDate.toISOString().split("T")[0],
      weight: parseFloat(weight.toFixed(2)), kartaWeight: parseFloat(kartaWeight.toFixed(2)),
      kartaAmount: parseFloat(kartaAmount.toFixed(2)), netWeight: parseFloat(netWeight.toFixed(2)),
      amount: parseFloat(amount.toFixed(2)), labouryAmount: parseFloat(labouryAmount.toFixed(2)),
      kanta: parseFloat(kanta.toFixed(2)), 
      cd: parseFloat(cdAmount.toFixed(2)),
      originalNetAmount: parseFloat(originalNetAmount.toFixed(2)),
      netAmount: parseFloat(netAmount.toFixed(2)),
    }));
  }, [form, paymentHistory]);
  
  useEffect(() => {
    const subscription = form.watch((value) => {
        performCalculations(value as Partial<FormValues>);
    });
    return () => subscription.unsubscribe();
  }, [form, performCalculations]);

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
      srNo: customerState.srNo, date: formDate, term: Number(customerState.term) || 0,
      name: customerState.name, so: customerState.so, address: customerState.address,
      contact: customerState.contact, vehicleNo: customerState.vehicleNo, variety: customerState.variety,
      grossWeight: customerState.grossWeight || 0, teirWeight: customerState.teirWeight || 0,
      rate: customerState.rate || 0, kartaPercentage: customerState.kartaPercentage || 1,
      labouryRate: customerState.labouryRate || 2, kanta: customerState.kanta || 50,
      paymentType: customerState.paymentType || 'Full',
      cd: customerState.cd || 0,
    };
    setCurrentSupplier(customerState);
    form.reset(formValues);
    performCalculations(formValues);
  }, [form, performCalculations]);

  const handleNew = useCallback(() => {
    setIsEditing(false);
    const nextSrNum = safeSuppliers.length > 0 ? Math.max(...safeSuppliers.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 : 1;
    const newState = getInitialFormState(lastVariety);
    newState.srNo = formatSrNo(nextSrNum);
    const today = new Date();
    today.setHours(0,0,0,0);
    newState.date = today.toISOString().split('T')[0];
    newState.dueDate = today.toISOString().split('T')[0];
    resetFormToState(newState);
  }, [safeSuppliers, lastVariety, resetFormToState]);

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
        formattedSrNo = formatSrNo(parseInt(formattedSrNo));
        form.setValue('srNo', formattedSrNo);
    }
    const foundCustomer = safeSuppliers.find(c => c.srNo === formattedSrNo);
    if (foundCustomer) {
        setIsEditing(true);
        resetFormToState(foundCustomer);
    } else {
        setIsEditing(false);
        const currentId = isEditing ? currentSupplier.id : "";
        const nextSrNum = safeSuppliers.length > 0 ? Math.max(...safeSuppliers.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 : 1;
        const currentState = {...getInitialFormState(lastVariety), srNo: formattedSrNo || formatSrNo(nextSrNum), id: currentId };
        resetFormToState(currentState);
    }
  }

  const handleContactBlur = (contactValue: string) => {
    if (contactValue.length === 10) {
      const foundCustomer = suppliers.find(c => c.contact === contactValue);
      if (foundCustomer && foundCustomer.id !== currentSupplier.id) {
        form.setValue('name', foundCustomer.name);
        form.setValue('so', foundCustomer.so);
        form.setValue('address', foundCustomer.address);
        toast({ title: "Supplier Found", description: `Details for ${toTitleCase(foundCustomer.name)} have been auto-filled.` });
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement.tagName === 'BUTTON' || activeElement.closest('[role="dialog"]') || activeElement.closest('[role="menu"]') || activeElement.closest('[cmdk-root]')) {
        return;
      }
      const formEl = e.currentTarget;
      const formElements = Array.from(formEl.elements).filter(el => (el as HTMLElement).offsetParent !== null) as (HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement)[];
      const currentElementIndex = formElements.findIndex(el => el === document.activeElement);
      if (currentElementIndex > -1 && currentElementIndex < formElements.length - 1) {
        e.preventDefault();
        formElements[currentElementIndex + 1].focus();
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSupplier(id);
      await deletePaymentsForSrNo(currentSupplier.srNo);
      toast({ title: "Success", description: "Entry and associated payments deleted successfully." });
      if (currentSupplier.id === id) {
        handleNew();
      }
    } catch (error) {
      console.error("Error deleting supplier and payments: ", error);
      toast({
        title: "Error",
        description: "Failed to delete entry. Please try again.",
        variant: "destructive",
      });
    }
  };

  const executeSubmit = async (values: FormValues, deletePayments: boolean = false, callback?: (savedEntry: Customer) => void) => {
    const completeEntry: Customer = {
      ...currentSupplier,
      ...values,
      date: values.date.toISOString().split("T")[0],
      dueDate: new Date(new Date(values.date).setDate(new Date(values.date).getDate() + (Number(values.term) || 0))).toISOString().split("T")[0],
      term: String(values.term),
      name: toTitleCase(values.name), so: toTitleCase(values.so), address: toTitleCase(values.address), vehicleNo: toTitleCase(values.vehicleNo), variety: toTitleCase(values.variety),
      customerId: `${toTitleCase(values.name).toLowerCase()}|${values.contact.toLowerCase()}`,
    };

    try {
        if (isEditing && completeEntry.id) {
            if (deletePayments) {
                await deletePaymentsForSrNo(completeEntry.srNo);
                const updatedEntry = { ...completeEntry, netAmount: completeEntry.originalNetAmount };
                toast({ title: "Payments Deleted", description: "Associated payments have been removed." });
                const success = await updateSupplier(updatedEntry.id, updatedEntry);
                 if (success) {
                    toast({ title: "Success", description: "Entry updated successfully." });
                    if (callback) callback(updatedEntry); else handleNew();
                } else {
                    toast({ title: "Error", description: "Supplier not found. Cannot update.", variant: "destructive" });
                }
            } else {
                 const success = await updateSupplier(completeEntry.id, completeEntry);
                 if (success) {
                    toast({ title: "Success", description: "Entry updated successfully." });
                    if (callback) callback(completeEntry); else handleNew();
                } else {
                    toast({ title: "Error", description: "Supplier not found. Cannot update.", variant: "destructive" });
                }
            }
        } else {
            const newEntry = await addSupplier(completeEntry);
            toast({ title: "Success", description: "New entry saved successfully." });
            if (callback) callback(newEntry); else handleNew();
        }
    } catch (error) {
        console.error("Error saving supplier:", error);
        toast({ title: "Error", description: "Failed to save entry.", variant: "destructive" });
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
        handlePrint([savedEntry]);
        handleNew();
      });
    } else {
      toast({
        title: "Invalid Form",
        description: "Please check the form for errors before saving.",
        variant: "destructive"
      });
    }
  };
  
  const handleShowDetails = (customer: Customer) => {
    setDetailsSupplier(customer);
  }
  
  const handlePrint = (entriesToPrint: Customer[]) => {
    if (!entriesToPrint || entriesToPrint.length === 0) {
        toast({
            title: "No Selection",
            description: "Please select one or more entries to print.",
            variant: "destructive",
        });
        return;
    }

    if (entriesToPrint.length === 1) {
        setReceiptsToPrint(entriesToPrint);
        setConsolidatedReceiptData(null);
    } else {
        const firstCustomerId = entriesToPrint[0].customerId;
        const allSameCustomer = entriesToPrint.every(e => e.customerId === firstCustomerId);

        if (!allSameCustomer) {
            toast({
                title: "Multiple Suppliers Selected",
                description: "Consolidated receipts can only be printed for a single supplier at a time.",
                variant: "destructive",
            });
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
  };
  
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
                varietyOptions={varietyOptions}
                paymentTypeOptions={paymentTypeOptions}
                setLastVariety={handleSetLastVariety}
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
                isBrokerageIncluded={false}
                onBrokerageToggle={() => {}}
                isCustomerForm={false}
            />
        </form>
      </FormProvider>      
      
      <EntryTable 
        entries={filteredSuppliers} 
        onEdit={handleEdit} 
        onDelete={handleDelete} 
        onShowDetails={handleShowDetails} 
        onPrint={handlePrint}
        selectedIds={selectedSupplierIds}
        onSelectionChange={setSelectedSupplierIds}
        onSearch={setSearchTerm}
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
