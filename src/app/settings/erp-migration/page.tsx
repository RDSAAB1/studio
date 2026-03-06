"use client";

import React, { useState, useEffect, use } from "react";
import {
  migrateDataToSeason,
  checkCompanyStructureExists,
  setupCompanyStructureViaRest,
  MIGRATABLE_COLLECTIONS,
  type CompanySetupResult,
  type MigrationResult,
} from "@/lib/erp-migration";
import { getFirebaseAuth } from "@/lib/firebase";
import { getRtgsSettings } from "@/lib/firestore";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

type Step = 1 | 2;

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
export default function ErpMigrationPage(props: PageProps) {
  if (props.searchParams) use(props.searchParams);
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [companyName, setCompanyName] = useState("");
  const [subCompanyName, setSubCompanyName] = useState("MAIN");
  const [seasonName, setSeasonName] = useState(
    `${new Date().getFullYear()} A`
  );
  const [loading, setLoading] = useState(true);

  // Step 1 state
  const [setupRunning, setSetupRunning] = useState(false);
  const [verifyRunning, setVerifyRunning] = useState(false);
  const [setupResult, setSetupResult] = useState<CompanySetupResult | null>(
    null
  );

  // Step 2 state
  const [migrationRunning, setMigrationRunning] = useState(false);
  const [migrationResult, setMigrationResult] =
    useState<MigrationResult | null>(null);
  const [migrationProgress, setMigrationProgress] = useState({
    pct: 0,
    current: "",
    done: 0,
    total: 0,
  });
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(
    () => new Set(MIGRATABLE_COLLECTIONS.map((c) => c.id))
  );

  useEffect(() => {
    let cancelled = false;
    const fallback = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 1500);

    getRtgsSettings()
      .then((settings) => {
        if (!cancelled && settings?.companyName) {
          setCompanyName((prev) => prev || settings.companyName);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          clearTimeout(fallback);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, []);

  const handleStep1CreateCompany = async () => {
    if (!companyName.trim() || !subCompanyName.trim() || !seasonName.trim()) {
      toast({
        title: "Missing details",
        description:
          "Please enter Company Name, Sub Company and Season before creating.",
        variant: "destructive",
      });
      return;
    }

    setSetupRunning(true);
    setSetupResult(null);

    const TIMEOUT_MS = 300_000; // 5 min — REST retries on 429 with backoff (8s, 20s, 45s, 90s) and 5s between docs
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              "Request timed out. Check Firebase Console → Firestore → companies, or try \"Verify if already created\"."
            )
          ),
        TIMEOUT_MS
      );
    });

    try {
      const opts = {
        companyName: companyName.trim(),
        subCompanyName: subCompanyName.trim(),
        seasonName: seasonName.trim(),
      };
      let result: CompanySetupResult;

      const auth = getFirebaseAuth();
      const user = auth?.currentUser;
      if (user) {
        const idToken = await user.getIdToken();
        result = await Promise.race([
          setupCompanyStructureViaRest(idToken, opts),
          timeoutPromise,
        ]);
      } else {
        result = await Promise.race([
          fetch("/api/erp-migration/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(opts),
          }).then(async (res) => {
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data?.error || res.statusText || "Setup failed");
            }
            return res.json();
          }),
          timeoutPromise,
        ]);
      }
      setSetupResult(result);
      toast({
        title: "Company created",
        description: `${companyName} → ${subCompanyName} → ${seasonName} structure is ready.`,
        variant: "success",
      });
    } catch (error: unknown) {
      let msg = error instanceof Error ? error.message : "Could not create company.";
      const isQuota =
        msg.includes("429") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("Quota exceeded") ||
        msg.includes("Too Many Requests");
      if (isQuota) {
        msg =
          "Firestore quota exceeded. Wait a few minutes, then try \"Verify if already created\" — the structure may have been created before the error.";
      }
      console.error("[ERP Migration] Company setup failed:", error);
      toast({
        title: "Company setup failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSetupRunning(false);
    }
  };

  const handleVerifyExisting = async () => {
    if (!companyName.trim() || !subCompanyName.trim() || !seasonName.trim()) {
      toast({
        title: "Missing details",
        description: "Enter Company, Sub Company and Season to verify.",
        variant: "destructive",
      });
      return;
    }
    setVerifyRunning(true);
    try {
      const result = await checkCompanyStructureExists({
        companyName: companyName.trim(),
        subCompanyName: subCompanyName.trim(),
        seasonName: seasonName.trim(),
      });
      if (result) {
        setSetupResult(result);
        toast({
          title: "Structure found",
          description: "Company structure already exists in Firestore. You can proceed to Step 2.",
          variant: "success",
        });
      } else {
        toast({
          title: "Not found",
          description: "No matching structure in Firestore. Create it first or check names.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Verify failed",
        description: e instanceof Error ? e.message : "Could not verify.",
        variant: "destructive",
      });
    } finally {
      setVerifyRunning(false);
    }
  };

  const handleProceedToStep2 = () => {
    setStep(2);
    setMigrationResult(null);
    setMigrationProgress({ pct: 0, current: "", done: 0, total: 0 });
  };

  const toggleCollection = (id: string) => {
    setSelectedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllCollections = () => {
    setSelectedCollections(new Set(MIGRATABLE_COLLECTIONS.map((c) => c.id)));
  };

  const deselectAllCollections = () => {
    setSelectedCollections(new Set());
  };

  const handleStep2MigrateData = async () => {
    if (!companyName.trim() || !subCompanyName.trim() || !seasonName.trim()) {
      toast({
        title: "Missing details",
        description: "Company setup is required first.",
        variant: "destructive",
      });
      return;
    }

    setMigrationRunning(true);
    setMigrationResult(null);
    setMigrationProgress({ pct: 0, current: "Starting…", done: 0, total: 30 });

    try {
      const result = await migrateDataToSeason(
        {
          companyName: companyName.trim(),
          subCompanyName: subCompanyName.trim(),
          seasonName: seasonName.trim(),
        },
        (pct, current, done, total) => {
          setMigrationProgress({ pct, current, done, total });
        },
        setupResult,
        selectedCollections.size > 0 ? Array.from(selectedCollections) : undefined
      );
      setMigrationResult(result);
      toast({
        title: "Migration complete",
        description: `Migrated ${result.totalMigrated} records to ${seasonName}.`,
        variant: "success",
      });
    } catch (error: unknown) {
      toast({
        title: "Migration failed",
        description:
          error instanceof Error ? error.message : "Could not migrate data.",
        variant: "destructive",
      });
    } finally {
      setMigrationRunning(false);
    }
  };

  const handleBackToStep1 = () => {
    setStep(1);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ERP Data Migration</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            step === 1 ? "bg-primary text-primary-foreground" : "bg-muted"
          }`}
        >
          {setupResult ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <span className="w-5 h-5 rounded-full bg-current/30 flex items-center justify-center text-xs">
              1
            </span>
          )}
          Step 1: Company Setup
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            step === 2 ? "bg-primary text-primary-foreground" : "bg-muted"
          }`}
        >
          {migrationResult ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <span className="w-5 h-5 rounded-full bg-current/30 flex items-center justify-center text-xs">
              2
            </span>
          )}
          Step 2: Data Migration
        </div>
      </div>

      {/* Step 1: Company Setup */}
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Company Setup</CardTitle>
          <CardDescription>
            Create Company → Sub Company → Season structure. Data migration will
            happen in Step 2.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. JRMD Agro"
                disabled={!!setupResult}
              />
            </div>
            <div className="space-y-2">
              <Label>Sub Company</Label>
              <Input
                value={subCompanyName}
                onChange={(e) => setSubCompanyName(e.target.value)}
                placeholder="e.g. MAIN BRANCH"
                disabled={!!setupResult}
              />
            </div>
            <div className="space-y-2">
              <Label>Season / Year Label</Label>
              <Input
                value={seasonName}
                onChange={(e) => setSeasonName(e.target.value)}
                placeholder="e.g. 2024 A"
                disabled={!!setupResult}
              />
            </div>
          </div>

          {setupResult && (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Company structure created</p>
                <p className="text-sm opacity-90">
                  {companyName} → {subCompanyName} → {seasonName}
                </p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2 items-start">
          {!setupResult ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={handleStep1CreateCompany}
                  disabled={setupRunning || verifyRunning}
                >
                  {setupRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Company Structure
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleVerifyExisting}
                  disabled={setupRunning || verifyRunning}
                >
                  {verifyRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify if already created
                </Button>
              </div>
              {setupRunning && (
                <p className="text-xs text-muted-foreground">
                  First-time write can take 1–2 minutes. If it times out, check Firestore → companies; if the doc exists, click &quot;Verify if already created&quot;.
                </p>
              )}
            </>
          ) : (
            <Button type="button" onClick={handleProceedToStep2}>
              Proceed to Step 2: Data Migration
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Step 2: Data Migration - only prominent when step 2 */}
      <Card className={step === 2 ? "" : "opacity-75"}>
        <CardHeader>
          <CardTitle>Step 2: Data Migration</CardTitle>
          <CardDescription>
            Copy existing data into the new structure. Original data is not
            deleted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!setupResult ? (
            <p className="text-sm text-muted-foreground">
              Complete Step 1 first to enable data migration.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-base">Select collections to migrate</Label>
                <p className="text-sm text-muted-foreground">
                  Choose which data to copy. Original data is not deleted.
                </p>
                <div className="flex gap-2 mb-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllCollections}
                    disabled={migrationRunning}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={deselectAllCollections}
                    disabled={migrationRunning}
                  >
                    Deselect All
                  </Button>
                </div>
                <ScrollArea className="h-48 rounded-md border p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {MIGRATABLE_COLLECTIONS.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
                      >
                        <Checkbox
                          checked={selectedCollections.has(c.id)}
                          onCheckedChange={() => toggleCollection(c.id)}
                          disabled={migrationRunning}
                        />
                        <span className="text-sm">{c.label}</span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
                <p className="text-xs text-muted-foreground">
                  {selectedCollections.size} of {MIGRATABLE_COLLECTIONS.length} selected
                </p>
              </div>
              {migrationRunning && (
                <div className="space-y-2">
                  <Progress
                    value={migrationProgress.pct}
                    className="h-3 transition-all duration-300"
                  />
                  <p className="text-sm text-muted-foreground">
                    Migrating {migrationProgress.current} (
                    {migrationProgress.done}/{migrationProgress.total} collections)
                    … please keep this tab open.
                  </p>
                </div>
              )}
              {migrationResult && !migrationRunning && (
                <div className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-medium">Migration complete</p>
                    <p className="text-sm opacity-90">
                      Migrated {migrationResult.totalMigrated} records to{" "}
                      {seasonName}.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          {step === 2 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleBackToStep1}
              disabled={migrationRunning}
            >
              Back to Step 1
            </Button>
          )}
          <Button
            type="button"
            onClick={handleStep2MigrateData}
            disabled={!setupResult || migrationRunning || selectedCollections.size === 0}
          >
            {migrationRunning && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Migrate Existing Data
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
