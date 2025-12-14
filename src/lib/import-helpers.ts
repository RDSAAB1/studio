import { format, parse, isValid } from 'date-fns';
import type { Customer } from './definitions';

// Field aliases for column matching
export const FIELD_ALIASES: Record<string, string[]> = {
  'name': ['NAME', 'CUSTOMER', 'CUSTOMER NAME', 'SUPPLIER', 'SUPPLIER NAME'],
  'contact': ['CONTACT', 'MOBILE NO.', 'MOBILE NO', 'MOBILE NUMBER', 'PHONE', 'PHONE NO.', 'CONTACT NO.', 'CONTACT NUMBER'],
  'fatherName': ['FATHER NAME', 'FATHER NAMME', 'S/O', 'SO', 'FATHER', 'FATHERS NAME'],
  'address': ['ADDRESS', 'ADD', 'LOCATION'],
  'vehicleNo': ['VEHICLE NO', 'VEHICLE NO.', 'VEHICLE', 'VEHICLE NUMBER', 'TRUCK NO'],
  'variety': ['VARIETY', 'MATERIAL', 'PRODUCT', 'ITEM', 'COMMODITY'],
  'grossWeight': ['GROSS', 'GROSS WT', 'GROSS WEIGHT', 'GROSS WT.', 'GROSS WGT'],
  'teirWeight': ['TIER WT', 'TEIR WT', 'TARE W', 'TARE WT', 'TARE', 'TIER WEIGHT', 'TEIR WEIGHT'],
  'netWeight': ['NET WT', 'NET WEIGHT', 'NET WEIGHT kg', 'NET WGT', 'FINAL WT', 'FINAL WEIGHT'],
  'rate': ['RATE', 'RATE/QTL', 'RATE PER QTL', 'PRICE', 'PRICE/QTL'],
  'amount': ['AMOUNT', 'TOTAL', 'TOTAL CHRG', 'TOTAL CHARGE', 'TOTAL AMOUNT'],
  'srNo': ['SR NO.', 'SR NO', 'RST', 'SERIAL NO', 'SERIAL NO.', 'SERIAL NUMBER'],
  'date': ['DATE', 'ENTRY DATE', 'TRANSACTION DATE'],
  'term': ['TERM', 'CREDIT TERM', 'PAYMENT TERM'],
  'labour': ['LABOUR', 'LABOURY', 'LAB', 'LABOUR RATE', 'LABOURY RATE'],
};

// Find matching field for a column name
export function findMatchingField(columnName: string): string | null {
  const colUpper = columnName.toUpperCase().trim();
  
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some(alias => {
      const aliasUpper = alias.toUpperCase();
      // Exact match
      if (colUpper === aliasUpper) return true;
      // Contains match
      if (colUpper.includes(aliasUpper) || aliasUpper.includes(colUpper)) return true;
      // Similarity check
      return calculateSimilarity(colUpper, aliasUpper) > 0.7;
    })) {
      return field;
    }
  }
  
  return null;
}

// Calculate string similarity
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

// Detect unit from column name or value
export function detectUnit(columnName: string, value: any): 'QTL' | 'KG' {
  const colUpper = columnName.toUpperCase();
  const valStr = String(value).toUpperCase();
  
  // Check column name for unit hints
  if (colUpper.includes('KG') || colUpper.includes('KILO')) return 'KG';
  if (colUpper.includes('QTL') || colUpper.includes('QUINTAL')) return 'QTL';
  
  // Check value range (KG values are typically much larger)
  const numVal = Number(value);
  if (numVal > 1000 && !colUpper.includes('GROSS')) return 'KG';
  
  return 'QTL'; // Default
}

// Convert weight between units
export function convertWeight(value: number, fromUnit: 'QTL' | 'KG', toUnit: 'QTL' | 'KG'): number {
  if (fromUnit === toUnit) return value;
  if (fromUnit === 'KG' && toUnit === 'QTL') return value / 100; // 1 QTL = 100 KG
  if (fromUnit === 'QTL' && toUnit === 'KG') return value * 100;
  return value;
}

// Parse date from various formats
export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  const formats = [
    'dd-MM-yyyy',
    'dd/MM/yyyy',
    'yyyy-MM-dd',
    'MM/dd/yyyy',
    'dd-MMM-yy',
    'dd-MMM-yyyy',
    'dd/MM/yy',
  ];
  
  for (const fmt of formats) {
    try {
      const parsed = parse(dateStr, fmt, new Date());
      if (isValid(parsed)) return parsed;
    } catch {}
  }
  
  // Try native Date parsing
  const native = new Date(dateStr);
  if (isValid(native)) return native;
  
  return null;
}

