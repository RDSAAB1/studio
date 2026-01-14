import { useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type { Customer } from "@/lib/definitions";
import { formatSrNo, toTitleCase } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { addSupplier } from "@/lib/firestore";

interface UseSupplierImportExportProps {
  allSuppliers: Customer[] | undefined;
}

export function useSupplierImportExport({ allSuppliers }: UseSupplierImportExportProps) {
  const { toast } = useToast();
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const handleExport = useCallback(() => {
    const rows = (allSuppliers || []).map((s) => ({
      'SR NO.': s.srNo,
      'DATE': s.date,
      'NAME': s.name,
      'FATHER NAME': s.fatherName,
      'ADDRESS': s.address,
      'CONTACT': s.contact,
      'VEHICLE NO': s.vehicleNo,
      'VARIETY': s.variety,
      'GROSS WT': s.grossWeight,
      'TIER WT': s.teirWeight,
      'NET WT': s.netWeight,
      'RATE': s.rate,
      'KARTA %': s.kartaPercentage,
      'LAB RATE': s.labouryRate,
      'BROKERAGE': s.brokerage,
      'BROKERAGE RATE': s.brokerageRate,
      'BROKERAGE ADD/SUB': s.brokerageAddSubtract ? 'ADD' : 'SUB',
      'KANTA': s.kanta,
      'AMOUNT': s.amount,
      'KARTA AMT': s.kartaAmount,
      'LAB AMT': s.labouryAmount,
      'NET AMT': s.netAmount,
      'TERM': s.term,
      'DUE DATE': s.dueDate,
      'SO': s.so,
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
          const workbook = XLSX.read(data, { type: typeof data === 'string' ? 'binary' : 'array', cellNF: true, cellText: false });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });

          let nextSrNum = (allSuppliers || []).length > 0
            ? Math.max(...(allSuppliers || []).map(c => parseInt((c.srNo || 'S0000').substring(1)) || 0)) + 1
            : 1;

          let imported = 0;
          for (const item of json) {
            const supplierData: Customer = {
              id: item['ID'] || crypto.randomUUID(),
              srNo: item['SR NO.'] || formatSrNo(nextSrNum++, 'S'),
              date: item['DATE'] || format(new Date(), 'yyyy-MM-dd'),
              name: toTitleCase(item['NAME'] || ''),
              fatherName: toTitleCase(item['FATHER NAME'] || ''),
              address: toTitleCase(item['ADDRESS'] || ''),
              contact: String(item['CONTACT'] || ''),
              vehicleNo: String(item['VEHICLE NO'] || '').toUpperCase(),
              variety: toTitleCase(item['VARIETY'] || ''),
              grossWeight: Number(item['GROSS WT']) || 0,
              teirWeight: Number(item['TIER WT']) || 0,
              netWeight: Number(item['NET WT']) || 0,
              rate: Number(item['rate'] ?? item['RATE']) || 0,
              kartaPercentage: Number(item['KARTA %']) || 0,
              labouryRate: Number(item['LAB RATE']) || 0,
              brokerage: Number(item['BROKERAGE']) || 0,
              brokerageRate: Number(item['BROKERAGE RATE']) || 0,
              brokerageAddSubtract: String(item['BROKERAGE ADD/SUB'] || 'ADD').toUpperCase() === 'ADD',
              kanta: Number(item['KANTA']) || 0,
              amount: Number(item['AMOUNT']) || 0,
              kartaAmount: Number(item['KARTA AMT']) || 0,
              labouryAmount: Number(item['LAB AMT']) || 0,
              netAmount: Number(item['NET AMT']) || 0,
              term: String(item['TERM'] || ''),
              dueDate: String(item['DUE DATE'] || ''),
              so: String(item['SO'] || ''),
              forceUnique: Boolean(item['FORCE UNIQUE'] || false),
              paymentType: String(item['PAYMENT TYPE'] || ''),
            } as Customer;

            await addSupplier(supplierData);
            imported++;
          }

          toast({ title: 'Imported', description: `${imported} rows imported` });
        } catch (err) {
          toast({ variant: 'destructive', title: 'Import failed', description: 'Invalid file format' });
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



