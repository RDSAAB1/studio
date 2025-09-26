

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Customer, Payment, Holiday } from './definitions';
import { isSunday, addDays, differenceInCalendarDays } from 'date-fns';

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
    cdRate?: number;
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

export const calculateSupplierEntry = (values: Partial<SupplierFormValues>, paymentHistory: any[], holidays: Holiday[], dailyPaymentLimit: number, allSuppliers: Customer[]) => {
    const date = values.date ? new Date(values.date) : new Date();
    const termDays = Number(values.term) || 0;
    let newDueDate = addDays(date, termDays);

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
        suggestedTerm = differenceInCalendarDays(newDueDate, date);
    }
    
    if (allSuppliers && allSuppliers.length > 0) {
        let dailyTotal = 0;
        const dueDateString = newDueDate.toISOString().split('T')[0];
        
        allSuppliers.forEach(supplier => {
            if (supplier.dueDate === dueDateString) {
                dailyTotal += Number(supplier.netAmount) || 0;
            }
        });

        if (dailyTotal > dailyPaymentLimit) {
            let nextAvailableDate = addDays(newDueDate, 1);
            while (isHoliday(nextAvailableDate)) {
                 nextAvailableDate = addDays(nextAvailableDate, 1);
            }
            warning += ` Daily limit of ${formatCurrency(dailyPaymentLimit)} on ${newDueDate.toLocaleDateString()} reached.`;
            newDueDate = nextAvailableDate;
            suggestedTerm = differenceInCalendarDays(newDueDate, date);
        }
    }

    const grossWeight = values.grossWeight || 0;
    const teirWeight = values.teirWeight || 0;
    const weight = grossWeight - teirWeight;
    const kartaPercentage = values.kartaPercentage || 0;
    const rate = values.rate || 0;
    
    const kartaWeight = Math.round(weight * kartaPercentage) / 100;
    const kartaAmount = Math.round(kartaWeight * rate);
    
    const netWeight = weight - kartaWeight;
    
    const amount = Math.round(weight * rate); 

    const labouryRate = values.labouryRate || 0;
    const labouryAmount = Math.round(weight * labouryRate);
    const kanta = values.kanta || 0;

    const originalNetAmount = Math.round(amount - labouryAmount - kanta - kartaAmount);

    const totalPaidForThisEntry = (Array.isArray(paymentHistory) ? paymentHistory : [])
      .filter(p => p.paidFor?.some((pf: any) => pf.srNo === values.srNo))
      .reduce((sum, p) => {
          const paidForDetail = p.paidFor?.find((pf: any) => pf.srNo === values.srNo);
          return sum + (paidForDetail?.amount || 0);
      }, 0);
      
    const netAmount = originalNetAmount - totalPaidForThisEntry;

    return {
      ...values,
      date: date instanceof Date ? date.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      term: String(values.term), dueDate: newDueDate.toISOString().split("T")[0],
      weight: weight,
      kartaWeight: kartaWeight,
      kartaAmount: kartaAmount,
      netWeight: netWeight,
      amount: amount, 
      labouryAmount: labouryAmount,
      kanta: kanta, 
      originalNetAmount: originalNetAmount,
      netAmount: netAmount,
      warning: warning,
      suggestedTerm: suggestedTerm,
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

    const cdPercentage = Number(values.cdRate) || 0;
    const cdAmount = Math.round((amount * cdPercentage) / 100);
    
    const kanta = Number(values.kanta) || 0;
    
    const bagRate = Number(values.bagRate) || 0;
    const bagAmount = Math.round(bags * bagRate);

    const advanceFreight = Number(values.advanceFreight) || 0;

    let originalNetAmount = Math.round(amount + kanta + bagAmount - cdAmount + advanceFreight);
    if (!values.isBrokerageIncluded) {
        originalNetAmount -= brokerageAmount;
    }

    const totalPaidForThisEntry = (Array.isArray(paymentHistory) ? paymentHistory : [])
        .filter(p => p.paidFor?.some((pf: any) => pf.srNo === values.srNo))
        .reduce((sum, p) => {
            const paidForDetail = p.paidFor?.find((pf: any) => pf.srNo === values.srNo);
            return sum + (paidForDetail?.amount || 0);
        }, 0);
      
    const netAmount = originalNetAmount - totalPaidForThisEntry;

    const currentDate = values.date ? new Date(values.date) : new Date();

    return {
        ...values,
        date: currentDate.toISOString().split("T")[0],
        dueDate: (values.date ? new Date(values.date) : new Date()).toISOString().split("T")[0],
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
}
