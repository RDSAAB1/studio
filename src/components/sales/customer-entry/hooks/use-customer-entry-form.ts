"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Customer, CustomerPayment, OptionItem } from "@/lib/definitions";
import { formatSrNo, formatDateLocal, calculateCustomerEntry } from "@/lib/utils";
import { getOptionsRealtime } from "@/lib/firestore";

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

/** Returns next customer serial number (e.g. C00001, C00002) from existing customers list */
export function getNextCustomerSrNo(customers: Customer[]): string {
  if (!customers.length) return formatSrNo(1, 'C');
  const maxNum = customers.reduce((max, c) => {
    const num = parseInt(c.srNo?.substring(1) ?? '0', 10) || 0;
    return num > max ? num : max;
  }, 0);
  return formatSrNo(maxNum + 1, 'C');
}

export const getInitialFormState = (lastVariety?: string, lastPaymentType?: string, initialSrNo?: string): Customer => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateStr = formatDateLocal(today);
  const srNo = initialSrNo ?? getNextCustomerSrNo([]);

  // Set default values for RICE BRAN
  const isRiceBran = (lastVariety || '').toUpperCase().trim() === 'RICE BRAN';
  const defaultBaseReport = isRiceBran ? 15 : 0;
  const defaultRiceBranGst = isRiceBran ? 5 : 0;
  const defaultBagWeightKg = isRiceBran ? 0.2 : 0;

  return {
    id: "", srNo, date: dateStr, term: '0', dueDate: dateStr, 
    name: '', companyName: '', address: '', contact: '', gstin: '', stateName: '', stateCode: '', vehicleNo: '', variety: lastVariety || '', grossWeight: 0, teirWeight: 0,
    weight: 0, rate: 0, amount: 0, bags: 0, bagWeightKg: defaultBagWeightKg, bagRate: 0, bagAmount: 0,
    brokerage: 0, brokerageRate: 0, brokerageAmount: 0, cd: 0, cdRate: 0, isBrokerageIncluded: false,
    netWeight: 0, originalNetAmount: 0, netAmount: 0, barcode: '',
    receiptType: 'Cash', paymentType: lastPaymentType || 'Full', customerId: '',
    so: '', kartaPercentage: 0, kartaWeight: 0, kartaAmount: 0, labouryRate: 0, labouryAmount: 0,
    transportationRate: 0, transportAmount: 0, cdAmount: 0, kanta: 0,
    baseReport: defaultBaseReport, collectedReport: 0, riceBranGst: defaultRiceBranGst, calculatedRate: 0,
  };
};

const getInitialFormValues = (lastVariety?: string, lastPaymentType?: string, initialSrNo?: string): FormValues => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const srNo = initialSrNo ?? getNextCustomerSrNo([]);

  return {
    srNo,
    date: today,
    bags: 0,
    name: '',
    companyName: '',
    address: '',
    contact: '',
    gstin: '',
    stateName: '',
    stateCode: '',
    vehicleNo: '',
    variety: lastVariety || '',
    grossWeight: 0,
    teirWeight: 0,
    rate: 0,
    kartaPercentage: 0,
    cd: 0,
    cdAmount: 0,
    brokerage: 0,
    paymentType: lastPaymentType || 'Full',
    isBrokerageIncluded: false,
    bagWeightKg: 0,
    bagRate: 0,
    shippingName: '',
    shippingCompanyName: '',
    shippingAddress: '',
    shippingContact: '',
    shippingGstin: '',
    shippingStateName: '',
    shippingStateCode: '',
    hsnCode: '1006',
    taxRate: 5,
    isGstIncluded: false,
    nineRNo: '',
    gatePassNo: '',
    grNo: '',
    grDate: '',
    transport: '',
    transportationRate: 0,
    baseReport: 0,
    collectedReport: 0,
    riceBranGst: 0,
  };
};

interface UseCustomerEntryFormProps {
  isClient: boolean;
  paymentHistory: CustomerPayment[];
  safeCustomers: Customer[];
}

