import { useCallback } from 'react';
import type { CompleteSupplierFormValues } from "@/lib/complete-form-schema";

export interface SupplierCalculations {
  finalWeight: number;
  kartaWeight: number;
  netWeight: number;
  amount: number;
  kartaAmount: number;
  labouryAmount: number;
  brokerageAmount: number;
  signedBrokerage: number;
  netAmount: number;
}

export function useSupplierCalculations() {
  const calculateValues = useCallback((values: Partial<CompleteSupplierFormValues>): SupplierCalculations => {
    const grossWeight = Number(values.grossWeight) || 0;
    const teirWeight = Number(values.teirWeight) || 0;
    const kartaPercentage = Number(values.kartaPercentage) || 0;
    const rate = Number(values.rate) || 0;
    const labouryRate = Number(values.labouryRate) || 0;
    const kanta = Number(values.kanta) || 0;
    const brokerageRate = Number(values.brokerageRate || 0) || 0;
    const brokerageAddSubtract = true;
    
    const finalWeight = grossWeight - teirWeight;
    
    // Calculate Karta Weight with proper rounding: round UP when Final Wt decimal part >= 0.50
    const rawKartaWt = (finalWeight * kartaPercentage) / 100;
    const kartaWeight = Math.round(rawKartaWt * 100) / 100;
    
    const netWeight = finalWeight - kartaWeight;
    const amount = finalWeight * rate;
    const kartaAmount = kartaWeight * rate;
    
    // Labour Amount calculated on Final Wt, not Net Wt
    const labouryAmount = finalWeight * labouryRate;
    
    // Brokerage calculated on Final Wt, not Net Wt
    const brokerageAmount = Math.round(brokerageRate * finalWeight * 100) / 100;
    const signedBrokerage = brokerageAddSubtract ? brokerageAmount : -brokerageAmount;
    
    const netAmount = amount - kartaAmount - labouryAmount - kanta + signedBrokerage;

    return {
      finalWeight: finalWeight,
      kartaWeight: kartaWeight,
      netWeight: netWeight,
      amount: amount,
      kartaAmount: kartaAmount,
      labouryAmount: labouryAmount,
      brokerageAmount: brokerageAmount,
      signedBrokerage: signedBrokerage,
      netAmount: netAmount,
    };
  }, []);

  return { calculateValues };
}
