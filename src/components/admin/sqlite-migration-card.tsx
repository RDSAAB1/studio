"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Loader2, FolderOpen, DatabaseZap, ArrowRightLeft, FileSpreadsheet, Database, CheckCircle2, CheckCircle, HardDrive,
  Truck, Users, CreditCard, Gavel, BookText, ListPlus, Wallet, TrendingUp, TrendingDown,
  Landmark, MapPin, Banknote, Repeat, FileText, UserRound, Coins, CalendarCheck,
  Package, PlusCircle, Files, Briefcase, Settings2, Settings, Tags, Tag, UserCircle,
  Factory, LayoutTemplate, CheckSquare, Square, HandCoins
} from "lucide-react";
import { cn, toTitleCase } from "@/lib/utils";
import { isSqliteMode, setSqliteMode, setSqliteFolderPath, getSqliteFolderPath, switchToSqliteFolder, SQLITE_TABLES } from "@/lib/sqlite-storage";
import { clearAllLocalData } from "@/lib/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function SqliteMigrationCard() {
  const { toast } = useToast();
  const [sqliteFolderPath, setSqliteFolderPathState] = useState<string | null>(null);
  const [sqliteModeActive, setSqliteModeActive] = useState(false);
  const [isEnablingSqlite, setIsEnablingSqlite] = useState(false);
  const [isMigratingToSqlite, setIsMigratingToSqlite] = useState(false);
  const [isImportingExcelToSqlite, setIsImportingExcelToSqlite] = useState(false);
  const [isCreatingNewDb, setIsCreatingNewDb] = useState(false);
  const [selectedCollectionsForNewDb, setSelectedCollectionsForNewDb] = useState<string[]>([
    'settings',
    'options',
    'banks',
    'bankAccounts',
  ]);
  const [loading, setLoading] = useState(true);

  // States for Select Folder Flow
  const [isSelectFolderDialogOpen, setIsSelectFolderDialogOpen] = useState(false);
  const [selectFolderFlowStep, setSelectFolderFlowStep] = useState<"initial" | "synced" | "cleared">("initial");
  const [syncStats, setSyncStats] = useState<{ total: number; error: string }>({ total: 0, error: "" });
  const [isFlowSyncing, setIsFlowSyncing] = useState(false);

  const [dbSize, setDbSize] = useState<number | null>(null);
  const [isVacuuming, setIsVacuuming] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  useEffect(() => {
    setSqliteModeActive(isSqliteMode());
    const electron = typeof window !== "undefined" ? (window as any).electron : undefined;
    if (electron?.sqliteGetFolder) {
      electron.sqliteGetFolder()
        .then((res: any) => { if (res?.folder) setSqliteFolderPathState(res.folder); })
        .catch(() => {});
    }
    if (electron?.sqliteGetFileSize) {
      electron.sqliteGetFileSize()
        .then((res: any) => { if (res?.size !== undefined) setDbSize(res.size); })
        .catch(() => {});
    }
    setLoading(false);
  }, []);

  const onClickSelectSqliteFolder = () => {
    setIsSelectFolderDialogOpen(true);
    setSelectFolderFlowStep("initial");
    setSyncStats({ total: 0, error: "" });
  };

  const handleFlowSyncData = async () => {
    const electron = typeof window !== "undefined"
      ? (window as unknown as { electron?: { sqliteSetFolder?: (p: string) => Promise<{ success?: boolean; folder?: string; error?: string }> } }).electron
      : undefined;

    if (!electron?.sqliteSetFolder) {
      toast({ title: "Electron required", description: "Run: npm run electron:dev", variant: "destructive" });
      return;
    }

    const folderPath = sqliteFolderPath || getSqliteFolderPath();
    if (!folderPath) {
      toast({ title: "No current folder", description: "Koi SQLite folder active nahi hai. Aap direct switch kar sakte hain.", variant: "default" });
      setSelectFolderFlowStep("synced");
      return;
    }

    setIsFlowSyncing(true);
    try {
      const res = await electron.sqliteSetFolder(folderPath);
      if (!res?.success) {
        toast({ title: "Failed", description: res?.error || "Could not set SQLite folder.", variant: "destructive" });
        return;
      }

      const { importDexieToSqlite } = await import("@/lib/sqlite-migration");
      const out = await importDexieToSqlite();
      const tableRows = Object.entries(out.details || {}).map(([table, d]) => ({
        table,
        fromDexie: d.sourceCount,
        toSqlite: d.sqliteCount,
        error: d.error ?? "",
      }));
      const total = tableRows.reduce((sum, r) => sum + (r.toSqlite || 0), 0);
      const hasError = tableRows.some((r) => !!r.error || r.fromDexie !== r.toSqlite);

      if (out.success && !hasError) {
        setSyncStats({ total, error: "" });
        setSelectFolderFlowStep("synced");
      } else {
        const firstErr = tableRows.find((r) => r.error)?.error;
        setSyncStats({ total, error: firstErr || "Kuch tables migrate nahi ho paye." });
        setSelectFolderFlowStep("synced");
      }
    } catch (e) {
      setSyncStats({ total: 0, error: e instanceof Error ? e.message : "Error syncing." });
      setSelectFolderFlowStep("synced");
    } finally {
      setIsFlowSyncing(false);
    }
  };

  const handleFlowClearDexie = async () => {
    try {
      await clearAllLocalData();
      toast({ title: "Data cleared", description: "Dexie data clear ho gaya.", variant: "default" });
      setSelectFolderFlowStep("cleared");
    } catch (e) {
      toast({ title: "Failed", description: "Could not clear Dexie data", variant: "destructive" });
    }
  };

  const handleFlowSelectFolder = async () => {
    const electron = typeof window !== "undefined" ? (window as unknown as { electron?: { selectFolder?: () => Promise<string | null> } }).electron : undefined;
    if (!electron?.selectFolder) return;
    
    const folderPath = await electron.selectFolder();
    if (!folderPath) return;

    try {
      const res = await switchToSqliteFolder(folderPath);
      if (res?.success) {
        const effective = res.folder || folderPath;
        setSqliteFolderPathState(effective);
        setSqliteFolderPath(effective);
        setSqliteMode(true);
        setSqliteModeActive(true);
        
        setIsSelectFolderDialogOpen(false);
        toast({ title: "Folder set", description: `SQLite DB: ${effective}. Loaded records from it.` });
        
        // Reload page to ensure clean state with new DB
        window.location.reload();
      } else {
        toast({ title: "Failed", description: res?.error || "Could not set folder.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const handleUseSqliteForData = async () => {
    const electron = typeof window !== "undefined" ? (window as unknown as { electron?: { selectFolder?: () => Promise<string | null> } }).electron : undefined;
    if (!electron?.selectFolder) {
      toast({ title: "Electron required", description: "Run: npm run electron:dev", variant: "destructive" });
      return;
    }
    let folderPath = sqliteFolderPath;
    if (!folderPath) {
      folderPath = await electron.selectFolder();
      if (!folderPath) return;
    }
    setIsEnablingSqlite(true);
    try {
      const res = await switchToSqliteFolder(folderPath);
      if (res.success) {
        const effective = res.folder || folderPath;
        setSqliteFolderPathState(effective);
        setSqliteFolderPath(effective);
        setSqliteMode(true);
        setSqliteModeActive(true);

        const mismatches: string[] = [];
        if (res.details) {
          for (const [table, info] of Object.entries(res.details)) {
            if (info.sqlite !== info.dexie || info.error) {
              mismatches.push(`${table}: sqlite=${info.sqlite}, dexie=${info.dexie}${info.error ? `, err=${info.error}` : ''}`);
            }
          }
        }

        toast({
          title: "SQLite enabled",
          description: mismatches.length
            ? `${res.loaded ?? 0} records loaded. Mismatch tables: ${mismatches.join(" | ")}`
            : `${res.loaded ?? 0} records loaded. Data ab SQLite se read/write hoga.`,
          variant: mismatches.length ? "destructive" : "success",
        });

        if (typeof window !== "undefined" && res.details) {
          // eslint-disable-next-line no-console
          console.table(
            Object.entries(res.details).map(([table, info]) => ({
              table,
              sqlite: info.sqlite,
              dexie: info.dexie,
              skipped: info.skipped ?? 0,
              error: info.error ?? "",
            }))
          );
        }
      } else {
        toast({ title: "Load failed", description: res.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setIsEnablingSqlite(false);
    }
  };

  const handleMigrateCurrentDataToSqlite = async () => {
    const electron = typeof window !== "undefined"
      ? (window as unknown as { electron?: { sqliteSetFolder?: (p: string) => Promise<{ success?: boolean; folder?: string; error?: string }> } }).electron
      : undefined;

    if (!electron?.sqliteSetFolder) {
      toast({ title: "Electron required", description: "SQLite works only in Electron. Run: npm run electron:dev", variant: "destructive" });
      return;
    }

    const folderPath = sqliteFolderPath || getSqliteFolderPath();
    if (!folderPath) {
      toast({ title: "Select SQLite folder", description: "Pehle SQLite folder select karein.", variant: "destructive" });
      return;
    }

    setIsMigratingToSqlite(true);
    try {
      const res = await electron.sqliteSetFolder(folderPath);
      if (!res?.success) {
        toast({ title: "Failed", description: res?.error || "Could not set SQLite folder.", variant: "destructive" });
        return;
      }

      const { importDexieToSqlite } = await import("@/lib/sqlite-migration");
      const out = await importDexieToSqlite();
      const tableRows = Object.entries(out.details || {}).map(([table, d]) => ({
        table,
        fromDexie: d.sourceCount,
        toSqlite: d.sqliteCount,
        error: d.error ?? "",
      }));
      const total = tableRows.reduce((sum, r) => sum + (r.toSqlite || 0), 0);
      const hasError = tableRows.some((r) => !!r.error || r.fromDexie !== r.toSqlite);

      if (typeof window !== "undefined") {
        // eslint-disable-next-line no-console
        console.table(tableRows);
      }

      if (out.success && !hasError) {
        toast({ title: "Migration complete", description: `${total} records SQLite me migrate ho gaye.`, variant: "success" });
      } else {
        const firstErr = tableRows.find((r) => r.error)?.error;
        const msg = firstErr || "Kuch tables migrate nahi ho paye. DevTools console.table me per-table detail dekh sakte hain.";
        toast({ title: "Migration partial", description: msg, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Migration failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setIsMigratingToSqlite(false);
    }
  };

  const handleImportExcelFolderToSqlite = async () => {
    const electron = typeof window !== "undefined"
      ? (window as unknown as {
          electron?: {
            selectFolder?: () => Promise<string | null>;
            sqliteSetFolder?: (p: string) => Promise<{ success?: boolean; folder?: string; error?: string }>;
          };
        }).electron
      : undefined;

    if (!electron?.selectFolder || !electron?.sqliteSetFolder) {
      toast({ title: "Electron required", description: "Run: npm run electron:dev", variant: "destructive" });
      return;
    }

    const sqliteFolder = sqliteFolderPath || getSqliteFolderPath();
    if (!sqliteFolder) {
      toast({ title: "Select SQLite folder", description: "Pehle SQLite folder select karein.", variant: "destructive" });
      return;
    }

    const excelFolder = await electron.selectFolder();
    if (!excelFolder) return;

    setIsImportingExcelToSqlite(true);
    try {
      const setRes = await electron.sqliteSetFolder(sqliteFolder);
      if (!setRes?.success) {
        toast({ title: "Failed", description: setRes?.error || "Could not set SQLite folder.", variant: "destructive" });
        return;
      }
      const { loadFromFolderToDexie } = await import("@/lib/local-folder-storage");
      const loadRes = await loadFromFolderToDexie(excelFolder);
      if (!loadRes.success) {
        toast({ title: "Excel load failed", description: loadRes.error || "Excel se load nahi ho paya.", variant: "destructive" });
        return;
      }

      const { importDexieToSqlite } = await import("@/lib/sqlite-migration");
      const out = await importDexieToSqlite();
      const tableRows = Object.entries(out.details || {}).map(([table, d]) => ({
        table,
        fromDexie: d.sourceCount,
        toSqlite: d.sqliteCount,
        error: d.error ?? "",
      }));
      const total = tableRows.reduce((sum, r) => sum + (r.toSqlite || 0), 0);
      const hasError = tableRows.some((r) => !!r.error || r.fromDexie !== r.toSqlite);

      if (typeof window !== "undefined") {
        // eslint-disable-next-line no-console
        console.table(tableRows);
      }

      if (out.success && !hasError) {
        toast({ title: "Excel \u2192 SQLite done", description: `${total} records SQLite me migrate ho gaye.`, variant: "success" });
      } else {
        const firstErr = tableRows.find((r) => r.error)?.error;
        const msg = firstErr || "Kuch tables migrate nahi ho paye. DevTools console.table me per-table detail dekh sakte hain.";
        toast({ title: "Partial migration", description: msg, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setIsImportingExcelToSqlite(false);
    }
  };

  const toggleCollectionForNewDb = (name: string) => {
    setSelectedCollectionsForNewDb((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  };

  const handleCreateNewDbFromSelectedCollections = async () => {
    const electron = typeof window !== "undefined"
      ? (window as unknown as {
          electron?: {
            selectFolder?: () => Promise<string | null>;
            sqliteSetFolder?: (p: string) => Promise<{ success?: boolean; folder?: string; error?: string }>;
            sqliteAll?: (tableName: string) => Promise<any[]>;
            sqliteImportTable?: (tableName: string, rows: any[], opts?: { clear?: boolean }) => Promise<{ success: boolean; count?: number; error?: string }>;
          };
        }).electron
      : undefined;

    if (!electron?.selectFolder || !electron?.sqliteSetFolder) {
      toast({ title: "Electron required", description: "Run: npm run electron:dev", variant: "destructive" });
      return;
    }

    if (!selectedCollectionsForNewDb.length) {
      toast({ title: "Select at least one collection", description: "Koi na koi collection select karein jo nayi DB me chahiye.", variant: "destructive" });
      return;
    }

    const targetFolder = await electron.selectFolder();
    if (!targetFolder) return;

    const currentFolder = sqliteFolderPath || getSqliteFolderPath();

    setIsCreatingNewDb(true);
    try {
      // ✅ STEP 1: Read all data from CURRENT folder BEFORE switching
      toast({ title: "Reading data...", description: "Current database se data padha ja raha hai..." });
      const tableData: Record<string, any[]> = {};
      let totalRead = 0;
      for (const tableName of selectedCollectionsForNewDb) {
        try {
          const rows = await electron.sqliteAll!(tableName) ?? [];
          tableData[tableName] = rows;
          totalRead += rows.length;
        } catch {
          tableData[tableName] = [];
        }
      }

      // ✅ STEP 2: Switch to the new folder
      const setRes = await electron.sqliteSetFolder!(targetFolder);
      if (!setRes?.success) {
        toast({ title: "Failed", description: setRes?.error || "Could not set SQLite folder.", variant: "destructive" });
        return;
      }

      // ✅ STEP 3: Write data into the new folder's SQLite
      toast({ title: "Writing data...", description: `${totalRead} records nayi DB me likh rahe hain...` });
      const tableRows: { table: string; fromSource: number; toSqlite: number; error: string }[] = [];
      for (const [tableName, rows] of Object.entries(tableData)) {
        try {
          const res = await electron.sqliteImportTable!(tableName, rows, { clear: true });
          tableRows.push({ table: tableName, fromSource: rows.length, toSqlite: res.count ?? rows.length, error: res.success ? "" : (res.error ?? "import failed") });
        } catch (e) {
          tableRows.push({ table: tableName, fromSource: rows.length, toSqlite: 0, error: e instanceof Error ? e.message : String(e) });
        }
      }

      if (typeof window !== "undefined") {
        // eslint-disable-next-line no-console
        console.table(tableRows);
      }

      const total = tableRows.reduce((sum, r) => sum + (r.toSqlite || 0), 0);
      const hasError = tableRows.some((r) => !!r.error);

      if (!hasError) {
        toast({ title: "New DB created ✅", description: `${total} records selected collections se nayi DB me copy ho gaye.`, variant: "success" });
      } else {
        const firstErr = tableRows.find((r) => r.error)?.error;
        toast({ title: "New DB partial", description: firstErr || "Kuch collections copy nahi ho payeen.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      // Restore back to original folder
      if (currentFolder) {
        try { await electron.sqliteSetFolder!(currentFolder); } catch { /* ignore */ }
      }
      setIsCreatingNewDb(false);
    }
  };


  const handleVacuumSqlite = async () => {
    const electron = typeof window !== "undefined" ? (window as any).electron : undefined;
    if (!electron?.sqliteVacuum) return;
    setIsVacuuming(true);
    try {
      const res = await electron.sqliteVacuum();
      if (res?.success) {
        toast({ title: "Optimized", description: "SQLite database size has been optimized.", variant: "success" });
        if (electron.sqliteGetFileSize) {
          const sizeRes = await electron.sqliteGetFileSize();
          if (sizeRes?.size !== undefined) setDbSize(sizeRes.size);
        }
      } else {
        toast({ title: "Failed", description: res?.error || "Optimization failed.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setIsVacuuming(false);
    }
  };

  const handleSwitchFromSqlite = () => {
    setSqliteMode(false);
    setSqliteModeActive(false);
    toast({ title: "Local Storage Offline", description: "System has defaulted to legacy cloud storage." });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48 border border-slate-800 rounded-lg bg-slate-950/20 backdrop-blur-sm">
        <Loader2 className="animate-spin h-6 w-6 text-indigo-500" />
        <span className="ml-2 text-sm text-slate-400 font-black uppercase tracking-widest">Initialising Settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {/* Subtle Theme-Aware Status Toolbar */}
        <div className="flex flex-wrap items-center gap-3 p-2 bg-card border border-border/80 rounded-[6px] shadow-sm">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-muted/30 rounded-[4px] border border-border/50">
                <div className={cn("h-1.5 w-1.5 rounded-full", sqliteModeActive ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-muted-foreground/40")} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {sqliteModeActive ? 'Sync Online' : 'Offline Mode'}
                </span>
            </div>

            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-muted/30 rounded-[4px] border border-border/50 flex-1 min-w-[200px]">
                <Database className="h-3.5 w-3.5 text-primary/70" />
                <span className="text-[10px] font-semibold text-foreground/80 truncate">
                    {sqliteFolderPath || getSqliteFolderPath() || 'Local App Data'}
                </span>
            </div>

            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-muted/30 rounded-[4px] border border-border/50">
                <div className="flex items-center gap-1.5">
                    <HardDrive className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span className="text-[11px] font-bold text-foreground/70">{dbSize !== null ? (dbSize / 1024 / 1024).toFixed(1) : 0} MB</span>
                </div>
                {sqliteModeActive && (
                   <Button onClick={handleVacuumSqlite} disabled={isVacuuming} variant="ghost" size="icon" className="h-6 w-6 rounded hover:bg-muted">
                      {isVacuuming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingDown className="h-3.5 w-3.5 text-primary/60" />}
                   </Button>
                )}
            </div>

            <div className="flex gap-1.5">
                <Button
                    onClick={onClickSelectSqliteFolder}
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 rounded-[4px] text-[10px] font-bold uppercase tracking-wider"
                >
                    <FolderOpen className="h-3.5 w-3.5 mr-2" />
                    Change Directory
                </Button>
                {!sqliteModeActive ? (
                  <Button
                      onClick={handleUseSqliteForData}
                      disabled={isEnablingSqlite}
                      size="sm"
                      className="h-8 px-4 rounded-[4px] bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all"
                  >
                      {isEnablingSqlite ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                      Connect Hub
                  </Button>
                ) : (
                  <Button
                      onClick={handleSwitchFromSqlite}
                      disabled={isEnablingSqlite}
                      size="sm"
                      className="h-8 px-4 rounded-[4px] variant-destructive text-[10px] font-bold uppercase tracking-wider transition-all"
                  >
                      Disconnect
                  </Button>
                )}
            </div>
        </div>

        {/* Portable Backup Builder Section - 3D White Look using theme tokens */}
        <div className="ui-card p-6 bg-white space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
            <div className="space-y-0.5">
              <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                 <div className="p-1.5 bg-primary/5 rounded-md">
                    <DatabaseZap className="h-4 w-4 text-primary" />
                 </div>
                 Portable Datasets
              </h4>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest ml-1">Administrative Migration Logic</p>
            </div>
            
            <div className="flex items-center gap-1.5 p-1 bg-muted/40 border border-border/50 rounded-md">
              <Button variant="ghost" size="sm" onClick={() => setSelectedCollectionsForNewDb([...SQLITE_TABLES])} className="h-7 px-3 text-[10px] font-bold uppercase text-muted-foreground hover:text-primary hover:bg-white rounded-sm transition-all">All</Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCollectionsForNewDb([])} className="h-7 px-3 text-[10px] font-bold uppercase text-muted-foreground hover:text-destructive hover:bg-white rounded-sm transition-all">None</Button>
              <div className="h-7 px-3 flex items-center bg-primary/10 text-primary text-[10px] font-bold rounded-sm border border-primary/20 uppercase tracking-tight">{selectedCollectionsForNewDb.length} Selected</div>
            </div>
          </div>

          <div className="relative rounded-md border border-border/40 bg-muted/20 p-2 overflow-hidden shadow-inner">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 p-1 max-h-[400px] overflow-y-auto custom-scrollbar-mini">
              {SQLITE_TABLES.map((name) => {
                const checked = selectedCollectionsForNewDb.includes(name);
                const getIcon = (table: string) => {
                    const map: Record<string, any> = {
                      suppliers: Truck, customers: Users, payments: CreditCard, customerPayments: HandCoins, governmentFinalizedPayments: Gavel,
                      ledgerAccounts: BookText, ledgerEntries: ListPlus, ledgerCashAccounts: Wallet, incomes: TrendingUp, expenses: TrendingDown,
                      transactions: ArrowRightLeft, banks: Landmark, bankBranches: MapPin, bankAccounts: CreditCard, supplierBankAccounts: Repeat,
                      loans: Banknote, fundTransactions: Repeat, mandiReports: FileText,
                      inventoryItems: Package, inventoryAddEntries: PlusCircle, kantaParchi: FileText, customerDocuments: Files,
                      options: Settings2, settings: Settings, incomeCategories: Tags, expenseCategories: Tag, accounts: UserCircle, manufacturingCosting: Factory, expenseTemplates: LayoutTemplate
                    };
                    const IconComp = map[table] || Database;
                    return <IconComp className={cn("h-4 w-4", checked ? "text-primary" : "text-muted-foreground/50")} />;
                };

                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleCollectionForNewDb(name)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 p-4 rounded-md border transition-all duration-200 group/tile relative",
                      checked 
                        ? "bg-white text-primary border-primary/30 shadow-md scale-[1.02] z-10" 
                        : "bg-white text-muted-foreground border-border/40 hover:border-primary/20 hover:shadow-sm hover:scale-[1.01]"
                    )}
                  >
                    <div className={cn("p-2 rounded-md transition-all duration-200", checked ? "bg-primary/5 text-primary" : "bg-muted/30")}>
                        {getIcon(name)}
                    </div>
                    <span className="truncate text-[10px] font-bold uppercase tracking-tight text-center w-full">
                        {toTitleCase(name.replace(/([A-Z])/g, ' $1').trim())}
                    </span>
                    {checked && (
                       <div className="absolute top-1.5 right-1.5 flex items-center justify-center">
                          <CheckCircle2 className="h-3 w-3 text-primary" />
                       </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border/40">
             <div className="flex gap-3">
                <Button onClick={handleMigrateCurrentDataToSqlite} disabled={isMigratingToSqlite} variant="outline" size="sm" className="h-10 px-6 rounded-md text-[11px] font-bold uppercase tracking-widest hover:text-primary transition-all shadow-sm">
                  {isMigratingToSqlite ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4 text-primary/60" />}
                  Safe Export
                </Button>
                <Button onClick={handleImportExcelFolderToSqlite} disabled={isImportingExcelToSqlite} variant="outline" size="sm" className="h-10 px-6 rounded-md text-[11px] font-bold uppercase tracking-widest hover:text-emerald-600 transition-all shadow-sm">
                  {isImportingExcelToSqlite ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600/60" />}
                  Bulk Sync
                </Button>
             </div>

             <Button
                onClick={handleCreateNewDbFromSelectedCollections}
                disabled={isCreatingNewDb}
                className="h-11 px-8 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 font-bold border-none"
             >
                {isCreatingNewDb ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <DatabaseZap className="mr-3 h-5 w-5" />}
                Init Portable Sync
             </Button>
          </div>

          {importSummary && (
              <div className="p-4 rounded-md bg-emerald-50 border border-emerald-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-1 shadow-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-widest truncate">{importSummary}</p>
              </div>
          )}
        </div>

        {/* Select SQLite Folder Popup Dialog */}
        <Dialog open={isSelectFolderDialogOpen} onOpenChange={setIsSelectFolderDialogOpen}>
          <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 rounded-3xl shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-slate-900 font-black uppercase tracking-widest text-sm flex items-center gap-2">
                 <FolderOpen className="h-5 w-5 text-indigo-600" />
                 Switch Memory Hub
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectFolderFlowStep === "initial" && (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                    <p className="text-xs text-amber-800 font-bold leading-relaxed">
                      ⚠️ Data Safety Protocol: Ensure current session data is synchronized to Local Storage before switching directories. Unsaved cache may be lost.
                    </p>
                  </div>
                  <Button onClick={handleFlowSyncData} disabled={isFlowSyncing} className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[12px] shadow-lg shadow-indigo-600/20">
                    {isFlowSyncing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ArrowRightLeft className="mr-2 h-5 w-5" />}
                    {isFlowSyncing ? "Syncing Logic..." : "Sync & Proceed"}
                  </Button>
                </div>
              )}

              {selectFolderFlowStep === "synced" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-emerald-700 bg-emerald-50 px-4 py-3 rounded-2xl border border-emerald-100">
                    <CheckCircle2 className="h-6 w-6" />
                    <div>
                        <p className="text-sm font-black uppercase tracking-tight">System Synced</p>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{syncStats.total} Records safely moved.</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 font-bold leading-relaxed text-center px-4">
                    Dynamic cache (Dexie) can now be safely evacuated to restore baseline performance.
                  </p>
                  <Button onClick={handleFlowClearDexie} className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-[12px] shadow-lg shadow-slate-900/20">
                    Clear Engine Cache
                  </Button>
                </div>
              )}

              {selectFolderFlowStep === "cleared" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-indigo-700 bg-indigo-50 px-4 py-3 rounded-2xl border border-indigo-100">
                    <CheckCircle2 className="h-6 w-6" />
                    <p className="text-sm font-black uppercase tracking-tight">Cache Evacuated</p>
                  </div>
                  <Button onClick={handleFlowSelectFolder} className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[12px] shadow-lg shadow-indigo-600/20 shadow-indigo-600/20">
                    <FolderOpen className="mr-2 h-5 w-5 font-bold" />
                    Mount New Directory
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter className="sm:justify-center border-t border-slate-50 pt-4">
               <Button type="button" variant="ghost" onClick={() => setIsSelectFolderDialogOpen(false)} className="text-slate-400 hover:text-slate-900 font-black uppercase tracking-widest text-[11px] transition-colors">Abort Switch</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
