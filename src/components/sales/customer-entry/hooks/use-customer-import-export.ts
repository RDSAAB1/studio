import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import type { Customer, CustomerPayment } from "@/lib/definitions";
import { formatSrNo, toTitleCase, formatDateLocal, calculateCustomerEntry } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { bulkUpsertCustomers, addCustomer, updateCustomer } from "@/lib/firestore";
import { FIELD_ALIASES } from "@/lib/import-helpers";

interface UseCustomerImportExportProps {
  customers: Customer[];
  paymentHistory: CustomerPayment[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
}

export function useCustomerImportExport({ 
  customers, 
  paymentHistory, 
  setCustomers 
}: UseCustomerImportExportProps) {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [importCurrent, setImportCurrent] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importStartTime, setImportStartTime] = useState<number | null>(null);

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

  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast({ title: "No file selected", variant: "destructive" });
      return;
    }

    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast({ title: "Invalid file type", description: "Please select an Excel file (.xlsx or .xls)", variant: "destructive" });
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportStatus('Reading file...');
    setImportStartTime(Date.now());

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          setIsImporting(false);
          toast({ title: "File read error", description: "Could not read the file.", variant: "destructive" });
          return;
        }

        setImportStatus('Parsing Excel file...');
        setImportProgress(5);

        const workbook = XLSX.read(data, { type: 'binary', cellNF: true, cellText: false });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          setIsImporting(false);
          toast({ title: "Invalid file", description: "The Excel file does not contain any sheets.", variant: "destructive" });
          return;
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          setIsImporting(false);
          toast({ title: "Invalid file", description: "Could not read the worksheet.", variant: "destructive" });
          return;
        }

        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });
        
        if (!json || json.length === 0) {
          setIsImporting(false);
          setImportStartTime(null);
          toast({ title: "Empty file", description: "The Excel file does not contain any data.", variant: "destructive" });
          return;
        }
        
        const totalRows = json.length;
        setImportTotal(totalRows);
        setImportStatus(`Processing ${totalRows} entries...`);
        setImportProgress(10);
        
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

        // Merge project-wide aliases with customer-specific ones
        const FIELD_MAP: Record<string, string[]> = {
          ...FIELD_ALIASES,
          'name': [...(FIELD_ALIASES['name'] || []), 'CLIENT', 'PARTY NAME', 'NAME OF CUSTOMER'],
          'companyName': ['COMPANY', 'COMPANY NAME', 'FIRM', 'FIRM NAME', 'SHOP NAME'],
          'gstin': ['GSTIN', 'GST', 'GST NO', 'GST NUMBER'],
          'cdRate': ['CD RATE', 'CD', 'CD %'],
          'brokerageRate': ['BROKERAGE', 'BROK', 'BROKERAGE RATE'],
          'bags': ['BAGS', 'PACKETS', 'QTY', 'QUANTITY'],
          'bagWeightKg': ['BAG WT', 'BAG WEIGHT', 'BAG WEIGHT KG'],
          'bagRate': ['BAG RATE', 'BARDANA RATE'],
        };

        const findValue = (item: any, fieldKeys: string[]): any => {
          const itemKeys = Object.keys(item);
          for (const key of fieldKeys) {
            // Case-insensitive exact match
            const exactMatch = itemKeys.find(k => k.trim().toUpperCase() === key.toUpperCase());
            if (exactMatch && item[exactMatch] !== undefined && item[exactMatch] !== null && item[exactMatch] !== '') {
              return item[exactMatch];
            }
          }
          // Try partial match if exact didn't work
          for (const key of fieldKeys) {
            const partialMatch = itemKeys.find(k => k.trim().toUpperCase().includes(key.toUpperCase()));
            if (partialMatch && item[partialMatch] !== undefined && item[partialMatch] !== null && item[partialMatch] !== '') {
              return item[partialMatch];
            }
          }
          return undefined;
        };

        const updatedCustomersList = [...safeCustomers];

        for (const item of json) {
          try {
            const processedCount = successCount + updateCount + errorCount;
            setImportCurrent(processedCount + 1);
            setImportStatus(`Importing entry ${processedCount + 1} of ${totalRows}...`);
            
            const nameVal = findValue(item, FIELD_MAP.name);
            if (!nameVal) {
              errorCount++;
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

            // Unit detection (KG vs QTL)
            const getWeight = (v: any) => {
              const n = parseFloat(String(v || 0)) || 0;
              return n > 1000 ? n / 100 : n; // If > 1000, likely KG
            };

            const gw = getWeight(findValue(item, FIELD_MAP.grossWeight));
            const tw = getWeight(findValue(item, FIELD_MAP.teirWeight));
            const nwFromFile = findValue(item, FIELD_MAP.netWeight);
            let weight = gw - tw;
            if (weight <= 0 && nwFromFile) weight = getWeight(nwFromFile);

            const cdVal = parseFloat(String(findValue(item, FIELD_MAP.cdRate) || 0)) || 0;

            const customerData: Customer = {
              id: finalSrNo,
              srNo: finalSrNo,
              date: dateStr,
              term: '0',
              dueDate: dateStr,
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
              cd: cdVal, // Use as percentage rate for calculation
              cdRate: cdVal,
              brokerageRate: parseFloat(String(findValue(item, FIELD_MAP.brokerageRate) || 0)) || 0,
              brokerageAmount: 0,
              bags: parseFloat(String(findValue(item, FIELD_MAP.bags) || 0)) || 0,
              bagWeightKg: parseFloat(String(findValue(item, FIELD_MAP.bagWeightKg) || 0)) || 0,
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
              kartaPercentage: 0,
              kartaWeight: 0,
              kartaAmount: 0,
              labouryRate: 0,
              labouryAmount: 0,
              amount: 0,
              netAmount: 0,
              originalNetAmount: 0,
              kanta: 0,
            };

            const calculated = calculateCustomerEntry(customerData, paymentHistory);
            const finalData = { ...customerData, ...calculated };

            const existingIndex = updatedCustomersList.findIndex(c => c.srNo === finalSrNo);
            if (existingIndex >= 0) {
              const { id, ...updateData } = finalData;
              await updateCustomer(updatedCustomersList[existingIndex].id, updateData);
              updatedCustomersList[existingIndex] = { ...updatedCustomersList[existingIndex], ...updateData };
              updateCount++;
            } else {
              await addCustomer(finalData);
              updatedCustomersList.push(finalData);
              successCount++;
            }

            setImportProgress(10 + Math.floor(((successCount + updateCount + errorCount) / totalRows) * 90));
          } catch (e) {
            console.error('Row process error:', e);
            errorCount++;
          }
        }
        
        setCustomers(updatedCustomersList);
        setImportProgress(100);
        toast({ 
          title: "Import Finished", 
          description: `${successCount} new added, ${updateCount} updated.`,
          variant: errorCount ? "destructive" : "default" 
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
      }
    };
    reader.readAsBinaryString(file);
    if (event.target) event.target.value = '';
  }, [safeCustomers, paymentHistory, toast, setCustomers]);


  return {
    handleImport,
    handleExport,
    isImporting,
    importProgress,
    importStatus,
    importCurrent,
    importTotal,
    importStartTime,
  };
}
