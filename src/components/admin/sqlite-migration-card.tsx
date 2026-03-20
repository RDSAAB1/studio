"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FolderOpen, DatabaseZap, ArrowRightLeft, FileSpreadsheet, Database, CheckCircle2 } from "lucide-react";
import { isSqliteMode, setSqliteMode, setSqliteFolderPath, getSqliteFolderPath, switchToSqliteFolder } from "@/lib/sqlite-storage";
import { clearAllLocalData } from "@/lib/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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
    'bankBranches',
    'bankAccounts',
    'supplierBankAccounts',
  ]);
  const [loading, setLoading] = useState(true);

  // States for Select Folder Flow
  const [isSelectFolderDialogOpen, setIsSelectFolderDialogOpen] = useState(false);
  const [selectFolderFlowStep, setSelectFolderFlowStep] = useState<"initial" | "synced" | "cleared">("initial");
  const [syncStats, setSyncStats] = useState<{ total: number; error: string }>({ total: 0, error: "" });
  const [isFlowSyncing, setIsFlowSyncing] = useState(false);

  const [dbSize, setDbSize] = useState<number | null>(null);
  const [isVacuuming, setIsVacuuming] = useState(false);

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
      const setRes = await electron.sqliteSetFolder(targetFolder);
      if (!setRes?.success) {
        toast({ title: "Failed", description: setRes?.error || "Could not set SQLite folder.", variant: "destructive" });
        return;
      }

      const { importDexieToSqlite } = await import("@/lib/sqlite-migration");
      const out = await importDexieToSqlite(selectedCollectionsForNewDb);
      const tableRows = Object.entries(out.details || {}).map(([table, d]) => ({
        table,
        fromDexie: d.sourceCount,
        toSqlite: d.sqliteCount,
        error: d.error ?? "",
      }));
      const total = tableRows.reduce((sum, r) => sum + (r.toSqlite || 0), 0);
      const hasError = tableRows.some((r) => !!r.error || (r.table !== 'ledgerCashAccounts' && r.fromDexie !== r.toSqlite));

      if (typeof window !== "undefined") {
        // eslint-disable-next-line no-console
        console.table(tableRows);
      }

      if (!hasError) {
        toast({ title: "New DB created", description: `${total} records selected collections se nayi DB me copy ho gaye.`, variant: "success" });
      } else {
        const firstErr = tableRows.find((r) => r.error)?.error;
        const msg = firstErr || "Kuch collections copy nahi ho payeen. DevTools console.table me per-table detail dekh sakte hain.";
        toast({ title: "New DB partial", description: msg, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      if (currentFolder) {
        try {
          await electron.sqliteSetFolder(currentFolder);
        } catch {
          // ignore
        }
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
    toast({ title: "SQLite off", description: "Page refresh karein." });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48 border rounded-lg">
        <Loader2 className="animate-spin h-6 w-6 text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading SQLite settings...</span>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseZap className="h-5 w-5 text-primary" />
            SQLite Database Management
          </CardTitle>
          <CardDescription>
            Sirf SQLite use hota hai. Folder select karein jahan jrmd.sqlite store hoga. Sab data wahi se read/write hoga.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={onClickSelectSqliteFolder} variant="outline" size="sm">
              <FolderOpen className="mr-2 h-4 w-4" />
              Select SQLite folder
            </Button>
            <Button
              onClick={handleImportExcelFolderToSqlite}
              disabled={isImportingExcelToSqlite}
              variant="outline"
              size="sm"
            >
              {isImportingExcelToSqlite ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              {isImportingExcelToSqlite ? "Importing..." : "Import Excel folder \u2192 SQLite"}
            </Button>
            <Button
              onClick={handleMigrateCurrentDataToSqlite}
              disabled={isMigratingToSqlite}
              variant="outline"
              size="sm"
            >
              {isMigratingToSqlite ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
              {isMigratingToSqlite ? "Migrating..." : "Migrate current data \u2192 SQLite"}
            </Button>
            <Button
              onClick={handleUseSqliteForData}
              disabled={isEnablingSqlite}
              size="sm"
              className="bg-primary text-primary-foreground"
            >
              {isEnablingSqlite && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEnablingSqlite ? "Loading..." : (
                <>
                  <DatabaseZap className="mr-2 h-4 w-4" />
                  Use SQLite for data
                </>
              )}
            </Button>
            {sqliteModeActive && (
              <Button onClick={handleSwitchFromSqlite} variant="destructive" size="sm">
                SQLite off
              </Button>
            )}
          </div>
          {(sqliteFolderPath || sqliteModeActive) && (
            <div className="flex flex-col gap-2 mt-2 bg-muted/30 p-3 rounded-lg border">
              <p className="text-xs text-muted-foreground break-all">
                <strong>SQLite folder:</strong> {sqliteFolderPath || getSqliteFolderPath() || "\u2014"}
              </p>
              {dbSize !== null && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span><strong>DB Size:</strong> {(dbSize / 1024).toFixed(1)} KB</span>
                  <Button
                    onClick={handleVacuumSqlite}
                    disabled={isVacuuming || !sqliteModeActive}
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-primary"
                  >
                    {isVacuuming ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <DatabaseZap className="mr-1 h-3 w-3" />}
                    Optimize Size
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Create new DB from selected collections</p>
            <div className="flex flex-wrap gap-2 text-[10px]">
              {[
                'settings',
                'options',
                'banks',
                'bankBranches',
                'bankAccounts',
                'supplierBankAccounts',
              ].map((name) => {
                const labelMap: Record<string, string> = {
                  settings: 'Settings',
                  options: 'Options',
                  banks: 'Banks',
                  bankBranches: 'Bank Branches',
                  bankAccounts: 'Bank Accounts',
                  supplierBankAccounts: 'Supplier Bank Accounts',
                };
                const checked = selectedCollectionsForNewDb.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleCollectionForNewDb(name)}
                    className={cn(
                      "px-2 py-1 rounded-full border transition-colors",
                      checked ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
                    )}
                  >
                    {labelMap[name] || name}
                  </button>
                );
              })}
            </div>
            <Button
              onClick={handleCreateNewDbFromSelectedCollections}
              disabled={isCreatingNewDb}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              {isCreatingNewDb ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
              {isCreatingNewDb ? "Creating..." : "Create new DB from selected collections"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Select SQLite Folder Popup Dialog */}
      <Dialog open={isSelectFolderDialogOpen} onOpenChange={setIsSelectFolderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Switch SQLite Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectFolderFlowStep === "initial" && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Folder switch karne se pehle current app data ko SQLite mein zaroor save/sync kar lein taki koi recent data loss na ho.
                </p>
                <Button 
                  onClick={handleFlowSyncData} 
                  disabled={isFlowSyncing} 
                  className="w-full"
                >
                  {isFlowSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
                  {isFlowSyncing ? "Syncing..." : "Switch data (Sync to SQLite)"}
                </Button>
              </div>
            )}

            {selectFolderFlowStep === "synced" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-md border border-emerald-200">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="text-sm font-medium">
                    Data sync successful. {syncStats.total} records transfer hue.
                  </p>
                </div>
                {syncStats.error && (
                  <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{syncStats.error}</p>
                )}
                <p className="text-sm text-slate-600">
                  Ab baari hai purane app cache (Dexie data) ko clear karne ki, taki nayi DB open karte waqt dono mix na hon.
                </p>
                <Button 
                  onClick={handleFlowClearDexie} 
                  className="w-full"
                >
                  Continue (Clear Dexie Data)
                </Button>
              </div>
            )}

            {selectFolderFlowStep === "cleared" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-md border border-emerald-200">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="text-sm font-medium">Cache completely cleared.</p>
                </div>
                <p className="text-sm text-slate-600">
                  Aap completely safe hain naya folder select karne ke liye. Naya folder chunen.
                </p>
                <Button 
                  onClick={handleFlowSelectFolder} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Select folder
                </Button>
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsSelectFolderDialogOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
