import { useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import type { Customer } from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";
import { addSupplier } from "@/lib/firestore";
import { processSupplierImportRow } from "@/lib/supplier-import-processor";

interface UseSupplierImportExportProps {
  allSuppliers: Customer[] | undefined;
}

export function useSupplierImportExport({ allSuppliers }: UseSupplierImportExportProps) {
  const { toast } = useToast();
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const handleExport = useCallback(() => {
    const rows = (allSuppliers || []).map((s) => ({
      'RST': s.srNo,
      'DATE': s.date,
      'CUSTOMER': s.name,
      'FATHER NAME': s.so || s.fatherName || '', // Support both for safety
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

  const handleImportChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result as ArrayBuffer | string;
          const workbook = XLSX.read(data, { 
              type: typeof data === 'string' ? 'binary' : 'array', 
              cellNF: true, 
              cellText: false 
          });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          // Use {raw: true} to avoid date mangling if possible, but processor handles strings
          const json: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });

          let nextSrNum = (allSuppliers || []).length > 0
            ? Math.max(...(allSuppliers || []).map(c => {
                const num = parseInt((c.srNo || 'S0000').replace(/[^0-9]/g, ''));
                return isNaN(num) ? 0 : num;
              })) + 1
            : 1;

          let imported = 0;
          for (const item of json) {
            // Robust check: skip row if it doesn't have at least one of these critical fields (Name or Gross/Net weight)
            // We search for ANY key that contains 'CUSTOMER', 'NAME', 'GROSS', 'NET' or 'SR'
            const hasData = Object.keys(item).some(key => {
                const k = key.toUpperCase().trim();
                return (k.includes('CUSTOMER') || k.includes('NAME') || k.includes('GROSS') || k.includes('NET') || k.includes('RST') || k.includes('VEHICLE')) && item[key];
            });

            if (!hasData) continue;

            const supplierData = processSupplierImportRow(item, nextSrNum++);
            await addSupplier(supplierData);
            imported++;
          }

          toast({ 
              title: 'Success', 
              description: `${imported} entries imported. Name, S/O, Address, Contact, and Calculations have been updated.` 
          });
        } catch (err) {
          console.error('[Import Error]', err);
          toast({ 
              variant: 'destructive', 
              title: 'Import failed', 
              description: 'Error processing data. Please ensure column headers match.' 
          });
        } finally {
          event.target.value = '';
        }
      };

      reader.readAsBinaryString(file);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Import failed', description: 'Could not read file' });
    }
  }, [allSuppliers, toast]);

  return {
    handleExport,
    handleImportClick,
    handleImportChange,
    importInputRef,
  };
}



