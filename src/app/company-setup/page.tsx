"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { electronNavigate } from "@/lib/electron-navigate";
import { useErpSelection } from "@/contexts/erp-selection-context";
import { listErpCompanies, addErpSubCompany, addErpSeason } from "@/lib/erp-migration";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Building, Plus, Layers, CalendarDays, ArrowRight } from "lucide-react";

type ErpCompany = {
  id: string;
  name: string;
  subCompanies: { id: string; name: string; seasons: { key: string; name: string }[] }[];
};

export default function CompanySetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = searchParams.get("new") === "1";
  const fromLogin = searchParams.get("login") === "1";
  const { selection, setSelection } = useErpSelection();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<ErpCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [addSubOpen, setAddSubOpen] = useState(false);
  const [addSeasonOpen, setAddSeasonOpen] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [newSeasonName, setNewSeasonName] = useState("");
  const [adding, setAdding] = useState(false);
  const [uiCompanyId, setUiCompanyId] = useState<string | null>(null);
  const [uiSubCompanyId, setUiSubCompanyId] = useState<string | null>(null);

  const refreshCompanies = () =>
    listErpCompanies().then(setCompanies).catch(() => setCompanies([]));

  useEffect(() => {
    refreshCompanies().finally(() => setLoading(false));
  }, []);

  const companyId = selection?.companyId ?? uiCompanyId;
  const subCompanyId = selection?.subCompanyId ?? uiSubCompanyId;
  const selectedCompany = companyId ? companies.find((c) => c.id === companyId) : companies[0];
  const selectedSubCompany = selectedCompany?.subCompanies.find((s) => s.id === subCompanyId);
  const selectedSeason = selectedSubCompany?.seasons.find(
    (s) => s.key === selection?.seasonKey
  );

  const handleAddSubCompany = async () => {
    if (!selectedCompany || !newSubName.trim()) return;
    setAdding(true);
    try {
      const subId = await addErpSubCompany(
        selectedCompany.id,
        selectedCompany.name,
        newSubName.trim()
      );
      toast({ title: "Sub company added", variant: "success" });
      setNewSubName("");
      setAddSubOpen(false);
      await refreshCompanies();
      setUiCompanyId(selectedCompany.id);
      setUiSubCompanyId(subId);
      setSelection(null, { skipReload: true });
    } catch (e) {
      toast({ title: "Failed to add", description: String(e), variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleAddSeason = async () => {
    if (!selectedCompany || !selectedSubCompany || !newSeasonName.trim()) return;
    setAdding(true);
    try {
      const seasonKey = await addErpSeason(
        selectedCompany.id,
        selectedSubCompany.id,
        selectedCompany.name,
        selectedSubCompany.name,
        newSeasonName.trim()
      );
      toast({ title: "Season added", variant: "success" });
      setNewSeasonName("");
      setAddSeasonOpen(false);
      await refreshCompanies();
      setSelection(
        {
          companyId: selectedCompany.id,
          subCompanyId: selectedSubCompany.id,
          seasonKey,
        },
        { skipReload: true }
      );
    } catch (e) {
      toast({ title: "Failed to add", description: String(e), variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleContinue = () => {
    electronNavigate("/", router, { method: "push" });
  };

  if (loading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">
                {isNew ? "Company Created Successfully" : fromLogin ? "Setup Required" : "Company Setup"}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isNew
                  ? "Ab aap Sub Company aur Season add kar sakte hain, ya seedha dashboard par ja sakte hain."
                  : fromLogin
                    ? "Aapki company mein Sub Company ya Season nahi hai. Pehle create karein, phir Continue par click karein."
                    : "Sub Company aur Season manage karein."}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {selectedCompany && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Company</span>
                <span className="font-semibold">{selectedCompany.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Sub Company</span>
                <span className="font-semibold">
                  {selectedSubCompany?.name ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Season</span>
                <span className="font-semibold">{selectedSeason?.name ?? "—"}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setAddSubOpen(true);
              }}
              disabled={!selectedCompany}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Sub Company
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setAddSeasonOpen(true);
              }}
              disabled={!selectedCompany || !selectedSubCompany}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Season
            </Button>
          </div>

          <Button type="button" className="w-full" size="lg" onClick={handleContinue}>
            <ArrowRight className="h-4 w-4 mr-2" />
            Continue to Dashboard
          </Button>
        </CardContent>
      </Card>

      <Dialog open={addSubOpen} onOpenChange={setAddSubOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Sub Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Sub Company Name</Label>
            <Input
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              placeholder="e.g. JRM, Branch 1"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddSubOpen(false)} disabled={adding}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddSubCompany} disabled={adding || !newSubName.trim()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addSeasonOpen} onOpenChange={setAddSeasonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Season</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Season Name</Label>
            <Input
              value={newSeasonName}
              onChange={(e) => setNewSeasonName(e.target.value)}
              placeholder="e.g. 2026, 2026 A"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddSeasonOpen(false)} disabled={adding}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddSeason} disabled={adding || !newSeasonName.trim()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
