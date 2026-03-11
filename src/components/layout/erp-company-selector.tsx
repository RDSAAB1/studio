"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Building2, Layers, FileText, Plus, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listErpCompanies, addErpSubCompany, addErpSeason } from "@/lib/erp-migration";
import { useErpSelection, loadStoredErpSelection } from "@/contexts/erp-selection-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { TenantSummary } from "@/lib/tenancy";
import { getCompanyMemberRole } from "@/lib/tenancy";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ErpCompany = {
  id: string;
  name: string;
  subCompanies: { id: string; name: string; seasons: { key: string; name: string }[] }[];
};

type ErpCompanySelectorProps = {
  hasErpCompanies: boolean;
  tenants?: TenantSummary[];
  activeTenant?: { id: string; storageMode: string; name?: string } | null;
  onActivateTenant?: (t: TenantSummary) => void;
  onOpenTenantDialog?: (mode: "create" | "join") => void;
  onGenerateJoinCode?: (companyId?: string) => Promise<void>;
  /** When true, hide Company dropdown - only show Sub Company and Season */
  hideCompanySelector?: boolean;
};

export function ErpCompanySelector({
  hasErpCompanies,
  tenants = [],
  activeTenant = null,
  onActivateTenant,
  onOpenTenantDialog,
  onGenerateJoinCode,
  hideCompanySelector = false,
}: ErpCompanySelectorProps) {
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
  const [companyRole, setCompanyRole] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmShownRef = React.useRef(false);

  const refreshCompanies = () =>
    listErpCompanies().then(setCompanies).catch(() => setCompanies([]));

  useEffect(() => {
    refreshCompanies();
    setLoading(false);
  }, []);

  // Validate selection: user should only see their companies' data. If selection is invalid, fix it.
  // Prefer restored selection from localStorage so refresh keeps company/sub/season.
  const validatedRef = React.useRef(false);
  useEffect(() => {
    if (companies.length === 0) return;
    if (validatedRef.current) return;
    const isValid = selection && companies.some((c) => c.id === selection.companyId);
    if (!isValid) {
      // Prefer localStorage so refresh keeps company/sub/season (context may not have restored yet).
      const stored = loadStoredErpSelection();
      const company = stored ? companies.find((c) => c.id === stored.companyId) : null;
      const sub = company?.subCompanies.find((s) => s.id === stored!.subCompanyId);
      const seasonKey = sub?.seasons.some((s) => s.key === stored!.seasonKey) ? stored!.seasonKey : sub?.seasons[0]?.key;
      if (company && sub && seasonKey) {
        void setSelection({ companyId: company.id, subCompanyId: sub.id, seasonKey }, { skipReload: true });
        return; // do not set validatedRef so effect can run again if needed
      }
      validatedRef.current = true;
      const first = companies[0];
      const subWithSeason = first?.subCompanies.find((s) => s.seasons.length > 0);
      const subFallback = subWithSeason ?? first?.subCompanies[0];
      const seasonFallback = subFallback?.seasons[0];
      if (first && subFallback && seasonFallback) {
        void setSelection({ companyId: first.id, subCompanyId: subFallback.id, seasonKey: seasonFallback.key }, { skipReload: true });
      }
    }
  }, [companies, selection, setSelection]);

  useEffect(() => {
    const cid = selection?.companyId ?? uiCompanyId;
    if (!cid) {
      setCompanyRole(null);
      return;
    }
    getCompanyMemberRole(cid).then(setCompanyRole);
  }, [selection?.companyId, uiCompanyId]);

  const companyId = selection?.companyId ?? uiCompanyId;
  const subCompanyId = selection?.subCompanyId ?? uiSubCompanyId;
  const selectedCompany = companyId ? companies.find((c) => c.id === companyId) : null;
  const selectedSubCompany = selectedCompany?.subCompanies.find((s) => s.id === subCompanyId);
  const selectedSeason = selectedSubCompany?.seasons.find((s) => s.key === selection?.seasonKey);

  // After each refresh / first valid selection, show a small confirmation window
  // so user consciously continues with the current sub company + season.
  useEffect(() => {
    if (
      !confirmShownRef.current &&
      hasErpCompanies &&
      selectedCompany &&
      selectedSubCompany &&
      selectedSeason
    ) {
      confirmShownRef.current = true;
      setConfirmOpen(true);
    }
  }, [hasErpCompanies, selectedCompany, selectedSubCompany, selectedSeason]);

  const handleCompanySelect = (c: ErpCompany) => {
    const subWithSeason = c.subCompanies.find((s) => s.seasons.length > 0);
    const sub = subWithSeason ?? c.subCompanies[0];
    const season = sub?.seasons[0];
    if (sub && season) {
      void setSelection({ companyId: c.id, subCompanyId: sub.id, seasonKey: season.key }, { skipReload: true });
    } else {
      setUiCompanyId(c.id);
      setUiSubCompanyId(sub?.id ?? null);
      setSelection(null, { skipReload: true }); // No reload - show overlay for Add Sub/Season
    }
  };

  const handleSubCompanySelect = (s: ErpCompany["subCompanies"][0], companyId: string) => {
    const season = s.seasons[0];
    if (season) {
      void setSelection({ companyId, subCompanyId: s.id, seasonKey: season.key }, { skipReload: true });
    } else {
      setUiCompanyId(companyId);
      setUiSubCompanyId(s.id);
      setSelection(null, { skipReload: true }); // No reload - show overlay for Add Season
    }
  };

  const handleSeasonSelect = (s: { key: string; name: string }, companyId: string, subCompanyId: string) => {
    void setSelection({ companyId, subCompanyId, seasonKey: s.key }, { skipReload: true });
  };

  const handleAddSubCompany = async () => {
    if (!selectedCompany || !newSubName.trim()) return;
    setAdding(true);
    try {
      const subId = await addErpSubCompany(selectedCompany.id, selectedCompany.name, newSubName.trim());
      toast({ title: "Sub company added", variant: "success" });
      setNewSubName("");
      setAddSubOpen(false);
      await refreshCompanies();
      setUiCompanyId(selectedCompany.id);
      setUiSubCompanyId(subId);
      setSelection(null, { skipReload: true }); // Show overlay for Add Season
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
      refreshCompanies();
      setSelection(
        { companyId: selectedCompany.id, subCompanyId: selectedSubCompany.id, seasonKey },
        { skipReload: true }
      );
    } catch (e) {
      toast({ title: "Failed to add", description: String(e), variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleClear = () => {
    setUiCompanyId(null);
    setUiSubCompanyId(null);
    setSelection(null, { skipReload: true });
  };

  const companyLabel = hasErpCompanies
    ? (selectedCompany?.name ?? "Select Company")
    : (activeTenant?.name ?? "Company");
  const subCompanyLabel = selectedSubCompany?.name ?? "Sub Company";
  const seasonLabel = selectedSeason?.name ?? "Season";

  const dropdownClass = "h-9 w-9 text-white/90 hover:bg-white/10 hover:text-white";
  const disabledClass = "h-9 w-9 text-white/40 cursor-not-allowed";

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-2">
        {!hideCompanySelector && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={dropdownClass}
                  >
                    <Building2 className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {companyLabel}
              </TooltipContent>
            </Tooltip>
          <DropdownMenuContent align="end" className="min-w-56 rounded-lg border border-violet-900/30 bg-violet-950/95 text-white">
            <DropdownMenuLabel>Company</DropdownMenuLabel>
            {hasErpCompanies ? (
              <>
                {companies.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    className="cursor-pointer focus:bg-white/10"
                    onClick={() => handleCompanySelect(c)}
                  >
                    {c.name}
                  </DropdownMenuItem>
                ))}
                {selectedCompany && (companyRole === "owner" || companyRole === "admin") && onGenerateJoinCode && (
                  <>
                    <DropdownMenuItem
                      className="cursor-pointer focus:bg-white/10"
                      onClick={() => void onGenerateJoinCode(selectedCompany.id)}
                    >
                      Generate join code (copied)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer focus:bg-white/10"
                      onClick={() => onOpenTenantDialog?.("join")}
                    >
                      Join by code
                    </DropdownMenuItem>
                  </>
                )}
                {selectedCompany && onOpenTenantDialog && (
                  <DropdownMenuItem className="cursor-pointer focus:bg-white/10" onClick={() => onOpenTenantDialog("create")}>
                    Create new company
                  </DropdownMenuItem>
                )}
              </>
            ) : (
              <>
                {tenants.map((t) => {
                  const isActive = t.id === activeTenant?.id && t.storageMode === activeTenant?.storageMode;
                  return (
                    <DropdownMenuItem
                      key={`${t.storageMode}:${t.id}`}
                      className={cn("cursor-pointer focus:bg-white/10", isActive && "bg-white/10")}
                      onClick={() => {
                        if (isActive) return;
                        void onActivateTenant?.(t);
                      }}
                    >
                      {t.name}
                    </DropdownMenuItem>
                  );
                })}
                {onOpenTenantDialog && (
                  <DropdownMenuItem className="cursor-pointer focus:bg-white/10" onClick={() => onOpenTenantDialog("create")}>
                    Create new company
                  </DropdownMenuItem>
                )}
                {onGenerateJoinCode && (
                  <DropdownMenuItem className="cursor-pointer focus:bg-white/10" onClick={() => void onGenerateJoinCode()}>
                    Generate join code (copied)
                  </DropdownMenuItem>
                )}
                {onOpenTenantDialog && (
                  <DropdownMenuItem className="cursor-pointer focus:bg-white/10" onClick={() => onOpenTenantDialog("join")}>
                    Join by code
                  </DropdownMenuItem>
                )}
              </>
            )}
        </DropdownMenuContent>
        </DropdownMenu>
        )}

      {/* Sub company & Season: header/sub-header on left, both icons on their right */}
      <div className="flex flex-row items-center gap-2">
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] font-semibold text-white/95 truncate max-w-[140px] sm:max-w-[180px]" title={subCompanyLabel}>
            {subCompanyLabel}
          </span>
          <span className="text-[10px] font-medium text-white/75 truncate max-w-[140px] sm:max-w-[180px]" title={seasonLabel}>
            {seasonLabel}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={hasErpCompanies && selectedCompany ? dropdownClass : disabledClass}
                    disabled={!hasErpCompanies || !selectedCompany}
                  >
                    <Layers className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {subCompanyLabel}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="min-w-56 rounded-lg border border-violet-900/30 bg-violet-950/95 text-white">
              <DropdownMenuLabel>Sub Company</DropdownMenuLabel>
              {hasErpCompanies && selectedCompany ? (
                <>
                  {selectedCompany.subCompanies.map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      className="cursor-pointer focus:bg-white/10"
                      onClick={() => handleSubCompanySelect(s, selectedCompany.id)}
                    >
                      {s.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem
                    className="cursor-pointer focus:bg-white/10 text-white/80"
                    onSelect={(e) => {
                      e.preventDefault();
                      setAddSubOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add new sub company
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem disabled>Select company first</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={hasErpCompanies && selectedCompany && selectedSubCompany ? dropdownClass : disabledClass}
                    disabled={!hasErpCompanies || !selectedCompany || !selectedSubCompany}
                  >
                    <FileText className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {seasonLabel}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="min-w-56 rounded-lg border border-violet-900/30 bg-violet-950/95 text-white">
              <DropdownMenuLabel>Season</DropdownMenuLabel>
              {hasErpCompanies && selectedCompany && selectedSubCompany ? (
                <>
                  {selectedSubCompany.seasons.map((s) => (
                    <DropdownMenuItem
                      key={s.key}
                      className="cursor-pointer focus:bg-white/10"
                      onClick={() => handleSeasonSelect(s, selectedCompany.id, selectedSubCompany.id)}
                    >
                      {s.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem
                    className="cursor-pointer focus:bg-white/10 text-white/80"
                    onSelect={(e) => {
                      e.preventDefault();
                      setAddSeasonOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add new season
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem disabled>Select sub company first</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Per-refresh confirmation window: confirm / change active sub company + season */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 border-0 shadow-none bg-transparent overflow-visible">
          <div
            className="rounded-xl text-slate-900 shadow-[0_16px_48px_rgba(15,23,42,0.14),0_32px_80px_rgba(15,23,42,0.12)] overflow-hidden"
            style={{ backgroundColor: '#f1f5f9' }}
          >
            {/* Header strip - space for close (X) button */}
            <div className="px-5 pt-10 pr-12 pb-1">
              <DialogHeader className="p-0">
                <DialogTitle className="text-[13px] font-semibold tracking-tight text-slate-800">
                  Confirm Sub Company & Season
                </DialogTitle>
              </DialogHeader>
            </div>

            <div className="px-5 pb-5 space-y-5 text-[11px]">
              {/* Current selection - card with primary accent */}
              <div className="space-y-2.5">
                <p className="text-slate-600 font-medium text-[11px]">
                  Aap iss sub company aur season par kaam kar rahe hain:
                </p>
                <div className="rounded-lg border-l-4 border-l-primary/80 bg-white border border-slate-200/80 px-3.5 py-3 shadow-[0_1px_4px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center justify-between gap-3 py-0.5">
                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Sub Company</span>
                    <span className="text-[11px] font-semibold truncate max-w-[180px] text-slate-800" title={subCompanyLabel}>
                      {subCompanyLabel}
                    </span>
                  </div>
                  <div className="h-px bg-slate-100 my-1.5" />
                  <div className="flex items-center justify-between gap-3 py-0.5">
                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Season</span>
                    <span className="text-[11px] font-semibold truncate max-w-[180px] text-primary" title={seasonLabel}>
                      {seasonLabel}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Please confirm before entries karein, taki galti se dusri season ya sub company mein data na chale jaye.
                </p>
              </div>

              {/* Change selection - grouped controls */}
              {hasErpCompanies && selectedCompany && (
                <div className="space-y-3 pt-1">
                  <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                    Change selection
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-medium text-slate-600 block">Sub Company</label>
                      <Select
                        value={selectedSubCompany?.id ?? undefined}
                        onValueChange={(value) => {
                          const next = selectedCompany.subCompanies.find((s) => s.id === value);
                          if (next) handleSubCompanySelect(next, selectedCompany.id);
                        }}
                      >
                        <SelectTrigger className="h-9 text-[11px] rounded-md bg-white border-slate-200 text-slate-800 hover:bg-slate-50/80 focus:ring-2 focus:ring-primary/25 focus:border-primary/30">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent className="text-[11px]">
                          {selectedCompany.subCompanies.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-medium text-slate-600 block">Season</label>
                      <Select
                        value={selection?.seasonKey ?? undefined}
                        onValueChange={(value) => {
                          if (!selectedSubCompany) return;
                          const next = selectedSubCompany.seasons.find((s) => s.key === value);
                          if (next) handleSeasonSelect(next, selectedCompany.id, selectedSubCompany.id);
                        }}
                        disabled={!selectedSubCompany}
                      >
                        <SelectTrigger className="h-9 text-[11px] rounded-md bg-white border-slate-200 text-slate-800 hover:bg-slate-50/80 disabled:opacity-60 focus:ring-2 focus:ring-primary/25 focus:border-primary/30">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent className="text-[11px]">
                          {selectedSubCompany?.seasons.map((s) => (
                            <SelectItem key={s.key} value={s.key}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer - clear separation, balanced buttons */}
            <div className="px-5 pb-5 pt-1 border-t border-slate-200/80 bg-slate-50/50">
              <div className="flex items-center justify-end gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-[2px] border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300"
                  onClick={() => setConfirmOpen(false)}
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  className="h-8 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                  onClick={() => setConfirmOpen(false)}
                >
                  Continue with this
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {!hideCompanySelector && hasErpCompanies && (selection || companyId) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
              onClick={handleClear}
            >
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Clear selection
          </TooltipContent>
        </Tooltip>
      )}

      <Dialog open={addSubOpen} onOpenChange={setAddSubOpen}>
        <DialogContent className="bg-violet-950/95 border-violet-900/30 text-white">
          <DialogHeader>
            <DialogTitle>Add Sub Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Sub Company Name</Label>
            <Input
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              placeholder="e.g. JRM"
              className="bg-white/5 border-white/20"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddSubOpen(false)} disabled={adding}>Cancel</Button>
            <Button type="button" onClick={handleAddSubCompany} disabled={adding || !newSubName.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addSeasonOpen} onOpenChange={setAddSeasonOpen}>
        <DialogContent className="bg-violet-950/95 border-violet-900/30 text-white">
          <DialogHeader>
            <DialogTitle>Add Season</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Season Name</Label>
            <Input
              value={newSeasonName}
              onChange={(e) => setNewSeasonName(e.target.value)}
              placeholder="e.g. 2026 A"
              className="bg-white/5 border-white/20"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddSeasonOpen(false)} disabled={adding}>Cancel</Button>
            <Button type="button" onClick={handleAddSeason} disabled={adding || !newSeasonName.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Overlay: Company selected but no sub/season - block root data, show setup options */}
      {hasErpCompanies && selectedCompany && !selection && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm">
          <div className="max-w-md mx-4 p-6 rounded-xl border border-violet-900/30 bg-violet-950/95 text-white shadow-2xl text-center space-y-4">
            <Building2 className="h-12 w-12 text-violet-400 mx-auto" />
            <h2 className="text-xl font-semibold">Setup Required</h2>
            <p className="text-white/80 text-sm">
              {selectedCompany.name} has no sub-company or season yet. Add them to start fresh.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              {!selectedSubCompany ? (
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setAddSubOpen(true);
                  }}
                  disabled={adding}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Sub Company
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setAddSeasonOpen(true);
                  }}
                  disabled={adding}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Season
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
