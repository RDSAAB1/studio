"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSupplierData } from "@/hooks/use-supplier-data";
import { useSupplierSummary } from "../supplier-profile/hooks/use-supplier-summary";
import { useSupplierFiltering } from "../supplier-profile/hooks/use-supplier-filtering";
import { usePersistedSelection } from "@/hooks/use-persisted-state";
import { SupplierProfileView } from "../supplier-profile/supplier-profile-view";
import { useSupplierHubContext } from "./context/supplier-hub-context";
import { DetailsDialog } from "@/components/sales/details-dialog";
import { PaymentDetailsDialog } from "@/components/sales/supplier-payments/payment-details-dialog";
import { StatementPreview } from "../supplier-profile/components/statement-preview";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { useSupplierPayments } from "@/hooks/use-supplier-payments";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import SupplierHubEntrySection from "./components/supplier-hub-entry-section";
import SupplierHubPaymentSection from "./components/supplier-hub-payment-section";
import { SupplierHubTopBar, SUPPLIER_HUB_TOP_BAR_HEIGHT } from "./components/supplier-hub-top-bar";
import type { Customer, CustomerSummary, Payment } from "@/lib/definitions";
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { addSupplier, deleteAllSuppliers, deleteAllPayments, deleteMultipleSuppliers, getReceiptSettings } from "@/lib/firestore";
import { formatSrNo, toTitleCase } from "@/lib/utils";
import { ReceiptPrintDialog } from "@/components/sales/print-dialogs";
import { ImportPreviewDialog } from "@/components/sales/import-preview-dialog";
import type { ReceiptSettings } from "@/lib/definitions";
import type { ImportRow } from "@/lib/import-helpers";

const SECTION_TAB_KEYS = ["overview", "entry", "payments"] as const;
type SectionTabKey = (typeof SECTION_TAB_KEYS)[number];

type CommandHandlers = {
  finalize?: () => void;
  clear?: () => void;
  reset?: () => void;
};

