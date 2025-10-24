"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Customer, Payment, OptionItem, ReceiptSettings, Holiday } from "@/lib/definitions";
import { formatSrNo, toTitleCase, formatCurrency, calculateSupplierEntry, calculateSupplierEntryWithValidation, levenshteinDistance } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { addSupplier, deleteSupplier, updateSupplier, getOptionsRealtime, addOption, updateOption, deleteOption, getReceiptSettings, updateReceiptSettings, deletePaymentsForSrNo, deleteAllSuppliers, deleteAllPayments, getHolidays, getDailyPaymentLimit, getInitialSuppliers, getMoreSuppliers, getInitialPayments, getMorePayments, recalculateAndUpdateSuppliers, deleteMultipleSuppliers, recalculateAndUpdateAllSuppliers } from "@/lib/firestore";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { firestoreDB } from "@/lib/firebase";
import { format } from "date-fns";
import { handleDeletePaymentLogic } from "@/lib/payment-logic";
import { db } from '@/lib/database';

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
    labouryRate: 2, labouryAmount: 0, kanta: 50, amount: 0, netAmount: 0, originalNetAmount: 0, barcode: '',
    receiptType: 'Cash', paymentType: lastPaymentType || 'Full', customerId: '', searchValue: '',
  };
};

export const useSupplierEntry = () => {
  const { toast } = useToast();
  
  // State management
  const [suppliers, setSuppliers] = useState<Customer[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [currentSupplier, setCurrentSupplier] = useState<Customer>(() => getInitialFormState());
  const [isEditing, setIsEditing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [autoFillData, setAutoFillData] = useState<Record<string, any> | null>(null);
  
  // Options and settings
  const [varietyOptions, setVarietyOptions] = useState<OptionItem[]>([]);
  const [paymentTypeOptions, setPaymentTypeOptions] = useState<OptionItem[]>([]);
  const [lastVariety, setLastVariety] = useState<string>('');
  const [lastPaymentType, setLastPaymentType] = useState<string>('');
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [dailyPaymentLimit, setDailyPaymentLimit] = useState(800000);
  
  // Form management
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getInitialFormState(),
  });

  // Load data once on mount
  useEffect(() => {
    const loadData = async () => {
      if (db) {
        const suppliersData = await db.suppliers.orderBy('srNo').reverse().toArray();
        const paymentsData = await db.payments.toArray();
        setSuppliers(suppliersData);
        setPaymentHistory(paymentsData);
      }
    };
    loadData();
  }, []);

  // Load settings and options
  useEffect(() => {
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
    
    // Initialize options if they don't exist
    const initializeOptions = async () => {
        try {
            // Check if varieties document exists, if not create it
            const varietiesDoc = await getDoc(doc(firestoreDB, 'options', 'varieties'));
            if (!varietiesDoc.exists()) {
                console.log('Creating varieties document...');
                await setDoc(doc(firestoreDB, 'options', 'varieties'), {
                    items: ['Wheat', 'Rice', 'Corn', 'Barley']
                });
            }
            
            // Check if paymentTypes document exists, if not create it
            const paymentTypesDoc = await getDoc(doc(firestoreDB, 'options', 'paymentTypes'));
            if (!paymentTypesDoc.exists()) {
                console.log('Creating paymentTypes document...');
                await setDoc(doc(firestoreDB, 'options', 'paymentTypes'), {
                    items: ['Full', 'Partial']
                });
            }
        } catch (error) {
            console.error('Error initializing options:', error);
        }
    };
    initializeOptions();

    const unsubVarieties = getOptionsRealtime('varieties', (options) => {
        console.log('Variety options loaded:', options);
        // Use default options if none are loaded
        const finalOptions = options.length > 0 ? options : [
            { id: 'wheat', name: 'Wheat' },
            { id: 'rice', name: 'Rice' },
            { id: 'corn', name: 'Corn' },
            { id: 'barley', name: 'Barley' }
        ];
        setVarietyOptions(finalOptions);
    }, (err) => {
        console.error("Error fetching varieties:", err);
        // Set default options on error
        setVarietyOptions([
            { id: 'wheat', name: 'Wheat' },
            { id: 'rice', name: 'Rice' },
            { id: 'corn', name: 'Corn' },
            { id: 'barley', name: 'Barley' }
        ]);
    });
    
    const unsubPaymentTypes = getOptionsRealtime('paymentTypes', (options) => {
        console.log('Payment type options loaded:', options);
        // Use default options if none are loaded
        const finalOptions = options.length > 0 ? options : [
            { id: 'full', name: 'Full' },
            { id: 'partial', name: 'Partial' }
        ];
        setPaymentTypeOptions(finalOptions);
    }, (err) => {
        console.error("Error fetching payment types:", err);
        // Set default options on error
        setPaymentTypeOptions([
            { id: 'full', name: 'Full' },
            { id: 'partial', name: 'Partial' }
        ]);
    });

    const savedVariety = localStorage.getItem('lastSelectedVariety');
    const savedPaymentType = localStorage.getItem('lastSelectedPaymentType');
    if (savedVariety) setLastVariety(savedVariety);
    if (savedPaymentType) setLastPaymentType(savedPaymentType);

    setIsClient(true);
    setIsLoading(false);

    return () => {
        unsubVarieties();
        unsubPaymentTypes();
    };
  }, []);

  // Safe data with fallbacks
  const safeSuppliers = useMemo(() => suppliers || [], [suppliers]);
  const safePaymentHistory = useMemo(() => paymentHistory || [], [paymentHistory]);

  // Perform calculations (only when needed - on blur)
  const performCalculations = useCallback((data: Partial<FormValues>) => {
    // Ultra-lightweight calculation - only basic math, no heavy operations
    const calculatedState = calculateSupplierEntry(data);
    setCurrentSupplier(prev => ({...prev, ...calculatedState}));
  }, []);

  // Heavy calculations for validation
  const performHeavyCalculations = useCallback((data: Partial<FormValues>, showWarning: boolean = false) => {
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

  // Reset form to state
  const resetFormToState = useCallback((customerState: Customer) => {
    setCurrentSupplier(customerState);
    form.reset(customerState);
  }, [form]);

  // Handle new entry
  const handleNew = useCallback(() => {
    const nextSrNo = formatSrNo(safeSuppliers);
    const newState = getInitialFormState(lastVariety, lastPaymentType);
    newState.srNo = nextSrNo;
    
    // Set persistent date
    let persistentDate = new Date();
    if (typeof window !== 'undefined') {
      const savedDate = localStorage.getItem('supplierEntryDate');
      if (savedDate) {
        persistentDate = new Date(savedDate);
      }
    }
    persistentDate.setHours(0,0,0,0);
    
    newState.date = format(persistentDate, 'yyyy-MM-dd');
    newState.dueDate = format(persistentDate, 'yyyy-MM-dd');
    resetFormToState(newState);
    form.setValue('date', persistentDate);
    
    // Clear auto-fill data for new entry
    setAutoFillData(null);
    
    setTimeout(() => form.setFocus('srNo'), 50);
  }, [safeSuppliers, lastVariety, lastPaymentType, resetFormToState, form, setAutoFillData]);

  // Handle serial number blur - auto-fill all fields
  const handleSrNoBlur = useCallback((srNoValue: string) => {
    let formattedSrNo = srNoValue.trim();
    if (formattedSrNo && !isNaN(parseInt(formattedSrNo)) && isFinite(Number(formattedSrNo))) {
        formattedSrNo = formatSrNo(parseInt(formattedSrNo), 'S');
        form.setValue('srNo', formattedSrNo);
    }
    
    const foundCustomer = safeSuppliers.find(c => c.srNo === formattedSrNo);
    if (foundCustomer) {
        setIsEditing(true);
        resetFormToState(foundCustomer);
        
        // Auto-fill all fields with found customer data
        const allFields = [
            'date', 'term', 'name', 'so', 'address', 'contact', 'vehicleNo', 
            'variety', 'grossWeight', 'teirWeight', 'rate', 'kartaPercentage', 
            'labouryRate', 'kanta', 'paymentType'
        ];
        
        // Create auto-fill data object
        const autoFillData: Record<string, any> = {};
        allFields.forEach(field => {
            const value = foundCustomer[field as keyof Customer];
            if (value !== undefined && value !== null) {
                autoFillData[field] = value;
            }
        });
        
        // Set auto-fill data for immediate UI update FIRST
        setAutoFillData(autoFillData);
        
        // Then set form values after a small delay to ensure auto-fill data is processed
        setTimeout(() => {
            allFields.forEach(field => {
                const value = foundCustomer[field as keyof Customer];
                if (value !== undefined && value !== null) {
                    form.setValue(field as any, value);
                }
            });
            
            // Run calculations with the filled data
            performHeavyCalculations(foundCustomer, true);
        }, 10);
        
        toast({ 
            title: "Supplier found!", 
            description: `Auto-filled all fields for ${foundCustomer.name}` 
        });
    } else if (isEditing) {
        // Keep the form data but switch to "new entry" mode for that SR No.
        setIsEditing(false);
        const currentData = form.getValues();
        setCurrentSupplier(prev => ({
            ...prev,
            srNo: formattedSrNo,
            id: formattedSrNo
        }));
        form.setValue('srNo', formattedSrNo);
        
        // Clear auto-fill data for new entry
        setAutoFillData(null);
    }
    
    // Run heavy calculations on blur for validation
    const currentData = form.getValues();
    performHeavyCalculations(currentData, true);
  }, [safeSuppliers, isEditing, form, resetFormToState, performHeavyCalculations, toast]);

  // Optimized calculation field change handler
  const handleCalculationFieldChange = useCallback((fieldName: string, value: any) => {
    const updatedValues = { [fieldName]: value };
    performCalculations(updatedValues);
  }, [performCalculations]);

  // Handle form submission
  const handleSubmit = useCallback(async (values: FormValues) => {
    try {
      const completeEntry: Customer = {
          ...currentSupplier,
          ...values,
          id: currentSupplier.id || `supplier_${Date.now()}`,
          customerId: currentSupplier.customerId || `customer_${Date.now()}`,
      };

      if (isEditing) {
          await updateSupplier(completeEntry);
          setSuppliers(prev => prev.map(s => s.id === completeEntry.id ? completeEntry : s));
          toast({ title: "Supplier updated successfully!" });
      } else {
          await addSupplier(completeEntry);
          setSuppliers(prev => [completeEntry, ...prev]);
          toast({ title: "Supplier added successfully!" });
      }

      // Save last selected variety and payment type
      localStorage.setItem('lastSelectedVariety', values.variety);
      localStorage.setItem('lastSelectedPaymentType', values.paymentType);
      setLastVariety(values.variety);
      setLastPaymentType(values.paymentType);

      handleNew();
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast({ title: "Error saving supplier", description: "Please try again", variant: "destructive" });
    }
  }, [currentSupplier, isEditing, toast, handleNew]);

  return {
    // State
    suppliers: safeSuppliers,
    paymentHistory: safePaymentHistory,
    currentSupplier,
    isEditing,
    isLoading,
    isClient,
    autoFillData,
    
    // Options
    varietyOptions,
    paymentTypeOptions,
    receiptSettings,
    holidays,
    dailyPaymentLimit,
    
    // Form
    form,
    
    // Actions
    setCurrentSupplier,
    setIsEditing,
    performCalculations,
    performHeavyCalculations,
    handleCalculationFieldChange,
    handleSrNoBlur,
    resetFormToState,
    handleNew,
    handleSubmit,
    
    // Data management
    setSuppliers,
    setPaymentHistory,
    setAutoFillData,
  };
};
