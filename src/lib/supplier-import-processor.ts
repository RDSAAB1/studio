import { Customer } from './definitions';
import { formatSrNo, toTitleCase } from './utils';
import { addDays, format, parseISO } from 'date-fns';

export interface RawImportRow {
  [key: string]: any;
}

/**
 * Extracts numbers even if units (kg, qtl) are present in string.
 */
function safeNumeric(val: any): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const cleaned = String(val).replace(/[^0-9.]/g, '');
    return Number(cleaned) || 0;
}

/**
 * Parses date string, specifically handles Excel serial dates and DD-MM-YYYY
 */
function parseImportDate(val: any): string {
    const today = new Date();
    // Use local time zone offset to prevent off-by-one errors when formatting
    const offset = today.getTimezoneOffset() * 60000;
    const localToday = new Date(today.getTime() - offset).toISOString().split('T')[0];
    
    if (!val) return localToday;

    // Handle Excel Serial Dates (e.g., 45123)
    if (typeof val === 'number' || !isNaN(Number(val))) {
        const serial = Number(val);
        if (serial > 10000) { // Likely an Excel date
            // Excel dates are days since Dec 30 1899
            const d = new Date(Date.UTC(1899, 11, 30));
            d.setUTCDate(d.getUTCDate() + serial);
            return d.toISOString().split('T')[0];
        }
    }

    const s = String(val).trim();
    
    // Match DD-MM-YYYY, DD/MM/YYYY, D-M-YYYY etc.
    const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        return `${year}-${month}-${day}`;
    }

    // Try native parsing as a fallback
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
        const localParsed = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
        return localParsed.toISOString().split('T')[0];
    }

    return localToday;
}

/**
 * Robust case-insensitive value extraction from row.
 * Handles extra spaces, tabs, and case differences in column headers.
 */
function getFlexValue(row: RawImportRow, header: string): any {
    const keys = Object.keys(row);
    const searchKey = header.toUpperCase().trim();
    // Use a fuzzy match: actual key includes search key or vice versa
    const actualKey = keys.find(k => {
        const normalizedK = k.toUpperCase().trim();
        return normalizedK === searchKey || normalizedK.includes(searchKey);
    });
    return actualKey ? row[actualKey] : '';
}

/**
 * Maps screenshot/user headers to system fields and performs automated calculations.
 * Updated for KG to QTL conversion and YES/NO laboury logic.
 */
