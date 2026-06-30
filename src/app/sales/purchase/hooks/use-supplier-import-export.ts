import { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import type { Customer } from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";
import { addStagedSupplier } from "@/lib/firestore";
import { processSupplierImportRow, safeNumeric, getFlexValue } from "@/lib/supplier-import-processor";
import { findFuzzyClusters, findVarietyClusters, type FuzzyCluster } from "@/lib/string-similarity";
import { db } from "@/lib/database";
import { formatSrNo } from "@/lib/utils";

interface UseSupplierImportExportProps {
  allSuppliers: Customer[] | undefined;
}

export function useSupplierImportExport({ allSuppliers }: UseSupplierImportExportProps) {
  const { toast } = useToast();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const cancelRef = useRef<boolean>(false);
  
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

  const handleExport = useCallback(() => {
    const rows = (allSuppliers || []).map((s) => ({
      'RST': s.srNo,
      'DATE': s.date,
      'CUSTOMER': s.name,
      'FATHER NAME': s.so || s.fatherName || '', 
      'ADDRESS': s.address,
      'MOBILE NO.': s.contact,
      'VEHICLE NO': s.vehicleNo,
      'MATERIAL': s.variety,
      'GROSS': s.grossWeight,
      'TIER': s.teirWeight,
      'NET WT': s.weight,
      'KARDA %': s.kartaPercentage,
      'KARDA WT': s.kartaWeight,
      'RATE': s.rate,
      'TOTAL AMT': s.amount,
      'KARDA AMT': s.kartaAmount,
      'LABOURY': s.labouryAmount,
      'KANTA': s.kanta,
      'FAINAL AMT': s.netAmount,
      'TERM': s.term,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Suppliers');
    XLSX.writeFile(workbook, 'suppliers-export.xlsx');
    toast({ title: 'Exported', description: `${rows.length} rows exported` });
  }, [allSuppliers, toast]);

  const handleImportClick = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleCancelImport = useCallback(() => {
    cancelRef.current = true;
    setImportStatus('Stopping import...');
  }, []);

  const executeStagedImport = useCallback(async (json: any[]) => {
    try {
      cancelRef.current = false;
      setIsImporting(true);
      setImportProgress(10);
      setImportStatus(`Processing ${json.length} entries...`);
      setImportStartTime(Date.now());

      const totalRows = json.length;
      setImportTotal(totalRows);

      let nextSrNum = (allSuppliers || []).length > 0
        ? Math.max(...(allSuppliers || []).map(c => {
            const num = parseInt((c.srNo || 'S0000').replace(/[^0-9]/g, ''));
            return isNaN(num) ? 0 : num;
          })) + 1
        : 1;

      let imported = 0;
      const suppliersToInsert: Customer[] = [];
      const mainSuppliers = await db.suppliers.toArray();
      const existingSrNos = new Set(mainSuppliers.map(s => s.srNo?.trim().toUpperCase()).filter(Boolean));

      for (const item of json) {
        if (cancelRef.current) {
          setIsImporting(false);
          setImportProgress(0);
          setImportStatus('');
          toast({ title: 'Import Cancelled', description: 'Staged import was stopped by user.', variant: 'destructive' });
          return;
        }

        const hasData = Object.keys(item).some(key => {
            const k = key.toUpperCase().trim();
            return (k.includes('CUSTOMER') || k.includes('NAME') || k.includes('GROSS') || k.includes('NET') || k.includes('RST') || k.includes('VEHICLE')) && item[key];
        });

        if (!hasData) {
          imported++;
          continue;
        }

        const fatherNameVal = String(
            getFlexValue(item, 'FATHER') || 
            getFlexValue(item, 'FATHER NAMME') || 
            getFlexValue(item, 'FATHER NAME') || 
            getFlexValue(item, 'SO') || 
            getFlexValue(item, 'SON OF') || 
            ''
        ).trim();

        if (!fatherNameVal) {
          imported++;
          continue;
        }

        const rawSrNo = String(
            getFlexValue(item, 'RST') || 
            getFlexValue(item, 'SERIAL') || 
            getFlexValue(item, 'S.NO') || 
            getFlexValue(item, 'SR NO') || 
            getFlexValue(item, 'SR.NO') || 
            getFlexValue(item, 'SR. NO.') || 
            getFlexValue(item, 'SR NO.') || 
            getFlexValue(item, 'S.NO.') || 
            getFlexValue(item, 'SR_NO') || 
            ''
        ).trim();
        const numericSrNo = safeNumeric(rawSrNo);
        if (numericSrNo > 0) {
            const formattedSrNo = formatSrNo(numericSrNo, 'S').trim().toUpperCase();
            if (existingSrNos.has(formattedSrNo)) {
                imported++;
                continue;
            }
        }

        const supplierData = processSupplierImportRow(item, nextSrNum++);
        suppliersToInsert.push(supplierData);
        imported++;
        
        if (imported % 50 === 0 || imported === totalRows) {
          setImportStatus(`Processing entry ${imported} of ${totalRows}...`);
          setImportProgress(10 + Math.floor((imported / totalRows) * 80));
          setImportCurrent(imported);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      setImportStatus('Saving data to staging database...');
      setImportProgress(95);
      await db.stagedSuppliers.bulkPut(suppliersToInsert);

      setImportProgress(100);
      toast({ 
          title: 'Success', 
          description: `${suppliersToInsert.length} entries imported to staging.` 
      });

      setTimeout(() => {
        setIsImporting(false);
        setImportProgress(0);
        setImportStatus('');
      }, 1000);
    } catch (err) {
      console.error('[executeStagedImport Error]', err);
      toast({ title: 'Import failed', description: 'Could not complete the staging database write.', variant: 'destructive' });
      setIsImporting(false);
    }
  }, [allSuppliers, toast]);

  const runFuzzySpellingCheck = useCallback(async (json: any[]) => {
    try {
      const importedAddresses: string[] = [];
      const importedVarieties: string[] = [];

      const importableRows = json.filter(item => {
        const fatherNameVal = String(
            getFlexValue(item, 'FATHER') || 
            getFlexValue(item, 'FATHER NAMME') || 
            getFlexValue(item, 'FATHER NAME') || 
            getFlexValue(item, 'SO') || 
            getFlexValue(item, 'SON OF') || 
            ''
        ).trim();
        return !!fatherNameVal;
      });

      importableRows.forEach(item => {
        const keys = Object.keys(item);
        
        const addressKey = keys.find(k => {
          const norm = k.toUpperCase().trim();
          return norm === 'ADDRESS' || norm.includes('ADDRESS') || norm === 'CITY' || norm.includes('CITY');
        });
        if (addressKey && item[addressKey]) {
          importedAddresses.push(String(item[addressKey]).trim());
        }

        const varietyKey = keys.find(k => {
          const norm = k.toUpperCase().trim();
          return norm === 'MATERIAL' || norm.includes('MATERIAL') || norm === 'VARIETY' || norm.includes('VARIETY') || norm === 'ITEM' || norm.includes('ITEM') || norm === 'COMMODITY' || norm.includes('COMMODITY');
        });
        if (varietyKey && item[varietyKey]) {
          importedVarieties.push(String(item[varietyKey]).trim());
        }
      });

      const dbSuppliers = await db.suppliers.toArray();
      const existingAddresses = dbSuppliers.map(s => s.address).filter(Boolean);
      const existingVarieties = dbSuppliers.map(s => s.variety).filter(Boolean);

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
        executeStagedImport(json);
      }
    } catch (e) {
      console.error('[Import Fuzzy Check error]', e);
      executeStagedImport(json);
    }
  }, [executeStagedImport]);

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
      const cleanedLabourVal = rawLabour.replace(/[^0-9.]/g, '');
      const hasLaboury = rawLabour === 'YES' || rawLabour === 'Y' || (cleanedLabourVal !== '' && !isNaN(Number(cleanedLabourVal)) && Number(cleanedLabourVal) > 0);

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

  const handleResolveFuzzy = useCallback((resolutions: Record<string, string>) => {
    setShowFuzzyDialog(false);
    if (!pendingImportData) return;

    const isAddressType = fuzzyClusters.length > 0 && fuzzyClusters[0].field === 'address';

    const cleanedJson = pendingImportData.map(item => {
      const newItem = { ...item };
      const keys = Object.keys(newItem);
      
      if (isAddressType) {
        const addressKey = keys.find(k => {
          const norm = k.toUpperCase().trim();
          return norm === 'ADDRESS' || norm.includes('ADDRESS') || norm === 'CITY' || norm.includes('CITY');
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
          return norm === 'MATERIAL' || norm.includes('MATERIAL') || norm === 'VARIETY' || norm.includes('VARIETY') || norm === 'ITEM' || norm.includes('ITEM') || norm === 'COMMODITY' || norm.includes('COMMODITY');
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
      executeStagedImport(cleanedJson);
    }
  }, [pendingImportData, fuzzyClusters, pendingVarietyClusters, executeStagedImport]);

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
      executeStagedImport(dataToImport);
    }
  }, [pendingImportData, fuzzyClusters, pendingVarietyClusters, executeStagedImport]);

  const handleImportChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImportStatus('Reading file...');
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result as ArrayBuffer | string;
          
          setImportStatus('Parsing Excel file...');

          const workbook = XLSX.read(data, { 
              type: typeof data === 'string' ? 'binary' : 'array', 
              cellNF: true, 
              cellText: false 
          });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });

          if (!json || json.length === 0) {
            toast({ title: "Empty file", description: "The Excel file does not contain any data.", variant: "destructive" });
            return;
          }

          setPendingImportData(json);
          setShowConfigDialog(true);
        } catch (err) {
          console.error('[Import parsing error]', err);
          toast({ 
              variant: 'destructive', 
              title: 'Import failed', 
              description: 'Error processing data.' 
          });
          if (importInputRef.current) importInputRef.current.value = '';
        }
      };

      reader.readAsBinaryString(file);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Import failed', description: 'Could not read file' });
      if (importInputRef.current) importInputRef.current.value = '';
    }
  }, [toast]);

  return {
    handleExport,
    handleImportClick,
    handleImportChange,
    handleCancelImport,
    importInputRef,
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
    showConfigDialog,
    handleConfirmConfig,
    handleCancelConfig,
    pendingImportData,
  };
}
