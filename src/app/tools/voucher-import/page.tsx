"use client";

import React from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { printHtmlContent } from "@/lib/electron-print";

import { MandiHeaderEditor } from "./components/mandi-header-editor";
import { ParsingSection } from "./components/parsing-section";
import { EntriesTable } from "./components/entries-table";
import { EntryEditor } from "./components/entry-editor";

import { useVoucherImport } from "./hooks/use-voucher-import";
import { useMandiSettings } from "./hooks/use-mandi-settings";
import { generatePrintHtml } from "./utils/print-utils";

export default function VoucherImportTool() {
  const { toast } = useToast();
  const settings = useMandiSettings();
  const importState = useVoucherImport();

  const handlePrint = async (isPreview: boolean) => {
    const html = generatePrintHtml(
      importState.filteredEntries,
      settings.headerSettings,
      isPreview
    );
    if (!importState.filteredEntries.length) {
      toast({
        title: "No data",
        description: "Please parse or add entries before printing.",
        variant: "destructive",
      });
      return;
    }
    await printHtmlContent(html);
  };

  const handleExportExcel = () => {
    if (!importState.excelRows.length) {
      toast({
        title: "Nothing to export",
        description: "Parse some data before exporting to Excel.",
        variant: "destructive",
      });
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(importState.excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mandi Report");
    const filename = `Mandi_Report_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast({
      title: "Excel exported",
      description: `${filename} saved successfully.`,
      variant: "success",
    });
  };

  return (
    <div className="flex flex-col h-full bg-background p-4 md:p-6 space-y-8 overflow-y-auto custom-scrollbar">
      {/* Header Settings Section */}
      <section className="animate-in fade-in slide-in-from-top-4 duration-500">
        <MandiHeaderEditor
          settings={settings.headerSettings}
          onInputChange={settings.handleHeaderInputChange}
          onSave={settings.handleSaveHeaderSettings}
          isSaving={settings.isHeaderSaving}
        />
      </section>

      {/* Main Parsing Workspace */}
      <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <ParsingSection
          voucherInput={importState.voucherInput}
          setVoucherInput={importState.setVoucherInput}
          paymentInput={importState.paymentInput}
          setPaymentInput={importState.setPaymentInput}
          onPaste={importState.handlePaste}
          onParse={importState.handleParse}
          onClear={() => {
            importState.setVoucherInput("");
            importState.setPaymentInput("");
            importState.setErrors([]);
          }}
          errors={importState.errors}
          isExtensionInstalled={importState.isExtensionInstalled}
          triggerExtensionSync={importState.triggerExtensionSync}
        />
      </section>

      {/* Results & Management Table */}
      <section className="animate-in fade-in duration-1000">
        <EntriesTable
          entries={importState.entries}
          filteredEntries={importState.filteredEntries}
          activeId={importState.activeId}
          onSelect={importState.handleSelectEntry}
          onDelete={importState.handleDeleteEntry}
          onBulkDelete={importState.handleBulkDeleteEntry}
          onPreview={() => handlePrint(true)}
          onPrint={() => handlePrint(false)}
          onExport={handleExportExcel}
          filterFrom={importState.filterFrom}
          setFilterFrom={importState.setFilterFrom}
          filterTo={importState.filterTo}
          setFilterTo={importState.setFilterTo}
        />
      </section>

      {/* Modal/Overlay Editor for entries */}
      {importState.activeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <EntryEditor
              entry={importState.formState}
              onFieldChange={importState.handleFieldChange}
              onSave={importState.handleSaveEdit}
              onCancel={importState.resetForm}
              isSaving={importState.isSaving}
            />
          </div>
        </div>
      )}
      {/* Import Progress Overlay */}
      {importState.importProgress?.active && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border/60 rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 flex flex-col items-center gap-5">
            {/* Spinner */}
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-black text-primary">
                  {importState.importProgress.total > 0
                    ? Math.round((importState.importProgress.done / importState.importProgress.total) * 100)
                    : 0}%
                </span>
              </div>
            </div>
            {/* Title */}
            <div className="text-center space-y-1">
              <p className="text-sm font-black tracking-tight">Importing Records...</p>
              <p className="text-xs text-muted-foreground">
                {importState.importProgress.done} / {importState.importProgress.total} records saved
              </p>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                style={{
                  width: importState.importProgress.total > 0
                    ? `${(importState.importProgress.done / importState.importProgress.total) * 100}%`
                    : '0%'
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground/70 font-medium">
              सभी devices पर automatically sync हो जाएगा
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
