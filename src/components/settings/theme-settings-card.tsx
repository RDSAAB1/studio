"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette, Check, Plus, Trash2, RotateCcw, Sparkles, Pencil, Lock, KeyRound, ShieldCheck, ShieldAlert, Loader2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { 
  saveUserActiveTheme, 
  saveGlobalPresetToCloud, 
  syncGlobalPresetsFromCloud, 
  subscribeGlobalPresetSignals,
  getCurrentUserId,
  getUserActiveThemeKey,
  getUserColorsKey,
  STORAGE_KEY, 
  ACTIVE_THEME_KEY, 
  CURRENT_COLORS_KEY 
} from "@/lib/firestore/theme-sync";

export interface CustomThemePreset {
  id: string;
  name: string;
  colors: Record<string, any>;
  creatorUserId?: string;
  creatorName?: string;
  isSystem?: boolean;
}

export function formatDisplayUsername(rawId?: string): string {
  if (!rawId) return "Admin / Creator";
  let str = rawId.trim();

  if (str.startsWith("cu_")) {
    const parts = str.split("_");
    if (parts.length >= 3) {
      const username = parts[parts.length - 1];
      const company = parts.slice(1, parts.length - 1).join(" ");
      return `${username} (${company})`;
    } else if (parts.length === 2) {
      return parts[1];
    }
  }

  if (str.includes("@")) {
    return str.split("@")[0];
  }

  return str;
}

export function checkIsSuperAdmin(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const lcUsername = localStorage.getItem("companyUser_username")?.toLowerCase();
    if (lcUsername === "rdsaab1@gmail.com") return true;

    const lastEmail = localStorage.getItem("lastLoggedInEmail")?.toLowerCase();
    if (lastEmail === "rdsaab1@gmail.com") return true;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes("rdsaab1")) {
        return true;
      }
    }
  } catch (e) {}
  return false;
}

export const DEFAULT_THEMES: CustomThemePreset[] = [
  {
    id: "warm-marigold",
    name: "Warm Marigold (#F5A623)",
    colors: {
      headerBg: "#e58f06",
    headerMenuText: "#ffffff",
    headerHoverBg: "rgba(251, 152, 14, 0.55)",
    headerActiveBg: "#fb980e",
    profileAvatarBg: "#fb980e",
    
    submenuBg: "#ffffff",
    submenuText: "#db8b0a",
    submenuIcon: "#db8b0a",
    submenuHoverBg: "rgba(251, 152, 14, 0.3)",
    submenuHoverText: "#db8b0a",
    submenuActiveBg: "#fb980e",
    submenuActiveText: "#ffffff",

    settingsSubnavBg: "#ffffff",
    settingsSubnavText: "#db8b0a",
    settingsSubnavHoverBg: "rgba(251, 152, 14, 0.3)",
    settingsSubnavActiveBg: "#db8b0a",
    settingsSubnavActiveText: "#ffffff",
    settingsSubnavBorder: "rgba(203, 213, 225, 0.15)",

    tabBarBg: "#ffffff",
    tabBarText: "#db8b0a",
    tabBarHoverBg: "rgba(251, 152, 14, 0.3)",
    tabBarHoverText: "#db8b0a",
    tabBarActiveBg: "#db8b0a",
    tabBarActiveText: "#ffffff",
    tabBarBorder: "rgba(251, 152, 14, 0.13)",

    btnClearBg: "#b4040c",
    btnClearText: "#ffffff",
    btnSaveBg: "#db8b0a",
    btnSaveText: "#ffffff",
    btnImportBg: "#565758",
    btnImportText: "#ffffff",
    btnExportBg: "#565758",
    btnExportText: "#ffffff",
    btnDeleteBg: "#b4040c",
    btnDeleteText: "#ffffff",
    btnPrintBg: "#db8b0a",
    btnPrintText: "#ffffff",
    btnHoverBg: "transparent",

    dropdownBg: "#ffffff",
    dropdownText: "#334155",
    dropdownHoverBg: "rgba(251, 152, 14, 0.14)",
    dropdownHoverText: "#334155",
    dropdownActiveBg: "#db8b0a",
    dropdownActiveText: "#ffffff",
    dropdownBorder: "rgba(203, 213, 225, 0)",

    toggleActiveBg: "#e58e12",
    toggleActiveText: "#ffffff",
    toggleInactiveBg: "#ffffff",
    toggleInactiveText: "#475569",
    toggleContainerBg: "#1e293b",
    toggleLabelText: "#cbd5e1",

    tableHeaderBg: "#db8b0a",
    tableHeaderText: "#ffffff",
    tableRowEvenBg: "#ffffff",
    tableRowOddBg: "#ffffff",
    tableRowHoverBg: "rgba(251, 152, 14, 0.04)",
    tableBorderColor: "rgba(203, 213, 225, 0.1)",
    
    primary: "#e58f06",
    tableFooter: "#db8b0a",
    background: "#f4f1ea",
    cardBg: "#ffffff"
    }
  }
];


function parseColorOpacity(colorStr: string): { hex: string; opacity: number } {
  if (!colorStr) return { hex: "#ffffff", opacity: 100 };
  let str = colorStr.trim();
  if (str.startsWith("rgba")) {
    const match = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
    if (match) {
      const r = parseInt(match[1]).toString(16).padStart(2, "0");
      const g = parseInt(match[2]).toString(16).padStart(2, "0");
      const b = parseInt(match[3]).toString(16).padStart(2, "0");
      const a = match[4] !== undefined ? Math.round(parseFloat(match[4]) * 100) : 100;
      return { hex: `#${r}${g}${b}`, opacity: a };
    }
  }
  if (str.startsWith("#")) {
    if (str.length === 9) {
      const hexPart = str.substring(0, 7);
      const alphaHex = str.substring(7, 9);
      const a = Math.round((parseInt(alphaHex, 16) / 255) * 100);
      return { hex: hexPart, opacity: a };
    }
    return { hex: str, opacity: 100 };
  }
  return { hex: "#ffffff", opacity: 100 };
}

