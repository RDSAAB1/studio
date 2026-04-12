"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { getSyncConfig, saveSyncConfig, performFullSync, startAutoSync, exportAllLocalData } from "@/lib/d1-sync";
import { toast } from "sonner";

export default function CloudSyncSettings() {
    const [config, setConfig] = useState({
        accountId: "",
        databaseId: "",
        apiToken: "", // Not strictly needed for the worker but good for future
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
        toast.success("Sync settings saved successfully");
        // Trigger initial sync immediately
        if (config.syncToken && config.workerUrl) {
            performFullSync('all').catch(() => {});
        }
    };

    const handleSyncNow = async () => {
        if (!config.syncToken || !config.workerUrl) {
            toast.error("Please configure sync token and worker URL first");
            return;
        }

        setIsSyncing(true);
        try {
            // Force a full pull of all tables
            await performFullSync('all');
            const now = Date.now();
            setLastSync(new Date(now).toLocaleString());
            localStorage.setItem('bizsuite:lastSyncTime', String(now));
            toast.success("Full data synchronization complete");
        } catch (error: any) {
            toast.error("Sync failed: " + error.message);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleExport = async () => {
        if (!config.syncToken || !config.workerUrl) {
            toast.error("Please configure sync token and worker URL first");
            return;
        }

        if (!confirm("This will push ALL current local data to the cloud under your SELECTED Unit and Season. Continue?")) return;

        setIsExporting(true);
        setExportProgress(0);
        try {
            const res = await exportAllLocalData((progress, table) => {
                setExportProgress(progress);
                setExportTable(table);
            });
            if (res.success) {
                toast.success(`Export complete! ${res.total} records pushed.`);
            } else {
                toast.error("Export failed: " + res.error);
            }
        } catch (error: any) {
            toast.error("Export error: " + error.message);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="container mx-auto py-10 space-y-6 max-w-2xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Cloud Sync Settings</h1>
                    <p className="text-muted-foreground">Manage your multi-user Cloudflare D1 synchronization.</p>
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

            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm shadow-xl">
                <CardHeader>
                    <CardTitle>Cloudflare Configuration</CardTitle>
                    <CardDescription>Enter your Cloudflare D1 and Worker details to enable real-time sync.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="workerUrl">Worker URL</Label>
                        <Input 
                            id="workerUrl" 
                            placeholder="https://your-sync-worker.workers.dev" 
                            value={config.workerUrl}
                            onChange={(e) => setConfig({...config, workerUrl: e.target.value})}
                            className="bg-slate-950 border-slate-800"
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
                            className="bg-slate-950 border-slate-800"
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
                            {isSyncing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Sync Now
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-orange-500/20 bg-orange-500/5 backdrop-blur-sm shadow-xl">
                <CardHeader>
                    <CardTitle className="text-orange-400">Migration & Initial Export</CardTitle>
                    <CardDescription text-orange-200/60>
                        Use this to push your existing records to the cloud for the <b>first time</b>.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-xs text-orange-200/60 bg-orange-950/20 p-3 rounded border border-orange-500/10">
                        Warning: This will assign all current local data to your currently selected <b>Unit & Season</b>.
                    </p>
                    
                    {isExporting && (
                        <div className="space-y-2">
                             <div className="flex justify-between text-xs font-mono">
                                <span>Exporting {exportTable}...</span>
                                <span>{exportProgress}%</span>
                             </div>
                             <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div 
                                    className="bg-orange-500 h-full transition-all duration-300" 
                                    style={{ width: `${exportProgress}%` }}
                                />
                             </div>
                        </div>
                    )}

                    <Button 
                        variant="outline" 
                        onClick={handleExport} 
                        disabled={isExporting}
                        className="w-full border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                    >
                        {isExporting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Push Local Data to Cloud Unit
                    </Button>
                </CardContent>
            </Card>

            {lastSync && (
                <div className="flex items-center justify-center text-sm text-muted-foreground gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Last successfully synced at {lastSync}
                </div>
            )}

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex gap-4">
                <AlertCircle className="w-6 h-6 text-blue-500 flex-shrink-0" />
                <div className="text-sm text-blue-200/80">
                    <p className="font-semibold text-blue-400 mb-1">How it works:</p>
                    Each device maintains its own local SQLite database for offline speed. 
                    When internet is available, changes are merged through your private Cloudflare D1 database.
                </div>
            </div>
        </div>
    );
}
