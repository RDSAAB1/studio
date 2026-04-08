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
    </div>
  );
}
