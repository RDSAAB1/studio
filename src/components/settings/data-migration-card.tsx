"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Loader2, Database } from "lucide-react";
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
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    ERP Data Migration
                </CardTitle>
                <CardDescription>
                    Move all existing data of the current company into a single Company → Sub Company → Season structure for the new ERP system.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <Label>Company Name</Label>
                        <Input
                            value={migrationCompanyName}
                            onChange={(e) => setMigrationCompanyName(e.target.value)}
                            placeholder="e.g. JRMD Agro"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>Sub Company</Label>
                        <Input
                            value={migrationSubCompanyName}
                            onChange={(e) => setMigrationSubCompanyName(e.target.value)}
                            placeholder="e.g. MAIN BRANCH"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>Season / Year Label</Label>
                        <Input
                            value={migrationSeasonName}
                            onChange={(e) => setMigrationSeasonName(e.target.value)}
                            placeholder="e.g. 2024 A"
                        />
                    </div>
                </div>
                <p className="text-xs text-muted-foreground">
                    This will copy all existing data of the active company into the selected Sub Company and
                    Season. Old data is not deleted; a marker is added so you can safely run migration again
                    without duplicating records.
                </p>
                {migrationRunning && (
                    <div className="space-y-2">
                        <Progress value={100} className="h-2 animate-pulse" />
                        <p className="text-xs text-muted-foreground text-center">
                            Migrating data… please keep this tab open.
                        </p>
                    </div>
                )}
                {migrationResult && !migrationRunning && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">
                        <p className="font-semibold">Migration completed successfully!</p>
                        <p className="mt-1">
                            Migrated <span className="font-semibold">{migrationResult.totalMigrated}</span> records
                            to <span className="font-semibold">{migrationSeasonName}</span> in Sub Company{" "}
                            <span className="font-semibold">{migrationSubCompanyName}</span>.
                        </p>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex justify-end border-t bg-muted/50 p-4">
                <Button type="button" onClick={handleMigrationRun} disabled={migrationRunning}>
                    {migrationRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Migrate Existing Data
                </Button>
            </CardFooter>
        </Card>
    );
}