function composeRgba(hex: string, opacity: number): string {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  const r = parseInt(c.substring(0, 2) || "00", 16);
  const g = parseInt(c.substring(2, 4) || "00", 16);
  const b = parseInt(c.substring(4, 6) || "00", 16);
  const a = Math.max(0, Math.min(100, opacity)) / 100;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

interface ColorControlWithOpacityProps {
  label: string;
  value: string;
  onChange: (newValue: string) => void;
  defaultHex: string;
}

function ColorControlWithOpacity({ label, value, onChange, defaultHex }: ColorControlWithOpacityProps) {
  const { hex, opacity } = parseColorOpacity(value || defaultHex);

  const handleHexChange = (newHex: string) => {
    if (opacity < 100) {
      onChange(composeRgba(newHex, opacity));
    } else {
      onChange(newHex);
    }
  };

  const handleOpacityChange = (newOpacity: number) => {
    if (newOpacity < 100) {
      onChange(composeRgba(hex, newOpacity));
    } else {
      onChange(hex);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all rounded-lg p-2.5 space-y-1.5">
      {/* Title Header with Opacity */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-bold text-slate-800 truncate" title={label}>
          {label}
        </span>
        <span className="text-[9.5px] font-mono font-bold text-amber-700 shrink-0">
          {opacity}%
        </span>
      </div>

      {/* Main Color Picker & Hex Input Box */}
      <div className="flex items-center gap-1.5">
        <div className="relative shrink-0 w-7 h-7 rounded-md overflow-hidden border border-slate-300 shadow-2xs cursor-pointer group flex items-center justify-center">
          <div
            className="absolute inset-0 transition-transform group-hover:scale-110"
            style={{ backgroundColor: value || defaultHex }}
          />
          <input
            type="color"
            value={hex}
            onChange={(e) => handleHexChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            title="Click to pick color"
          />
        </div>

        <Input
          value={value || defaultHex}
          onChange={(e) => onChange(e.target.value)}
          className="text-[11px] font-mono font-bold h-7 uppercase bg-slate-50 border-slate-200 text-slate-900 flex-1 px-2 py-0"
        />
      </div>

      {/* Modern Sleek Opacity Slider with Seamless Capsule Knob */}
      <div className="flex items-center gap-1.5 pt-0.5">
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 shrink-0">Trans.</span>
        <div className="relative flex-1 flex items-center">
          <style>{`
            .pro-slider-clean::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 12px;
              height: 12px;
              border-radius: 9999px;
              background: #ffffff;
              border: 2px solid ${value || defaultHex};
              box-shadow: 0 1px 3px rgba(0,0,0,0.25);
              cursor: pointer;
              transition: transform 0.15s ease, border-color 0.15s ease;
            }
            .pro-slider-clean::-webkit-slider-thumb:hover {
              transform: scale(1.2);
            }
            .pro-slider-clean::-moz-range-thumb {
              width: 12px;
              height: 12px;
              border-radius: 9999px;
              background: #ffffff;
              border: 2px solid ${value || defaultHex};
              box-shadow: 0 1px 3px rgba(0,0,0,0.25);
              cursor: pointer;
            }
          `}</style>
          <input
            type="range"
            min="0"
            max="100"
            value={opacity}
            onChange={(e) => handleOpacityChange(Number(e.target.value))}
            style={{
              background: `linear-gradient(to right, ${value || defaultHex} 0%, ${value || defaultHex} ${opacity}%, #e2e8f0 ${opacity}%, #e2e8f0 100%)`
            }}
            className="pro-slider-clean w-full h-1.5 rounded-full appearance-none cursor-pointer border border-slate-200 shadow-2xs transition-all"
          />
        </div>
      </div>
    </div>
  );
}

export function ThemeSettingsCard() {
  const { toast } = useToast();
  const [themes, setThemes] = useState<CustomThemePreset[]>(DEFAULT_THEMES);
  const [activeThemeId, setActiveThemeId] = useState<string>("warm-marigold");

  const [newThemeName, setNewThemeName] = useState("");
  const [customColors, setCustomColors] = useState({
    headerBg: "#e58f06",
    headerMenuText: "#ffffff",
    headerHoverBg: "rgba(251, 152, 14, 0.55)",
    headerActiveBg: "#fb980e",
    profileAvatarBg: "#fb980e",
    
    submenuBg: "#ffffff",
    submenuText: "#db8b0a",
    submenuIcon: "#db8b0a",
    submenuHoverBg: "rgba(251, 152, 14, 0.3)",
    submenuHoverText: "#db8b0a",
    submenuActiveBg: "#fb980e",
    submenuActiveText: "#ffffff",

    settingsSubnavBg: "#ffffff",
    settingsSubnavText: "#db8b0a",
    settingsSubnavHoverBg: "rgba(251, 152, 14, 0.3)",
    settingsSubnavActiveBg: "#db8b0a",
    settingsSubnavActiveText: "#ffffff",
    settingsSubnavBorder: "rgba(203, 213, 225, 0.15)",

    tabBarBg: "#ffffff",
    tabBarText: "#db8b0a",
    tabBarHoverBg: "rgba(251, 152, 14, 0.3)",
    tabBarHoverText: "#db8b0a",
    tabBarActiveBg: "#db8b0a",
    tabBarActiveText: "#ffffff",
    tabBarBorder: "rgba(251, 152, 14, 0.13)",

    btnClearBg: "#b4040c",
    btnClearText: "#ffffff",
    btnSaveBg: "#db8b0a",
    btnSaveText: "#ffffff",
    btnImportBg: "#565758",
    btnImportText: "#ffffff",
    btnExportBg: "#565758",
    btnExportText: "#ffffff",
    btnDeleteBg: "#b4040c",
    btnDeleteText: "#ffffff",
    btnPrintBg: "#db8b0a",
    btnPrintText: "#ffffff",
    btnHoverBg: "transparent",

    dropdownBg: "#ffffff",
    dropdownText: "#334155",
    dropdownHoverBg: "rgba(251, 152, 14, 0.14)",
    dropdownHoverText: "#334155",
    dropdownActiveBg: "#db8b0a",
    dropdownActiveText: "#ffffff",
    dropdownBorder: "rgba(203, 213, 225, 0)",

    toggleActiveBg: "#e58e12",
    toggleActiveText: "#ffffff",
    toggleInactiveBg: "#ffffff",
    toggleInactiveText: "#475569",
    toggleContainerBg: "#1e293b",
    toggleLabelText: "#cbd5e1",

    tableHeaderBg: "#db8b0a",
    tableHeaderText: "#ffffff",
    tableRowEvenBg: "#ffffff",
    tableRowOddBg: "#ffffff",
    tableRowHoverBg: "rgba(251, 152, 14, 0.04)",
    tableBorderColor: "rgba(203, 213, 225, 0.1)",
    
    primary: "#e58f06",
    tableFooter: "#db8b0a",
    background: "#f4f1ea",
    cardBg: "#ffffff"
  });

  const applyThemeColors = (colors: Record<string, any>, themeId?: string, showToast = false) => {
    setCustomColors(colors as typeof customColors);
    try {
      if (themeId) {
        setActiveThemeId(themeId);
      }
      saveUserActiveTheme(colors, themeId);

      if (showToast) {
        toast({ title: "Theme Applied & Synced to Account!", variant: "success" });
      }
    } catch (e) {
      console.error("Error applying theme colors:", e);
    }
  };

  useEffect(() => {
    let unsubPresets: (() => void) | null = null;
    try {
      syncGlobalPresetsFromCloud().then((presets) => {
        if (presets && presets.length > 0) {
          setThemes(presets);
        }
      });

      unsubPresets = subscribeGlobalPresetSignals((newPresets) => {
        if (newPresets && newPresets.length > 0) {
          setThemes(newPresets);
        }
      });

      const userId = getCurrentUserId();
      const userThemeKey = getUserActiveThemeKey(userId);
      const userColorsKey = getUserColorsKey(userId);

      const activeId = localStorage.getItem(userThemeKey) || localStorage.getItem(ACTIVE_THEME_KEY);
      if (activeId) setActiveThemeId(activeId);
      const savedColors = localStorage.getItem(userColorsKey) || localStorage.getItem(CURRENT_COLORS_KEY);
      if (savedColors) {
        const parsed = JSON.parse(savedColors);
        const mergedColors = {
          ...customColors,
          ...parsed
        };
        setCustomColors(mergedColors);
        applyThemeColors(mergedColors, activeId || undefined, false);
      }
    } catch (e) {
      console.error("Error loading theme presets:", e);
    }

    return () => {
      if (unsubPresets) unsubPresets();
    };
  }, []);

  const updateSingleColor = (key: keyof typeof customColors, val: string) => {
    const updated = { ...customColors, [key]: val };
    if (key === "submenuText") updated.submenuIcon = val;
    setCustomColors(updated);
    applyThemeColors(updated, undefined, false);
  };

  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"update" | "delete" | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [targetCreatorId, setTargetCreatorId] = useState<string>("admin");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    setIsAdminUser(checkIsSuperAdmin());
    let unsubAuth: (() => void) | null = null;
    import("@/lib/firebase").then(({ getFirebaseAuth }) => {
      const auth = getFirebaseAuth();
      if (auth) {
        unsubAuth = auth.onAuthStateChanged(() => {
          setIsAdminUser(checkIsSuperAdmin());
        });
      }
    }).catch(() => {});
    return () => {
      if (unsubAuth) unsubAuth();
    };
  }, []);

  const verifyCreatorPassword = async (creatorId: string, password: string): Promise<boolean> => {
    console.log("[VerifyCreator] creatorId received:", creatorId);
    
    // 0. Super Admin Bypass check
    if (checkIsSuperAdmin()) {
      console.log("[VerifyCreator] Super Admin bypass allowed.");
      return true;
    }

    if (!password || !creatorId) {
      console.log("[VerifyCreator] Missing password or creatorId");
      return false;
    }
    const trimmedPass = password.trim();

    // Robust clean username extraction (e.g. 'omsharma1' from 'cu_SHARMA COMPNAY 2_omsharma1' or raw 'omsharma1')
    let targetUsername = creatorId.trim().replace(/^["']|["']$/g, "").trim();
    if (targetUsername.startsWith("cu_") || targetUsername.includes("_")) {
      const parts = targetUsername.split("_");
      targetUsername = parts[parts.length - 1];
    }
    console.log("[VerifyCreator] targetUsername parsed:", targetUsername);

    // 1. Check Company User Login endpoint (/api/company-users/login) STRICTLY for target creator username
    try {
      console.log("[VerifyCreator] Fetching login API for username:", targetUsername);
      const res = await fetch("/api/company-users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: targetUsername, password: trimmedPass })
      });
      console.log("[VerifyCreator] Login API response status:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("[VerifyCreator] Login API response data:", data);
        if (data.success || data.username || data.role) {
          console.log("[VerifyCreator] Login API verification succeeded!");
          return true;
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        console.log("[VerifyCreator] Login API failed:", errData);
      }
    } catch (e) {
      console.error("[VerifyCreator] Login API connection error:", e);
    }

    // 2. Check Firebase Auth if creatorId is an email address
    if (targetUsername.includes("@")) {
      try {
        console.log("[VerifyCreator] Trying Firebase Auth for email:", targetUsername);
        const { getFirebaseAuth } = await import("@/lib/firebase");
        const { signInWithEmailAndPassword } = await import("firebase/auth");
        const auth = getFirebaseAuth();
        await signInWithEmailAndPassword(auth, targetUsername, trimmedPass);
        console.log("[VerifyCreator] Firebase Auth verification succeeded!");
        return true;
      } catch (e) {
        console.log("[VerifyCreator] Firebase Auth failed:", e);
      }
    }

    console.log("[VerifyCreator] Strict verification failed for creator:", targetUsername);
    return false;
  };

  const handleOpenAuthModal = (action: "update" | "delete", targetPresetId?: string) => {
    const targetId = targetPresetId || activeThemeId;
    const targetPreset = themes.find((t) => t.id === targetId);

    // Determine target preset creator - DO NOT fallback to getCurrentUserId()!
    let creator = targetPreset?.creatorUserId || targetPreset?.creatorName;
    if (!creator) {
      if (targetPreset?.id.startsWith("custom-")) {
        creator = "admin";
      } else {
        creator = "system_admin";
      }
    }

    setTargetCreatorId(creator);
    setPendingAction(action);
    if (targetPresetId) setPendingDeleteId(targetPresetId);
    
    if (isAdminUser) {
      setAuthPassword("password");
    } else {
      setAuthPassword("");
    }
    setAuthError("");
    setAuthDialogOpen(true);
  };

  const handleConfirmAuth = async () => {
    if (!authPassword.trim()) {
      setAuthError("Please enter the password to authorize this action.");
      return;
    }

    setIsVerifying(true);
    setAuthError("");

    const isValid = await verifyCreatorPassword(targetCreatorId, authPassword);
    setIsVerifying(false);

    if (!isValid) {
      const displayCreator = formatDisplayUsername(targetCreatorId);
      const shortUser = targetCreatorId.startsWith("cu_") ? targetCreatorId.split("_").pop()! : displayCreator;
      setAuthError(`Galat Password! Creator '${shortUser}' (${displayCreator}) ka sahi password enter karein tabhi yeh preset update ya delete hoga.`);
      return;
    }

    setAuthDialogOpen(false);
    setAuthPassword("");

    if (pendingAction === "update") {
      executePresetUpdate();
    } else if (pendingAction === "delete" && pendingDeleteId) {
      executePresetDelete(pendingDeleteId);
    }
  };

  const handleSelectPreset = (preset: CustomThemePreset) => applyThemeColors(preset.colors, preset.id, true);

  // Updating existing preset REQUIRES CREATOR PASSWORD AUTHORIZATION!
  const handleUpdateActivePreset = () => {
    const currentActive = themes.find((t) => t.id === activeThemeId);
    if (!currentActive) {
      toast({ title: "No active preset selected to update", variant: "destructive" });
      return;
    }

    const currentUserId = getCurrentUserId();
    const isSuperAdmin = currentUserId.toLowerCase() === "rdsaab1@gmail.com" || 
                         currentUserId.toLowerCase() === "rdsaab1_gmail_com" ||
                         localStorage.getItem("companyUser_username")?.toLowerCase() === "rdsaab1@gmail.com";

    const creator = currentActive.creatorUserId || currentActive.creatorName || "system_admin";
    if (creator === currentUserId || isSuperAdmin) {
      executePresetUpdate();
    } else {
      handleOpenAuthModal("update");
    }
  };

  const executePresetUpdate = () => {
    const currentActive = themes.find((t) => t.id === activeThemeId);
    if (!currentActive) return;

    const updatedPresets = themes.map((t) =>
      t.id === activeThemeId
        ? { ...t, colors: { ...customColors } }
        : t
    );
    setThemes(updatedPresets);
    saveGlobalPresetToCloud(updatedPresets);
    saveUserActiveTheme(customColors, activeThemeId);
    toast({ title: `Preset "${currentActive.name}" updated & saved globally! 🎉`, variant: "success" });
  };

  // Creating a NEW PRESET DOES NOT REQUIRE A PASSWORD!
  const handleSaveCustomTheme = () => {
    if (!newThemeName.trim()) {
      toast({ title: "Please enter a theme name", variant: "destructive" });
      return;
    }
    const currentUserId = getCurrentUserId();
    const newPreset: CustomThemePreset = {
      id: `custom-${Date.now()}`,
      name: newThemeName.trim(),
      colors: { ...customColors },
      creatorUserId: currentUserId,
      creatorName: currentUserId,
    };

    const updated = [...themes, newPreset];
    setThemes(updated);
    setActiveThemeId(newPreset.id);
    saveGlobalPresetToCloud(updated);
    saveUserActiveTheme(customColors, newPreset.id);
    setNewThemeName("");
    toast({ title: `Theme preset "${newPreset.name}" saved globally! 🎉`, variant: "success" });
  };

  // Deleting an existing preset REQUIRES PASSWORD AUTHORIZATION!
  const handleDeleteTheme = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const currentUserId = getCurrentUserId();
    const isSuperAdmin = currentUserId.toLowerCase() === "rdsaab1@gmail.com" || 
                         currentUserId.toLowerCase() === "rdsaab1_gmail_com" ||
                         localStorage.getItem("companyUser_username")?.toLowerCase() === "rdsaab1@gmail.com";

    const targetPreset = themes.find((t) => t.id === id);
    const creator = targetPreset?.creatorUserId || targetPreset?.creatorName || "system_admin";

    if (creator === currentUserId || isSuperAdmin) {
      executePresetDelete(id);
    } else {
      handleOpenAuthModal("delete", id);
    }
  };

  const executePresetDelete = (id: string) => {
    const updated = themes.filter((t) => t.id !== id);
    setThemes(updated);
    saveGlobalPresetToCloud(updated);
    toast({ title: "Theme preset deleted.", variant: "success" });
  };

  const handleResetDefault = () => {
    setThemes(DEFAULT_THEMES);
    saveGlobalPresetToCloud(DEFAULT_THEMES);
    handleSelectPreset(DEFAULT_THEMES[0]);
  };

  return (
    <Card className="border border-slate-200 shadow-xs rounded-xl overflow-hidden bg-white">
      {/* Header Bar - Clean White Card with Group 1 Icon Rule */}
      <CardHeader className="bg-white border-b border-slate-200 py-3.5 px-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div 
              className="p-2 rounded-lg shadow-xs flex items-center justify-center font-bold shrink-0 transition-colors"
              style={{ 
                backgroundColor: "var(--profile-avatar-bg, #020617)",
                color: "var(--header-text-color, #ffffff)"
              }}
            >
              <Palette className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>Theme Presets & Instant Live Customizer</span>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </CardTitle>
              <CardDescription className="text-xs text-slate-600 font-semibold">
                Instant Real-Time Color Customization (Group 1, Group 2, Group 3)
              </CardDescription>
            </div>
          </div>


        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-6">
        {/* Presets Gallery Section */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <Label className="text-xs font-black uppercase tracking-wider text-slate-500 block">
              Saved Presets (1-Click Instant Switch)
            </Label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {themes.map((preset) => {
              const isActive = activeThemeId === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className={`relative p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    isActive
                      ? "border-amber-500 bg-amber-500/10 shadow-xs ring-2 ring-amber-500/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-xs font-black text-slate-900 truncate">
                      {preset.name}
                    </span>
                    {isActive && (
                      <span className="p-0.5 bg-amber-500 text-slate-950 rounded-full shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 h-5 rounded-lg overflow-hidden border border-slate-200 p-0.5 bg-slate-50">
                    <div className="h-full flex-1 rounded-xs" style={{ backgroundColor: preset.colors.headerBg }} title="Header" />
                    <div className="h-full flex-1 rounded-xs" style={{ backgroundColor: preset.colors.submenuBg }} title="Submenu" />
                    <div className="h-full flex-1 rounded-xs" style={{ backgroundColor: preset.colors.submenuActiveBg }} title="Active" />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium mt-2 pt-1 border-t border-slate-100">
                    <span className="truncate flex items-center gap-1 text-slate-600 font-semibold" title={`Creator: ${formatDisplayUsername(preset.creatorUserId || preset.creatorName)}`}>
                      <User className="w-3 h-3 text-purple-600 shrink-0" />
                      {formatDisplayUsername(preset.creatorUserId || preset.creatorName)}
                    </span>
                  </div>

                  {!DEFAULT_THEMES.some((d) => d.id === preset.id) && (
                    <button
                      onClick={(e) => handleDeleteTheme(preset.id, e)}
                      className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-100 transition-colors"
                      title="Delete Preset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Group 1 Customizer */}
        <div className="border-t border-slate-200 pt-5">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-xs font-black uppercase tracking-wider text-amber-700 block">
              Group 1: Top Navigation Bar Elements (5 Controls)
            </Label>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full">
              Instant Live Sync
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 bg-amber-50/40 p-3.5 rounded-xl border border-amber-200/80">
            <ColorControlWithOpacity
              label="1. Top Bar Background"
              value={customColors.headerBg}
              defaultHex="#F5A623"
              onChange={(val) => updateSingleColor("headerBg", val)}
            />
            <ColorControlWithOpacity
              label="2. Menu Text Color"
              value={customColors.headerMenuText}
              defaultHex="#020617"
              onChange={(val) => updateSingleColor("headerMenuText", val)}
            />
            <ColorControlWithOpacity
              label="3. Menu Item Hover Fill"
              value={customColors.headerHoverBg}
              defaultHex="#D9820B"
              onChange={(val) => updateSingleColor("headerHoverBg", val)}
            />
            <ColorControlWithOpacity
              label="4. Selected Active Menu Fill"
              value={customColors.headerActiveBg}
              defaultHex="#B86A00"
              onChange={(val) => updateSingleColor("headerActiveBg", val)}
            />
            <ColorControlWithOpacity
              label="5. Profile Avatar Icon"
              value={customColors.profileAvatarBg}
              defaultHex="#020617"
              onChange={(val) => updateSingleColor("profileAvatarBg", val)}
            />
          </div>
        </div>

        {/* Group 2 Customizer: Submenu Dropdown List */}
        <div className="border-t border-slate-200 pt-5">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-xs font-black uppercase tracking-wider text-sky-700 block">
              Group 2: Submenu Dropdown List (5 Unified Controls)
            </Label>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-100 text-sky-900 rounded-full">
              Instant Live Sync
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-3.5 bg-sky-50/40 p-3.5 rounded-xl border border-sky-200/80">
            <ColorControlWithOpacity
              label="1. Submenu Card BG"
              value={customColors.submenuBg}
              defaultHex="#ffffff"
              onChange={(val) => updateSingleColor("submenuBg", val)}
            />
            <ColorControlWithOpacity
              label="2. Normal Text & Icon"
              value={customColors.submenuText}
              defaultHex="#334155"
              onChange={(val) => updateSingleColor("submenuText", val)}
            />
            <ColorControlWithOpacity
              label="3. Submenu Hover Fill"
              value={customColors.submenuHoverBg}
              defaultHex="#fff7ed"
              onChange={(val) => updateSingleColor("submenuHoverBg", val)}
            />
            <ColorControlWithOpacity
              label="4. Hover Text & Icon"
              value={customColors.submenuHoverText}
              defaultHex="#ea580c"
              onChange={(val) => updateSingleColor("submenuHoverText", val)}
            />
            <ColorControlWithOpacity
              label="5. Selected Active Fill"
              value={customColors.submenuActiveBg}
              defaultHex="#F5A623"
              onChange={(val) => updateSingleColor("submenuActiveBg", val)}
            />
            <ColorControlWithOpacity
              label="6. Selected Active Text & Icon"
              value={customColors.submenuActiveText}
              defaultHex="#ffffff"
              onChange={(val) => updateSingleColor("submenuActiveText", val)}
            />
          </div>
        </div>

        {/* Group 3 Customizer: Settings Subnav Horizontal List */}
        <div className="border-t border-slate-200 pt-5">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-xs font-black uppercase tracking-wider text-purple-700 block">
              Group 3: Settings Subnav Bar (Company, Theme, Email, Team, etc.)
            </Label>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-900 rounded-full">
              Instant Live Sync
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-3.5 bg-purple-50/40 p-3.5 rounded-xl border border-purple-200/80">
            <ColorControlWithOpacity
              label="1. Subnav Bar Background"
              value={customColors.settingsSubnavBg}
              defaultHex="#F1E6F2"
              onChange={(val) => updateSingleColor("settingsSubnavBg", val)}
            />
            <ColorControlWithOpacity
              label="2. Normal Tab Text & Icon"
              value={customColors.settingsSubnavText}
              defaultHex="#334155"
              onChange={(val) => updateSingleColor("settingsSubnavText", val)}
            />
            <ColorControlWithOpacity
              label="3. Tab Hover Background"
              value={customColors.settingsSubnavHoverBg}
              defaultHex="#e2d1e4"
              onChange={(val) => updateSingleColor("settingsSubnavHoverBg", val)}
            />
            <ColorControlWithOpacity
              label="4. Selected Active Tab Fill"
              value={customColors.settingsSubnavActiveBg}
              defaultHex="#F5A623"
              onChange={(val) => updateSingleColor("settingsSubnavActiveBg", val)}
            />
            <ColorControlWithOpacity
              label="5. Selected Active Tab Text"
              value={customColors.settingsSubnavActiveText}
              defaultHex="#020617"
              onChange={(val) => updateSingleColor("settingsSubnavActiveText", val)}
            />
            <ColorControlWithOpacity
              label="6. Subnav Grid / Border Line"
              value={customColors.settingsSubnavBorder || "#cbd5e1"}
              defaultHex="#cbd5e1"
              onChange={(val) => updateSingleColor("settingsSubnavBorder" as any, val)}
            />
          </div>
        </div>

        {/* Group 3B Customizer: Module & Form Tab Bars (Entry, Stock, Ledger, Cash/Udhar/Interest/Adj) */}
        <div className="border-t border-slate-200 pt-5">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-xs font-black uppercase tracking-wider text-amber-800 block">
              Group 3B: Module & Form Tab Bars (Entry, Stock, Ledger, Cash/Udhar/Interest/Adj)
            </Label>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full">
              Instant Live Sync
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-7 gap-3 bg-amber-50/60 p-3.5 rounded-xl border border-amber-300/80">
            <ColorControlWithOpacity
              label="1. Tab Bar Background"
              value={customColors.tabBarBg || "#f0e6d6"}
              defaultHex="#f0e6d6"
              onChange={(val) => updateSingleColor("tabBarBg" as any, val)}
            />
            <ColorControlWithOpacity
              label="2. Normal Tab Text"
              value={customColors.tabBarText || "#78350f"}
              defaultHex="#78350f"
              onChange={(val) => updateSingleColor("tabBarText" as any, val)}
            />
            <ColorControlWithOpacity
              label="3. Tab Hover Fill"
              value={customColors.tabBarHoverBg || "#fde68a"}
              defaultHex="#fde68a"
              onChange={(val) => updateSingleColor("tabBarHoverBg" as any, val)}
            />
            <ColorControlWithOpacity
              label="4. Tab Hover Text"
              value={customColors.tabBarHoverText || "#451a03"}
              defaultHex="#451a03"
              onChange={(val) => updateSingleColor("tabBarHoverText" as any, val)}
            />
            <ColorControlWithOpacity
              label="5. Selected Active Fill"
              value={customColors.tabBarActiveBg || "#b45309"}
              defaultHex="#b45309"
              onChange={(val) => updateSingleColor("tabBarActiveBg" as any, val)}
            />
            <ColorControlWithOpacity
              label="6. Selected Active Text"
              value={customColors.tabBarActiveText || "#ffffff"}
              defaultHex="#ffffff"
              onChange={(val) => updateSingleColor("tabBarActiveText" as any, val)}
            />
            <ColorControlWithOpacity
              label="7. Grid / Divider Line"
              value={customColors.tabBarBorder || "#fcd34d"}
              defaultHex="#fcd34d"
              onChange={(val) => updateSingleColor("tabBarBorder" as any, val)}
            />
          </div>
        </div>

        {/* Group 4 Customizer: Commands & Search Action Buttons */}
        <div className="border-t border-slate-200 pt-5">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-xs font-black uppercase tracking-wider text-emerald-700 block">
              Group 4: Commands Bar Buttons (Clear, Save, Import, Export, Delete, Print)
            </Label>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-full">
              Instant Live Sync
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-3 bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-200/80">
            <ColorControlWithOpacity
              label="1. Clear (Alt+C) BG"
              value={customColors.btnClearBg}
              defaultHex="#2d3748"
              onChange={(val) => updateSingleColor("btnClearBg", val)}
            />
            <ColorControlWithOpacity
              label="2. Clear (Alt+C) Text"
              value={customColors.btnClearText}
              defaultHex="#ffffff"
              onChange={(val) => updateSingleColor("btnClearText", val)}
            />

            <ColorControlWithOpacity
              label="3. Save (Alt+S) BG"
              value={customColors.btnSaveBg}
              defaultHex="#e58e12"
              onChange={(val) => updateSingleColor("btnSaveBg", val)}
            />
            <ColorControlWithOpacity
              label="4. Save (Alt+S) Text"
              value={customColors.btnSaveText}
              defaultHex="#ffffff"
              onChange={(val) => updateSingleColor("btnSaveText", val)}
            />

            <ColorControlWithOpacity
              label="5. Import Button BG"
              value={customColors.btnImportBg}
              defaultHex="#f1f5f9"
              onChange={(val) => updateSingleColor("btnImportBg", val)}
            />
            <ColorControlWithOpacity
              label="6. Import Button Text"
              value={customColors.btnImportText}
              defaultHex="#334155"
              onChange={(val) => updateSingleColor("btnImportText", val)}
            />

            <ColorControlWithOpacity
              label="7. Export Button BG"
              value={customColors.btnExportBg}
              defaultHex="#f1f5f9"
              onChange={(val) => updateSingleColor("btnExportBg", val)}
            />
            <ColorControlWithOpacity
              label="8. Export Button Text"
              value={customColors.btnExportText}
              defaultHex="#334155"
              onChange={(val) => updateSingleColor("btnExportText", val)}
            />

            <ColorControlWithOpacity
              label="9. Delete Button BG"
              value={customColors.btnDeleteBg}
              defaultHex="#2d3748"
              onChange={(val) => updateSingleColor("btnDeleteBg", val)}
            />
            <ColorControlWithOpacity
              label="10. Delete Button Text"
              value={customColors.btnDeleteText}
              defaultHex="#ffffff"
              onChange={(val) => updateSingleColor("btnDeleteText", val)}
            />

            <ColorControlWithOpacity
              label="11. Print Button BG"
              value={customColors.btnPrintBg}
              defaultHex="#e58e12"
              onChange={(val) => updateSingleColor("btnPrintBg", val)}
            />
            <ColorControlWithOpacity
              label="12. Print Button Text"
              value={customColors.btnPrintText}
              defaultHex="#ffffff"
              onChange={(val) => updateSingleColor("btnPrintText", val)}
            />

            <ColorControlWithOpacity
              label="13. Custom Hover BG (Optional)"
              value={customColors.btnHoverBg || ""}
              defaultHex=""
              onChange={(val) => updateSingleColor("btnHoverBg", val)}
            />
          </div>
        </div>

        {/* Group 5 Customizer: ALL DROPDOWNS & AUTOCOMPLETE SUGGESTION LISTS */}
        <div className="border-t border-slate-200 pt-5">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-xs font-black uppercase tracking-wider text-purple-700 block">
              Group 5: ALL DROPDOWNS & AUTOCOMPLETE SUGGESTION LISTS (7 Unified Controls)
            </Label>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-900 rounded-full">
              Instant Live Sync
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 bg-purple-50/40 p-3.5 rounded-xl border border-purple-200/80">
            <ColorControlWithOpacity
              label="1. Dropdown BG"
              value={customColors.dropdownBg || "#ffffff"}
              defaultHex="#ffffff"
              onChange={(val) => updateSingleColor("dropdownBg" as any, val)}
            />
            <ColorControlWithOpacity
              label="2. Normal Item Text"
              value={customColors.dropdownText || "#334155"}
              defaultHex="#334155"
              onChange={(val) => updateSingleColor("dropdownText" as any, val)}
            />
            <ColorControlWithOpacity
              label="3. Item Hover Fill"
              value={customColors.dropdownHoverBg || "#fff7ed"}
              defaultHex="#fff7ed"
              onChange={(val) => updateSingleColor("dropdownHoverBg" as any, val)}
            />
            <ColorControlWithOpacity
              label="4. Item Hover Text"
              value={customColors.dropdownHoverText || "#ea580c"}
              defaultHex="#ea580c"
              onChange={(val) => updateSingleColor("dropdownHoverText" as any, val)}
            />
            <ColorControlWithOpacity
              label="5. Selected Active Fill"
              value={customColors.dropdownActiveBg || "#F5A623"}
              defaultHex="#F5A623"
              onChange={(val) => updateSingleColor("dropdownActiveBg" as any, val)}
            />
            <ColorControlWithOpacity
              label="6. Selected Active Text"
              value={customColors.dropdownActiveText || "#ffffff"}
              defaultHex="#ffffff"
              onChange={(val) => updateSingleColor("dropdownActiveText" as any, val)}
            />
            <ColorControlWithOpacity
              label="7. Border & Divider Line"
              value={customColors.dropdownBorder || "#cbd5e1"}
              defaultHex="#cbd5e1"
              onChange={(val) => updateSingleColor("dropdownBorder" as any, val)}
            />
          </div>
        </div>

        {/* Group 6 Customizer: Universal Switches & Toggle Switches */}
        <div className="border-t border-slate-200 pt-5">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-xs font-black uppercase tracking-wider text-blue-700 block">
              Group 6: Universal Switches & Toggle Controls (4 Unified Controls)
            </Label>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-900 rounded-full">
              Instant Live Sync
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 bg-blue-50/40 p-3.5 rounded-xl border border-blue-200/80">
            <ColorControlWithOpacity
              label="1. Active Toggle Fill (ON)"
              value={customColors.toggleActiveBg || "#e58e12"}
              defaultHex="#e58e12"
              onChange={(val) => updateSingleColor("toggleActiveBg", val)}
            />
            <ColorControlWithOpacity
              label="2. Active Toggle Text (ON)"
              value={customColors.toggleActiveText || "#ffffff"}
              defaultHex="#ffffff"
              onChange={(val) => updateSingleColor("toggleActiveText", val)}
            />

            <ColorControlWithOpacity
              label="3. Inactive Toggle Fill (OFF)"
              value={customColors.toggleInactiveBg || "#cbd5e1"}
              defaultHex="#cbd5e1"
              onChange={(val) => updateSingleColor("toggleInactiveBg", val)}
            />
            <ColorControlWithOpacity
              label="4. Inactive Toggle Text (OFF)"
              value={customColors.toggleInactiveText || "#475569"}
              defaultHex="#475569"
              onChange={(val) => updateSingleColor("toggleInactiveText", val)}
            />

            <ColorControlWithOpacity
              label="5. Toggle Container BG"
              value={customColors.toggleContainerBg || "#1e293b"}
              defaultHex="#1e293b"
              onChange={(val) => updateSingleColor("toggleContainerBg" as any, val)}
            />
            <ColorControlWithOpacity
              label="6. Toggle Label Text Color"
              value={customColors.toggleLabelText || "#cbd5e1"}
              defaultHex="#cbd5e1"
              onChange={(val) => updateSingleColor("toggleLabelText" as any, val)}
            />
          </div>
        </div>

        {/* Group 6 Customizer: Universal Data Tables Styling */}
        <div className="border-t border-slate-200 pt-5">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-xs font-black uppercase tracking-wider text-amber-800 block">
              Group 6: Universal Data Tables Styling (6 Unified Controls)
            </Label>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full">
              Instant Live Sync
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-3 bg-amber-50/40 p-3.5 rounded-xl border border-amber-200/80">
            <ColorControlWithOpacity
              label="1. Table Header BG"
              value={customColors.tableHeaderBg || "#e2e8f0"}
              defaultHex="#e2e8f0"
              onChange={(val) => updateSingleColor("tableHeaderBg", val)}
            />
            <ColorControlWithOpacity
              label="2. Table Header Text"
              value={customColors.tableHeaderText || "#1e293b"}
              defaultHex="#1e293b"
              onChange={(val) => updateSingleColor("tableHeaderText", val)}
            />

            <ColorControlWithOpacity
              label="3. Row BG (Even)"
              value={customColors.tableRowEvenBg || "#ffffff"}
              defaultHex="#ffffff"
              onChange={(val) => updateSingleColor("tableRowEvenBg", val)}
            />
            <ColorControlWithOpacity
              label="4. Row BG (Odd)"
              value={customColors.tableRowOddBg || "#f8fafc"}
              defaultHex="#f8fafc"
              onChange={(val) => updateSingleColor("tableRowOddBg", val)}
            />

            <ColorControlWithOpacity
              label="5. Row Hover BG"
              value={customColors.tableRowHoverBg || "#f1f5f9"}
              defaultHex="#f1f5f9"
              onChange={(val) => updateSingleColor("tableRowHoverBg", val)}
            />
            <ColorControlWithOpacity
              label="6. Table Grid Border"
              value={customColors.tableBorderColor || "#cbd5e1"}
              defaultHex="#cbd5e1"
              onChange={(val) => updateSingleColor("tableBorderColor", val)}
            />
          </div>
        </div>

        {/* Save & Edit Preset Row - Group 4 Theme Rule Compliant */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Input
              placeholder="Enter Preset Name (e.g. Warm Amber ERP)..."
              value={newThemeName}
              onChange={(e) => setNewThemeName(e.target.value)}
              className="text-xs h-9 bg-slate-50 border-slate-300"
            />
            <Button
              onClick={handleSaveCustomTheme}
              style={{
                backgroundColor: "var(--btn-save-bg, #e58e12)",
                color: "var(--btn-save-text, #ffffff)"
              }}
              className="font-black shrink-0 h-9 px-4 shadow-sm hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4 mr-1 stroke-[3]" /> Save as New Preset
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleUpdateActivePreset}
              style={{
                backgroundColor: "var(--btn-import-bg, #f1f5f9)",
                color: "var(--btn-import-text, #334155)"
              }}
              className="border border-slate-300 font-bold h-9 px-4 text-xs shadow-xs hover:opacity-90 transition-opacity"
              title="Save current color edits back to active theme preset"
            >
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Update Active Preset
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Password Authorization Dialog for Updating / Deleting Presets */}
      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <DialogContent className="sm:max-w-[420px] bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl z-[100000]">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  {pendingAction === "update" ? "Theme Creator Authorization" : "Preset Delete Authorization"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Yeh theme preset <span className="font-bold text-purple-700">{formatDisplayUsername(targetCreatorId)}</span> dwara banaya gaya tha. Preset {pendingAction === "update" ? "update" : "delete"} karne ke liye creator ka password enter karein.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleConfirmAuth(); }} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Creator Password ({formatDisplayUsername(targetCreatorId)}):
              </Label>
              <div className="relative">
                <Input
                  type={isAdminUser ? "text" : "password"}
                  placeholder={`Enter password for ${targetCreatorId.startsWith("cu_") ? targetCreatorId.split("_").pop() : formatDisplayUsername(targetCreatorId)}...`}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="h-10 text-xs pl-9 pr-3 rounded-lg border-slate-300 focus-visible:ring-purple-500 font-mono"
                  autoFocus
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
              {isAdminUser && (
                <div className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200/60 flex flex-col gap-1 mt-2">
                  <span className="flex items-center gap-1.5 font-bold">
                    🔑 Admin Bypass Active (rdsaab1@gmail.com)
                  </span>
                  <span>Aap system admin hain, isliye aapke liye password <span className="font-bold underline">password</span> auto-fill kar diya gaya hai. Confirm par click karein.</span>
                </div>
              )}
              {authError && (
                <p className="text-[11px] font-medium text-red-600 bg-red-50 p-2 rounded-md border border-red-200/60 flex items-center gap-1.5 mt-1">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  {authError}
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAuthDialogOpen(false)}
                className="h-9 text-xs font-semibold rounded-lg border-slate-300"
                disabled={isVerifying}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-9 text-xs font-bold rounded-lg bg-purple-700 hover:bg-purple-800 text-white shadow-sm"
                disabled={isVerifying || !authPassword.trim()}
              >
                {isVerifying ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Confirm Authorization
                  </span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
