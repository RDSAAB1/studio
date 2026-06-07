
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { FormProvider } from "react-hook-form";
import type { Customer, CustomerPayment, OptionItem, ReceiptSettings, DocumentType, ConsolidatedReceiptData, CustomerDocument } from "@/lib/definitions";
import { toTitleCase, formatCurrency, formatDateLocal, formatSrNo } from "@/lib/utils";

import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { addCustomer, updateCustomer, deleteCustomer, bulkUpsertCustomers, addOption, updateOption, deleteOption, updateReceiptSettings, deleteCustomerPaymentsForSrNo, addCustomerDocument, updateCustomerDocument, deleteCustomerDocument } from "@/lib/firestore";
import { useGlobalData } from '@/contexts/global-data-context';
import { format } from "date-fns";
import { db } from "@/lib/database";

import { CustomerForm } from "@/components/sales/customer-form";
import { CalculatedSummary } from "@/components/sales/calculated-summary";
import { SimpleCustomerTable } from "@/components/sales/simple-customer-table";
import React from "react";
import { CustomerEntryDialogs } from "./components/customer-entry-dialogs";
import { useCustomerImportExport } from "./hooks/use-customer-import-export";
import { useCustomerEntryForm, type FormValues, getInitialFormState } from "./hooks/use-customer-entry-form";

const MemoizedCustomerTable = React.memo(SimpleCustomerTable);