export function processSupplierImportRow(row: RawImportRow, nextSrNo: number): Customer {
    // 1. Text Fields
    const rawSrNo = String(getFlexValue(row, 'RST') || getFlexValue(row, 'SERIAL') || getFlexValue(row, 'S.NO') || '').trim();
    let numericSrNo = safeNumeric(rawSrNo);
    
    // If Excel doesn't have a numeric serial No, use the auto-increment one
    if (numericSrNo === 0) {
        numericSrNo = nextSrNo;
    }

    const srNo = formatSrNo(numericSrNo, 'S');
    let date = parseImportDate(getFlexValue(row, 'DATE'));
    const vehicleNo = String(getFlexValue(row, 'VEHICLE NO') || getFlexValue(row, 'VEHICLE') || getFlexValue(row, 'TRUCK') || '').trim().toUpperCase();
    const name = String(getFlexValue(row, 'CUSTOMER') || getFlexValue(row, 'NAME') || getFlexValue(row, 'SUPPLIER') || '').trim();
    
    // Father's name / S/O
    const so = String(
        getFlexValue(row, 'FATHER') || 
        getFlexValue(row, 'FATHER NAMME') || 
        getFlexValue(row, 'FATHER NAME') || 
        getFlexValue(row, 'SO') || 
        getFlexValue(row, 'SON OF') || 
        ''
    ).trim();
    
    const address = String(getFlexValue(row, 'ADDRESS') || getFlexValue(row, 'CITY') || '').trim();
    const contact = String(getFlexValue(row, 'MOBILE NO.') || getFlexValue(row, 'MOBILE') || getFlexValue(row, 'CONTACT') || getFlexValue(row, 'PHONE') || '').trim();
    const variety = String(getFlexValue(row, 'MATERIAL') || getFlexValue(row, 'VARIETY') || getFlexValue(row, 'ITEM') || getFlexValue(row, 'COMMODITY') || '').trim();

    // 2. Numeric Fields & Unit Conversion (KG to QTL)
    // User mentioned sheet is in kg (e.g. 1443), system needs QTL (14.43).
    const rawGross = safeNumeric(getFlexValue(row, 'GROSS WEIGHT') || getFlexValue(row, 'GROSS WT') || getFlexValue(row, 'GROSS'));
    const rawTare = safeNumeric(getFlexValue(row, 'TARE WEIGHT') || getFlexValue(row, 'TARE WT') || getFlexValue(row, 'TARE') || getFlexValue(row, 'TIER'));
    const rawNet = safeNumeric(getFlexValue(row, 'NET WEIGHT') || getFlexValue(row, 'NET WT'));

    // Convert to Quantals (/100) if values look like KG (usually > 300)
    const grossWeight = rawGross > 300 ? Number((rawGross / 100).toFixed(2)) : rawGross;
    const teirWeight = rawTare > 300 ? Number((rawTare / 100).toFixed(2)) : rawTare;
    let weight = rawNet > 300 ? Number((rawNet / 100).toFixed(2)) : rawNet;
    
    // If net weight is missing but gross/tare exist
    if (weight === 0 && grossWeight > 0) {
        weight = Number((grossWeight - teirWeight).toFixed(2));
    }

    // Rate mapping: "TOTAL CHRG" often contains the rate in these sheets
    const rateLine = getFlexValue(row, 'TOTAL CHRG') || getFlexValue(row, 'RATE') || getFlexValue(row, 'PRICE');
    const rate = safeNumeric(rateLine);
    const kanta = safeNumeric(getFlexValue(row, 'KANTA') || getFlexValue(row, 'WEIGHING'));

    // Laboury logic: YES=Rs 2, NO/Empty=Rs 0
    const rawLabour = String(getFlexValue(row, 'LABOU') || getFlexValue(row, 'LABOUR') || '').trim().toUpperCase();
    let labouryRate = 0;
    if (rawLabour === 'YES' || rawLabour === 'Y') {
        labouryRate = 2;
    } else if (rawLabour && !isNaN(Number(rawLabour.replace(/[^0-9.]/g, '')))) {
        labouryRate = safeNumeric(rawLabour);
    }

    // 3. Core Calculations (Matching screenshot logic)
    const kartaPercentage = 1; // Standard 1% default for these imports
    const kartaWeight = Number((weight * 0.01).toFixed(2));
    const netWeight = Math.max(0, weight - kartaWeight);
    
    const amount = Number((weight * rate).toFixed(2));
    const labouryAmount = Number((weight * labouryRate).toFixed(2));
    
    // Financial calculations
    const kartaAmount = Number((amount * (kartaPercentage / 100)).toFixed(2));
    const netAmount = Number((amount - kartaAmount - labouryAmount - kanta).toFixed(2));

    // Term/Days logic: Extract numeric part. Default to 0 if not clear.
    const rawTerm = String(getFlexValue(row, 'TERM') || '').trim();
    let termDays = 0;
    if (rawTerm) {
        const matches = rawTerm.match(/\d+/);
        if (matches) termDays = parseInt(matches[0]);
    }

    // Calculate Due Date based on the parsed transaction date + term
    let dueDate = date; 
    try {
        const entryDate = new Date(date);
        if (!isNaN(entryDate.getTime())) {
            // Use local date methods to add days
            entryDate.setDate(entryDate.getDate() + termDays);
            
            // Format to YYYY-MM-DD avoiding timezone shifts
            const offset = entryDate.getTimezoneOffset() * 60000;
            const localFormatted = new Date(entryDate.getTime() - offset).toISOString().split('T')[0];
            dueDate = localFormatted;
        }
    } catch (e) {
        console.warn('[Import] Due Date calculation failed for date:', date, e);
    }
    
    // Final safety check to absolutely prevent empty strings
    if (!dueDate || dueDate.trim() === '') {
        const today = new Date();
        const offset = today.getTimezoneOffset() * 60000;
        dueDate = new Date(today.getTime() - offset).toISOString().split('T')[0];
        date = dueDate;
    }

    return {
        id: `imp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        srNo: srNo,
        date: date,
        name: toTitleCase(name),
        so: toTitleCase(so),
        address: toTitleCase(address),
        contact: contact,
        vehicleNo: vehicleNo,
        variety: toTitleCase(variety),
        term: String(termDays),
        dueDate: dueDate,
        grossWeight,
        teirWeight,
        weight, // NET WT
        kartaPercentage,
        kartaWeight,
        kartaAmount,
        netWeight, // FINAL WT
        rate,
        labouryRate,
        labouryAmount,
        kanta,
        amount, // TOTAL AMT
        netAmount, // FINAL AMT
        originalNetAmount: netAmount,
        paymentType: 'Full', // Default
        customerId: `${toTitleCase(name).toLowerCase()}|${toTitleCase(so).toLowerCase()}`,
    } as Customer;
}
