"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle, Loader2, ArrowUpCircle, ShieldAlert, Wrench, Search } from "lucide-react";
import { getSyncConfig, saveSyncConfig, performFullSync, startAutoSync, exportAllLocalData, testCloudTable, resetCloudTable, recoverMasterDataFromLegacySeason, migrateCommonToCurrentSeason } from "@/lib/d1-sync";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { SQLITE_TABLES } from "@/lib/sqlite-storage";

export function CloudSyncCard() {
    const { toast } = useToast();
    const [config, setConfig] = useState({
        accountId: "",
        databaseId: "",
        apiToken: "",
        syncToken: "",
        workerUrl: ""
    });

    const [isSyncing, setIsSyncing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [exportTable, setExportTable] = useState("");
    const [lastSync, setLastSync] = useState<string | null>(null);

    useEffect(() => {
        const saved = getSyncConfig();
        if (saved) {
            setConfig({
                ...saved,
                apiToken: (saved as any).apiToken || "",
                workerUrl: (saved as any).workerUrl || ""
            });
        }
        const ls = localStorage.getItem('bizsuite:lastSyncTime');
        if (ls) setLastSync(new Date(parseInt(ls)).toLocaleString());
    }, []);

    const handleSave = () => {
        saveSyncConfig(config as any);
        toast({ title: "Sync settings saved", variant: "success" });
        if (config.syncToken && config.workerUrl) {
            startAutoSync();
        }
    };

    const handleSyncNow = async () => {
        if (!config.syncToken || !config.workerUrl) {
            toast({ title: "Configuration missing", description: "Please enter sync token and worker URL", variant: "destructive" });
            return;
        }

        setIsSyncing(true);
        try {
            await performFullSync('all');
            const now = Date.now();
            setLastSync(new Date(now).toLocaleString());
            localStorage.setItem('bizsuite:lastSyncTime', String(now));
            toast({ title: "Synchronization complete", variant: "success" });
        } catch (error: any) {
            toast({ title: "Sync failed", description: error.message, variant: "destructive" });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleInitialExport = async () => {
        if (!config.syncToken || !config.workerUrl) {
            toast({ title: "Configuration missing", description: "Please enter sync token and worker URL", variant: "destructive" });
            return;
        }

        setIsExporting(true);
        setExportProgress(0);
        try {
            const res = await exportAllLocalData((progress, table) => {
                setExportProgress(progress);
                setExportTable(table);
            });

            if (res.success) {
                toast({ title: "Initial Migration Complete", description: `Successfully exported ${res.total} records to cloud.`, variant: "success" });
            } else {
                toast({ title: "Migration Failed", description: res.error, variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsExporting(false);
            setExportProgress(0);
        }
    };

    const handleRecoverMaster = async () => {
        if (!config.syncToken || !config.workerUrl) {
            toast({ title: "Configuration missing", variant: "destructive" });
            return;
        }
        
        if (!confirm(`This will pull Master Data (Banks, Ledgers, Categories) from the season you are currently on and mark it as 'COMMON' for the whole unit. Continue?`)) return;

        setIsSyncing(true);
        try {
            const res = await recoverMasterDataFromLegacySeason();
            if (res.success) {
                toast({ title: "Recovery Complete", description: `Migrated ${res.pulled} records to Common scope.`, variant: "success" });
                // Force a push to update cloud with COMMON label
                setTimeout(() => performFullSync('all'), 2000);
            } else {
                toast({ title: "Recovery Failed", description: res.error, variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSyncing(false);
        }
    };
    
    const handleMigrateToSeason = async (type: 'suppliers' | 'customers') => {
        if (!config.syncToken || !config.workerUrl) {
            toast({ title: "Configuration missing", variant: "destructive" });
            return;
        }
        
        if (!confirm(`This will pull ${type} from the COMMON cloud storage and assign them to your CURRENT season. Use this to fix the "Common Data" mistake. Continue?`)) return;

        setIsSyncing(true);
        try {
            const res = await migrateCommonToCurrentSeason([type]);
            if (res.success) {
                toast({ title: "Migration Complete", description: `Migrated ${res.pulled} ${type} to this season.`, variant: "success" });
                // Force a push to update cloud with Season label
                setTimeout(() => performFullSync(type), 2000);
            } else {
                toast({ title: "Migration Failed", description: res.error, variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Cloud Sync</h2>
                    <p className="text-muted-foreground text-sm">Manage multi-user Cloudflare synchronization.</p>
                </div>
                {config.syncToken ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 px-3 py-1">
                        <Cloud className="w-4 h-4 mr-2" /> Active
                    </Badge>
                ) : (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 px-3 py-1">
                        <CloudOff className="w-4 h-4 mr-2" /> Not Configured
                    </Badge>
                )}
            </div>

            <Card className="border-slate-800 bg-slate-900/50">
                <CardHeader>
                    <CardTitle className="text-lg">Cloudflare Connection</CardTitle>
                    <CardDescription>Setup your worker and database IDs.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="workerUrl">Worker URL</Label>
                        <Input 
                            id="workerUrl" 
                            placeholder="https://your-worker.workers.dev" 
                            value={config.workerUrl}
                            onChange={(e) => setConfig({...config, workerUrl: e.target.value})}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="syncToken">Secret Sync Token</Label>
                        <Input 
                            id="syncToken" 
                            type="password"
                            placeholder="Enter your private sync token" 
                            value={config.syncToken}
                            onChange={(e) => setConfig({...config, syncToken: e.target.value})}
                        />
                    </div>
                    
                    <div className="pt-4 flex gap-4">
                        <Button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700">
                            Save Configuration
                        </Button>
                        <Button 
                            variant="secondary" 
                            onClick={handleSyncNow} 
                            disabled={isSyncing}
                            className="flex-1"
                        >
                            {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Sync Now
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {lastSync && (
                <div className="flex items-center justify-center text-xs text-muted-foreground gap-2">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    Last successfully synced at {lastSync}
                </div>
            )}

            <Card className="border-orange-500/20 bg-orange-500/5 backdrop-blur-sm shadow-xl mt-6">
                <CardHeader>
                    <CardTitle className="text-orange-400 flex items-center gap-2">
                        <ArrowUpCircle className="w-5 h-5" />
                        Migration & Initial Export
                    </CardTitle>
                    <CardDescription className="text-orange-200/60">
                        Use this to push your existing records to the cloud for the <b>first time</b>.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-xs text-orange-200/60 bg-orange-950/20 p-3 rounded border border-orange-500/10">
                        Warning: This will assign all current local data to your currently selected <b>Unit & Season</b>.
                    </p>
                    
                    {isExporting ? (
                        <div className="space-y-2">
                             <div className="flex justify-between text-xs font-mono">
                                <span>Exporting {exportTable}...</span>
                                <span>{exportProgress}%</span>
                             </div>
                             <Progress value={exportProgress} className="h-1.5" />
                        </div>
                    ) : (
                        <Button 
                            variant="outline" 
                            onClick={handleInitialExport} 
                            disabled={isExporting}
                            className="w-full border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                        >
                            {isExporting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Push Local Data to Cloud Unit
                        </Button>
                    )}
                </CardContent>
            </Card>

            <Card className="border-pink-500/20 bg-pink-500/5 mt-6">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-pink-400">
                        <Wrench className="w-5 h-5" />
                        Master Data Recovery
                    </CardTitle>
                    <CardDescription className="text-pink-200/60">
                        Use this if your Banks or Categories disappeared after the "Common" update.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button 
                        variant="outline" 
                        className="w-full border-pink-500/30 text-pink-400 hover:bg-pink-500/10 font-bold"
                        onClick={handleRecoverMaster}
                        disabled={isSyncing}
                    >
                        {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Recover Master Data from Current Season
                    </Button>
                    
                    <div className="mt-4 pt-4 border-t border-pink-500/20 space-y-2">
                        <p className="text-[10px] text-pink-300/50 uppercase font-bold tracking-wider">Undo Common mistake</p>
                        <div className="flex gap-2">
                            <Button 
                                variant="outline" 
                                size="sm"
                                className="flex-1 border-pink-500/30 text-pink-400 text-xs"
                                onClick={() => handleMigrateToSeason('suppliers')}
                                disabled={isSyncing}
                            >
                                Fix Suppliers
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm"
                                className="flex-1 border-pink-500/30 text-pink-400 text-xs"
                                onClick={() => handleMigrateToSeason('customers')}
                                disabled={isSyncing}
                            >
                                Fix Customers
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm"
                                className="flex-1 border-pink-500/30 text-pink-400 text-xs"
                                onClick={async () => {
                                    await handleMigrateToSeason('payments');
                                    await handleMigrateToSeason('customerPayments');
                                }}
                                disabled={isSyncing}
                            >
                                Fix Payments
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-red-500/20 bg-red-500/5 mt-6">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-red-400">
                        <ShieldAlert className="w-5 h-5" />
                        Troubleshooting & Repair
                    </CardTitle>
                    <CardDescription>If a specific table (like suppliers) shows an error in D1 Dashboard, use these tools to fix it.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="text-sm space-y-2">
                        <Label>Select Table to Repair</Label>
                        <div className="flex gap-2">
                            <select 
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-md p-2 text-sm"
                                id="repair-table-select"
                            >
                                {SQLITE_TABLES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <Button variant="outline" size="sm" onClick={async () => {
                                const table = (document.getElementById('repair-table-select') as HTMLSelectElement).value;
                                if (!table) return;
                                toast({ title: `Testing ${table}...` });
                                const res = await testCloudTable(table);
                                if (res.success) toast({ title: "Health Check Passed", description: `Cloud has ${res.count} records for ${table}`, variant: "success" });
                                else toast({ title: "Health Check Failed", description: res.error, variant: "destructive" });
                            }}>
                                <Search className="w-4 h-4 mr-2" /> Test
                            </Button>
                        </div>
                        <div className="pt-2">
                            <Button 
                                variant="destructive" 
                                className="w-full"
                                onClick={async () => {
                                    const table = (document.getElementById('repair-table-select') as HTMLSelectElement).value;
                                    if (!table) return;
                                    if (!confirm(`Are you sure? This will DELETE ALL cloud data for ${table}. Local data is safe.`)) return;
                                    
                                    toast({ title: `Resetting ${table} on Cloud...` });
                                    const res = await resetCloudTable(table);
                                    if (res.success) toast({ title: "Table Reset Complete", description: "You can now re-export existing data.", variant: "success" });
                                    else toast({ title: "Reset Failed", description: res.error, variant: "destructive" });
                                }}
                            >
                                <Wrench className="w-4 h-4 mr-2" /> Reset Cloud Table
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div className="text-xs text-blue-200/80">
                    <p className="font-semibold text-blue-400 mb-1">Local-First Architecture:</p>
                    Work happens locally in SQLite. Internet is only needed to sync with other devices via Cloudflare.
                </div>
            </div>
        </div>
    );
}
