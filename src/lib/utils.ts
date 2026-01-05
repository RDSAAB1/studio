
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
    brokerage?: number;
    brokerageRate?: number;
    isBrokerageIncluded?: boolean;
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
    cdAmount?: number;
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

// Format date to YYYY-MM-DD in local timezone (no UTC conversion)
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatSrNo(num: number | string, prefix: 'S' | 'C' | 'R' = 'S') {
  return prefix + String(num).padStart(5, '0');
}

export function formatKantaParchiSrNo(num: number | string): string {
  const numStr = String(num).replace(/[^0-9]/g, '');
  const numValue = numStr ? parseInt(numStr, 10) : (typeof num === 'number' ? num : 1);
  return 'KP' + String(numValue).padStart(5, '0');
}

export function formatDocumentSrNo(num: number | string): string {
  const numStr = String(num).replace(/[^0-9]/g, '');
  const numValue = numStr ? parseInt(numStr, 10) : (typeof num === 'number' ? num : 1);
  return 'DOC' + String(numValue).padStart(5, '0');
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
    // Always round UP when Final Wt decimal part >= 0.50 (e.g., 179.50 -> 1.80, not 1.79)
    // Only round down if decimal part < 0.50 (e.g., 179.40 -> 1.79)
    if (decimalPart >= 5) {
        kartaWeight = Math.ceil(rawKartaWeight * 100) / 100;
    } else {
        kartaWeight = Math.floor(rawKartaWeight * 100) / 100;
    }

    const kartaAmount = Math.round(kartaWeight * rate);
    const netWeight = weight - kartaWeight;
    const amount = Math.round(weight * rate); 
    const labouryRate = values.labouryRate || 0;
    // Labour Amount calculated on Final Wt (weight), not Net Wt
    const labouryAmount = Math.round(weight * labouryRate);
    const kanta = values.kanta || 0;
    
    // Brokerage calculation (if provided) - calculated on Final Wt (weight), not Net Wt
    // Brokerage Amount = Final Weight × Brokerage Rate
    const brokerageRate = Number(values.brokerageRate || values.brokerage) || 0;
    const brokerageAmount = Math.round(weight * brokerageRate);
    
    // Calculate base amount before brokerage
    let originalNetAmount = Math.round(amount - labouryAmount - kanta - kartaAmount);
    
    // Brokerage logic: INCLUDE (brokerageAddSubtract = true) = Add, EXCLUDE (brokerageAddSubtract = false) = Subtract
    if (brokerageAmount > 0) {
        const isIncluded = values.brokerageAddSubtract ?? true; // Default to INCLUDE (ADD)
        if (isIncluded) {
            originalNetAmount += brokerageAmount; // Add when INCLUDE
        } else {
            originalNetAmount -= brokerageAmount; // Subtract when EXCLUDE
        }
    }
    
    const netAmount = originalNetAmount;

    return {
      ...values,
      weight,
      kartaWeight,
      kartaAmount,
      netWeight,
      amount,
      labouryAmount,
      brokerage: brokerageAmount,
      brokerageRate: brokerageRate,
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
    
    // ✅ Calculate KRTA (same logic as supplier)
    const kartaPercentage = values.kartaPercentage || 0;
    let rate = values.rate || 0;
    
    // ✅ RICE BRAN special rate calculation
    const variety = (values.variety || '').toUpperCase().trim();
    const isRiceBran = variety === 'RICE BRAN';
    let calculatedRate = rate;
    
    if (isRiceBran) {
        const baseReport = Number((values as any).baseReport || 0);
        const collectedReport = Number((values as any).collectedReport || 0);
        const riceBranGst = Number((values as any).riceBranGst || 0);
        
        if (baseReport > 0 && collectedReport > 0) {
            // Step 1: Calculate intermediate rate: (rate / baseReport) * collectedReport
            const intermediateRate = (rate / baseReport) * collectedReport;
            // Step 2: Apply GST percentage: intermediateRate * (1 + GST/100)
            // Keep full precision with 2 decimal places (paise)
            const fullRate = intermediateRate * (1 + riceBranGst / 100);
            // Round to 2 decimal places properly
            calculatedRate = Number(fullRate.toFixed(2)); // Keep 2 decimal places (paise)
        }
        // If baseReport or collectedReport is 0, use original rate
    }
    
    // Use calculated rate for all calculations
    const effectiveRate = isRiceBran ? calculatedRate : rate;
    
    const decimalPart = Math.round((weight - Math.floor(weight)) * 10);
    const rawKartaWeight = weight * kartaPercentage / 100;

    let kartaWeight;
    // Always round UP when Final Wt decimal part >= 0.50 (e.g., 179.50 -> 1.80, not 1.79)
    // Only round down if decimal part < 0.50 (e.g., 179.40 -> 1.79)
    if (decimalPart >= 5) {
        kartaWeight = Math.ceil(rawKartaWeight * 100) / 100;
    } else {
        kartaWeight = Math.floor(rawKartaWeight * 100) / 100;
    }

    const kartaAmount = Math.round(kartaWeight * effectiveRate);
    
    const bags = Number(values.bags) || 0;
    const bagWeightPerBagKg = Number(values.bagWeightKg) || 0;
    const totalBagWeightKg = bags * bagWeightPerBagKg;
    const totalBagWeightQuintals = totalBagWeightKg / 100; // Convert KG to QTL
    // ✅ Net weight = weight - kartaWeight - bagWeight (like supplier: weight - kartaWeight)
    const netWeight = weight - kartaWeight - totalBagWeightQuintals;
    
    const amount = Math.round(weight * effectiveRate); // Amount calculated on final weight (before karta and bags) using effective rate
    
    // ✅ Calculate Bag Weight Deduction: Bag Weight (QTL) × Rate
    const bagWeightDeductionAmount = Math.round(totalBagWeightQuintals * effectiveRate);
    
    const brokerageRate = Number(values.brokerage || values.brokerageRate) || 0;
    const brokerageAmount = Math.round(weight * brokerageRate); // Brokerage on final weight

    // CD calculation: If cdAmount is provided directly, use it; otherwise calculate from cdRate
    let finalCdAmount = 0;
    if (values.cdAmount !== undefined && values.cdAmount !== null && values.cdAmount > 0) {
        // User entered CD Amount directly
        finalCdAmount = Math.round(values.cdAmount);
    } else {
        // User entered CD% - calculate amount from percentage
        const cdRate = Number(values.cd) || 0;
        finalCdAmount = Math.round((amount * cdRate) / 100);
    }
    
    const bagRate = Number(values.bagRate) || 0;
    const bagAmount = Math.round(bags * bagRate);

    // ✅ Calculate Transport Amount: Transportation Rate × Final Weight (per QTL)
    const transportationRate = Number((values as any).transportationRate || 0);
    const transportAmount = Math.round(weight * transportationRate);

    // ✅ For RICE BRAN: Calculate Net Receivable using Net Weight × Calculated Rate
    // For others: Use existing formula
    let originalNetAmount;
    if (isRiceBran && calculatedRate) {
        // Keep net weight to 2 decimal places, then multiply with calculated rate
        const roundedNetWeight = Math.round(netWeight * 100) / 100; // Round to 2 decimal places
        // Net Receivable = (Net Weight × Calculated Rate) + Bag Amount - CD - Transport - Brokerage
        const netWeightAmount = roundedNetWeight * calculatedRate; // Use calculated rate with paise
        originalNetAmount = Math.round(netWeightAmount + bagAmount - finalCdAmount - transportAmount);
        // Brokerage logic: Include = Add, Exclude = Subtract
        if (values.isBrokerageIncluded) {
            originalNetAmount += brokerageAmount; // Add when included
        } else {
            originalNetAmount -= brokerageAmount; // Subtract when excluded
        }
    } else {
        // ✅ Original net amount = amount - kartaAmount - bagWeightDeductionAmount + bagAmount - finalCdAmount - transportAmount
        // Net Receivable = Amount - Karta - Bag Wt Deduction + Bag Amount - CD - Transport
        originalNetAmount = Math.round(amount - kartaAmount - bagWeightDeductionAmount + bagAmount - finalCdAmount - transportAmount);
        // Brokerage logic: Include = Add, Exclude = Subtract
        if (values.isBrokerageIncluded) {
            originalNetAmount += brokerageAmount; // Add when included
        } else {
            originalNetAmount -= brokerageAmount; // Subtract when excluded
        }
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
        kartaWeight: kartaWeight,
        kartaAmount: kartaAmount,
        netWeight: netWeight,
        amount: amount,
        brokerage: brokerageAmount,
        cd: finalCdAmount,
        bagAmount: bagAmount,
        bagWeightDeductionAmount: bagWeightDeductionAmount, // Bag Weight deduction amount
        transportationRate: transportationRate,
        transportAmount: transportAmount, // Transport Amount = Transportation Rate × Final Weight
        originalNetAmount: originalNetAmount,
        netAmount: netAmount,
        calculatedRate: isRiceBran ? calculatedRate : undefined, // Store calculated rate for RICE BRAN
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
