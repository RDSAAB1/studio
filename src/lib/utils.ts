
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Customer, FormValues as SupplierFormValues } from './definitions';
import type { FormValues as CustomerFormValues } from '../app/sales/customer-entry/customer-entry-client';


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

export function formatPaymentId(num: number | string) {
  return 'P' + String(num).padStart(5, '0');
}

export function formatCurrency(amount: number): string {
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


export const calculateSupplierEntry = (values: SupplierFormValues, paymentHistory: any[]) => {
    const date = values.date;
    const termDays = Number(values.term) || 0;
    const newDueDate = new Date(date);
    newDueDate.setDate(newDueDate.getDate() + termDays);
    const grossWeight = values.grossWeight || 0;
    const teirWeight = values.teirWeight || 0;
    const weight = grossWeight - teirWeight; // This is finalWeight
    const kartaPercentage = values.kartaPercentage || 0;
    const rate = values.rate || 0;
    
    const kartaWeight = weight * (kartaPercentage / 100);
    const netWeight = weight - kartaWeight;
    
    // Corrected amount calculation to be based on final weight (weight)
    const amount = weight * rate; 

    // Karta amount is based on karta weight and rate
    const kartaAmount = kartaWeight * rate;
    
    const labouryRate = values.labouryRate || 0;
    const labouryAmount = weight * labouryRate;
    const kanta = values.kanta || 0;

    // Corrected originalNetAmount calculation based on the corrected amount
    const originalNetAmount = amount - labouryAmount - kanta - kartaAmount;

    const totalPaidForThisEntry = paymentHistory
      .filter(p => p.paidFor?.some((pf: any) => pf.srNo === values.srNo))
      .reduce((sum, p) => {
          const paidForDetail = p.paidFor?.find((pf: any) => pf.srNo === values.srNo);
          return sum + (paidForDetail?.amount || 0);
      }, 0);
      
    const netAmount = originalNetAmount - totalPaidForThisEntry;

    return {
      ...values,
      date: values.date instanceof Date ? values.date.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
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
    };
};

export const calculateCustomerEntry = (values: CustomerFormValues, paymentHistory: any[]) => {
    const grossWeight = values.grossWeight || 0;
    const teirWeight = values.teirWeight || 0;
    const weight = grossWeight - teirWeight;
    
    const bags = Number(values.bags) || 0;
    const bagWeightPerBagKg = Number(values.bagWeightKg) || 0;
    const totalBagWeightKg = bags * bagWeightPerBagKg;
    const totalBagWeightQuintals = totalBagWeightKg / 100;
    const netWeight = weight - totalBagWeightQuintals;
    
    const rate = values.rate || 0;
    const amount = weight * rate;
    
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
        .filter(p => p.paidFor?.some((pf: any) => pf.srNo === values.srNo))
        .reduce((sum, p) => {
            const paidForDetail = p.paidFor?.find((pf: any) => pf.srNo === values.srNo);
            return sum + (paidForDetail?.amount || 0);
        }, 0);
      
    const netAmount = originalNetAmount - totalPaidForThisEntry;

    const currentDate = values.date instanceof Date ? values.date : new Date();

    return {
        ...values,
        date: currentDate.toISOString().split("T")[0],
        dueDate: (values.date ? new Date(values.date) : new Date()).toISOString().split("T")[0],
        weight: weight,
        netWeight: netWeight,
        amount: amount,
        brokerage: brokerageAmount,
        brokerageRate: brokerageRate,
        cd: cdAmount,
        cdRate: cdPercentage,
        kanta: kanta,
        bagAmount: bagAmount,
        originalNetAmount: originalNetAmount,
        netAmount: netAmount,
    }
}
