import { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import type { Customer, CustomerPayment } from "@/lib/definitions";
import { formatSrNo, toTitleCase, formatDateLocal, calculateCustomerEntry } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { bulkUpsertCustomers } from "@/lib/firestore";
import { FIELD_ALIASES } from "@/lib/import-helpers";
import { findFuzzyClusters, findVarietyClusters, type FuzzyCluster } from "@/lib/string-similarity";
import { db } from "@/lib/database";

export function parseBagsAndWeight(bagsValueRaw: any, varietyRaw: string): { bags: number; bagWeightKg: number } {
  const bagsStr = String(bagsValueRaw || '').trim().toUpperCase();
  const variety = String(varietyRaw || '').trim().toUpperCase();

  const numericBags = parseFloat(bagsStr);
  const isPureNumber = !isNaN(numericBags) && /^\d+(\.\d+)?$/.test(bagsStr);

  const isWheat = variety.includes("GEHOO") || variety.includes("WHEAT") || variety.includes("GEH") || variety.includes("WHE") || variety.includes("GEHU");
  const isRiceBranOrPolish = variety.includes("POLISH") || variety.includes("BRAN") || variety.includes("RICE") || variety.includes("BRN") || variety.includes("POL");

  if (isPureNumber) {
    const totalBags = numericBags;
    let weightPerBag = 0;
    if (isWheat) {
      weightPerBag = 1.0;
    } else if (isRiceBranOrPolish) {
      weightPerBag = 0.2;
    } else {
      weightPerBag = 0.2;
    }
    return { bags: totalBags, bagWeightKg: weightPerBag };
  }

  let pptBags = 0;
  let juttBags = 0;
  let unnamedBags = 0;

  const matches = Array.from(bagsStr.matchAll(/(\d+(?:\.\d+)?)\s*([A-Z]*)/g));
  let hasMatches = false;

  for (const match of matches) {
    hasMatches = true;
    const num = parseFloat(match[1]);
    const word = match[2] || '';

    const isJuteWord = word.includes("JUT") || word.includes("JUTE") || word.includes("BARDANA") || word.includes("JOT") || word.includes("JUTT") || word.includes("JT");
    const isPptWord = word.includes("KATTA") || word.includes("KATT") || word.includes("PPT") || word.includes("BAG") || word.includes("KATA") || word.includes("PP") || word.includes("PT") || word.includes("POLY") || word.includes("PLASTIC");

    if (isJuteWord) {
      juttBags += num;
    } else if (isPptWord) {
      pptBags += num;
    } else {
      unnamedBags += num;
    }
  }

  if (!hasMatches) {
    return { bags: 0, bagWeightKg: 0 };
  }

  let totalBags = pptBags + juttBags + unnamedBags;
  if (totalBags === 0) return { bags: 0, bagWeightKg: 0 };

  let totalWeightKg = 0;
  if (isWheat) {
    totalWeightKg = totalBags * 1.0;
  } else if (isRiceBranOrPolish) {
    let unnamedWeight = 0.2;
    if (bagsStr.includes("JUT") || bagsStr.includes("JUTE") || bagsStr.includes("BARDANA") || bagsStr.includes("JUTT")) {
      if (!bagsStr.includes("KATTA") && !bagsStr.includes("PPT") && !bagsStr.includes("BAG") && !bagsStr.includes("KATT") && !bagsStr.includes("KATA")) {
        unnamedWeight = 0.7;
      }
    }
    totalWeightKg = (pptBags * 0.2) + (juttBags * 0.7) + (unnamedBags * unnamedWeight);
  } else {
    totalWeightKg = (pptBags * 0.2) + (juttBags * 0.7) + (unnamedBags * 0.2);
  }

  return {
    bags: totalBags,
    bagWeightKg: Number((totalWeightKg / totalBags).toFixed(4))
  };
}

interface UseCustomerImportExportProps {
  customers: Customer[];
  paymentHistory: CustomerPayment[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  isImportMode?: boolean;
}

export function useCustomerImportExport({ 
  customers, 
  paymentHistory, 
  setCustomers,
  isImportMode = false
}: UseCustomerImportExportProps) {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [importCurrent, setImportCurrent] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importStartTime, setImportStartTime] = useState<number | null>(null);

  // Configuration states
  const [showConfigDialog, setShowConfigDialog] = useState(false);

  // Fuzzy spelling states
  const [showFuzzyDialog, setShowFuzzyDialog] = useState(false);
  const [fuzzyClusters, setFuzzyClusters] = useState<FuzzyCluster[]>([]);
  const [pendingVarietyClusters, setPendingVarietyClusters] = useState<FuzzyCluster[]>([]);
  const [pendingImportData, setPendingImportData] = useState<any[] | null>(null);

  const importInputRef = useRef<HTMLInputElement | null>(null);
  const cancelRef = useRef<boolean>(false);

  const safeCustomers = customers || [];

  const handleExport = useCallback(() => {
    if (!safeCustomers || safeCustomers.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }

    const dataToExport = safeCustomers.map(c => {
      const calculated = calculateCustomerEntry(c, paymentHistory);
      return {
        'SR NO.': c.srNo,
        'DATE': c.date,
        'BAGS': c.bags || 0,
        'NAME': c.name,
        'COMPANY NAME': c.companyName || '',
        'ADDRESS': c.address,
        'CONTACT': c.contact,
        'GSTIN': c.gstin || '',
        'STATE NAME': c.stateName || '',
        'STATE CODE': c.stateCode || '',
        'VEHICLE NO': c.vehicleNo,
        'VARIETY': c.variety,
        'GROSS WT': c.grossWeight,
        'TIER WT': c.teirWeight,
        'NET WT': calculated.netWeight,
        'RATE': c.rate,
        'CD RATE': c.cdRate || 0,
        'CD AMOUNT': calculated.cd || 0,
        'BROKERAGE RATE': c.brokerageRate || 0,
        'BROKERAGE AMOUNT': calculated.brokerage || 0,
        'BROKERAGE INCLUDED': c.isBrokerageIncluded ? 'Yes' : 'No',
        'BAG WEIGHT KG': c.bagWeightKg || 0,
        'BAG RATE': c.bagRate || 0,
        'BAG AMOUNT': calculated.bagAmount || 0,
        'KANTA': calculated.kanta || 0,
        'AMOUNT': calculated.amount || 0,
        'NET AMOUNT': calculated.originalNetAmount || 0,
        'PAYMENT TYPE': c.paymentType,
        'SHIPPING NAME': c.shippingName || '',
        'SHIPPING COMPANY NAME': c.shippingCompanyName || '',
        'SHIPPING ADDRESS': c.shippingAddress || '',
        'SHIPPING CONTACT': c.shippingContact || '',
        'SHIPPING GSTIN': c.shippingGstin || '',
        'SHIPPING STATE NAME': c.shippingStateName || '',
        'SHIPPING STATE CODE': c.shippingStateCode || '',
        'HSN CODE': c.hsnCode || '',
        'TAX RATE': c.taxRate || 0,
        'GST INCLUDED': c.isGstIncluded ? 'Yes' : 'No',
        '9R NO': c.nineRNo || '',
        'GATE PASS NO': c.gatePassNo || '',
        'GR NO': c.grNo || '',
        'GR DATE': c.grDate || '',
        'TRANSPORT': c.transport || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");
    XLSX.writeFile(workbook, "CustomerEntries.xlsx");
    toast({ title: "Exported", description: "Customer data has been exported." });
  }, [safeCustomers, paymentHistory, toast]);

  const handleCancelImport = useCallback(() => {
    cancelRef.current = true;
    setImportStatus('Stopping import...');
  }, []);

  const executeCustomerImport = useCallback(async (json: any[]) => {
    try {
      cancelRef.current = false;
      setIsImporting(true);
      setImportProgress(10);
      setImportStatus(`Processing ${json.length} entries...`);
      setImportStartTime(Date.now());

      const totalRows = json.length;
      setImportTotal(totalRows);

      let nextSrNum = safeCustomers.length > 0 
        ? Math.max(...safeCustomers.map(c => {
            const numPart = c.srNo.substring(1);
            const numValue = parseInt(numPart);
            return isNaN(numValue) ? 0 : numValue;
          })) + 1 
        : 1;

      const processedSrNos = new Set<string>();
      let successCount = 0;
      let updateCount = 0;
      let errorCount = 0;

      const FIELD_MAP: Record<string, string[]> = {
        ...FIELD_ALIASES,
        'name': [...(FIELD_ALIASES['name'] || []), 'CLIENT', 'PARTY NAME', 'NAME OF CUSTOMER'],
        'companyName': ['COMPANY', 'COMPANY NAME', 'FIRM', 'FIRM NAME', 'SHOP NAME'],
        'gstin': ['GSTIN', 'GST', 'GST NO', 'GST NUMBER'],
        'cdRate': ['CD RATE', 'CD', 'CD %'],
        'brokerageRate': ['BROKERAGE', 'BROK', 'BROKERAGE RATE'],
        'bags': ['BAGS', 'BAG', 'PACKETS', 'QTY', 'QUANTITY', 'NO OF BAGS', 'KATTA', 'BAGS QTY'],
        'bagWeightKg': ['BAG WT', 'BAG WEIGHT', 'BAG WEIGHT KG'],
        'bagRate': ['BAG RATE', 'BARDANA RATE'],
      };

      const findValue = (item: any, fieldKeys: string[], excludeSubstrings: string[] = []): any => {
        const itemKeys = Object.keys(item);
        for (const key of fieldKeys) {
          const exactMatch = itemKeys.find(k => k.trim().toUpperCase() === key.toUpperCase());
          if (exactMatch && item[exactMatch] !== undefined && item[exactMatch] !== null && item[exactMatch] !== '') {
            return item[exactMatch];
          }
        }
        for (const key of fieldKeys) {
          const partialMatch = itemKeys.find(k => {
            const normalizedK = k.trim().toUpperCase();
            if (!normalizedK.includes(key.toUpperCase())) return false;
            if (excludeSubstrings.some(sub => normalizedK.includes(sub.toUpperCase()))) return false;
            return true;
          });
          if (partialMatch && item[partialMatch] !== undefined && item[partialMatch] !== null && item[partialMatch] !== '') {
            return item[partialMatch];
          }
        }
        return undefined;
      };

      const updatedCustomersList = [...safeCustomers];
      const customersToSave: Customer[] = [];
      const mainCustomers = await db.customers.toArray();
      const existingSrNos = new Set(mainCustomers.map(c => c.srNo?.trim().toUpperCase()).filter(Boolean));

      for (const item of json) {
        try {
          if (cancelRef.current) {
            setIsImporting(false);
            setImportProgress(0);
            setImportStatus('');
            toast({ title: 'Import Cancelled', description: 'Customer import was stopped by user.', variant: 'destructive' });
            return;
          }

          const processedCount = successCount + updateCount + errorCount;
          
          const nameVal = findValue(item, FIELD_MAP.name);
          if (!nameVal) {
            const hasAnyValue = Object.values(item).some(v => v !== null && v !== undefined && String(v).trim() !== "");
            if (hasAnyValue) {
              errorCount++;
            }
            continue;
          }

          const fatherNameVal = findValue(item, FIELD_MAP.fatherName);
          if (fatherNameVal && String(fatherNameVal).trim() !== "") {
            // Skip rows that have a Father Name in customer entry
            continue;
          }

          const contactVal = findValue(item, FIELD_MAP.contact);
          const dateVal = findValue(item, FIELD_MAP.date);
          const srVal = findValue(item, FIELD_MAP.srNo);

          let dateStr = formatDateLocal(new Date());
          if (dateVal) {
            const parsedDate = new Date(dateVal);
            if (!isNaN(parsedDate.getTime())) dateStr = formatDateLocal(parsedDate);
          }

          let finalSrNo = String(srVal || '');
          if (!finalSrNo || finalSrNo === 'undefined' || finalSrNo === '') {
            finalSrNo = formatSrNo(nextSrNum++, 'C');
          } else if (/^\d+$/.test(finalSrNo)) {
            finalSrNo = formatSrNo(parseInt(finalSrNo), 'C');
          }

          if (processedSrNos.has(finalSrNo)) {
            finalSrNo = formatSrNo(nextSrNum++, 'C');
          }
          processedSrNos.add(finalSrNo);

          // Duplicate check: skip existing entries in import mode
          if (isImportMode && existingSrNos.has(finalSrNo.trim().toUpperCase())) {
            continue;
          }

          const getWeight = (v: any) => {
            const n = parseFloat(String(v || 0)) || 0;
            return n > 1000 ? n / 100 : n;
          };

          const gw = getWeight(findValue(item, FIELD_MAP.grossWeight, ['BAG', 'KARTA', 'KARDA', 'CD', 'RATE', 'AMOUNT', 'AMT', 'NET', 'TEIR', 'TIER', 'TARE']));
          const tw = getWeight(findValue(item, FIELD_MAP.teirWeight, ['BAG', 'KARTA', 'KARDA', 'CD', 'RATE', 'AMOUNT', 'AMT', 'NET', 'GROSS']));
          const nwFromFile = findValue(item, FIELD_MAP.netWeight, ['BAG', 'KARTA', 'KARDA', 'CD', 'RATE', 'AMOUNT', 'AMT', 'GROSS', 'TEIR', 'TIER', 'TARE']);
          let weight = gw - tw;
          if (weight <= 0 && nwFromFile) weight = getWeight(nwFromFile);

          const cdVal = parseFloat(String(findValue(item, FIELD_MAP.cdRate, ['AMOUNT', 'AMT']) || 0)) || 0;

          // Config configurations for Kanta, Karta, and Laboury
          let labouryRate = 0;
          if (item['CONFIG_LABOURY_RATE'] !== undefined) {
            labouryRate = Number(item['CONFIG_LABOURY_RATE']);
          } else {
            const rawLabour = String(findValue(item, ['LABOUR', 'LABOURY', 'LABOURY RATE']) || '').trim().toUpperCase();
            if (rawLabour === 'YES' || rawLabour === 'Y') {
              labouryRate = 2;
            } else if (rawLabour && !isNaN(Number(rawLabour.replace(/[^0-9.]/g, '')))) {
              labouryRate = parseFloat(rawLabour);
            }
          }

          const kantaVal = parseFloat(String(item['KANTA'] || findValue(item, ['KANTA', 'WEIGHING']) || 0)) || 0;
          const kartaPercentage = parseFloat(String(item['KARTA_PERCENTAGE'] || findValue(item, ['KARTA', 'KARDA %', 'KARDA']) || 0)) || 0;

          let rawBagsVal = '';
          const rawTermVal = String(findValue(item, ['TERM', 'CREDIT TERM', 'PAYMENT TERM']) || '').trim().toUpperCase();
          const hasBagKeywordsInTerm = ['KATTA', 'BAG', 'JUT', 'BURI', 'BORI', 'BARDANA'].some(keyword => rawTermVal.includes(keyword));

          if (hasBagKeywordsInTerm) {
            rawBagsVal = rawTermVal;
          } else {
            rawBagsVal = findValue(item, FIELD_MAP.bags, ['WT', 'WEIGHT', 'WGT', 'KG', 'RATE', 'AMOUNT', 'AMT', 'CD', 'BROKERAGE', 'LABOUR']);
          }
          
          // Fallback 1: Scan all fields in the row for strings containing "KATTA", "BAG", "JUT", "BURI", "BORI", "BARDANA"
          if (!rawBagsVal) {
            for (const key of Object.keys(item)) {
              const valStr = String(item[key] || '').trim().toUpperCase();
              if (valStr.includes("KATTA") || valStr.includes("BAG") || valStr.includes("JUT") || valStr.includes("BURI") || valStr.includes("BORI") || valStr.includes("BARDANA")) {
                const normalizedKey = key.toUpperCase();
                const isWeightColumn = ['WT', 'WEIGHT', 'WGT', 'KG', 'RATE', 'AMOUNT', 'AMT', 'CD', 'BROKERAGE', 'LABOUR'].some(sub => normalizedKey.includes(sub));
                if (!isWeightColumn) {
                  rawBagsVal = item[key];
                  break;
                }
              }
            }
          }
          
          // Fallback 2: Scan for a numeric value in columns starting with "__EMPTY" or containing "KATTA", "BAG", "QTY"
          if (!rawBagsVal) {
            for (const key of Object.keys(item)) {
              const val = item[key];
              const numVal = parseFloat(String(val || ''));
              if (!isNaN(numVal) && numVal > 0) {
                const normalizedKey = key.toUpperCase();
                if (normalizedKey.startsWith("__EMPTY") || normalizedKey.includes("KATTA") || normalizedKey.includes("BAG") || normalizedKey.includes("QTY")) {
                  const isExcluded = ['WT', 'WEIGHT', 'WGT', 'KG', 'RATE', 'AMOUNT', 'AMT', 'CD', 'BROKERAGE', 'LABOUR', 'GROSS', 'TEIR', 'TIER', 'TARE', 'NET', 'CONTACT', 'MOBILE', 'PHONE', 'GSTIN', 'GST', 'DATE', 'SR', 'RST', 'SERIAL'].some(sub => normalizedKey.includes(sub));
                  if (!isExcluded) {
                    rawBagsVal = val;
                    break;
                  }
                }
              }
            }
          }

          const varietyVal = String(findValue(item, FIELD_MAP.variety) || '').toUpperCase();
          const parsedBagsAndWt = parseBagsAndWeight(rawBagsVal, varietyVal);

          const explicitBagWeight = parseFloat(String(findValue(item, FIELD_MAP.bagWeightKg, ['RATE', 'AMOUNT', 'AMT', 'CD', 'BROKERAGE', 'LABOUR', 'QTY', 'QUANTITY']) || 0)) || 0;
          const finalBags = parsedBagsAndWt.bags;
          const finalBagWeightKg = explicitBagWeight > 0 ? explicitBagWeight : parsedBagsAndWt.bagWeightKg;

          let termDays = 0;
          if (rawTermVal) {
            const hasBagKeywords = ['KATTA', 'BAG', 'JUT', 'BURI', 'BORI', 'BARDANA'].some(keyword => rawTermVal.includes(keyword));
            if (!hasBagKeywords) {
              const numMatch = rawTermVal.match(/\d+/);
              if (numMatch) {
                termDays = parseInt(numMatch[0]);
              }
            }
          }

          let dueDateStr = dateStr;
          if (termDays > 0) {
            try {
              const entryDate = new Date(dateStr);
              if (!isNaN(entryDate.getTime())) {
                entryDate.setDate(entryDate.getDate() + termDays);
                const offset = entryDate.getTimezoneOffset() * 60000;
                dueDateStr = new Date(entryDate.getTime() - offset).toISOString().split('T')[0];
              }
            } catch (e) {
              console.warn('[Import] Due Date calculation failed:', e);
            }
          }

          const customerData: Customer = {
            id: isImportMode ? `imp-${finalSrNo}` : finalSrNo,
            srNo: finalSrNo,
            date: dateStr,
            term: String(termDays),
            dueDate: dueDateStr,
            name: toTitleCase(String(nameVal || '')),
            companyName: toTitleCase(String(findValue(item, FIELD_MAP.companyName) || '')),
            address: toTitleCase(String(findValue(item, FIELD_MAP.address) || '')),
            contact: String(contactVal || ''),
            gstin: String(findValue(item, FIELD_MAP.gstin) || ''),
            vehicleNo: String(findValue(item, FIELD_MAP.vehicleNo) || '').toUpperCase(),
            variety: String(findValue(item, FIELD_MAP.variety) || '').toUpperCase(),
            grossWeight: gw,
            teirWeight: tw,
            weight: weight,
            netWeight: weight,
            rate: parseFloat(String(findValue(item, FIELD_MAP.rate) || 0)) || 0,
            cd: cdVal,
            cdRate: cdVal,
            brokerageRate: parseFloat(String(findValue(item, FIELD_MAP.brokerageRate) || 0)) || 0,
            brokerageAmount: 0,
            bags: finalBags,
            bagWeightKg: finalBagWeightKg,
            bagRate: parseFloat(String(findValue(item, FIELD_MAP.bagRate) || 0)) || 0,
            paymentType: 'Full',
            customerId: `${toTitleCase(String(nameVal || '')).toLowerCase()}|${String(contactVal || '').toLowerCase()}`,
            isBrokerageIncluded: false,
            isGstIncluded: false,
            taxRate: 5,
            hsnCode: '1006',
            barcode: '',
            receiptType: 'Cash',
            so: '',
            kartaPercentage: kartaPercentage,
            kartaWeight: 0,
            kartaAmount: 0,
            labouryRate: labouryRate,
            labouryAmount: 0,
            amount: 0,
            netAmount: 0,
            originalNetAmount: 0,
            kanta: kantaVal,
          };

          const calculated = calculateCustomerEntry(customerData, paymentHistory);
          const computedLabouryAmount = Math.round(weight * labouryRate);
          const finalData = { 
            ...customerData, 
            ...calculated,
            labouryAmount: computedLabouryAmount,
            originalNetAmount: Math.round(Number(calculated.originalNetAmount || calculated.netAmount || 0) - computedLabouryAmount),
            netAmount: Math.round(Number(calculated.netAmount || 0) - computedLabouryAmount)
          };

          const existingIndex = updatedCustomersList.findIndex(c => c.srNo === finalSrNo);
          if (existingIndex >= 0) {
            const merged = { ...updatedCustomersList[existingIndex], ...finalData };
            customersToSave.push(merged);
            updatedCustomersList[existingIndex] = merged;
            updateCount++;
          } else {
            customersToSave.push(finalData);
            updatedCustomersList.push(finalData);
            successCount++;
          }

          if (processedCount % 50 === 0 || processedCount === totalRows - 1) {
            setImportStatus(`Processing entry ${processedCount + 1} of ${totalRows}...`);
            setImportProgress(10 + Math.floor((processedCount / totalRows) * 80));
            setImportCurrent(processedCount + 1);
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        } catch (e) {
          console.error('Row process error:', e);
          errorCount++;
        }
      }

      setImportStatus('Saving to database...');
      setImportProgress(95);

      if (customersToSave.length > 0) {
        if (isImportMode) {
          await db.stagedCustomers.bulkPut(customersToSave);
        } else {
          await db.customers.bulkPut(customersToSave);
          await bulkUpsertCustomers(customersToSave);
        }
      }

      if (!isImportMode) {
        setCustomers(updatedCustomersList);
      }
      setImportProgress(100);
      toast({ 
        title: isImportMode ? "Import Finished (Staging)" : "Import Finished", 
        description: isImportMode 
          ? `${customersToSave.length} entries imported to staging table.`
          : `${successCount} new added, ${updateCount} updated.`,
        variant: errorCount ? "destructive" : "success" 
      });

      setTimeout(() => {
        setIsImporting(false);
        setImportProgress(0);
        setImportStatus('');
      }, 2000);
    } catch (error) {
      setIsImporting(false);
      setImportStatus('');
      toast({ title: "Import Failed", variant: "destructive" });
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  }, [safeCustomers, paymentHistory, setCustomers, toast, isImportMode]);

  const handleResolveFuzzy = useCallback((resolutions: Record<string, string>) => {
    setShowFuzzyDialog(false);
    if (!pendingImportData) return;

    const isAddressType = fuzzyClusters.length > 0 && fuzzyClusters[0].field === 'address';

    const cleanedJson = pendingImportData.map(item => {
      const newItem = { ...item };
      const keys = Object.keys(newItem);
      
      const FIELD_MAP = {
        address: FIELD_ALIASES.address || ['ADDRESS', 'CITY'],
        variety: FIELD_ALIASES.variety || ['MATERIAL', 'VARIETY', 'ITEM', 'COMMODITY']
      };

      if (isAddressType) {
        const addressKey = keys.find(k => {
          const norm = k.toUpperCase().trim();
          return FIELD_MAP.address.some(x => norm === x.toUpperCase() || norm.includes(x.toUpperCase()));
        });
        if (addressKey && newItem[addressKey]) {
          const rawVal = String(newItem[addressKey]).trim();
          const lookup = rawVal.toLowerCase().trim();
          if (resolutions[lookup] && resolutions[lookup] !== 'KEEP_ORIGINAL') {
            newItem[addressKey] = resolutions[lookup];
          }
        }
      } else {
        const varietyKey = keys.find(k => {
          const norm = k.toUpperCase().trim();
          return FIELD_MAP.variety.some(x => norm === x.toUpperCase() || norm.includes(x.toUpperCase()));
        });
        if (varietyKey && newItem[varietyKey]) {
          const rawVal = String(newItem[varietyKey]).trim();
          const lookup = rawVal.toLowerCase().trim();
          if (resolutions[lookup] && resolutions[lookup] !== 'KEEP_ORIGINAL') {
            newItem[varietyKey] = resolutions[lookup];
          }
        }
      }

      return newItem;
    });

    if (isAddressType && pendingVarietyClusters.length > 0) {
      setPendingImportData(cleanedJson);
      setFuzzyClusters(pendingVarietyClusters);
      setPendingVarietyClusters([]);
      setShowFuzzyDialog(true);
    } else {
      setPendingImportData(null);
      setFuzzyClusters([]);
      setPendingVarietyClusters([]);
      executeCustomerImport(cleanedJson);
    }
  }, [pendingImportData, fuzzyClusters, pendingVarietyClusters, executeCustomerImport]);

  const handleCancelFuzzy = useCallback(() => {
    setShowFuzzyDialog(false);
    if (!pendingImportData) return;
    
    const isAddressType = fuzzyClusters.length > 0 && fuzzyClusters[0].field === 'address';

    if (isAddressType && pendingVarietyClusters.length > 0) {
      setFuzzyClusters(pendingVarietyClusters);
      setPendingVarietyClusters([]);
      setShowFuzzyDialog(true);
    } else {
      const dataToImport = [...pendingImportData];
      setPendingImportData(null);
      setFuzzyClusters([]);
      setPendingVarietyClusters([]);
      executeCustomerImport(dataToImport);
    }
  }, [pendingImportData, fuzzyClusters, pendingVarietyClusters, executeCustomerImport]);

  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast({ title: "No file selected", variant: "destructive" });
      return;
    }

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast({ title: "Invalid file type", description: "Please select an Excel file (.xlsx or .xls)", variant: "destructive" });
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    setImportStatus('Reading file...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          toast({ title: "File read error", description: "Could not read the file.", variant: "destructive" });
          return;
        }

        setImportStatus('Parsing Excel file...');

        const workbook = XLSX.read(data, { type: 'binary', cellNF: true, cellText: false });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          toast({ title: "Invalid file", description: "The Excel file does not contain any sheets.", variant: "destructive" });
          return;
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          toast({ title: "Invalid file", description: "Could not read the worksheet.", variant: "destructive" });
          return;
        }

        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });
        
        if (!json || json.length === 0) {
          toast({ title: "Empty file", description: "The Excel file does not contain any data.", variant: "destructive" });
          return;
        }

        setPendingImportData(json);
        setShowConfigDialog(true);
      } catch (error) {
        toast({ title: "Import Failed", variant: "destructive" });
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  }, [toast]);

  const runFuzzySpellingCheck = useCallback(async (json: any[]) => {
    try {
      const importedAddresses: string[] = [];
      const importedVarieties: string[] = [];

      const FIELD_MAP = {
        address: FIELD_ALIASES.address || ['ADDRESS', 'CITY'],
        variety: FIELD_ALIASES.variety || ['MATERIAL', 'VARIETY', 'ITEM', 'COMMODITY'],
        fatherName: FIELD_ALIASES.fatherName || ['FATHER NAME', 'S/O', 'SO', 'FATHER']
      };

      const nameFieldMap = [...(FIELD_ALIASES['name'] || []), 'CLIENT', 'PARTY NAME', 'NAME OF CUSTOMER'];

      // Filter: Only check rows that will actually be imported (those with a Name and WITHOUT a Father's name)
      const importableRows = json.filter(item => {
        const keys = Object.keys(item);
        
        const nameKey = keys.find(k => {
          const norm = k.toUpperCase().trim();
          return nameFieldMap.some(x => norm === x.toUpperCase() || norm.includes(x.toUpperCase()));
        });
        if (!nameKey || !item[nameKey]) return false;

        const fatherKey = keys.find(k => {
          const norm = k.toUpperCase().trim();
          return FIELD_MAP.fatherName.some(x => norm === x.toUpperCase() || norm.includes(x.toUpperCase()));
        });
        const fatherVal = fatherKey ? String(item[fatherKey]).trim() : '';
        return !fatherVal;
      });

      importableRows.forEach(item => {
        const keys = Object.keys(item);
        
        const addressKey = keys.find(k => {
          const norm = k.toUpperCase().trim();
          return FIELD_MAP.address.some(x => norm === x.toUpperCase() || norm.includes(x.toUpperCase()));
        });
        if (addressKey && item[addressKey]) {
          importedAddresses.push(String(item[addressKey]).trim());
        }

        const varietyKey = keys.find(k => {
          const norm = k.toUpperCase().trim();
          return FIELD_MAP.variety.some(x => norm === x.toUpperCase() || norm.includes(x.toUpperCase()));
        });
        if (varietyKey && item[varietyKey]) {
          importedVarieties.push(String(item[varietyKey]).trim());
        }
      });

      const existingAddresses = safeCustomers.map(c => c.address).filter(Boolean);
      const existingVarieties = safeCustomers.map(c => c.variety).filter(Boolean);

      const addressClusters = findFuzzyClusters('address', importedAddresses, existingAddresses, 0.78);
      const varietyClusters = findVarietyClusters(importedVarieties, existingVarieties, 0.78);

      if (addressClusters.length > 0) {
        setPendingImportData(json);
        setPendingVarietyClusters(varietyClusters);
        setFuzzyClusters(addressClusters);
        setShowFuzzyDialog(true);
      } else if (varietyClusters.length > 0) {
        setPendingImportData(json);
        setPendingVarietyClusters([]);
        setFuzzyClusters(varietyClusters);
        setShowFuzzyDialog(true);
      } else {
        executeCustomerImport(json);
      }
    } catch (e) {
      executeCustomerImport(json);
    }
  }, [safeCustomers, executeCustomerImport]);

  const handleConfirmConfig = useCallback((config: {
    defaultKanta: number;
    defaultKarta: number;
    defaultLabouryRate: number;
    exceptions: Record<string, { kanta: number; karta: number; labouryRate: number }>;
  }) => {
    setShowConfigDialog(false);
    if (!pendingImportData) return;

    const configuredJson = pendingImportData.map((item, idx) => {
      const newItem = { ...item };
      const exception = config.exceptions[idx];

      newItem['KANTA'] = exception ? exception.kanta : config.defaultKanta;
      newItem['KARTA_PERCENTAGE'] = exception ? exception.karta : config.defaultKarta;

      const keys = Object.keys(newItem);
      const labourKey = keys.find(k => {
        const norm = k.toUpperCase().trim();
        return norm.includes('LABOU') || norm.includes('LABOUR');
      });
      const rawLabour = labourKey ? String(newItem[labourKey]).trim().toUpperCase() : '';
      const cleaned = rawLabour.replace(/[^0-9.]/g, '');
      const hasLaboury = rawLabour === 'YES' || rawLabour === 'Y' || (cleaned !== '' && !isNaN(Number(cleaned)) && Number(cleaned) > 0);

      if (hasLaboury) {
        newItem['CONFIG_LABOURY_RATE'] = exception ? exception.labouryRate : config.defaultLabouryRate;
      } else {
        if (exception && exception.labouryRate > 0) {
          newItem['CONFIG_LABOURY_RATE'] = exception.labouryRate;
          if (labourKey) {
            newItem[labourKey] = 'YES';
          } else {
            newItem['LABOUR'] = 'YES';
          }
        } else {
          newItem['CONFIG_LABOURY_RATE'] = 0;
        }
      }

      return newItem;
    });

    setPendingImportData(null);
    runFuzzySpellingCheck(configuredJson);
  }, [pendingImportData, runFuzzySpellingCheck]);

  const handleCancelConfig = useCallback(() => {
    setShowConfigDialog(false);
    setPendingImportData(null);
    if (importInputRef.current) {
      importInputRef.current.value = '';
    }
  }, []);

  return {
    handleImport,
    handleExport,
    handleCancelImport,
    isImporting,
    importProgress,
    importStatus,
    importCurrent,
    importTotal,
    importStartTime,
    showFuzzyDialog,
    fuzzyClusters,
    handleResolveFuzzy,
    handleCancelFuzzy,
    importInputRef,
    showConfigDialog,
    handleConfirmConfig,
    handleCancelConfig,
    pendingImportData,
  };
}