export default function SupplierHubClient() {
  const { toast } = useToast();
  const supplierHubContext = useSupplierHubContext();
  const activeSection = supplierHubContext?.activeSection || "overview";
  const setActiveSection = supplierHubContext?.setActiveSection || (() => {});
  const [selectedSupplierKey, setSelectedSupplierKey] = usePersistedSelection(
    "supplier-hub:selected-supplier",
    null as string | null
  );

  const [statementOpen, setStatementOpen] = useState(false);
  const [detailsSupplier, setDetailsSupplier] = useState<Customer | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<Payment | null>(null);
  const [entryCommands, setEntryCommands] = useState<CommandHandlers>({});
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
  const [receiptsToPrint, setReceiptsToPrint] = useState<Customer[]>([]);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<any[]>([]);
  const [importSourceColumns, setImportSourceColumns] = useState<string[]>([]);

  const supplierData = useSupplierData();
  const paymentsHook = useSupplierPayments();
  const { processPayment, resetPaymentForm, selectedEntryIds, isProcessing } = paymentsHook;

  const paymentSelectRef = useRef(paymentsHook.handleCustomerSelect);

  useEffect(() => {
    paymentSelectRef.current = paymentsHook.handleCustomerSelect;
  }, [paymentsHook.handleCustomerSelect]);

  useEffect(() => {
    getReceiptSettings().then(settings => {
      if (settings) setReceiptSettings(settings);
    });
  }, []);

  const {
    suppliers,
    paymentHistory,
    loading,
    expenses,
    bankAccounts,
    customerSummaryMap,
  } = supplierData;

  const { supplierSummaryMap, MILL_OVERVIEW_KEY } = useSupplierSummary(
    suppliers,
    paymentHistory,
    undefined,
    undefined
  );

  const { filteredSupplierOptions } = useSupplierFiltering(
    supplierSummaryMap,
    selectedSupplierKey,
    (key) => {
      if (typeof key === "string" || key === null) {
        setSelectedSupplierKey(key);
      }
    },
    undefined,
    undefined,
    MILL_OVERVIEW_KEY
  );

  useEffect(() => {
    if (selectedSupplierKey) {
      paymentSelectRef.current(selectedSupplierKey);
    }
  }, [selectedSupplierKey]);

  const handleSerialSelect = useCallback(
    (serialNo: string) => {
      // Update parchiNo in payment form when serial is selected
      if (activeSection === "payments") {
        // Find the supplier entry by serial number
        const matchingSupplier = suppliers.find((s) => {
          const sr = (s.srNo || "").toUpperCase();
          return sr === serialNo.toUpperCase();
        });
        
        if (matchingSupplier && matchingSupplier.id && paymentsHook.setSelectedEntryIds) {
          // Select this entry which will auto-fill parchiNo via useEffect in use-supplier-payments
          paymentsHook.setSelectedEntryIds(new Set([matchingSupplier.id]));
        }
      }
    },
    [activeSection, paymentsHook, suppliers]
  );

  const selectedSummary = useMemo(() => {
    if (!selectedSupplierKey) return null;
    return supplierSummaryMap.get(selectedSupplierKey) ?? null;
  }, [selectedSupplierKey, supplierSummaryMap]);

  const handleSupplierSelect = (key: string | null) => {
    setSelectedSupplierKey(key);
    paymentSelectRef.current(key);
    if (key) {
      toast({
        title: "Supplier Selected",
        description: "Modules updated for the selected supplier.",
        duration: 2500,
      });
    } else {
      toast({
        title: "Reset to overview",
        description: "Showing combined mill data.",
        duration: 2000,
      });
    }
  };

  const selectedOption = useMemo(() => {
    if (!selectedSupplierKey) return null;
    return (
      filteredSupplierOptions.find((option) => option.value === selectedSupplierKey) ??
      null
    );
  }, [filteredSupplierOptions, selectedSupplierKey]);

  const paymentCommands = useMemo<CommandHandlers>(() => {
    return {
      finalize: processPayment,
      clear: resetPaymentForm,
      reset: resetPaymentForm,
    };
  }, [processPayment, resetPaymentForm]);

  const activeCommands: CommandHandlers = useMemo(() => {
    switch (activeSection) {
      case "entry":
        return entryCommands;
      case "payments":
        return paymentCommands;
      default:
        return {};
    }
  }, [activeSection, entryCommands, paymentCommands]);

  // Import handler - shows preview dialog
  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: typeof data === 'string' ? 'binary' : 'array', cellNF: true, cellText: false });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });

        if (json.length === 0) {
          toast({ title: "No data found", description: "The file appears to be empty.", variant: "destructive" });
          return;
        }

        // Store in temporary state and show preview
        setImportPreviewData(json);
        setImportSourceColumns(Object.keys(json[0] || {}));
        setImportPreviewOpen(true);
      } catch (error) {
        console.error("Import failed:", error);
        toast({ title: "Import Failed", description: "Please check the file format and content.", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
    // Reset input
    event.target.value = '';
  }, [toast]);

  // Handle import from preview dialog
  const handleImportFromPreview = useCallback(async (rows: ImportRow[]) => {
    try {
      let nextSrNum = suppliers.length > 0 ? Math.max(...suppliers.map(s => {
        const match = s.srNo?.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })) + 1 : 1;

      let imported = 0;
      let failed = 0;

      for (const row of rows) {
        try {
          // Calculate due date if term is available
          let dueDate = row.mappedData.dueDate;
          if (!dueDate && row.mappedData.date && row.mappedData.term) {
            const entryDate = new Date(row.mappedData.date);
            const term = parseInt(String(row.mappedData.term || 20), 10);
            entryDate.setDate(entryDate.getDate() + term);
            dueDate = format(entryDate, 'yyyy-MM-dd');
          }

          const supplierData: Customer = {
            id: row.mappedData.srNo || formatSrNo(nextSrNum++, 'S'),
            srNo: row.mappedData.srNo || formatSrNo(nextSrNum++, 'S'),
            date: row.mappedData.date || format(new Date(), 'yyyy-MM-dd'),
            term: String(row.mappedData.term || 20),
            dueDate: dueDate || format(new Date(), 'yyyy-MM-dd'),
            name: toTitleCase(row.mappedData.name || ''),
            so: toTitleCase(row.mappedData.so || row.mappedData.fatherName || ''),
            fatherName: toTitleCase(row.mappedData.fatherName || row.mappedData.so || ''),
            address: toTitleCase(row.mappedData.address || ''),
            contact: String(row.mappedData.contact || ''),
            vehicleNo: (row.mappedData.vehicleNo || '').toUpperCase(),
            variety: toTitleCase(row.mappedData.variety || ''),
            grossWeight: row.mappedData.grossWeight || 0,
            teirWeight: row.mappedData.teirWeight || 0,
            weight: row.mappedData.weight || (row.mappedData.grossWeight || 0) - (row.mappedData.teirWeight || 0),
            kartaPercentage: row.mappedData.kartaPercentage || 0,
            kartaWeight: row.mappedData.kartaWeight || 0,
            kartaAmount: row.mappedData.kartaAmount || 0,
            netWeight: row.mappedData.netWeight || 0,
            rate: row.mappedData.rate || 0,
            labouryRate: row.mappedData.labouryRate || 0,
            labouryAmount: row.mappedData.labouryAmount || 0,
            brokerage: row.mappedData.brokerage || 0,
            brokerageRate: row.mappedData.brokerageRate || 0,
            brokerageAmount: row.mappedData.brokerageAmount || 0,
            brokerageAddSubtract: row.mappedData.brokerageAddSubtract ?? true,
            kanta: row.mappedData.kanta || 0,
            amount: row.mappedData.amount || 0,
            netAmount: typeof row.mappedData.netAmount === 'number' ? row.mappedData.netAmount : (typeof row.mappedData.originalNetAmount === 'number' ? row.mappedData.originalNetAmount : 0),
            originalNetAmount: typeof row.mappedData.originalNetAmount === 'number' ? row.mappedData.originalNetAmount : (typeof row.mappedData.netAmount === 'number' ? row.mappedData.netAmount : 0),
            paymentType: row.mappedData.paymentType || 'Full',
            customerId: `${toTitleCase(row.mappedData.name || '').toLowerCase()}|${String(row.mappedData.contact || '').toLowerCase()}`,
            barcode: '',
            receiptType: 'Cash',
          };

          await addSupplier(supplierData);
          imported++;
        } catch (error) {
          console.error('Failed to import row:', error);
          failed++;
        }
      }

      if (imported > 0) {
        toast({ 
          title: "Import Successful", 
          description: `${imported} entries imported${failed > 0 ? `, ${failed} failed` : ''}.` 
        });
      } else {
        toast({ 
          title: "Import Failed", 
          description: "No entries could be imported.", 
          variant: "destructive" 
        });
      }
    } catch (error) {
      console.error("Import failed:", error);
      toast({ title: "Import Failed", description: String(error), variant: "destructive" });
    }
  }, [suppliers, toast]);

  // Export handler
  const handleExport = useCallback(() => {
    if (!suppliers || suppliers.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }

    const dataToExport = suppliers.map(s => ({
      'SR NO.': s.srNo,
      'DATE': s.date,
      'TERM': s.term,
      'DUE DATE': s.dueDate,
      'NAME': s.name,
      'S/O': s.so || s.fatherName,
      'ADDRESS': s.address,
      'CONTACT': s.contact,
      'VEHICLE NO': s.vehicleNo,
      'VARIETY': s.variety,
      'GROSS WT': s.grossWeight,
      'TIER WT': s.teirWeight,
      'FINAL WT': s.weight,
      'KARTA %': s.kartaPercentage,
      'KARTA WT': s.kartaWeight,
      'NET WT': s.netWeight,
      'RATE': s.rate,
      'LABOURY RATE': s.labouryRate,
      'LABOURY AMT': s.labouryAmount,
      'KANTA': s.kanta,
      'AMOUNT': s.amount,
      'NET AMOUNT': s.netAmount || s.originalNetAmount,
      'PAYMENT TYPE': s.paymentType,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    
    // Set column widths for proper display
    worksheet['!cols'] = [
      { wch: 10 },  // SR NO.
      { wch: 12 },  // DATE
      { wch: 6 },   // TERM
      { wch: 12 },  // DUE DATE
      { wch: 25 },  // NAME
      { wch: 20 },  // S/O
      { wch: 35 },  // ADDRESS
      { wch: 12 },  // CONTACT
      { wch: 12 },  // VEHICLE NO
      { wch: 15 },  // VARIETY
      { wch: 10 },  // GROSS WT
      { wch: 10 },  // TIER WT
      { wch: 10 },  // FINAL WT
      { wch: 10 },  // KARTA %
      { wch: 10 },  // KARTA WT
      { wch: 10 },  // NET WT
      { wch: 10 },  // RATE
      { wch: 12 },  // LABOURY RATE
      { wch: 12 },  // LABOURY AMT
      { wch: 10 },  // KANTA
      { wch: 12 },  // AMOUNT
      { wch: 12 },  // NET AMOUNT
      { wch: 12 },  // PAYMENT TYPE
    ];
    
    // Style header row (row 1) - make it bold with background color
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const headerRowIndex = 0; // First row is header
    
    // Get all column headers
    const headers = Object.keys(dataToExport[0] || {});
    
    headers.forEach((header, colIndex) => {
      const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: colIndex });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { t: 's', v: header };
      }
      
      // Apply styling to header cell
      if (!worksheet[cellAddress].s) {
        worksheet[cellAddress].s = {};
      }
      
      // Bold font
      worksheet[cellAddress].s.font = { bold: true };
      
      // Background color (light gray)
      worksheet[cellAddress].s.fill = {
        fgColor: { rgb: "E5E5E5" }
      };
      
      // Center alignment
      worksheet[cellAddress].s.alignment = {
        horizontal: "center",
        vertical: "center"
      };
      
      // Border
      worksheet[cellAddress].s.border = {
        top: { style: "thin", color: { auto: 1 } },
        bottom: { style: "thin", color: { auto: 1 } },
        left: { style: "thin", color: { auto: 1 } },
        right: { style: "thin", color: { auto: 1 } }
      };
    });
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Suppliers");
    XLSX.writeFile(workbook, `SupplierEntries-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: "Exported", description: `${dataToExport.length} entries exported successfully.` });
  }, [suppliers, toast]);

  // Delete handler
  const handleDelete = useCallback(async () => {
    if (!suppliers || suppliers.length === 0) {
      toast({ title: "No data to delete", variant: "destructive" });
      return;
    }

    if (!confirm(`Are you sure you want to delete all ${suppliers.length} supplier entries? This action cannot be undone.`)) {
      return;
    }

    try {
      const supplierIds = suppliers.map(s => s.id).filter(Boolean);
      if (supplierIds.length > 0) {
        await deleteMultipleSuppliers(supplierIds);
      }
      await deleteAllPayments();
      toast({ title: "Deleted", description: "All supplier entries have been deleted.", variant: "success" });
    } catch (error) {
      console.error("Delete failed:", error);
      toast({ title: "Delete Failed", description: "Could not delete entries.", variant: "destructive" });
    }
  }, [suppliers, toast]);

  // Print handler
  const handlePrint = useCallback(() => {
    switch (activeSection) {
      case "overview":
        if (selectedSummary) {
          setStatementOpen(true);
        } else {
          toast({ title: "No data to print", description: "Please select a supplier first.", variant: "destructive" });
        }
        break;
      case "entry":
        // Show single parchi receipt preview for selected supplier's most recent entry
        if (suppliers.length === 0) {
          toast({ title: "No data to print", description: "No supplier entries found.", variant: "destructive" });
          break;
        }

        let entryToPrint: Customer | null = null;

        if (selectedSupplierKey && selectedOption) {
          // Find all entries for the selected supplier
          const supplierEntries = suppliers.filter(s => {
            const key = `${s.name}_${s.so || s.fatherName}_${s.address}`.trim();
            return key === selectedSupplierKey;
          });

          if (supplierEntries.length > 0) {
            // Get the most recent entry for this supplier
            entryToPrint = supplierEntries.sort((a, b) => {
              const dateA = new Date(a.date || 0).getTime();
              const dateB = new Date(b.date || 0).getTime();
              return dateB - dateA;
            })[0];
          }
        }

        // If no supplier selected or no entries found, use most recent entry overall
        if (!entryToPrint) {
          entryToPrint = suppliers.sort((a, b) => {
            const dateA = new Date(a.date || 0).getTime();
            const dateB = new Date(b.date || 0).getTime();
            return dateB - dateA;
          })[0];
        }

        if (entryToPrint) {
          setReceiptsToPrint([entryToPrint]);
        } else {
          toast({ title: "No data to print", description: "No supplier entries found.", variant: "destructive" });
        }
        break;
      case "payments":
        toast({ title: "Print", description: "Print functionality for payments section will be implemented." });
        break;
      default:
        break;
    }
  }, [activeSection, selectedSummary, selectedSupplierKey, selectedOption, suppliers, toast]);

  // Section-specific handlers
  const sectionHandlers = useMemo(() => {
    switch (activeSection) {
      case "entry":
        return {
          onImport: handleImport,
          onExport: handleExport,
          onDelete: handleDelete,
          onPrint: handlePrint,
        };
      case "overview":
        return {
          onImport: undefined,
          onExport: handleExport,
          onDelete: handleDelete,
          onPrint: handlePrint,
        };
      case "payments":
        return {
          onImport: undefined,
          onExport: undefined,
          onDelete: undefined,
          onPrint: handlePrint,
        };
      default:
        return {
          onImport: undefined,
          onExport: undefined,
          onDelete: undefined,
          onPrint: undefined,
        };
    }
  }, [activeSection, handleImport, handleExport, handleDelete, handlePrint]);

  const sectionContent = useMemo(() => {
    if (!supplierData.isClient || loading) return null;
    switch (activeSection) {
      case "entry":
        return (
          <SupplierHubEntrySection
            suppliers={suppliers}
            selectedSupplierKey={selectedSupplierKey}
            selectedSummary={selectedSummary}
            millOverviewKey={MILL_OVERVIEW_KEY}
            onRegisterCommands={setEntryCommands}
          />
        );
      case "payments":
        return (
          <SupplierHubPaymentSection
            hook={paymentsHook}
            selectedSupplierSummary={selectedSummary}
            selectedSupplierKey={selectedSupplierKey}
            onSupplierKeyChange={handleSupplierSelect}
          />
        );
      default:
        return (
          <SupplierProfileView
            selectedSupplierData={selectedSummary as CustomerSummary | null}
            isMillSelected={selectedSupplierKey === MILL_OVERVIEW_KEY}
            onShowDetails={(supplier) => setDetailsSupplier(supplier)}
            onShowPaymentDetails={(payment) =>
              setPaymentDetails(payment as Payment)
            }
            onGenerateStatement={() => setStatementOpen(true)}
          />
        );
    }
  }, [activeSection, loading, supplierData.isClient, paymentsHook, selectedSummary, selectedSupplierKey, suppliers]);

  if (!supplierData.isClient || loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-3 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <span>Loading supplier workspace…</span>
      </div>
    );
  }

  return (
    <div
      className="space-y-3 w-full"
      style={{ paddingTop: SUPPLIER_HUB_TOP_BAR_HEIGHT }}
    >
      <SupplierHubTopBar
        options={filteredSupplierOptions}
        selectedKey={selectedSupplierKey}
        onSelect={handleSupplierSelect}
        millOverviewKey={MILL_OVERVIEW_KEY}
        suppliers={suppliers}
        onFinalize={activeCommands.finalize}
        onClear={activeCommands.clear}
        onResetCommands={
          activeCommands.reset
            ? () => activeCommands.reset?.()
            : undefined
        }
        paymentActiveTab={paymentsHook.activeTab}
        onPaymentTabChange={paymentsHook.setActiveTab}
        selectedEntryIds={activeSection === "payments" ? selectedEntryIds : undefined}
        isProcessing={activeSection === "payments" ? isProcessing : false}
        activeSection={activeSection}
        onImport={sectionHandlers.onImport}
        onExport={sectionHandlers.onExport}
        onDelete={sectionHandlers.onDelete}
        onPrint={sectionHandlers.onPrint}
        onSerialSelect={handleSerialSelect}
      />

      {sectionContent}

      <DetailsDialog
        isOpen={!!detailsSupplier}
        onOpenChange={(open) => {
          if (!open) setDetailsSupplier(null);
        }}
        customer={detailsSupplier}
        paymentHistory={paymentHistory}
        entryType="Supplier"
      />

      <PaymentDetailsDialog
        payment={paymentDetails}
        suppliers={suppliers}
        onOpenChange={() => setPaymentDetails(null)}
        onShowEntryDetails={setDetailsSupplier}
      />

      <Dialog open={statementOpen} onOpenChange={setStatementOpen}>
        <DialogContent className="max-w-5xl p-0 printable-statement-container">
          <DialogHeader className="sr-only">
            <DialogTitle>Statement Preview</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[90vh] printable-statement-scroll-area">
            {selectedSummary ? (
              <StatementPreview data={selectedSummary as CustomerSummary | null} />
            ) : (
              <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <ReceiptPrintDialog
        receipts={receiptsToPrint}
        settings={receiptSettings}
        onOpenChange={(open) => {
          if (!open) setReceiptsToPrint([]);
        }}
        isCustomer={false}
      />

      <ImportPreviewDialog
        isOpen={importPreviewOpen}
        onOpenChange={setImportPreviewOpen}
        rawData={importPreviewData}
        sourceColumns={importSourceColumns}
        onImport={handleImportFromPreview}
      />
    </div>
  );
}