// Process a row with mappings
export function processRow(row: any, mappings: Record<string, ColumnMapping>): Partial<Customer> {
  const result: Partial<Customer> = {};
  
  Object.entries(mappings).forEach(([sourceCol, mapping]) => {
    const value = row[sourceCol];
    if (value === undefined || value === null || value === '') return;

    const targetField = mapping.targetField;
    const sourceUnit = mapping.unit || 'QTL';
    const targetUnit = 'QTL'; // System always uses QTL

    // Weight fields with conversion
    if (['grossWeight', 'teirWeight', 'netWeight', 'weight'].includes(targetField)) {
      const numValue = Number(value);
      if (!isNaN(numValue)) {
        result[targetField as keyof Customer] = convertWeight(numValue, sourceUnit, targetUnit) as any;
      }
    }
    // Rate adjustment - if weight is in KG, rate needs adjustment
    else if (targetField === 'rate') {
      const numValue = Number(value);
      if (!isNaN(numValue)) {
        // If rate is per KG, convert to per QTL (multiply by 100)
        result.rate = sourceUnit === 'KG' ? numValue * 100 : numValue;
      }
    }
    // Term extraction
    else if (targetField === 'term') {
      const termStr = String(value);
      const termMatch = termStr.match(/\d+/);
      result.term = termMatch ? String(parseInt(termMatch[0], 10)) : '20';
    }
    // Date parsing
    else if (targetField === 'date' || targetField === 'dueDate') {
      const parsed = parseDate(String(value));
      if (parsed) {
        result[targetField as keyof Customer] = format(parsed, 'yyyy-MM-dd') as any;
      }
    }
    // Handle boolean fields (labour)
    else if (targetField === 'labour' || targetField === 'hasLabour') {
      const valStr = String(value).toUpperCase();
      result.labouryRate = (valStr === 'YES' || valStr === 'Y') ? 2 : 0;
    }
    // String fields
    else if (targetField === 'name' || targetField === 'fatherName' || targetField === 'so' || targetField === 'address' || targetField === 'variety') {
      result[targetField as keyof Customer] = String(value) as any;
    }
    // Number fields
    else {
      const numValue = Number(value);
      if (!isNaN(numValue)) {
        result[targetField as keyof Customer] = numValue as any;
      }
    }
  });

  // Calculate missing fields
  return calculateMissingFields(result);
}

// Calculate missing fields - using same logic as calculateSupplierEntry in utils.ts
export function calculateMissingFields(data: Partial<Customer>): Partial<Customer> {
  const grossWeight = data.grossWeight || 0;
  const teirWeight = data.teirWeight || 0;
  const finalWeight = data.weight || (grossWeight - teirWeight);
  const rate = data.rate || 0;
  const kartaPercentage = data.kartaPercentage || 0;
  const labouryRate = data.labouryRate || 0;
  const kanta = data.kanta || 0;
  
  // Calculate karta weight with rounding logic (same as utils.ts)
  // Always round UP when Final Wt decimal part >= 0.50 (e.g., 179.50 -> 1.80, not 1.79)
  const decimalPart = Math.round((finalWeight - Math.floor(finalWeight)) * 10);
  const rawKartaWeight = finalWeight * kartaPercentage / 100;
  let kartaWeight: number;
  if (decimalPart >= 5) {
    kartaWeight = Math.ceil(rawKartaWeight * 100) / 100;
  } else {
    kartaWeight = Math.floor(rawKartaWeight * 100) / 100;
  }
  
  // Use provided kartaWeight if available
  const finalKartaWeight = data.kartaWeight || kartaWeight;
  const netWeight = finalWeight - finalKartaWeight;
  
  // Calculate amounts with rounding (same as utils.ts)
  const amount = Math.round(finalWeight * rate);
  const kartaAmount = Math.round(finalKartaWeight * rate);
  // Labour Amount calculated on Final Wt, not Net Wt
  const labouryAmount = Math.round(finalWeight * labouryRate);
  // Brokerage calculated on Final Wt, not Net Wt
  const brokerageRate = Number(data.brokerage || data.brokerageRate) || 0;
  const brokerageAmount = Math.round(finalWeight * brokerageRate);
  const signedBrokerage = (data.brokerageAddSubtract ?? true) ? brokerageAmount : -brokerageAmount;
  const netAmount = Math.round(amount - labouryAmount - kanta - kartaAmount + signedBrokerage);
  
  return {
    ...data,
    weight: finalWeight,
    kartaWeight: finalKartaWeight,
    kartaAmount: kartaAmount,
    netWeight: netWeight,
    amount: amount,
    labouryAmount: labouryAmount,
    brokerage: brokerageAmount,
    brokerageRate: brokerageRate,
    brokerageAmount: brokerageAmount,
    netAmount: netAmount,
    originalNetAmount: netAmount,
  };
}

// Validate a row
export function validateRow(data: Partial<Customer>): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.name || String(data.name).trim() === '') {
    errors.push('Name required');
  }
  if (!data.date || String(data.date).trim() === '') {
    errors.push('Date required');
  }
  if (data.grossWeight !== undefined && data.teirWeight !== undefined) {
    if (data.grossWeight < data.teirWeight) {
      errors.push('Gross weight < Tier weight');
    }
  }
  if (data.grossWeight !== undefined && data.grossWeight < 0) {
    errors.push('Gross weight cannot be negative');
  }
  if (data.teirWeight !== undefined && data.teirWeight < 0) {
    errors.push('Tier weight cannot be negative');
  }
  
  return { isValid: errors.length === 0, errors };
}

// Column mapping interface
export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  unit: 'QTL' | 'KG';
  isRequired: boolean;
}

// Import row interface
export interface ImportRow {
  id: string;
  originalData: any;
  mappedData: Partial<Customer>;
  isSelected: boolean;
  isValid: boolean;
  errors?: string[];
}