export default function CustomerEntryClient() {
  const { toast } = useToast();
  // Use global context for receipt settings (customers and payment history are managed via pagination for now)
  const globalData = useGlobalData();
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [paymentHistory, setPaymentHistory] = useState<CustomerPayment[]>([]);

  const [isClient, setIsClient] = useState(false);
  // NO LOADING STATES - Data loads initially, then only CRUD updates
  
  const [detailsCustomer, setDetailsCustomer] = useState<Customer | null>(null);
  const [documentPreviewCustomer, setDocumentPreviewCustomer] = useState<Customer | null>(null);
  const [receiptsToPrint, setReceiptsToPrint] = useState<Customer[]>([]);
  const [consolidatedReceiptData, setConsolidatedReceiptData] = useState<ConsolidatedReceiptData | null>(null);
  const [isDocumentPreviewOpen, setIsDocumentPreviewOpen] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>('tax-invoice');

  // Use receipt settings from global context
  const receiptSettings = globalData.receiptSettings;
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);
  const [updateAction, setUpdateAction] = useState<((deletePayments: boolean) => void) | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVariety, setSelectedVariety] = useState<string>("ALL");
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>("ALL");
  const [selectedParticularDate, setSelectedParticularDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const [selectedStartDate, setSelectedStartDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const [selectedEndDate, setSelectedEndDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const debouncedSearchTerm = useDebounce(searchTerm, 10);
  const [highlightEntryId, setHighlightEntryId] = useState<string | null>(null);

  useEffect(() => {
    if (!isClient) return;
    const loadDefaultFilters = async () => {
      try {
        // Variety
        const storedVariety = await db.settings.get('customerEntryDefaultVariety');
        if (storedVariety && (storedVariety as any).value) {
          setSelectedVariety((storedVariety as any).value);
        } else {
          const localVariety = localStorage.getItem('customerEntryDefaultVariety');
          if (localVariety) setSelectedVariety(localVariety);
        }

        // Date Filter Mode
        const storedDateFilter = await db.settings.get('customerEntryDefaultDateFilter');
        if (storedDateFilter && (storedDateFilter as any).value) {
          setSelectedDateFilter((storedDateFilter as any).value);
        } else {
          const localDateFilter = localStorage.getItem('customerEntryDefaultDateFilter');
          if (localDateFilter) setSelectedDateFilter(localDateFilter);
        }

        // Particular Date
        const storedParticularDate = await db.settings.get('customerEntryDefaultParticularDate');
        if (storedParticularDate && (storedParticularDate as any).value) {
          setSelectedParticularDate((storedParticularDate as any).value);
        } else {
          const localParticularDate = localStorage.getItem('customerEntryDefaultParticularDate');
          if (localParticularDate) setSelectedParticularDate(localParticularDate);
        }

        // Start Date
        const storedStartDate = await db.settings.get('customerEntryDefaultStartDate');
        if (storedStartDate && (storedStartDate as any).value) {
          setSelectedStartDate((storedStartDate as any).value);
        } else {
          const localStartDate = localStorage.getItem('customerEntryDefaultStartDate');
          if (localStartDate) setSelectedStartDate(localStartDate);
        }

        // End Date
        const storedEndDate = await db.settings.get('customerEntryDefaultEndDate');
        if (storedEndDate && (storedEndDate as any).value) {
          setSelectedEndDate((storedEndDate as any).value);
        } else {
          const localEndDate = localStorage.getItem('customerEntryDefaultEndDate');
          if (localEndDate) setSelectedEndDate(localEndDate);
        }
      } catch (err) {
        console.error("Failed to load default customer filters:", err);
      }
    };
    loadDefaultFilters();
  }, [isClient]);

  const handleVarietyChange = useCallback(async (val: string | null) => {
    const newValue = val || "ALL";
    setSelectedVariety(newValue);
    try {
      await db.settings.put({ id: 'customerEntryDefaultVariety', value: newValue });
      localStorage.setItem('customerEntryDefaultVariety', newValue);
    } catch (err) {
      console.error("Failed to save default variety:", err);
    }
  }, []);

  const handleDateFilterModeChange = useCallback(async (val: string | null) => {
    const newValue = val || "ALL";
    setSelectedDateFilter(newValue);
    try {
      await db.settings.put({ id: 'customerEntryDefaultDateFilter', value: newValue });
      localStorage.setItem('customerEntryDefaultDateFilter', newValue);
    } catch (err) {
      console.error("Failed to save date filter mode:", err);
    }
  }, []);

  const handleParticularDateChange = useCallback(async (val: string) => {
    setSelectedParticularDate(val);
    try {
      await db.settings.put({ id: 'customerEntryDefaultParticularDate', value: val });
      localStorage.setItem('customerEntryDefaultParticularDate', val);
    } catch (err) {
      console.error("Failed to save particular date:", err);
    }
  }, []);

  const handleStartDateChange = useCallback(async (val: string) => {
    setSelectedStartDate(val);
    try {
      await db.settings.put({ id: 'customerEntryDefaultStartDate', value: val });
      localStorage.setItem('customerEntryDefaultStartDate', val);
    } catch (err) {
      console.error("Failed to save start date:", err);
    }
  }, []);

  const handleEndDateChange = useCallback(async (val: string) => {
    setSelectedEndDate(val);
    try {
      await db.settings.put({ id: 'customerEntryDefaultEndDate', value: val });
      localStorage.setItem('customerEntryDefaultEndDate', val);
    } catch (err) {
      console.error("Failed to save end date:", err);
    }
  }, []);
  const containerRef = useRef<HTMLDivElement>(null);

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
    let results = safeCustomers;

    // Apply date filter
    if (selectedDateFilter === "TODAY") {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      results = results.filter(customer => customer.date === todayStr);
    } else if (selectedDateFilter === "PARTICULAR" && selectedParticularDate) {
      results = results.filter(customer => customer.date === selectedParticularDate);
    } else if (selectedDateFilter === "RANGE" && selectedStartDate && selectedEndDate) {
      results = results.filter(customer => {
        if (!customer.date) return false;
        return customer.date >= selectedStartDate && customer.date <= selectedEndDate;
      });
    }

    // Apply variety filter
    if (selectedVariety !== 'ALL') {
      results = results.filter(customer => 
        customer.variety?.toUpperCase() === selectedVariety.toUpperCase()
      );
    }

    // Apply search filter
    if (!debouncedSearchTerm || !debouncedSearchTerm.trim()) {
      return results;
    }
    
    const filter = debouncedSearchTerm.trim().toLowerCase();
    
    // Use indexed search for faster filtering
    return results.filter(customer => {
      const searchIndex = [
        customer.name?.toLowerCase() || '',
        customer.contact || '',
        customer.srNo?.toLowerCase() || '',
        customer.companyName?.toLowerCase() || '',
        customer.address?.toLowerCase() || ''
      ].join(' ');
      return searchIndex.includes(filter);
    });
  }, [safeCustomers, debouncedSearchTerm, selectedVariety, selectedDateFilter, selectedParticularDate, selectedStartDate, selectedEndDate]);

  // Calculate totals for filtered data
  const tableTotals = useMemo(() => {
    const totals = filteredCustomers.reduce((acc, curr) => {
      const baseAmt = Number(curr.amount || 0);
      const kAmt = Number(curr.kartaAmount || 0);
      const bDeduction = Number((curr as any).bagWeightDeductionAmount || 0);
      const finalAmt = baseAmt - kAmt - bDeduction;
      
      const cdAmt = baseAmt * ((Number(curr.cdRate || curr.cd || 0)) / 100);
      const brkAmt = (Number(curr.weight || 0)) * (Number(curr.brokerageRate || curr.brokerage || 0));
      const transAmt = Number((curr as any).transportAmount || 0);
      const kantaAmt = Number(curr.kanta || 0);
      const bagAmt = Number(curr.bagAmount || 0);
      const advFreight = Number(curr.advanceFreight || 0);
      
      const totalRec = finalAmt - cdAmt - brkAmt + bagAmt + transAmt + kantaAmt + advFreight;

      const totalBagWtQtl = (Number(curr.bags || 0) * Number(curr.bagWeightKg || 0)) / 100;
      const avgBagWtKg = Number(curr.bags || 0) > 0 ? (Number(curr.netWeight || 0) * 100) / Number(curr.bags) : 0;

      return {
        bags: acc.bags + Number(curr.bags || 0),
        grossWt: acc.grossWt + Number(curr.grossWeight || 0),
        teirWt: acc.teirWt + Number(curr.teirWeight || 0),
        finalWt: acc.finalWt + Number(curr.weight || 0),
        kartaWt: acc.kartaWt + Number(curr.kartaWeight || 0),
        totalBagWt: acc.totalBagWt + totalBagWtQtl,
        netWt: acc.netWt + Number(curr.netWeight || 0),
        rate: acc.rate + Number(curr.rate || 0),
        baseAmt: acc.baseAmt + baseAmt,
        kartaAmt: acc.kartaAmt + kAmt,
        bagDedAmt: acc.bagDedAmt + bDeduction,
        finalAmt: acc.finalAmt + finalAmt,
        brkAmt: acc.brkAmt + brkAmt,
        cdAmt: acc.cdAmt + cdAmt,
        transAmt: acc.transAmt + transAmt,
        totalRec: acc.totalRec + totalRec,
        avgBagWt: acc.avgBagWt + avgBagWtKg,
        count: acc.count + 1
      };
    }, { 
        bags: 0, grossWt: 0, teirWt: 0, finalWt: 0, kartaWt: 0, totalBagWt: 0, 
        netWt: 0, rate: 0, baseAmt: 0, kartaAmt: 0, bagDedAmt: 0, finalAmt: 0, 
        brkAmt: 0, cdAmt: 0, transAmt: 0, totalRec: 0, avgBagWt: 0, count: 0 
    });

    // Calculate averages where needed
    if (totals.count > 0) {
        return {
            ...totals,
            rateAvg: totals.rate / totals.count,
            avgBagWtAvg: totals.avgBagWt / totals.count
        };
    }
    return totals;
  }, [filteredCustomers]);

  const {
    form,
    currentCustomer,
    setCurrentCustomer,
    isEditing,
    setIsEditing,
    varietyOptions,
    paymentTypeOptions,
    handleNew,
    handleSrNoBlur,
    handleContactBlur,
    resetFormToState,
    handleSetLastVariety,
    handleSetLastPaymentType,
  } = useCustomerEntryForm({
    isClient,
    paymentHistory,
    safeCustomers,
  });



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

  const handleMultiPrint = useCallback((customersToPrint: Customer[]) => {
    if (customersToPrint.length === 0) return;
    setReceiptsToPrint(customersToPrint);
    setConsolidatedReceiptData(null);
    toast({
      title: "Print Format",
      description: `Opening print format for ${customersToPrint.length} entries`
    });
  }, [toast]);

  const handleMultiDelete = useCallback(async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    try {
      for (const id of ids) {
        const customerToDelete = customers.find(c => c.id === id);
        await deleteCustomer(id);
        if (customerToDelete) {
          await deleteCustomerPaymentsForSrNo(customerToDelete.srNo);
        }
      }
      setCustomers(prev => prev.filter(c => !ids.includes(c.id)));
      toast({
        title: "Success",
        description: `${ids.length} entries deleted successfully`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete entries",
        variant: "destructive",
      });
    }
  }, [customers, toast]);


  const executeSubmit = async (deletePayments: boolean = false, callback?: (savedEntry: Customer) => void) => {
    const formValues = form.getValues();
    
    // Auto-generate SR No if missing or invalid (optimized - no sort)
    let srNo = formValues.srNo?.trim() ?? "";
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
        transportationRate: formValues.transportationRate ?? 0,
        cdRate: formValues.cd ?? 0, // Save CD percentage as cdRate
        cd: currentCustomer.cd ?? 0, // Save calculated CD amount
        cdAmount: formValues.cdAmount ?? 0, // Save CD amount if entered directly
        brokerageRate: formValues.brokerage ?? 0, // Save brokerage percentage as brokerageRate
        so: '',
        kartaPercentage: formValues.kartaPercentage ?? 0,
        kartaWeight: currentCustomer.kartaWeight ?? 0, // Use calculated value
        kartaAmount: currentCustomer.kartaAmount ?? 0, // Use calculated value
        bagWeightDeductionAmount: currentCustomer.bagWeightDeductionAmount ?? 0, // Bag Weight deduction amount
        transportAmount: currentCustomer.transportAmount ?? 0, // Transport Amount = Transportation Rate × Final Weight
        labouryRate: 0,
        labouryAmount: 0,
        barcode: '',
        receiptType: 'Cash',
        baseReport: formValues.baseReport ?? 0,
        collectedReport: formValues.collectedReport ?? 0,
        riceBranGst: formValues.riceBranGst ?? 0,
        ...(currentCustomer.calculatedRate != null && { calculatedRate: currentCustomer.calculatedRate }),
    };
    
    try {
        // If editing and SR No changed, delete old entry first before proceeding
        if (isEditing && currentCustomer.id && currentCustomer.id !== dataToSave.srNo) {
            try {
                await deleteCustomer(currentCustomer.id);
            } catch (saveError) {
                const msg = saveError instanceof Error ? saveError.message : String(saveError);
                toast({ title: "Failed to remove old entry from database.", description: msg, variant: "destructive" });
                return;
            }
            setCustomers(prev => prev.filter(c => c.id !== currentCustomer.id));
        }
        
        if (deletePayments) {
            const entryWithRestoredAmount = { ...dataToSave, netAmount: dataToSave.originalNetAmount, id: dataToSave.srNo };
            
            if (isEditing && currentCustomer.id === dataToSave.srNo) {
                const { id, ...updateData } = entryWithRestoredAmount as Customer;
                const updatedEntry = entryWithRestoredAmount as Customer;
                try {
                    await updateCustomer(id, updateData);
                    await deleteCustomerPaymentsForSrNo(dataToSave.srNo!);
                } catch (saveError) {
                    const msg = saveError instanceof Error ? saveError.message : String(saveError);
                    toast({ title: "Failed to save to database.", description: msg, variant: "destructive" });
                    return;
                }
                setCustomers(prev => {
                    const existingIndex = prev.findIndex(c => c.id === id);
                    if (existingIndex > -1) {
                        const newCustomers = [...prev];
                        newCustomers[existingIndex] = updatedEntry;
                        return newCustomers;
                    }
                    return [updatedEntry, ...prev];
                });
                setHighlightEntryId(updatedEntry.id);
                setTimeout(() => setHighlightEntryId(null), 3000);
                toast({ title: "Entry updated, payments deleted.", variant: "success" });
                if (callback) callback(updatedEntry); else handleNew();
            } else {
                try {
                    await addCustomer(entryWithRestoredAmount as Customer);
                    await deleteCustomerPaymentsForSrNo(dataToSave.srNo!);
                } catch (saveError) {
                    const msg = saveError instanceof Error ? saveError.message : String(saveError);
                    toast({ title: "Failed to save to database.", description: msg, variant: "destructive" });
                    return;
                }
                setCustomers(prev => {
                    const existingIndex = prev.findIndex(c => c.id === entryWithRestoredAmount.id);
                    if (existingIndex > -1) {
                        const newCustomers = [...prev];
                        newCustomers[existingIndex] = entryWithRestoredAmount as Customer;
                        return newCustomers;
                    }
                    return [entryWithRestoredAmount as Customer, ...prev];
                });
                setHighlightEntryId(entryWithRestoredAmount.id);
                setTimeout(() => setHighlightEntryId(null), 3000);
                toast({ title: "Entry updated, payments deleted.", variant: "success" });
                if (callback) callback(entryWithRestoredAmount as Customer); else handleNew();
            }
        } else {
            // Ensure ID is set to SR No
            const entryToSave = { ...dataToSave, id: srNo };
            
            // If editing, always use updateCustomer if we have an existing ID
            if (isEditing && currentCustomer.id) {
                // Check if SR No changed - if yes, we need to handle it differently
                if (currentCustomer.id !== srNo && currentCustomer.srNo && currentCustomer.srNo !== srNo) {
                    // SR No changed - delete old and create new
                    const tempEntry = { ...entryToSave, id: srNo } as Customer;
                    try {
                        await deleteCustomer(currentCustomer.id);
                        await addCustomer(tempEntry);
                    } catch (saveError) {
                        const msg = saveError instanceof Error ? saveError.message : String(saveError);
                        toast({ title: "Failed to save to database.", description: msg, variant: "destructive" });
                        return;
                    }
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
                    setHighlightEntryId(tempEntry.id);
                    setTimeout(() => setHighlightEntryId(null), 3000);
                    toast({ title: "Entry updated successfully.", variant: "success" });
                    if (typeof window !== 'undefined' && !callback) {
                        localStorage.removeItem('customer-entry-form-state');
                    }
                    if (callback) callback(tempEntry); else handleNew();
                } else {
                    // Same ID or updating existing - use updateCustomer
                    const updateId = currentCustomer.id || srNo;
                    const { id, ...updateData } = entryToSave as Customer;
                    const updatedEntry = { ...entryToSave, id: updateId } as Customer;
                    try {
                        await updateCustomer(updateId, updateData);
                    } catch (saveError) {
                        const msg = saveError instanceof Error ? saveError.message : String(saveError);
                        toast({ title: "Failed to save to database.", description: msg, variant: "destructive" });
                        return;
                    }
                    setCustomers(prev => {
                        const existingIndex = prev.findIndex(c => c.id === updateId);
                        if (existingIndex > -1) {
                            const newCustomers = [...prev];
                            newCustomers[existingIndex] = updatedEntry;
                            return newCustomers;
                        }
                        return [updatedEntry, ...prev];
                    });
                    setHighlightEntryId(updatedEntry.id);
                    setTimeout(() => setHighlightEntryId(null), 3000);
                    toast({ title: "Entry updated successfully.", variant: "success" });
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
                }
            } else {
                // New entry - save to database first, then update UI and show success
                const tempEntry = entryToSave as Customer;
                try {
                    await addCustomer(tempEntry);
                } catch (saveError) {
                    const msg = saveError instanceof Error ? saveError.message : String(saveError);
                    toast({ title: "Failed to save to database.", description: msg, variant: "destructive" });
                    return;
                }
                // Update UI after successful save
                setCustomers(prev => {
                    const existingIndex = prev.findIndex(c => c.id === tempEntry.id);
                    if (existingIndex > -1) {
                        const newCustomers = [...prev];
                        newCustomers[existingIndex] = tempEntry;
                        return newCustomers;
                    }
                    return [tempEntry, ...prev];
                });
                setHighlightEntryId(tempEntry.id);
                setTimeout(() => setHighlightEntryId(null), 3000);
                toast({ title: "Entry saved successfully.", variant: "success" });
                if (typeof window !== 'undefined' && !callback) {
                    localStorage.removeItem('customer-entry-form-state');
                }
                if (callback) callback(tempEntry); else handleNew();
            }
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast({
          title: "Failed to save entry.",
          description: message,
          variant: "destructive",
        });
    }
  };

  const onSubmit = async (callback?: (savedEntry: Customer) => void) => {
    await executeSubmit(false, callback);
  };

  const handleSaveAndPrint = async (docType: 'tax-invoice' | 'bill-of-supply' | 'challan' | 'receipt') => {
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

  // Global Shortcuts (Alt+S, Alt+C)
  useEffect(() => {
    const onSave = () => {
        // Only execute if this component is visible in the DOM
        if (containerRef.current?.closest('.hidden')) return;
        form.handleSubmit(() => onSubmit())();
    };
    const onClear = () => {
        // Only execute if this component is visible in the DOM
        if (containerRef.current?.closest('.hidden')) return;
        handleNew();
    };

    const onPrint = () => {
        if (containerRef.current?.closest('.hidden')) return;
        handleSaveAndPrint('tax-invoice');
    };

    window.addEventListener('app:save-entry', onSave);
    window.addEventListener('app:clear-form', onClear);
    window.addEventListener('app:print-entry', onPrint);

    return () => {
        window.removeEventListener('app:save-entry', onSave);
        window.removeEventListener('app:clear-form', onClear);
        window.removeEventListener('app:print-entry', onPrint);
    };
  }, [form, onSubmit, handleNew]);

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
          allFocusable[currentIndex + 1]?.focus();
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
          nextElement?.focus();
          // If it's an input, select the text if it's 0 or 0.00
          if (nextElement instanceof HTMLInputElement && (nextElement.value === '0' || nextElement.value === '0.00')) {
            setTimeout(() => nextElement.select(), 0);
          }
        }
      } else if (currentElementIndex === -1 && formElements.length > 0) {
        // If current element not found, focus first element
        formElements[0]?.focus();
      }
    }
  };

  if (!isClient) {
    return null;
  }

  return (
    <div ref={containerRef} className="space-y-4">
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
        </form>
      </FormProvider>      

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
        totals={tableTotals}
      />

      <MemoizedCustomerTable 
        onEditCustomer={handleEdit} 
        onViewDetails={handleShowDetails}
        onPrintCustomer={handleSinglePrint}
        onMultiPrint={handleMultiPrint}
        onMultiDelete={handleMultiDelete}
        customers={filteredCustomers}
        totalCount={filteredCustomers.length}
        varietyOptions={varietyOptions}
        highlightEntryId={highlightEntryId ?? undefined}
        selectedVariety={selectedVariety}
        onVarietyChange={handleVarietyChange}
        selectedDateFilter={selectedDateFilter}
        onDateFilterModeChange={handleDateFilterModeChange}
        selectedParticularDate={selectedParticularDate}
        onParticularDateChange={handleParticularDateChange}
        selectedStartDate={selectedStartDate}
        onStartDateChange={handleStartDateChange}
        selectedEndDate={selectedEndDate}
        onEndDateChange={handleEndDateChange}
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