export function useCustomerEntryForm({ isClient, paymentHistory, safeCustomers }: UseCustomerEntryFormProps) {
  const initialSrNo = getNextCustomerSrNo(safeCustomers);
  const [currentCustomer, setCurrentCustomer] = useState<Customer>(() => getInitialFormState(undefined, undefined, initialSrNo));
  const [isEditing, setIsEditing] = useState(false);
  const [lastVariety, setLastVariety] = useState<string>('');
  const [lastPaymentType, setLastPaymentType] = useState<string>('');
  const [varietyOptions, setVarietyOptions] = useState<OptionItem[]>([]);
  const [paymentTypeOptions, setPaymentTypeOptions] = useState<OptionItem[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getInitialFormValues(lastVariety, lastPaymentType, initialSrNo),
    shouldFocusError: false,
  });

  // When customers list loads/updates and we're on new entry, keep srNo in sync with next serial
  useEffect(() => {
    if (isEditing) return;
    const current = form.getValues('srNo');
    const next = getNextCustomerSrNo(safeCustomers);
    const isPlaceholder = current === 'C----' || current === '';
    const wasDefaultForEmpty = current === 'C00001' && safeCustomers.length > 0;
    if (isPlaceholder || wasDefaultForEmpty) {
      form.setValue('srNo', next, { shouldValidate: false, shouldDirty: false });
    }
  }, [safeCustomers, isEditing, form]);

  // Restore form state from localStorage
  useEffect(() => {
    if (!isClient) return;
    
    try {
      const saved = localStorage.getItem('customer-entry-form-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name || parsed.srNo || parsed.variety || (parsed.grossWeight && parsed.grossWeight > 0)) {
          if (parsed.date) {
            parsed.date = new Date(parsed.date);
          }
          const allowedKeys: (keyof FormValues)[] = [
            'srNo','date','bags','name','companyName','address','contact','gstin','stateName','stateCode',
            'vehicleNo','variety','grossWeight','teirWeight','rate','kartaPercentage','cd','cdAmount',
            'brokerage','paymentType','isBrokerageIncluded','bagWeightKg','bagRate','shippingName',
            'shippingCompanyName','shippingAddress','shippingContact','shippingGstin','shippingStateName',
            'shippingStateCode','hsnCode','taxRate','isGstIncluded','nineRNo','gatePassNo','grNo','grDate',
            'transport','transportationRate','baseReport','collectedReport','riceBranGst'
          ];
          allowedKeys.forEach((k) => {
            if (parsed[k] !== undefined) {
              form.setValue(k, parsed[k] as FormValues[typeof k], { shouldValidate: false });
            }
          });
        }
      }
    } catch (error) {
      // Ignore storage errors
    }
  }, [isClient, form]);

  // Load options and last selected values
  useEffect(() => {
    if (!isClient) return;

    const unsubVarieties = getOptionsRealtime('varieties', setVarietyOptions, () => {});
    const unsubPaymentTypes = getOptionsRealtime('paymentTypes', setPaymentTypeOptions, () => {});

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
  }, [isClient, form]);

  const handleSetLastVariety = (variety: string | null) => {
    const nextVariety = variety || '';
    setLastVariety(nextVariety);
    if (isClient) {
      if (nextVariety) localStorage.setItem('lastSelectedVariety', nextVariety);
      else localStorage.removeItem('lastSelectedVariety');
    }
  };

  const handleSetLastPaymentType = (paymentType: string | null) => {
    const nextPaymentType = paymentType || '';
    setLastPaymentType(nextPaymentType);
    if (isClient) {
      if (nextPaymentType) localStorage.setItem('lastSelectedPaymentType', nextPaymentType);
      else localStorage.removeItem('lastSelectedPaymentType');
    }
  };

  const performCalculations = useCallback((data: Partial<FormValues>) => {
    const calculatedState = calculateCustomerEntry(data, paymentHistory);
    setCurrentCustomer(prev => ({...prev, ...calculatedState}));
  }, [paymentHistory]);

  // Form watch and auto-save
  useEffect(() => {
    let saveTimer: NodeJS.Timeout;
    
    const subscription = form.watch((value) => {
        if (typeof window !== 'undefined') {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
                try {
                    if (value.name || value.srNo || value.variety || (value.grossWeight && (value.grossWeight > 0))) {
                        localStorage.setItem('customer-entry-form-state', JSON.stringify(value));
                    }
                } catch (error) {
                    // Ignore storage errors
                }
            }, 500);
        }
        
        performCalculations(value as Partial<FormValues>);
    });
    
    return () => {
        subscription.unsubscribe();
        clearTimeout(saveTimer);
    };
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
      contact: customerState.contact, gstin: customerState.gstin || '', stateName: customerState.stateName || '', stateCode: customerState.stateCode || '',
      vehicleNo: customerState.vehicleNo, variety: customerState.variety,
      grossWeight: customerState.grossWeight || 0, teirWeight: customerState.teirWeight || 0,
      rate: customerState.rate || 0, 
      kartaPercentage: customerState.kartaPercentage || 0,
      cd: customerState.cdRate !== undefined && customerState.cdRate !== null 
        ? customerState.cdRate 
        : (customerState.cd && customerState.amount && customerState.amount > 0 
          ? (customerState.cd / customerState.amount) * 100 
          : 0),
      cdAmount: customerState.cdAmount || (customerState.cd || 0),
      brokerage: customerState.brokerageRate !== undefined && customerState.brokerageRate !== null
        ? customerState.brokerageRate
        : (customerState.brokerage && customerState.netWeight && customerState.netWeight > 0
          ? customerState.brokerage / customerState.netWeight
          : 0),
      paymentType: customerState.paymentType || 'Full',
      isBrokerageIncluded: customerState.isBrokerageIncluded || false,
      hsnCode: customerState.hsnCode || '1006',
      taxRate: customerState.taxRate || 5,
      isGstIncluded: customerState.isGstIncluded || false,
      nineRNo: customerState.nineRNo || '',
      gatePassNo: customerState.gatePassNo || '',
      grNo: customerState.grNo || '',
      grDate: customerState.grDate || '',
      transport: customerState.transport || '',
      transportationRate: customerState.transportationRate || 0,
      bagWeightKg: customerState.bagWeightKg || 0,
      bagRate: customerState.bagRate || 0,
      shippingName: customerState.shippingName || '',
      shippingCompanyName: customerState.shippingCompanyName || '',
      shippingAddress: customerState.shippingAddress || '',
      shippingContact: customerState.shippingContact || '',
      shippingGstin: customerState.shippingGstin || '',
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
    const nextSrNo = getNextCustomerSrNo(safeCustomers);
    const newState = getInitialFormState(lastVariety, lastPaymentType, nextSrNo);
    const today = new Date();
    today.setHours(0,0,0,0);
    newState.date = formatDateLocal(today);
    newState.dueDate = formatDateLocal(today);
    resetFormToState(newState);
    if (typeof window !== 'undefined') {
        localStorage.removeItem('customer-entry-form-state');
    }
    
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
    if (formattedSrNo === 'C----' || formattedSrNo === '' || formattedSrNo === 'C') {
        return;
    }
    if (formattedSrNo && !isNaN(parseInt(formattedSrNo)) && isFinite(Number(formattedSrNo))) {
        formattedSrNo = formatSrNo(parseInt(formattedSrNo), 'C');
        form.setValue('srNo', formattedSrNo);
    }
    else if (formattedSrNo.startsWith('C') && formattedSrNo.length > 1) {
        const numPart = formattedSrNo.substring(1);
        if (!isNaN(parseInt(numPart)) && isFinite(Number(numPart))) {
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
    if (contactValue.length === 10 && safeCustomers) {
      const latestEntryForContact = safeCustomers
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
      }
    }
  };

  return {
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
  };
}
