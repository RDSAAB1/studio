
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Customer, Payment, Holiday } from './definitions';
import { isSunday, addDays, differenceInCalendarDays, isValid, parseISO, format } from 'date-fns';

interface SupplierFormValues {
    date: Date;
    term: string | number;
    srNo?: string;
    grossWeight?: number;
    teirWeight?: number;
    kartaPercentage?: number;
    rate?: number;
    labouryRate?: number;
    kanta?: number;
}

interface CustomerFormValues {
    date: Date;
    srNo?: string;
    grossWeight?: number;
    teirWeight?: number;
    bags?: number;
    bagWeightKg?: number;
    rate?: number;
    brokerageRate?: number;
    cd?: number;
    kanta?: number;
    bagRate?: number;
    isBrokerageIncluded?: boolean;
    advanceFreight?: number;
}


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toTitleCase(str: any) {
  if (typeof str !== 'string' || !str) return '';
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

export function formatSrNo(num: number | string, prefix: 'S' | 'C' | 'R' = 'S') {
  return prefix + String(num).padStart(5, '0');
}

export function formatTransactionId(num: number | string, prefix: 'IN' | 'EX' = 'IN') {
  return prefix + String(num).padStart(5, '0');
}


export function formatPaymentId(num: number | string) {
  return 'P' + String(num).padStart(5, '0');
}

export function formatCurrency(amount: number): string {
  if (isNaN(amount)) amount = 0;
  const options = {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  };
  return new Intl.NumberFormat('en-IN', options).format(Math.round(amount));
}

// Function to generate human-readable sequential IDs
export const generateReadableId = (prefix: string, lastNumber: number, padding: number): string => {
  const newNumber = lastNumber + 1;
  return `${prefix}${String(newNumber).padStart(padding, '0')}`;
};

// Ultra-lightweight calculation function - only basic math, no heavy operations
export const calculateSupplierEntry = (values: Partial<SupplierFormValues>, paymentHistory?: any[], holidays?: Holiday[], dailyPaymentLimit?: number, allSuppliers?: Customer[]) => {
    // Add null/undefined check to prevent runtime errors
    if (!values) {
        return {
            weight: 0,
            kartaWeight: 0,
            kartaAmount: 0,
            netWeight: 0,
            amount: 0,
            labouryAmount: 0,
            originalNetAmount: 0,
            netAmount: 0
        };
    }
    
    const grossWeight = values.grossWeight || 0;
    const teirWeight = values.teirWeight || 0;
    const weight = grossWeight - teirWeight;
    const kartaPercentage = values.kartaPercentage || 0;
    const rate = values.rate || 0;
    
    const decimalPart = Math.round((weight - Math.floor(weight)) * 10);
    const rawKartaWeight = weight * kartaPercentage / 100;

    let kartaWeight;
    if (decimalPart >= 5) {
        kartaWeight = Math.ceil(rawKartaWeight * 100) / 100;
    } else {
        kartaWeight = Math.floor(rawKartaWeight * 100) / 100;
    }

    const kartaAmount = Math.round(kartaWeight * rate);
    const netWeight = weight - kartaWeight;
    const amount = Math.round(weight * rate); 
    const labouryRate = values.labouryRate || 0;
    const labouryAmount = Math.round(weight * labouryRate);
    const kanta = values.kanta || 0;
    const originalNetAmount = Math.round(amount - labouryAmount - kanta - kartaAmount);
    const netAmount = originalNetAmount;

    return {
      ...values,
      weight,
      kartaWeight,
      kartaAmount,
      netWeight,
      amount,
      labouryAmount,
      originalNetAmount,
      netAmount
    };
};

// Heavy calculations moved to background - only called when needed (onBlur, onSubmit)
export const calculateSupplierEntryWithValidation = (values: Partial<SupplierFormValues>, paymentHistory: any[], holidays: Holiday[], dailyPaymentLimit: number, allSuppliers: Customer[]) => {
    const termDays = Number(values.term) || 0;
    
    let entryDate: Date;
    if (values.date) {
        entryDate = typeof values.date === 'string' ? parseISO(values.date) : values.date;
        if (!isValid(entryDate)) {
            entryDate = new Date();
        }
    } else {
        entryDate = new Date();
    }
    entryDate.setHours(0, 0, 0, 0);

    let newDueDate = addDays(entryDate, termDays);
    let warning = '';
    let suggestedTerm: number | null = null;
    
    const isHoliday = (d: Date) => isSunday(d) || holidays.some(h => new Date(h.date).toDateString() === d.toDateString());

    if (isHoliday(newDueDate)) {
        let shiftedDate = new Date(newDueDate);
        while (isHoliday(shiftedDate)) {
            shiftedDate = addDays(shiftedDate, 1);
        }
        warning = `Due date was on a holiday/Sunday.`;
        newDueDate = shiftedDate;
        suggestedTerm = differenceInCalendarDays(newDueDate, entryDate);
    }
    
    // Get basic calculations first
    const basicCalculations = calculateSupplierEntry(values);

    if (allSuppliers && allSuppliers.length > 0) {
        let dailyTotal = 0;
        const dueDateString = format(newDueDate, 'yyyy-MM-dd');
        
        // Calculate daily total from existing suppliers
        allSuppliers.forEach(supplier => {
            if (supplier.dueDate === dueDateString) {
                dailyTotal += Number(supplier.netAmount) || 0;
            }
        });

        // Add the current entry's amount to the daily total
        // Use the calculated netAmount from basicCalculations
        const currentEntryAmount = Number(basicCalculations.netAmount) || 0;
        
        // Only add positive amounts to avoid negative values
        if (currentEntryAmount > 0) {
            dailyTotal += currentEntryAmount;
        }

        // Debug logging removed for performance

        if (dailyTotal > dailyPaymentLimit) {
            let nextAvailableDate = addDays(newDueDate, 1);
            while (isHoliday(nextAvailableDate)) {
                 nextAvailableDate = addDays(nextAvailableDate, 1);
            }
            warning += ` Daily limit of ${formatCurrency(dailyPaymentLimit)} on ${newDueDate.toLocaleDateString()} reached.`;
            newDueDate = nextAvailableDate;
            suggestedTerm = differenceInCalendarDays(newDueDate, entryDate);
        }
    }

    return {
      ...basicCalculations,
      date: entryDate.toISOString().split('T')[0],
      term: String(values.term), 
      dueDate: newDueDate.toISOString().split('T')[0],
      warning,
      suggestedTerm
    };
};

export const calculateCustomerEntry = (values: Partial<CustomerFormValues>, paymentHistory?: any[]) => {
    const grossWeight = values.grossWeight || 0;
    const teirWeight = values.teirWeight || 0;
    const weight = grossWeight - teirWeight;
    
    const bags = Number(values.bags) || 0;
    const bagWeightPerBagKg = Number(values.bagWeightKg) || 0;
    const totalBagWeightKg = bags * bagWeightPerBagKg;
    const totalBagWeightQuintals = totalBagWeightKg / 100;
    const netWeight = weight - totalBagWeightQuintals;
    
    const rate = values.rate || 0;
    const amount = Math.round(netWeight * rate);
    
    const brokerageRate = Number(values.brokerageRate) || 0;
    const brokerageAmount = Math.round(netWeight * brokerageRate);

    const cdRate = Number(values.cd) || 0;
    const cdAmount = Math.round((amount * cdRate) / 100);
    
    const kanta = Number(values.kanta) || 0;
    
    const bagRate = Number(values.bagRate) || 0;
    const bagAmount = Math.round(bags * bagRate);

    const advanceFreight = Number(values.advanceFreight) || 0;

    let originalNetAmount = Math.round(amount + kanta + bagAmount - cdAmount + advanceFreight);
    if (!values.isBrokerageIncluded) {
        originalNetAmount -= brokerageAmount;
    }

    const paymentsForThisEntry = (paymentHistory || []).filter((p: any) => p.paidFor?.some((pf: any) => pf.srNo === values.srNo));
    const totalPaid = paymentsForThisEntry.reduce((acc: number, p: any) => acc + p.amount, 0);
    const netAmount = originalNetAmount - totalPaid;

    let entryDate: Date;
    if (values.date) {
        entryDate = typeof values.date === 'string' ? parseISO(values.date) : values.date;
        if (!isValid(entryDate)) entryDate = new Date();
    } else {
        entryDate = new Date();
    }
    entryDate.setHours(0, 0, 0, 0);


    return {
        ...values,
        date: format(entryDate, 'yyyy-MM-dd'),
        dueDate: format(entryDate, 'yyyy-MM-dd'),
        weight: weight,
        netWeight: netWeight,
        amount: amount,
        brokerage: brokerageAmount,
        cd: cdAmount,
        kanta: kanta,
        bagAmount: bagAmount,
        originalNetAmount: originalNetAmount,
        netAmount: netAmount,
    }
};

export const levenshteinDistance = (s1: string, s2: string): number => {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();

    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    }
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) {
            costs[s2.length] = lastValue;
        }
    }
    return costs[s2.length];
};
