"use client";

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import type { KantaParchi, CustomerDocument } from "@/lib/definitions";
import { toTitleCase, calculateCustomerEntry, formatSrNo, formatKantaParchiSrNo, formatDocumentSrNo } from "@/lib/utils";
import { addKantaParchi, addCustomerDocument } from "@/lib/firestore";
import { parseISO, format, isValid } from "date-fns";

interface CustomerImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
  existingKantaParchiSrNos?: string[];
  existingDocumentSrNos?: string[];
}

type ImportVariant = "kanta-parchi" | "parchi-document";

export function CustomerImportDialog({
  open,
  onOpenChange,
  onImportComplete,
  existingKantaParchiSrNos = [],
  existingDocumentSrNos = [],
}: CustomerImportDialogProps) {
  const { toast } = useToast();
  const [importVariant, setImportVariant] = useState<ImportVariant>("kanta-parchi");
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const parseDate = (value: any): string => {
    if (!value) return format(new Date(), 'yyyy-MM-dd');
    
    // Handle Excel date serial number
    if (typeof value === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
      return format(date, 'yyyy-MM-dd');
    }
    
    // Handle string dates in DD-MM-YYYY format
    if (typeof value === 'string') {
      // Try DD-MM-YYYY format first
      const ddmmyyyyMatch = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (ddmmyyyyMatch) {
        const [, day, month, year] = ddmmyyyyMatch;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (isValid(date)) {
          return format(date, 'yyyy-MM-dd');
        }
      }
      
      // Try ISO format
      const parsed = parseISO(value);
      if (isValid(parsed)) {
        return format(parsed, 'yyyy-MM-dd');
      }
      
      // Try other formats
      const date = new Date(value);
      if (isValid(date)) {
        return format(date, 'yyyy-MM-dd');
      }
    }
    
    return format(new Date(), 'yyyy-MM-dd');
  };

  // Convert weight from KG to quintals (1 quintal = 100 kg)
  const convertKgToQuintal = (kg: number): number => {
    return kg / 100;
  };

  // Parse customer name, father name, and address from combined field
  const parseCustomerField = (value: string): { name: string; fatherName: string; address: string } => {
    if (!value) return { name: '', fatherName: '', address: '' };
    
    // Try to split by common patterns
    // Format might be: "NAME FATHER ADDRESS" or "NAME F: FATHER ADDRESS"
    const parts = value.trim().split(/\s+/);
    let name = '';
    let fatherName = '';
    let address = '';
    
    // Look for "F:" or "F" pattern
    const fIndex = parts.findIndex(p => p.toUpperCase() === 'F:' || p.toUpperCase() === 'F');
    if (fIndex !== -1 && fIndex < parts.length - 1) {
      name = parts.slice(0, fIndex).join(' ');
      fatherName = parts[fIndex + 1];
      address = parts.slice(fIndex + 2).join(' ');
    } else {
      // If no F: pattern, assume first word is name, rest is address
      name = parts[0] || '';
      address = parts.slice(1).join(' ');
    }
    
    return {
      name: name.trim(),
      fatherName: fatherName.trim(),
      address: address.trim(),
    };
  };

  // Extract bags number from TERM column (e.g., "224 BAG" -> 224, "115 KATTA" -> 115)
  const extractBags = (value: string): number => {
    if (!value) return 0;
    const match = String(value).match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportProgress({ current: 0, total: 0 });

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary', cellNF: true, cellText: false });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });
          
          // Log first row to debug column names
          if (json.length > 0) {
            console.log('First row data:', json[0]);
            console.log('Available columns:', Object.keys(json[0]));
            console.log('Column names (uppercase):', Object.keys(json[0]).map(k => k.toUpperCase()));
          }

          if (json.length === 0) {
            toast({
              title: "Empty File",
              description: "The Excel file is empty.",
              variant: "destructive",
            });
            setIsImporting(false);
            return;
          }

          setImportProgress({ current: 0, total: json.length });

          let successCount = 0;
          let errorCount = 0;
          const errors: string[] = [];

          if (importVariant === "kanta-parchi") {
            // Helper function to get value from item with multiple possible keys (case-insensitive, trimmed)
            const getValue = (keys: string[], defaultValue: any = '', item: any) => {
              // First try exact match
              for (const key of keys) {
                if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
                  return item[key];
                }
              }
              
              // Then try case-insensitive match
              const itemKeys = Object.keys(item);
              for (const key of keys) {
                const foundKey = itemKeys.find(ik => ik.trim().toUpperCase() === key.trim().toUpperCase());
                if (foundKey && item[foundKey] !== undefined && item[foundKey] !== null && item[foundKey] !== '') {
                  return item[foundKey];
                }
              }
              
              return defaultValue;
            };
            
            // Import Kanta Parchi only
            for (let i = 0; i < json.length; i++) {
              const item = json[i];
              setImportProgress({ current: i + 1, total: json.length });

              try {
                // Helper function to get value from item with multiple possible keys (case-insensitive, trimmed)
                const getValue = (keys: string[], defaultValue: any = '') => {
                  // First try exact match
                  for (const key of keys) {
                    if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
                      return item[key];
                    }
                  }
                  
                  // Then try case-insensitive match
                  const itemKeys = Object.keys(item);
                  for (const key of keys) {
                    const foundKey = itemKeys.find(ik => ik.trim().toUpperCase() === key.trim().toUpperCase());
                    if (foundKey && item[foundKey] !== undefined && item[foundKey] !== null && item[foundKey] !== '') {
                      return item[foundKey];
                    }
                  }
                  
                  return defaultValue;
                };
                
                // Get next serial number
                let nextSrNum = 1;
                if (existingKantaParchiSrNos.length > 0) {
                  const maxNum = Math.max(...existingKantaParchiSrNos.map(srNo => {
                    const num = parseInt(srNo.replace(/[^\d]/g, '')) || 0;
                    return num;
                  }));
                  nextSrNum = maxNum + 1;
                }
                
                // Extract and format serial number (RST column) - use exact value from data
                let srNoValue = getValue([
                  'RST',
                  'rst',
                  'Rst',
                  'srNo',
                  'SR No',
                  'Sr No',
                  'Serial No'
                ], '');
                
                let formattedSrNo: string;
                if (srNoValue && String(srNoValue).trim() !== '') {
                  // If srNo is provided, extract number and format it
                  const numStr = String(srNoValue).replace(/[^0-9]/g, '');
                  if (numStr) {
                    formattedSrNo = formatKantaParchiSrNo(parseInt(numStr, 10));
                  } else {
                    // If no number found, use the value as-is (might already be formatted)
                    formattedSrNo = String(srNoValue).trim();
                  }
                } else {
                  // Only auto-generate if not found in data
                  formattedSrNo = formatKantaParchiSrNo(nextSrNum + i);
                }
                
                // Log serial number extraction for first row
                if (i === 0) {
                  console.log('Serial number extraction:', {
                    srNoValue,
                    formattedSrNo,
                    'RST column exists': item.RST !== undefined,
                    'all RST variations': Object.keys(item).filter(k => k.toUpperCase().includes('RST'))
                  });
                }
                
                // Extract and parse customer field (CUSTOME FATHER N. ADDRESS)
                const customerField = getValue([
                  'CUSTOME FATHER N. ADDRESS',
                  'CUSTOME FATHER N ADDRESS',
                  'CUSTOMER FATHER N. ADDRESS',
                  'CUSTOMER FATHER N ADDRESS',
                  'Customer',
                  'CUSTOMER',
                  'name',
                  'Name'
                ], '');
                const { name: parsedName, fatherName, address } = parseCustomerField(customerField);
                
                // Extract weights (in KG) and convert to quintals
                // Try all possible column name variations - check exact Excel column names first
                let grossWeightKg = 0;
                let teirWeightKg = 0;
                let netWeightKg = 0;
                
                // Try to find weight columns by checking all keys
                const allKeys = Object.keys(item);
                const weightKeys = allKeys.filter(k => {
                  const upper = k.toUpperCase().trim();
                  return upper.includes('GROSS') && (upper.includes('WE') || upper.includes('WT') || upper.includes('WEIGHT'));
                });
                const tareKeys = allKeys.filter(k => {
                  const upper = k.toUpperCase().trim();
                  return (upper.includes('TARE') || upper.includes('TEIR')) && (upper.includes('WE') || upper.includes('WT') || upper.includes('WEIGHT') || upper.includes('WEIO'));
                });
                const netKeys = allKeys.filter(k => {
                  const upper = k.toUpperCase().trim();
                  return upper.includes('NET') && (upper.includes('WE') || upper.includes('WT') || upper.includes('WEIGHT') || upper.includes('WEIG'));
                });
                
                // Log found keys for first row
                if (i === 0) {
                  console.log('Weight column search:', {
                    allKeys,
                    weightKeys,
                    tareKeys,
                    netKeys
                  });
                }
                
                // Get gross weight
                if (weightKeys.length > 0) {
                  grossWeightKg = Number(item[weightKeys[0]]) || 0;
                } else {
                  grossWeightKg = Number(getValue([
                    'GROSS WE',
                    'GROSS WE.',
                    'GROSS WEIGHT',
                    'GROSS WT',
                    'grossWeight',
                    'Gross Weight',
                    'Gross Wt',
                    'Gross We',
                    'gross we',
                    'gross weight'
                  ], 0));
                }
                
                // Get teir/tare weight
                if (tareKeys.length > 0) {
                  teirWeightKg = Number(item[tareKeys[0]]) || 0;
                } else {
                  teirWeightKg = Number(getValue([
                    'TARE WEIO',
                    'TARE WEIO.',
                    'TARE WEIGHT',
                    'TARE WT',
                    'TARE WE',
                    'teirWeight',
                    'Teir Weight',
                    'Tare Weight',
                    'Tare Wt',
                    'Tare Weio',
                    'tare weio',
                    'tare weight'
                  ], 0));
                }
                
                // Get net weight
                if (netKeys.length > 0) {
                  netWeightKg = Number(item[netKeys[0]]) || 0;
                } else {
                  netWeightKg = Number(getValue([
                    'NET WEIG',
                    'NET WEIG.',
                    'NET WEIGHT',
                    'NET WT',
                    'NET WE',
                    'netWeight',
                    'Net Weight',
                    'Net Wt',
                    'Net Weig',
                    'net weig',
                    'net weight'
                  ], 0));
                }
                
                // Convert to quintals
                const grossWeight = convertKgToQuintal(grossWeightKg);
                const teirWeight = convertKgToQuintal(teirWeightKg);
                
                // Log weights for debugging (first 3 rows)
                if (i < 3) {
                  console.log(`Row ${i + 2} - Weight extraction:`, {
                    grossWeightKg,
                    teirWeightKg,
                    netWeightKg,
                    grossWeight,
                    teirWeight,
                    weightKeys: weightKeys.length > 0 ? weightKeys[0] : 'not found',
                    tareKeys: tareKeys.length > 0 ? tareKeys[0] : 'not found',
                    netKeys: netKeys.length > 0 ? netKeys[0] : 'not found'
                  });
                }
                
                // Extract bags from TERM column
                const termValue = getValue(['TERM', 'term', 'Term'], '');
                const bags = extractBags(termValue);
                
                // Extract rate from TOTAL CHI column (this is the rate per quintal)
                // Reuse allKeys from weight extraction above
                const rateKeys = allKeys.filter(k => {
                  const upper = k.toUpperCase().trim();
                  return (upper.includes('TOTAL') && (upper.includes('CHI') || upper.includes('CHARGE'))) || 
                         (upper.includes('RATE') && !upper.includes('BAG'));
                });
                
                let rate = 0;
                if (rateKeys.length > 0) {
                  rate = Number(item[rateKeys[0]]) || 0;
                } else {
                  rate = Number(getValue([
                    'TOTAL CHI',
                    'TOTAL CHI.',
                    'TOTAL CHARGE',
                    'TOTAL CHARGE.',
                    'TOTAL CHARGES',
                    'rate',
                    'Rate',
                    'RATE'
                  ], 0));
                }
                
                // Log rate extraction for first row
                if (i === 0) {
                  console.log('Rate extraction:', {
                    rate,
                    rateKeys: rateKeys.length > 0 ? rateKeys[0] : 'not found',
                    'all rate-related keys': allKeys.filter(k => {
                      const upper = k.toUpperCase().trim();
                      return upper.includes('TOTAL') || upper.includes('RATE') || upper.includes('CHI') || upper.includes('CHARGE');
                    })
                  });
                }
                
                // Extract kanta from LABOURY column
                const kanta = Number(getValue([
                  'LABOURY',
                  'LABOURY.',
                  'laboury',
                  'kanta',
                  'Kanta'
                ], 0));
                
                // Extract variety from MATERIAL column
                const variety = getValue([
                  'MATERIAL',
                  'MATERIAL.',
                  'variety',
                  'Variety'
                ], '');
                
                // Extract mobile number
                const mobileNo = getValue([
                  'MATERIAL MOBILE NO.',
                  'MATERIAL MOBILE NO',
                  'MOBILE NO.',
                  'MOBILE NO',
                  'contact',
                  'Contact',
                  'phone',
                  'Phone'
                ], '');
                
                // Extract date
                const entryDate = parseDate(getValue([
                  'GROSS WE DATE',
                  'GROSS WEIGHT DATE',
                  'GROSS WE DATE.',
                  'date',
                  'Date'
                ], new Date()));
                
                // Extract vehicle number
                const vehicleNo = getValue([
                  'VEHICLE NO',
                  'VEHICLE NO.',
                  'vehicleNo',
                  'Vehicle No',
                  'Vehicle Number'
                ], '');
                
                // Extract basic fields
                const basicFields = {
                  srNo: formattedSrNo,
                  date: entryDate,
                  name: parsedName || '',
                  so: fatherName || '',
                  address: address || '',
                  contact: String(mobileNo),
                  vehicleNo: vehicleNo,
                  variety: variety,
                  grossWeight: grossWeight,
                  teirWeight: teirWeight,
                  rate: rate,
                  bags: bags,
                  bagWeightKg: Number(item.bagWeightKg || item['Bag Weight Kg'] || item['Bag Wt Kg'] || 0),
                  bagRate: Number(item.bagRate || item['Bag Rate'] || 0),
                  kanta: kanta,
                  cd: Number(item.cd || item.CD || item['Cash Discount'] || 0),
                  brokerage: Number(item.brokerage || item.Brokerage || 0),
                  isBrokerageIncluded: Boolean(item.isBrokerageIncluded ?? item['Is Brokerage Included'] ?? true),
                  advanceFreight: Number(item.advanceFreight || item['Advance Freight'] || 0),
                  paymentType: item.paymentType || item['Payment Type'] || 'Full',
                };

                // Log extracted data for debugging (first 3 rows)
                if (i < 3) {
                  console.log(`Row ${i + 2} - Extracted basic fields:`, {
                    srNo: basicFields.srNo,
                    name: basicFields.name,
                    contact: basicFields.contact,
                    vehicleNo: basicFields.vehicleNo,
                    variety: basicFields.variety,
                    grossWeight: basicFields.grossWeight,
                    teirWeight: basicFields.teirWeight,
                    rate: basicFields.rate,
                    bags: basicFields.bags,
                    kanta: basicFields.kanta,
                  });
                }
                
                // Check if srNo already exists
                if (existingKantaParchiSrNos.includes(basicFields.srNo)) {
                  errors.push(`Row ${i + 2}: SR No ${basicFields.srNo} already exists. Skipping.`);
                  errorCount++;
                  continue;
                }
                
                // Validate required fields
                if (!basicFields.name && !basicFields.contact && !basicFields.vehicleNo && basicFields.grossWeight === 0) {
                  console.warn(`Row ${i + 2}: Missing all basic info, skipping...`);
                  errors.push(`Row ${i + 2}: Missing required fields (name, contact, vehicleNo, or weights)`);
                  errorCount++;
                  continue;
                }

                // Calculate all derived fields
                const calculated = calculateCustomerEntry(basicFields, []);

                const kantaParchiData: KantaParchi = {
                  id: basicFields.srNo,
                  srNo: basicFields.srNo,
                  date: basicFields.date,
                  name: toTitleCase(basicFields.name),
                  contact: basicFields.contact,
                  vehicleNo: toTitleCase(basicFields.vehicleNo),
                  variety: toTitleCase(basicFields.variety),
                  grossWeight: basicFields.grossWeight,
                  teirWeight: basicFields.teirWeight,
                  weight: calculated.weight || 0,
                  netWeight: calculated.netWeight || 0,
                  rate: basicFields.rate,
                  bags: basicFields.bags,
                  bagWeightKg: basicFields.bagWeightKg,
                  bagRate: basicFields.bagRate,
                  bagAmount: calculated.bagAmount || 0,
                  amount: calculated.amount || 0,
                  cdRate: basicFields.cd,
                  cdAmount: calculated.cd || 0,
                  brokerageRate: basicFields.brokerage,
                  brokerageAmount: calculated.brokerage || 0,
                  isBrokerageIncluded: basicFields.isBrokerageIncluded,
                  kanta: basicFields.kanta,
                  advanceFreight: basicFields.advanceFreight,
                  originalNetAmount: calculated.originalNetAmount || 0,
                  netAmount: calculated.netAmount || 0,
                  paymentType: basicFields.paymentType,
                  customerId: `${toTitleCase(basicFields.name).toLowerCase()}|${basicFields.contact.toLowerCase()}`,
                };

                await addKantaParchi(kantaParchiData);
                successCount++;
              } catch (error: any) {
                console.error(`Error importing row ${i + 2}:`, error);
                errors.push(`Row ${i + 2}: ${error.message || 'Unknown error'}`);
                errorCount++;
              }
            }
          } else {
            // Import both Kanta Parchi and Document
            for (let i = 0; i < json.length; i++) {
              const item = json[i];
              setImportProgress({ current: i + 1, total: json.length });

              try {
                // Helper function to get value from item with multiple possible keys (case-insensitive, trimmed)
                const getValue = (keys: string[], defaultValue: any = '') => {
                  // First try exact match
                  for (const key of keys) {
                    if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
                      return item[key];
                    }
                  }
                  
                  // Then try case-insensitive match
                  const itemKeys = Object.keys(item);
                  for (const key of keys) {
                    const foundKey = itemKeys.find(ik => ik.trim().toUpperCase() === key.trim().toUpperCase());
                    if (foundKey && item[foundKey] !== undefined && item[foundKey] !== null && item[foundKey] !== '') {
                      return item[foundKey];
                    }
                  }
                  
                  return defaultValue;
                };
                
                // Get next Kanta Parchi serial number
                let nextKpSrNum = 1;
                if (existingKantaParchiSrNos.length > 0) {
                  const maxNum = Math.max(...existingKantaParchiSrNos.map(srNo => {
                    const num = parseInt(srNo.replace(/[^\d]/g, '')) || 0;
                    return num;
                  }));
                  nextKpSrNum = maxNum + 1;
                }
                
                // Extract and format Kanta Parchi serial number (RST column) - use exact value from data
                let kantaParchiSrNoValue = getValue([
                  'RST',
                  'rst',
                  'Rst',
                  'kantaParchiSrNo',
                  'Kanta Parchi SR No',
                  'KP SR No'
                ], '');
                
                let kantaParchiSrNo: string;
                if (kantaParchiSrNoValue && String(kantaParchiSrNoValue).trim() !== '') {
                  const numStr = String(kantaParchiSrNoValue).replace(/[^0-9]/g, '');
                  if (numStr) {
                    kantaParchiSrNo = formatKantaParchiSrNo(parseInt(numStr, 10));
                  } else {
                    // If no number found, use the value as-is (might already be formatted)
                    kantaParchiSrNo = String(kantaParchiSrNoValue).trim();
                  }
                } else {
                  // Only auto-generate if not found in data
                  kantaParchiSrNo = formatKantaParchiSrNo(nextKpSrNum + i);
                }
                
                if (existingKantaParchiSrNos.includes(kantaParchiSrNo)) {
                  errors.push(`Row ${i + 2}: Kanta Parchi SR No ${kantaParchiSrNo} already exists. Skipping.`);
                  errorCount++;
                  continue;
                }

                // Extract and parse customer field (CUSTOME FATHER N. ADDRESS)
                const customerField = getValue([
                  'CUSTOME FATHER N. ADDRESS',
                  'CUSTOME FATHER N ADDRESS',
                  'CUSTOMER FATHER N. ADDRESS',
                  'CUSTOMER FATHER N ADDRESS',
                  'Customer',
                  'CUSTOMER',
                  'name',
                  'Name'
                ], '');
                const { name: parsedName, fatherName, address } = parseCustomerField(customerField);
                
                // Extract weights (in KG) and convert to quintals - use same logic as Kanta Parchi import
                let grossWeightKg = 0;
                let teirWeightKg = 0;
                
                // Try to find weight columns by checking all keys
                const allKeys = Object.keys(item);
                const weightKeys = allKeys.filter(k => {
                  const upper = k.toUpperCase().trim();
                  return upper.includes('GROSS') && (upper.includes('WE') || upper.includes('WT') || upper.includes('WEIGHT'));
                });
                const tareKeys = allKeys.filter(k => {
                  const upper = k.toUpperCase().trim();
                  return (upper.includes('TARE') || upper.includes('TEIR')) && (upper.includes('WE') || upper.includes('WT') || upper.includes('WEIGHT') || upper.includes('WEIO'));
                });
                
                // Get gross weight
                if (weightKeys.length > 0) {
                  grossWeightKg = Number(item[weightKeys[0]]) || 0;
                } else {
                  grossWeightKg = Number(getValue([
                    'GROSS WE',
                    'GROSS WE.',
                    'GROSS WEIGHT',
                    'GROSS WT',
                    'grossWeight',
                    'Gross Weight',
                    'Gross Wt',
                    'Gross We',
                    'gross we',
                    'gross weight'
                  ], 0));
                }
                
                // Get teir/tare weight
                if (tareKeys.length > 0) {
                  teirWeightKg = Number(item[tareKeys[0]]) || 0;
                } else {
                  teirWeightKg = Number(getValue([
                    'TARE WEIO',
                    'TARE WEIO.',
                    'TARE WEIGHT',
                    'TARE WT',
                    'TARE WE',
                    'teirWeight',
                    'Teir Weight',
                    'Tare Weight',
                    'Tare Wt',
                    'Tare Weio',
                    'tare weio',
                    'tare weight'
                  ], 0));
                }
                
                // Convert to quintals
                const grossWeight = convertKgToQuintal(grossWeightKg);
                const teirWeight = convertKgToQuintal(teirWeightKg);
                
                // Extract bags from TERM column
                const termValue = getValue(['TERM', 'term', 'Term'], '');
                const bags = extractBags(termValue);
                
                // Extract rate from TOTAL CHI column (this is the rate per quintal)
                // Reuse allKeys from weight extraction above
                const rateKeysForDoc = allKeys.filter(k => {
                  const upper = k.toUpperCase().trim();
                  return (upper.includes('TOTAL') && (upper.includes('CHI') || upper.includes('CHARGE'))) || 
                         (upper.includes('RATE') && !upper.includes('BAG'));
                });
                
                let rate = 0;
                if (rateKeysForDoc.length > 0) {
                  rate = Number(item[rateKeysForDoc[0]]) || 0;
                } else {
                  rate = Number(getValue([
                    'TOTAL CHI',
                    'TOTAL CHI.',
                    'TOTAL CHARGE',
                    'TOTAL CHARGE.',
                    'TOTAL CHARGES',
                    'rate',
                    'Rate',
                    'RATE'
                  ], 0));
                }
                
                // Extract kanta from LABOURY column
                const kanta = Number(item['LABOURY'] || item.LABOURY || item.laboury || item.kanta || item.Kanta || 0);
                
                // Extract variety from MATERIAL column
                const variety = item.MATERIAL || item['MATERIAL'] || item.variety || item.Variety || '';
                
                // Extract mobile number (try separate MOBILE NO column first, then MATERIAL MOBILE NO.)
                const mobileNo = item['MOBILE NO'] || item['MOBILE NO.'] || item['MATERIAL MOBILE NO.'] || item['MATERIAL MOBILE NO'] || item.contact || item.Contact || item.phone || item.Phone || '';

                const kantaParchiFields = {
                  srNo: kantaParchiSrNo,
                  date: parseDate(item['GROSS WE DATE'] || item['GROSS WEIGHT DATE'] || item.date || item.Date),
                  name: parsedName || item.name || item.Name || '',
                  so: fatherName || item.so || item.SO || item.fatherName || '',
                  address: address || item.address || item.Address || '',
                  contact: String(mobileNo),
                  vehicleNo: item['VEHICLE NO'] || item['VEHICLE NO.'] || item.vehicleNo || item['Vehicle No'] || item['Vehicle Number'] || '',
                  variety: variety,
                  grossWeight: grossWeight,
                  teirWeight: teirWeight,
                  rate: rate,
                  bags: bags,
                  bagWeightKg: Number(item.bagWeightKg || item['Bag Weight Kg'] || item['Bag Wt Kg'] || 0),
                  bagRate: Number(item.bagRate || item['Bag Rate'] || 0),
                  kanta: kanta,
                  cd: Number(item.cd || item.CD || item['Cash Discount'] || 0),
                  brokerage: Number(item.brokerage || item.Brokerage || 0),
                  isBrokerageIncluded: Boolean(item.isBrokerageIncluded ?? item['Is Brokerage Included'] ?? true),
                  advanceFreight: Number(item.advanceFreight || item['Advance Freight'] || 0),
                  paymentType: item.paymentType || item['Payment Type'] || 'Full',
                };

                // Calculate Kanta Parchi fields
                const kantaParchiCalculated = calculateCustomerEntry(kantaParchiFields, []);

                const kantaParchiData: KantaParchi = {
                  id: kantaParchiFields.srNo,
                  srNo: kantaParchiFields.srNo,
                  date: kantaParchiFields.date,
                  name: toTitleCase(kantaParchiFields.name),
                  contact: kantaParchiFields.contact,
                  vehicleNo: toTitleCase(kantaParchiFields.vehicleNo),
                  variety: toTitleCase(kantaParchiFields.variety),
                  grossWeight: kantaParchiFields.grossWeight,
                  teirWeight: kantaParchiFields.teirWeight,
                  weight: kantaParchiCalculated.weight || 0,
                  netWeight: kantaParchiCalculated.netWeight || 0,
                  rate: kantaParchiFields.rate,
                  bags: kantaParchiFields.bags,
                  bagWeightKg: kantaParchiFields.bagWeightKg,
                  bagRate: kantaParchiFields.bagRate,
                  bagAmount: kantaParchiCalculated.bagAmount || 0,
                  amount: kantaParchiCalculated.amount || 0,
                  cdRate: kantaParchiFields.cd,
                  cdAmount: kantaParchiCalculated.cd || 0,
                  brokerageRate: kantaParchiFields.brokerage,
                  brokerageAmount: kantaParchiCalculated.brokerage || 0,
                  isBrokerageIncluded: kantaParchiFields.isBrokerageIncluded,
                  kanta: kantaParchiFields.kanta,
                  advanceFreight: kantaParchiFields.advanceFreight,
                  originalNetAmount: kantaParchiCalculated.originalNetAmount || 0,
                  netAmount: kantaParchiCalculated.netAmount || 0,
                  paymentType: kantaParchiFields.paymentType,
                  customerId: `${toTitleCase(kantaParchiFields.name).toLowerCase()}|${kantaParchiFields.contact.toLowerCase()}`,
                };

                // Save Kanta Parchi first
                await addKantaParchi(kantaParchiData);

                // Get next Document serial number
                let nextDocSrNum = 1;
                if (existingDocumentSrNos.length > 0) {
                  const maxNum = Math.max(...existingDocumentSrNos.map(srNo => {
                    const num = parseInt(srNo.replace(/[^\d]/g, '')) || 0;
                    return num;
                  }));
                  nextDocSrNum = maxNum + 1;
                }
                
                // Extract and format Document serial number
                let documentSrNoValue = item.documentSrNo || item['Document SR No'] || item['DOC SR No'] || '';
                let documentSrNo: string;
                if (documentSrNoValue) {
                  const numStr = String(documentSrNoValue).replace(/[^0-9]/g, '');
                  if (numStr) {
                    documentSrNo = formatDocumentSrNo(parseInt(numStr, 10));
                  } else {
                    documentSrNo = formatDocumentSrNo(nextDocSrNum + i);
                  }
                } else {
                  documentSrNo = formatDocumentSrNo(nextDocSrNum + i);
                }
                
                if (existingDocumentSrNos.includes(documentSrNo)) {
                  errors.push(`Row ${i + 2}: Document SR No ${documentSrNo} already exists. Skipping document.`);
                  // Kanta Parchi is already saved, so continue
                  continue;
                }

                const documentFields = {
                  documentType: (item.documentType || item['Document Type'] || 'tax-invoice') as 'tax-invoice' | 'bill-of-supply' | 'challan',
                  date: parseDate(item.documentDate || item['Document Date'] || item.date || item.Date),
                  companyName: item.companyName || item['Company Name'] || '',
                  address: item.address || item.Address || '',
                  gstin: item.gstin || item.GSTIN || '',
                  stateName: item.stateName || item['State Name'] || '',
                  stateCode: item.stateCode || item['State Code'] || '',
                  hsnCode: item.hsnCode || item.HSN || item['HSN Code'] || '1006',
                  taxRate: Number(item.taxRate || item['Tax Rate'] || item['GST Rate'] || 5),
                  isGstIncluded: Boolean(item.isGstIncluded ?? item['Is GST Included'] ?? false),
                  nineRNo: item.nineRNo || item['9R No'] || '',
                  gatePassNo: item.gatePassNo || item['Gate Pass No'] || '',
                  grNo: item.grNo || item['GR No'] || '',
                  grDate: item.grDate || item['GR Date'] || '',
                  transport: item.transport || item.Transport || '',
                  shippingName: item.shippingName || item['Shipping Name'] || '',
                  shippingCompanyName: item.shippingCompanyName || item['Shipping Company Name'] || '',
                  shippingAddress: item.shippingAddress || item['Shipping Address'] || '',
                  shippingContact: item.shippingContact || item['Shipping Contact'] || '',
                  shippingGstin: item.shippingGstin || item['Shipping GSTIN'] || '',
                  shippingStateName: item.shippingStateName || item['Shipping State Name'] || '',
                  shippingStateCode: item.shippingStateCode || item['Shipping State Code'] || '',
                };

                // Calculate document tax amounts
                const tableTotalAmount = (kantaParchiCalculated.netWeight || 0) * kantaParchiFields.rate;
                const taxRate = documentFields.taxRate;
                const isGstIncluded = documentFields.isGstIncluded;
                
                let taxableAmount: number;
                let totalTaxAmount: number;
                let totalInvoiceValue: number;

                if (isGstIncluded) {
                  taxableAmount = tableTotalAmount / (1 + (taxRate / 100));
                  totalTaxAmount = tableTotalAmount - taxableAmount;
                  totalInvoiceValue = tableTotalAmount + (kantaParchiFields.advanceFreight || 0);
                } else {
                  taxableAmount = tableTotalAmount;
                  totalTaxAmount = taxableAmount * (taxRate / 100);
                  totalInvoiceValue = taxableAmount + totalTaxAmount + (kantaParchiFields.advanceFreight || 0);
                }

                const cgstAmount = totalTaxAmount / 2;
                const sgstAmount = totalTaxAmount / 2;

                const documentData: CustomerDocument = {
                  id: documentSrNo,
                  documentSrNo: documentSrNo,
                  kantaParchiSrNo: kantaParchiFields.srNo,
                  documentType: documentFields.documentType,
                  date: documentFields.date,
                  name: toTitleCase(kantaParchiFields.name),
                  companyName: toTitleCase(documentFields.companyName),
                  address: toTitleCase(documentFields.address || kantaParchiFields.name),
                  contact: kantaParchiFields.contact,
                  gstin: documentFields.gstin,
                  stateName: documentFields.stateName,
                  stateCode: documentFields.stateCode,
                  hsnCode: documentFields.hsnCode,
                  taxRate: taxRate,
                  isGstIncluded: isGstIncluded,
                  nineRNo: documentFields.nineRNo,
                  gatePassNo: documentFields.gatePassNo,
                  grNo: documentFields.grNo,
                  grDate: documentFields.grDate,
                  transport: documentFields.transport,
                  shippingName: toTitleCase(documentFields.shippingName),
                  shippingCompanyName: toTitleCase(documentFields.shippingCompanyName),
                  shippingAddress: toTitleCase(documentFields.shippingAddress),
                  shippingContact: documentFields.shippingContact,
                  shippingGstin: documentFields.shippingGstin,
                  shippingStateName: documentFields.shippingStateName,
                  shippingStateCode: documentFields.shippingStateCode,
                  netWeight: kantaParchiCalculated.netWeight || 0,
                  rate: kantaParchiFields.rate,
                  amount: kantaParchiCalculated.amount || 0,
                  cdAmount: kantaParchiCalculated.cd || 0,
                  brokerageAmount: kantaParchiCalculated.brokerage || 0,
                  kanta: kantaParchiFields.kanta,
                  bagAmount: kantaParchiCalculated.bagAmount || 0,
                  advanceFreight: kantaParchiFields.advanceFreight,
                  taxableAmount: taxableAmount,
                  cgstAmount: cgstAmount,
                  sgstAmount: sgstAmount,
                  totalTaxAmount: totalTaxAmount,
                  totalInvoiceValue: totalInvoiceValue,
                };

                await addCustomerDocument(documentData);
                successCount++;
              } catch (error: any) {
                console.error(`Error importing row ${i + 2}:`, error);
                errors.push(`Row ${i + 2}: ${error.message || 'Unknown error'}`);
                errorCount++;
              }
            }
          }

          // Show results
          if (successCount > 0) {
            toast({
              title: "Import Successful",
              description: `${successCount} ${importVariant === "kanta-parchi" ? "Kanta Parchi" : "entries"} imported successfully.${errorCount > 0 ? ` ${errorCount} failed.` : ""}`,
              variant: "success",
            });
          } else {
            toast({
              title: "Import Failed",
              description: `No entries were imported.${errors.length > 0 ? ` Errors: ${errors.slice(0, 3).join(", ")}` : ""}`,
              variant: "destructive",
            });
          }

          if (errors.length > 0 && errors.length <= 10) {
            console.warn("Import errors:", errors);
          }

          onImportComplete?.();
          onOpenChange(false);
        } catch (error: any) {
          console.error("Error reading file:", error);
          toast({
            title: "Import Failed",
            description: error.message || "Failed to read the Excel file.",
            variant: "destructive",
          });
        } finally {
          setIsImporting(false);
          setImportProgress({ current: 0, total: 0 });
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };

      reader.readAsBinaryString(file);
    } catch (error: any) {
      console.error("Error importing file:", error);
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import the file.",
        variant: "destructive",
      });
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Customer Data</DialogTitle>
          <DialogDescription>
            Choose the import type and select an Excel file to import.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Import Type</Label>
            <RadioGroup value={importVariant} onValueChange={(value) => setImportVariant(value as ImportVariant)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="kanta-parchi" id="kanta-parchi" />
                <Label htmlFor="kanta-parchi" className="font-normal cursor-pointer">
                  Kanta Parchi Import
                  <span className="text-xs text-muted-foreground block">
                    Import kanta parchi with all fields and calculations
                  </span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="parchi-document" id="parchi-document" />
                <Label htmlFor="parchi-document" className="font-normal cursor-pointer">
                  Parchi and Document Import
                  <span className="text-xs text-muted-foreground block">
                    Import both kanta parchi and document with all fields and calculations
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Excel File</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              className="hidden"
            />
            <Button
              onClick={handleFileSelect}
              disabled={isImporting}
              className="w-full"
              variant="outline"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing... ({importProgress.current}/{importProgress.total})
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Select Excel File
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              <FileSpreadsheet className="inline h-3 w-3 mr-1" />
              Supported formats: .xlsx, .xls
            </p>
          </div>

          {importVariant === "kanta-parchi" && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium mb-1">Required Fields:</p>
              <p className="text-xs text-muted-foreground">
                srNo, date, name, contact, vehicleNo, variety, grossWeight, teirWeight, rate, bags, bagWeightKg, bagRate, kanta, cd, brokerage, isBrokerageIncluded, advanceFreight, paymentType
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                All calculations (weight, netWeight, amount, cdAmount, brokerageAmount, bagAmount, originalNetAmount, netAmount) will be automatically calculated.
              </p>
            </div>
          )}

          {importVariant === "parchi-document" && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium mb-1">Required Fields:</p>
              <p className="text-xs text-muted-foreground">
                All Kanta Parchi fields + documentType, documentDate, companyName, address, gstin, stateName, stateCode, hsnCode, taxRate, isGstIncluded, shipping fields, etc.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Both Kanta Parchi and Document will be imported with all calculations applied automatically.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

