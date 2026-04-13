"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Building2, Layers, FileText, Plus, X, HardDrive, Loader2, Database } from "lucide-react";
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
import { clearAllLocalData } from "@/lib/database";
import { pushLocalChanges, performFullSync } from "@/lib/d1-sync";

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
  const folderDialogOpen = false;
  const setFolderDialogOpen = () => {};
  const folderDialogShownRef = React.useRef(false);
  const localFolderPath: string | null = null;
  const setLocalFolderPathState = () => {};
  const isEnablingLocal = false;
  const setIsEnablingLocal = () => {};
  const localCompanies: ErpCompany[] = [];
  const setLocalCompanies = () => {};

  // SQLite-only: legacy local-folder helpers become no-ops
  const saveLocalSelectionToFolder = async () => {};
  const loadFromFolderToDexie = async () => ({ success: false as const, loaded: 0, error: "disabled" });
  const ensureLocalMetaStructure = async () => {};
  const initFolderWatcher = async () => {};
  const setLocalFolderPath = () => {};

  const refreshCompanies = () =>
    listErpCompanies().then(setCompanies).catch(() => setCompanies([]));

  useEffect(() => {
    refreshCompanies();
    setLoading(false);
  }, []);

  // SQLite-only: local folder mode disabled (state setters are no-ops)

  const effectiveCompanies = companies;

  // Validate selection: user should only see their companies' data. If selection is invalid, fix it.
  // Prefer restored selection from localStorage so refresh keeps company/sub/season.
  const validatedRef = React.useRef(false);
  useEffect(() => {
    if (effectiveCompanies.length === 0) return;
    if (validatedRef.current) return;
    const isValid = selection && effectiveCompanies.some((c) => c.id === selection.companyId);
    if (!isValid) {
      // Prefer localStorage so refresh keeps company/sub/season (context may not have restored yet).
      const stored = loadStoredErpSelection();
      const company = stored ? effectiveCompanies.find((c) => c.id === stored.companyId) : null;
      const sub = company?.subCompanies.find((s) => s.id === stored!.subCompanyId);
      const seasonKey = sub?.seasons.some((s) => s.key === stored!.seasonKey) ? stored!.seasonKey : sub?.seasons[0]?.key;
      if (company && sub && seasonKey) {
        void setSelection({ companyId: company.id, subCompanyId: sub.id, seasonKey }, { skipReload: true });
        return; // do not set validatedRef so effect can run again if needed
      }
      validatedRef.current = true;
      const first = effectiveCompanies[0];
      const subWithSeason = first?.subCompanies.find((s) => s.seasons.length > 0);
      const subFallback = subWithSeason ?? first?.subCompanies[0];
      const seasonFallback = subFallback?.seasons[0];
      if (first && subFallback && seasonFallback) {
        void setSelection({ companyId: first.id, subCompanyId: subFallback.id, seasonKey: seasonFallback.key }, { skipReload: true });
      }
    }
  }, [effectiveCompanies, selection, setSelection]);

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
  const selectedCompany = companyId ? effectiveCompanies.find((c) => c.id === companyId) : null;
  const selectedSubCompany = selectedCompany?.subCompanies.find((s) => s.id === subCompanyId);
  const selectedSeason = selectedSubCompany?.seasons.find((s) => s.key === selection?.seasonKey);
  const hasEffectiveCompanies = hasErpCompanies;

  // SQLite-only app: disable legacy Excel/local-folder dialog on refresh.
  useEffect(() => {
    // no-op (kept to preserve hook order in file history)
  }, []);

  // Removed auto-confirmation dialog logic for a smoother experience
  useEffect(() => {
    // Popup logic disabled
  }, []);

  const handleCompanySelect = async (c: ErpCompany) => {
    const subWithSeason = c.subCompanies.find((s) => s.seasons.length > 0);
    const sub = subWithSeason ?? c.subCompanies[0];
    const season = sub?.seasons[0];
    if (sub && season) {
      const sel = { companyId: c.id, subCompanyId: sub.id, seasonKey: season.key };
      // Perform clean context switch
      setLoading(true);
      try {
        await pushLocalChanges();
        await setSelection(sel, { skipReload: true });
        await performFullSync('all', true);
        toast({ title: `Switched to ${c.name}`, description: "Data synced for new context." });
      } catch (e) {
        toast({ title: "Sync failed", description: String(e), variant: "destructive" });
        await setSelection(sel, { skipReload: true });
      } finally {
        setLoading(false);
      }
    } else {
      setUiCompanyId(c.id);
      setUiSubCompanyId(sub?.id ?? null);
      setSelection(null, { skipReload: true }); // No reload - show overlay for Add Sub/Season
    }
  };

  const handleSubCompanySelect = async (s: ErpCompany["subCompanies"][0], companyId: string) => {
    const season = s.seasons[0];
    if (season) {
      const sel = { companyId, subCompanyId: s.id, seasonKey: season.key };
      // Perform clean context switch
      setLoading(true);
      try {
        await pushLocalChanges();
        await setSelection(sel, { skipReload: true });
        await performFullSync('all', true);
        toast({ title: `Switched to ${s.name}`, description: "Data synced for new unit." });
      } catch (e) {
        toast({ title: "Sync failed", description: String(e), variant: "destructive" });
        await setSelection(sel, { skipReload: true });
      } finally {
        setLoading(false);
      }
    } else {
      setUiCompanyId(companyId);
      setUiSubCompanyId(s.id);
      setSelection(null, { skipReload: true }); // No reload - show overlay for Add Season
    }
  };

  const handleSeasonSelect = async (s: { key: string; name: string }, companyId: string, subCompanyId: string) => {
    const sel = { companyId, subCompanyId, seasonKey: s.key };
    // Perform clean context switch
    setLoading(true);
    try {
      await pushLocalChanges();
      await setSelection(sel, { skipReload: true });
      await performFullSync('all', true);
      toast({ title: `Switched to ${s.name}`, description: "Data synced for new season." });
    } catch (e) {
      toast({ title: "Sync failed", description: String(e), variant: "destructive" });
      await setSelection(sel, { skipReload: true });
    } finally {
      setLoading(false);
    }
  };

  const handleUseFolderAsDataSource = async () => {
    toast({
      title: "SQLite only",
      description: "Excel/Folder mode disabled. Settings → Data Settings me SQLite folder select karein.",
    });
  };

  const handleSwitchToFirestore = () => {
    toast({ title: "SQLite only", description: "Firestore data mode disabled." });
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
      // Even if we don't have a season yet, we might want to clear old data
      // REMOVED: await clearAllLocalData('UNIT');
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
      const sel = { companyId: selectedCompany.id, subCompanyId: selectedSubCompany.id, seasonKey };
      // REMOVED: await clearAllLocalData('SEASON');
      await setSelection(sel, { skipReload: true });
      await performFullSync('all', true);
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

  const companyLabel = hasEffectiveCompanies
    ? (selectedCompany?.name ?? selection?.companyId ?? "Select Company")
    : (activeTenant?.name ?? "Company");
  const subCompanyLabel = selectedSubCompany?.name ?? selection?.subCompanyId ?? "Sub Company";
  const seasonLabel = selectedSeason?.name ?? selection?.seasonKey ?? "Season";

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
            {hasEffectiveCompanies ? (
              <>
                {effectiveCompanies.map((c) => (
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

      {/* Sub company & Season & Folder: header on left, icons on right */}
      <div className="flex flex-row items-center gap-2">
        <div className="flex flex-col leading-tight">
          {subCompanyLabel && !['MAIN', 'main', 'default'].includes(subCompanyLabel) && (
            <span className="text-[11px] font-semibold text-white/95 truncate max-w-[140px] sm:max-w-[180px]" title={subCompanyLabel}>
              {subCompanyLabel}
            </span>
          )}
          <span className="text-[10px] font-medium text-white/75 truncate max-w-[140px] sm:max-w-[180px]" title={seasonLabel}>
            {seasonLabel}
          </span>
          {localFolderPath && (
            <span className="text-[9px] font-medium text-emerald-400/90 truncate max-w-[140px] sm:max-w-[180px]" title={localFolderPath}>
              Folder
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={hasEffectiveCompanies && selectedCompany ? dropdownClass : disabledClass}
                    disabled={!hasEffectiveCompanies || !selectedCompany}
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
              {hasEffectiveCompanies && selectedCompany ? (
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
                  {!localFolderPath && (
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
                  )}
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
                    className={hasEffectiveCompanies && selectedCompany && selectedSubCompany ? dropdownClass : disabledClass}
                    disabled={!hasEffectiveCompanies || !selectedCompany || !selectedSubCompany}
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
              {hasEffectiveCompanies && selectedCompany && selectedSubCompany ? (
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
                  {!localFolderPath && (
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
                  )}
                </>
              ) : (
                <DropdownMenuItem disabled>Select sub company first</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* SQLite-only: legacy folder dialog disabled */}
      <Dialog open={false} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md p-0 gap-0 border-0 shadow-none bg-transparent overflow-visible">
          <div
            className="rounded-xl text-slate-900 shadow-[0_16px_48px_rgba(15,23,42,0.14),0_32px_80px_rgba(15,23,42,0.12)] overflow-hidden"
            style={{ backgroundColor: "#f1f5f9" }}
          >
            <div className="px-5 pt-6 pr-12 pb-1">
              <DialogHeader className="p-0">
                <DialogTitle className="text-[13px] font-semibold tracking-tight text-slate-800">
                  Data Folder
                </DialogTitle>
              </DialogHeader>
            </div>
            <div className="px-5 pb-5 space-y-4 text-[11px]">
              {localFolderPath ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-slate-600 font-medium">Active folder:</p>
                    <p className="text-[11px] font-mono truncate text-emerald-700 bg-emerald-50 px-3 py-2 rounded border border-emerald-200">
                      {localFolderPath}
                    </p>
                  </div>
                  {localCompanies.length > 0 && (
                    <div className="space-y-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-3">
                      <p className="text-slate-600 font-medium text-[11px]">Company / Sub Company / Season</p>
                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <Label className="text-[10px] text-slate-500">Company</Label>
                          <Select
                            value={selectedCompany?.id ?? ""}
                            onValueChange={(v) => {
                              const c = companies.find((x) => x.id === v);
                              if (c) void handleCompanySelect(c);
                            }}
                          >
                            <SelectTrigger className="h-8 text-[11px]">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {companies.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] text-slate-500">Sub Company</Label>
                          <Select
                            value={selectedSubCompany?.id ?? ""}
                            onValueChange={(v) => {
                              if (selectedCompany) {
                                const sub = selectedCompany.subCompanies.find((s) => s.id === v);
                                if (sub) void handleSubCompanySelect(sub, selectedCompany.id);
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 text-[11px]">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedCompany?.subCompanies.map((s) => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              )) ?? []}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] text-slate-500">Season</Label>
                          <Select
                            value={selection?.seasonKey ?? ""}
                            onValueChange={(v) => {
                              if (selectedCompany && selectedSubCompany) {
                                const sel = { companyId: selectedCompany.id, subCompanyId: selectedSubCompany.id, seasonKey: v };
                                void setSelection(sel, { skipReload: true });
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 text-[11px]">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedSubCompany?.seasons.map((s) => (
                                <SelectItem key={s.key} value={s.key}>{s.name}</SelectItem>
                              )) ?? []}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => {}}>
                      SQLite only
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-slate-600">SQLite only. Settings → Data Settings me SQLite folder select karein.</p>
                  <Button
                    className="w-full"
                    onClick={() => {}}
                  >
                    Select SQLite folder (Settings)
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => {}}>
                    Close
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation window removed */}

      {!hideCompanySelector && hasEffectiveCompanies && (selection || companyId) && (
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
      {hasEffectiveCompanies && selectedCompany && !selection && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm">
          <div className="max-w-md mx-4 p-6 rounded-xl border border-violet-900/30 bg-violet-950/95 text-white shadow-2xl text-center space-y-4">
            <Building2 className="h-12 w-12 text-violet-400 mx-auto" />
            <h2 className="text-xl font-semibold">Setup Required</h2>
            <p className="text-white/80 text-sm">
                {selectedCompany.name} needs at least one unit and one season to start.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              {(!selectedCompany.subCompanies || selectedCompany.subCompanies.length === 0) ? (
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
                  Add Unit (First)
                </Button>
              ) : (
                <>
                   <div className="space-y-1 text-left mb-2">
                      <Label className="text-xs text-white/60">Select Unit</Label>
                      <Select 
                        value={selectedSubCompany?.id} 
                        onValueChange={(id) => {
                            const s = selectedCompany.subCompanies.find(x => x.id === id);
                            if (s) setUiSubCompanyId(s.id);
                        }}
                      >
                         <SelectTrigger className="bg-white/10 border-white/20 h-10">
                            <SelectValue placeholder="Select Unit" />
                         </SelectTrigger>
                         <SelectContent>
                            {selectedCompany.subCompanies.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                         </SelectContent>
                      </Select>
                   </div>
                   <Button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setAddSeasonOpen(true);
                      }}
                      disabled={adding || !selectedSubCompany}
                      className="w-full bg-emerald-600 hover:bg-emerald-500"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Season to {selectedSubCompany?.name || 'Unit'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setAddSubOpen(true)} className="text-white/40 hover:text-white">
                        + Add Another Unit
                    </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={handleClear} className="mt-4">
                 Switch Company
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
