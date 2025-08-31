
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Customer, Payment, OptionItem, ReceiptSettings, DocumentType, ConsolidatedReceiptData } from "@/lib/definitions";
import { formatSrNo, toTitleCase, formatCurrency } from "@/lib/utils";

import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { addCustomer, deleteCustomer, getCustomersRealtime, updateCustomer, getPaymentsRealtime, getOptionsRealtime, addOption, updateOption, deleteOption, getReceiptSettings, updateReceiptSettings, deletePaymentsForSrNo } from "@/lib/firestore";
import { format } from "date-fns";

import { CustomerForm } from "@/components/sales/customer-form";
import { CalculatedSummary } from "@/components/sales/calculated-summary";
import { EntryTable } from "@/components/sales/entry-table";
import { DocumentPreviewDialog } from "@/components/sales/document-preview-dialog";
import { CustomerDetailsDialog } from "@/components/sales/customer-details-dialog";
import { ReceiptPrintDialog, ConsolidatedReceiptPrintDialog } from "@/components/sales/print-dialogs";
import { UpdateConfirmDialog } from "@/components/sales/update-confirm-dialog";
import { ReceiptSettingsDialog } from "@/components/sales/receipt-settings-dialog";
import { Hourglass } from "lucide-react";


const formSchema = z.object({
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
});

type FormValues = z.infer<typeof formSchema>;

const getInitialFormState = (lastVariety?: string): Customer => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateStr = today.toISOString().split('T')[0];

  return {
    id: "", srNo: 'C----', date: dateStr, term: '0', dueDate: dateStr, 
    name: '', companyName: '', address: '', contact: '', gstin: '', vehicleNo: '', variety: lastVariety || '', grossWeight: 0, teirWeight: 0,
    weight: 0, rate: 0, amount: 0, bags: 0, bagWeightKg: 0, bagRate: 0, bagAmount: 0,
    kanta: 0, brokerage: 0, brokerageRate: 0, cd: 0, cdRate: 0, isBrokerageIncluded: false,
    netWeight: 0, originalNetAmount: 0, netAmount: 0, barcode: '',
    receiptType: 'Cash', paymentType: 'Full', customerId: '',
    // Fields that should not be here
    so: '', kartaPercentage: 0, kartaWeight: 0, kartaAmount: 0, labouryRate: 0, labouryAmount: 0,
  };
};

