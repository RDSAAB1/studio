"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Loader2, Database, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { migrateTenantDataToSeason, type MigrationResult } from "@/lib/erp-migration";

interface DataMigrationCardProps {
    initialCompanyName?: string;
}

export function DataMigrationCard({ initialCompanyName = "" }: DataMigrationCardProps) {
    const { toast } = useToast();
    const [migrationCompanyName, setMigrationCompanyName] = useState<string>(initialCompanyName);
    const [migrationSubCompanyName, setMigrationSubCompanyName] = useState<string>("MAIN");
    const [migrationSeasonName, setMigrationSeasonName] = useState<string>(`${new Date().getFullYear()} A`);
    const [migrationRunning, setMigrationRunning] = useState(false);
    const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);

    const handleMigrationRun = async () => {
        if (!migrationCompanyName.trim() || !migrationSubCompanyName.trim() || !migrationSeasonName.trim()) {
            toast({
                title: "Missing details",
                description: "Please enter Company, Sub Company and Season before migrating.",
                variant: "destructive"
            });
            return;
        }

        setMigrationRunning(true);
        setMigrationResult(null);

        try {
            const result = await migrateTenantDataToSeason({
                companyName: migrationCompanyName.trim(),
                subCompanyName: migrationSubCompanyName.trim(),
                seasonName: migrationSeasonName.trim()
            });
            setMigrationResult(result);
            toast({
                title: "Migration Successful",
                description: `Successfully migrated ${result.totalMigrated} records.`,
                variant: "success"
            });
        } catch (error) {
            console.error("Migration failed:", error);
            toast({
                title: "Migration Failed",
                description: error instanceof Error ? error.message : "Unknown error occurred.",
                variant: "destructive"
            });
        } finally {
            setMigrationRunning(false);
        }
    };

    return (
        <Card className="ui-card bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
            <CardHeader className="py-5 px-6 border-b border-border/40 bg-muted/20">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                             <div className="p-1.5 bg-primary/5 rounded-md">
                                <Database className="h-4 w-4 text-primary" />
                             </div>
                             ERP Structural Migration
                        </CardTitle>
                        <CardDescription className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest ml-1">
                            Relational restructuring service
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-0.5">Company Branch</Label>
                        <Input
                            value={migrationCompanyName}
                            onChange={(e) => setMigrationCompanyName(e.target.value)}
                            placeholder="e.g. JRMD Agro"
                            className="h-10 bg-white border-border/60 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-primary/10 rounded-md transition-all font-semibold text-xs shadow-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-0.5">Sub-Division</Label>
                        <Input
                            value={migrationSubCompanyName}
                            onChange={(e) => setMigrationSubCompanyName(e.target.value)}
                            placeholder="e.g. MAIN BRANCH"
                            className="h-10 bg-white border-border/60 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-primary/10 rounded-md transition-all font-semibold text-xs shadow-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-0.5">Season Identifier</Label>
                        <Input
                            value={migrationSeasonName}
                            onChange={(e) => setMigrationSeasonName(e.target.value)}
                            placeholder="e.g. 2024 A"
                            className="h-10 bg-white border-border/60 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-primary/10 rounded-md transition-all font-semibold text-xs shadow-sm"
                        />
                    </div>
                </div>

                <div className="p-4 rounded-md bg-primary/5 border border-primary/10 shadow-sm">
                    <p className="text-[11px] font-semibold text-primary/80 uppercase tracking-tight leading-relaxed">
                        Notice: This protocol clones current dataset into a Company → Sub Company → Season hierarchy. 
                        Source integrity is maintained via relational markers to prevent redundancy.
                    </p>
                </div>

                {migrationRunning && (
                    <div className="space-y-3 p-4 bg-muted/20 rounded-md border border-border/40 animate-pulse shadow-inner">
                        <Progress value={80} className="h-1.5 bg-muted" />
                        <p className="text-[10px] font-bold text-muted-foreground text-center uppercase tracking-widest">
                            Executing Structural Transfer... Maintain connection.
                        </p>
                    </div>
                )}

                {migrationResult && !migrationRunning && (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-5 animate-in slide-in-from-top-1 shadow-sm">
                        <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-2 mb-2">
                             <CheckCircle2 className="h-5 w-5" />
                             Transfer Successful
                        </p>
                        <p className="text-xs font-semibold text-muted-foreground leading-normal ml-8 uppercase tracking-tight">
                            Successfully moved <span className="text-emerald-700 font-bold">{migrationResult.totalMigrated}</span> records
                            to <span className="text-foreground">{migrationSeasonName}</span> within <span className="text-foreground">{migrationSubCompanyName}</span>.
                        </p>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex justify-end border-t border-border/40 bg-muted/10 p-4">
                <Button 
                    type="button" 
                    onClick={handleMigrationRun} 
                    disabled={migrationRunning}
                    className="h-10 px-8 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-95 border-none"
                >
                    {migrationRunning ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Database className="mr-2 h-4 w-4" />
                    )}
                    Execute Migration
                </Button>
            </CardFooter>
        </Card>
    );
}
