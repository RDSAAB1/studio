"use client";

import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FolderOpen, DatabaseZap, UploadCloud, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const SQLITE_ALLOWED_TABLES = [
  'suppliers', 'customers', 'payments', 'customerPayments', 'governmentFinalizedPayments',
  'ledgerAccounts', 'ledgerEntries', 'ledgerCashAccounts', 'incomes', 'expenses', 'transactions',
  'banks', 'bankBranches', 'bankAccounts', 'supplierBankAccounts', 'loans', 'fundTransactions',
  'mandiReports',
  'inventoryItems', 'inventoryAddEntries', 'kantaParchi', 'customerDocuments',
  'options', 'settings', 'incomeCategories', 'expenseCategories', 'accounts',
  'manufacturingCosting', 'expenseTemplates',
].sort();

export function CollectionMigrationCard() {
  const { toast } = useToast();
  
  // States for Collection-wise Import
  const [importCollection, setImportCollection] = useState<string>("");
  const [importFilePath, setImportFilePath] = useState<string>("");
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [isImportingCollection, setIsImportingCollection] = useState(false);

  const handleSelectImportFile = async () => {
    const electron = (window as any).electron;
    if (!electron?.sqliteSelectFile) {
        toast({ title: "System Error", description: "File selection is not available.", variant: "destructive" });
        return;
    }
    const filePath = await electron.sqliteSelectFile();
    if (filePath) setImportFilePath(filePath);
  };

  const handleExecuteCollectionImport = async () => {
    if (!importCollection || !importFilePath) {
      toast({ title: "Select table and file", description: "Pehle table aur source file select karein.", variant: "destructive" });
      return;
    }

    const electron = (window as any).electron;
    setIsImportingCollection(true);
    try {
      // 1. Read external data
      const readRes = await electron.sqliteReadExternalTable(importFilePath, importCollection);
      if (!readRes.success) {
        toast({ title: "Read failed", description: readRes.error, variant: "destructive" });
        return;
      }

      const rows = readRes.data || [];
      if (rows.length === 0) {
        toast({ title: "No data", description: "Source table khali hai ya data valid nahi hai.", variant: "default" });
        return;
      }

      // 2. Import to local (Merge vs Replace)
      const importRes = await electron.sqliteImportTable(importCollection, rows, { clear: importMode === "replace" });
      if (importRes.success) {
        toast({ 
          title: "Import Successful", 
          description: `${importRes.count} records ${importMode === "replace" ? "replaced" : "merged"} successfully.`, 
          variant: "success" 
        });
        // Refresh page after a delay to show new data
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast({ title: "Import failed", description: importRes.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setIsImportingCollection(false);
    }
  };

  return (
    <Card className="border-slate-200 shadow-xl overflow-hidden">
      <CardHeader className="bg-slate-50/80 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
            <DatabaseZap className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-black uppercase tracking-tight">Collection Sync & Merger</CardTitle>
            <CardDescription className="text-xs font-bold text-slate-500">Selective table migration from external SQLite databases</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">1. Target Collection</Label>
            <CustomDropdown 
              options={SQLITE_ALLOWED_TABLES.map(t => ({ value: t, label: t.toUpperCase() }))}
              value={importCollection}
              onChange={(val) => setImportCollection(val || "")}
              placeholder="CHOOSE TABLE..."
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">2. Source File (.sqlite)</Label>
            <div className="flex gap-2">
              <Input 
                value={importFilePath} 
                readOnly 
                placeholder="No file selected..." 
                className="text-[11px] font-bold bg-slate-50/50 truncate border-slate-200"
              />
              <Button variant="outline" size="sm" onClick={handleSelectImportFile} className="border-slate-300 hover:bg-slate-100">
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">3. Operation Mode</Label>
          <RadioGroup 
            value={importMode} 
            onValueChange={(val) => setImportMode(val as "merge" | "replace")}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div 
              className={cn(
                "flex items-start space-x-3 p-3 rounded-xl border transition-all cursor-pointer",
                importMode === "merge" ? "bg-primary/5 border-primary shadow-sm" : "bg-white border-slate-200 hover:border-slate-300"
              )}
              onClick={() => setImportMode("merge")}
            >
              <RadioGroupItem value="merge" id="mode-merge" className="mt-1" />
              <Label htmlFor="mode-merge" className="cursor-pointer space-y-1">
                <span className="text-xs font-black uppercase tracking-tight text-slate-800">Merge (Upsert)</span>
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed">Adds new records and updates existing ones with matching IDs. Safest mode for synchronization.</p>
              </Label>
            </div>
            <div 
              className={cn(
                "flex items-start space-x-3 p-3 rounded-xl border transition-all cursor-pointer",
                importMode === "replace" ? "bg-destructive/5 border-destructive shadow-sm" : "bg-white border-slate-200 hover:border-slate-300"
              )}
              onClick={() => setImportMode("replace")}
            >
              <RadioGroupItem value="replace" id="mode-replace" className="mt-1" />
              <Label htmlFor="mode-replace" className="cursor-pointer space-y-1">
                <span className="text-xs font-black uppercase tracking-tight text-destructive">Replace (Danger)</span>
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed">Clears all locally stored records in this table before importing from source. Permanent action.</p>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {importMode === "replace" && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 animate-in fade-in slide-in-from-top-2 duration-300">
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <div className="space-y-1">
               <p className="text-xs font-black uppercase tracking-tight">Destructive Action Warning</p>
               <p className="text-[10px] font-bold leading-relaxed opacity-80">
                  You are about to wipe the selected local table. This cannot be undone. 
                  Ensure you have a recent backup of your state before executing.
               </p>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button 
            onClick={handleExecuteCollectionImport}
            disabled={isImportingCollection || !importCollection || !importFilePath}
            className={cn(
              "h-12 px-8 rounded-xl font-black uppercase tracking-widest text-[11px] shadow-lg transition-all active:scale-95",
              importMode === "replace" ? "bg-destructive hover:bg-destructive/90 shadow-destructive/20" : "bg-primary hover:bg-primary/90 shadow-primary/20"
            )}
          >
            {isImportingCollection ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <UploadCloud className="mr-3 h-5 w-5" />}
            {isImportingCollection ? "Syncing Logic..." : `Execute ${importMode === "replace" ? "Replace" : "Merge"} Sync`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