export default function CustomerEntryClient() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [currentCustomer, setCurrentCustomer] = useState<Customer>(() => getInitialFormState());
  const [isEditing, setIsEditing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [detailsCustomer, setDetailsCustomer] = useState<Customer | null>(null);
  const [documentPreviewCustomer, setDocumentPreviewCustomer] = useState<Customer | null>(null);
  const [receiptsToPrint, setReceiptsToPrint] = useState<Customer[]>([]);
  const [consolidatedReceiptData, setConsolidatedReceiptData] = useState<ConsolidatedReceiptData | null>(null);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [isDocumentPreviewOpen, setIsDocumentPreviewOpen] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>('tax-invoice');

  const [varietyOptions, setVarietyOptions] = useState<OptionItem[]>([]);
  const [paymentTypeOptions, setPaymentTypeOptions] = useState<OptionItem[]>([]);
  const [lastVariety, setLastVariety] = useState<string>('');
  const isInitialLoad = useRef(true);

  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);
  const [updateAction, setUpdateAction] = useState<((deletePayments: boolean) => void) | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const safeCustomers = useMemo(() => Array.isArray(customers) ? customers : [], [customers]);
  
  const filteredCustomers = useMemo(() => {
    if (!debouncedSearchTerm) {
      return safeCustomers;
    }
    const lowercasedFilter = debouncedSearchTerm.toLowerCase();
    return safeCustomers.filter(customer => {
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
    const unsubscribeCustomers = getCustomersRealtime((data: Customer[]) => {
      setCustomers(data);
      if (isInitialLoad.current && data) {
          const nextSrNum = data.length > 0 ? Math.max(...data.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 : 1;
          const initialSrNo = formatSrNo(nextSrNum, 'C');
          form.setValue('srNo', initialSrNo);
          setCurrentCustomer(prev => ({ ...prev, srNo: initialSrNo }));
          isInitialLoad.current = false;
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching customers: ", error);
      toast({
        title: "Error",
        description: "Failed to load customer data. Please try again.",
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
      unsubscribeCustomers();
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
    const grossWeight = values.grossWeight || 0;
    const teirWeight = values.teirWeight || 0;
    const weight = grossWeight - teirWeight;
    
    const bags = Number(values.bags) || 0;
    const bagWeightPerBagKg = Number(values.bagWeightKg) || 0;
    const totalBagWeightKg = bags * bagWeightPerBagKg;
    const totalBagWeightQuintals = totalBagWeightKg / 100;
    const netWeight = weight - totalBagWeightQuintals;
    
    const rate = values.rate || 0;
    const amount = netWeight * rate;
    
    const brokerageRate = Number(values.brokerage) || 0;
    const brokerageAmount = brokerageRate * weight;

    const cdPercentage = Number(values.cd) || 0;
    const cdAmount = (amount * cdPercentage) / 100;
    
    const kanta = Number(values.kanta) || 0;
    
    const bagRate = Number(values.bagRate) || 0;
    const bagAmount = bags * bagRate;

    let originalNetAmount = amount + kanta + bagAmount - cdAmount;
    if (!values.isBrokerageIncluded) {
        originalNetAmount -= brokerageAmount;
    }

    const totalPaidForThisEntry = paymentHistory
        .filter(p => p.paidFor?.some(pf => pf.srNo === values.srNo))
        .reduce((sum, p) => {
            const paidForDetail = p.paidFor?.find(pf => pf.srNo === values.srNo);
            return sum + (paidForDetail?.amount || 0);
        }, 0);
      
    const netAmount = originalNetAmount - totalPaidForThisEntry;

    setCurrentCustomer(prev => {
        const currentDate = values.date instanceof Date ? values.date : (prev.date ? new Date(prev.date) : new Date());
        return {
            ...prev,
            ...values,
            date: currentDate.toISOString().split("T")[0],
            dueDate: (values.date ? new Date(values.date) : new Date()).toISOString().split("T")[0],
            weight: parseFloat(weight.toFixed(2)),
            netWeight: parseFloat(netWeight.toFixed(2)),
            amount: parseFloat(amount.toFixed(2)),
            brokerage: parseFloat(brokerageAmount.toFixed(2)),
            brokerageRate: brokerageRate,
            cd: parseFloat(cdAmount.toFixed(2)),
            cdRate: cdPercentage,
            kanta: parseFloat(kanta.toFixed(2)),
            bagAmount: parseFloat(bagAmount.toFixed(2)),
            originalNetAmount: parseFloat(originalNetAmount.toFixed(2)),
            netAmount: parseFloat(netAmount.toFixed(2)),
        }
    });
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
      srNo: customerState.srNo, date: formDate, bags: customerState.bags || 0,
      name: customerState.name, companyName: customerState.companyName || '', address: customerState.address,
      contact: customerState.contact, gstin: customerState.gstin || '', vehicleNo: customerState.vehicleNo, variety: customerState.variety,
      grossWeight: customerState.grossWeight || 0, teirWeight: customerState.teirWeight || 0,
      rate: customerState.rate || 0, 
      cd: customerState.cdRate || customerState.cd || 0,
      brokerage: customerState.brokerageRate || customerState.brokerage || 0,
      kanta: customerState.kanta || 0,
      paymentType: customerState.paymentType || 'Full',
      isBrokerageIncluded: customerState.isBrokerageIncluded || false,
      bagWeightKg: customerState.bagWeightKg || 0,
      bagRate: customerState.bagRate || 0,
      shippingName: customerState.shippingName || '',
      shippingCompanyName: customerState.shippingCompanyName || '',
      shippingAddress: customerState.shippingAddress || '',
      shippingContact: customerState.shippingContact || '',
      shippingGstin: customerState.shippingGstin || '',
    };
    setCurrentCustomer(customerState);
    form.reset(formValues);
    performCalculations(formValues);
  }, [form, performCalculations]);

  const handleNew = useCallback(() => {
    setIsEditing(false);
    const nextSrNum = safeCustomers.length > 0 ? Math.max(...safeCustomers.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 : 1;
    const newState = getInitialFormState(lastVariety);
    newState.srNo = formatSrNo(nextSrNum, 'C');
    const today = new Date();
    today.setHours(0,0,0,0);
    newState.date = today.toISOString().split('T')[0];
    newState.dueDate = today.toISOString().split('T')[0];
    resetFormToState(newState);
  }, [safeCustomers, lastVariety, resetFormToState]);

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
    } else {
        setIsEditing(false);
        const currentId = isEditing ? currentCustomer.srNo : "";
        const nextSrNum = safeCustomers.length > 0 ? Math.max(...safeCustomers.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 : 1;
        const currentState = {...getInitialFormState(lastVariety), srNo: formattedSrNo || formatSrNo(nextSrNum, 'C'), id: currentId };
        resetFormToState(currentState);
    }
  }

  const handleContactBlur = (contactValue: string) => {
    if (contactValue.length > 0 && contactValue.length < 10) {
      toast({
        title: "Incomplete Contact Number",
        description: "Please enter a valid 10-digit contact number.",
        variant: "destructive"
      });
      return;
    }
    if (contactValue.length === 10) {
      const foundCustomer = customers.find(c => c.contact === contactValue);
      if (foundCustomer && foundCustomer.id !== currentCustomer.id) {
        form.setValue('name', foundCustomer.name);
        form.setValue('companyName', foundCustomer.companyName || '');
        form.setValue('address', foundCustomer.address);
        form.setValue('gstin', foundCustomer.gstin || '');
        toast({ title: "Customer Found", description: `Details for ${toTitleCase(foundCustomer.name)} have been auto-filled.` });
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
    if (!id) {
      toast({ title: "Error", description: "Cannot delete entry without a valid ID.", variant: "destructive" });
      return;
    }
    try {
      await deleteCustomer(id);
      await deletePaymentsForSrNo(currentCustomer.srNo);
      toast({ title: "Success", description: "Entry and associated payments deleted successfully." });
      if (currentCustomer.id === id) {
        handleNew();
      }
    } catch (error) {
      console.error("Error deleting customer and payments: ", error);
      toast({
        title: "Error",
        description: "Failed to delete entry. Please try again.",
        variant: "destructive",
      });
    }
  };

  const executeSubmit = async (deletePayments: boolean = false, callback?: (savedEntry: Customer) => void) => {
    const formValues = form.getValues();
    
    // Create a new clean object with only the fields relevant to the customer
    const dataToSave: Omit<Customer, 'id'> = {
        srNo: formValues.srNo,
        date: formValues.date.toISOString().split('T')[0],
        term: '0', 
        dueDate: formValues.date.toISOString().split('T')[0],
        name: toTitleCase(formValues.name),
        companyName: toTitleCase(formValues.companyName || ''),
        address: toTitleCase(formValues.address),
        contact: formValues.contact,
        gstin: formValues.gstin,
        vehicleNo: toTitleCase(formValues.vehicleNo),
        variety: toTitleCase(formValues.variety),
        paymentType: formValues.paymentType,
        customerId: `${toTitleCase(formValues.name).toLowerCase()}|${formValues.contact.toLowerCase()}`,
        
        // Form fields for customer
        grossWeight: formValues.grossWeight,
        teirWeight: formValues.teirWeight,
        rate: formValues.rate,
        bags: formValues.bags,
        bagWeightKg: formValues.bagWeightKg,
        bagRate: formValues.bagRate,
        kanta: formValues.kanta,
        isBrokerageIncluded: formValues.isBrokerageIncluded,

        // Shipping details
        shippingName: toTitleCase(formValues.shippingName || ''),
        shippingCompanyName: toTitleCase(formValues.shippingCompanyName || ''),
        shippingAddress: toTitleCase(formValues.shippingAddress || ''),
        shippingContact: formValues.shippingContact,
        shippingGstin: formValues.shippingGstin,
        
        // Values from calculations
        weight: currentCustomer.weight,
        netWeight: currentCustomer.netWeight,
        amount: currentCustomer.amount,
        bagAmount: currentCustomer.bagAmount,
        cd: currentCustomer.cd,
        cdRate: currentCustomer.cdRate,
        brokerage: currentCustomer.brokerage,
        brokerageRate: currentCustomer.brokerageRate,
        originalNetAmount: currentCustomer.originalNetAmount,
        netAmount: currentCustomer.netAmount,

        // Fields to explicitly exclude
        so: '',
        kartaPercentage: 0,
        kartaWeight: 0,
        kartaAmount: 0,
        labouryRate: 0,
        labouryAmount: 0,
        barcode: '',
        receiptType: 'Cash',
    };
    
    try {
        if (isEditing && currentCustomer.id && currentCustomer.id !== dataToSave.srNo) {
            await deleteCustomer(currentCustomer.id);
        }
        
        if (deletePayments) {
            await deletePaymentsForSrNo(dataToSave.srNo!);
            const entryWithRestoredAmount = { ...dataToSave, netAmount: dataToSave.originalNetAmount, id: dataToSave.srNo };
            await addCustomer(entryWithRestoredAmount as Customer);
            toast({ title: "Success", description: "Entry updated and payments deleted." });
            if (callback) callback(entryWithRestoredAmount as Customer); else handleNew();
        } else {
            const entryToSave = { ...dataToSave, id: dataToSave.srNo };
            await addCustomer(entryToSave as Customer);
            toast({ title: "Success", description: `Entry ${isEditing ? 'updated' : 'saved'} successfully.` });
            if (callback) callback(entryToSave as Customer); else handleNew();
        }
    } catch (error) {
        console.error("Error saving customer:", error);
        toast({ title: "Error", description: "Failed to save entry.", variant: "destructive" });
    }
  };

  const onSubmit = async (callback?: (savedEntry: Customer) => void) => {
    if (isEditing) {
        const hasPayments = paymentHistory.some(p => p.paidFor?.some(pf => pf.srNo === currentCustomer.srNo));
        if (hasPayments) {
            setUpdateAction(() => (deletePayments: boolean) => executeSubmit(deletePayments, callback));
            setIsUpdateConfirmOpen(true);
            return;
        }
    }
    executeSubmit(false, callback);
  };

  const handleSaveAndPrint = async (docType: DocumentType) => {
    const isValid = await form.trigger();
    if (isValid) {
      onSubmit((savedEntry) => {
        setDocumentPreviewCustomer(savedEntry);
        setDocumentType(docType);
        setIsDocumentPreviewOpen(true);
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
    setDetailsCustomer(customer);
  };

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
                title: "Multiple Customers Selected",
                description: "Consolidated receipts can only be printed for a single customer at a time.",
                variant: "destructive",
            });
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
        <form onSubmit={form.handleSubmit(() => onSubmit())} onKeyDown={handleKeyDown} className="space-y-4">
            <CustomerForm 
                form={form}
                handleSrNoBlur={handleSrNoBlur}
                handleContactBlur={handleContactBlur}
                varietyOptions={varietyOptions}
                paymentTypeOptions={paymentTypeOptions}
                setLastVariety={handleSetLastVariety}
                handleAddOption={addOption}
                handleUpdateOption={updateOption}
                handleDeleteOption={deleteOption}
                allCustomers={safeCustomers}
            />
            
            <CalculatedSummary
                customer={currentCustomer}
                onSave={() => form.handleSubmit(() => onSubmit())()}
                onSaveAndPrint={handleSaveAndPrint}
                onNew={handleNew}
                isEditing={isEditing}
                isCustomerForm={true}
                isBrokerageIncluded={form.watch('isBrokerageIncluded')}
                onBrokerageToggle={(checked: boolean) => form.setValue('isBrokerageIncluded', checked)}
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
        onSearch={setSearchTerm}
        entryType="Customer"
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
    </div>
  );
}
