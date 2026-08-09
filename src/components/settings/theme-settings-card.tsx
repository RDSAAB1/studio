"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette, Check, Plus, Trash2, RotateCcw, Sparkles, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  saveUserActiveTheme, 
  saveGlobalPresetToCloud, 
  syncGlobalPresetsFromCloud, 
  STORAGE_KEY, 
  ACTIVE_THEME_KEY, 
  CURRENT_COLORS_KEY 
} from "@/lib/firestore/theme-sync";

export interface CustomThemePreset {
  id: string;
  name: string;
  colors: Record<string, any>;
}

export const DEFAULT_THEMES: CustomThemePreset[] = [
  {
    id: "warm-marigold",
    name: "Warm Marigold (#F5A623)",
    colors: {
      headerBg: "#F5A623",
      headerMenuText: "#020617",
      headerHoverBg: "#D9820B",
      headerActiveBg: "#B86A00",
      profileAvatarBg: "#020617",
      
      submenuBg: "#ffffff",
      submenuText: "#334155",
      submenuIcon: "#F5A623",
      submenuHoverBg: "#fff7ed",
      submenuHoverText: "#ea580c",
      submenuActiveBg: "#F5A623",
      submenuActiveText: "#ffffff",

      settingsSubnavBg: "#F1E6F2",
      settingsSubnavText: "#334155",
      settingsSubnavHoverBg: "#e2d1e4",
      settingsSubnavActiveBg: "#F5A623",
      settingsSubnavActiveText: "#020617",

      btnClearBg: "#2d3748",
      btnClearText: "#ffffff",
      btnSaveBg: "#e58e12",
      btnSaveText: "#ffffff",
      btnImportBg: "#f1f5f9",
      btnImportText: "#334155",
      btnExportBg: "#f1f5f9",
      btnExportText: "#334155",
      btnDeleteBg: "#2d3748",
      btnDeleteText: "#ffffff",
      btnPrintBg: "#e58e12",
      btnPrintText: "#ffffff",
      btnHoverBg: "",

      toggleActiveBg: "#e58e12",
      toggleActiveText: "#ffffff",
      toggleInactiveBg: "#cbd5e1",
      toggleInactiveText: "#475569",

      tableHeaderBg: "#F5A623",
      tableHeaderText: "#020617",
      tableRowEvenBg: "#ffffff",
      tableRowOddBg: "#fdf8f0",
      tableRowHoverBg: "#fef3c7",
      tableBorderColor: "#cbd5e1",
      
      primary: "#F5A623",
      tableFooter: "#F5A623",
      background: "#f4f1ea",
      cardBg: "#ffffff",
    },
  },
  {
    id: "classic-amber",
    name: "Classic Honey Amber",
    colors: {
      headerBg: "#D97706",
      headerMenuText: "#ffffff",
      headerHoverBg: "#B45309",
      headerActiveBg: "#92400E",
      profileAvatarBg: "#D97706",
      
      submenuBg: "#ffffff",
      submenuText: "#334155",
      submenuIcon: "#D97706",
      submenuHoverBg: "#fef3c7",
      submenuHoverText: "#b45309",
      submenuActiveBg: "#D97706",
      submenuActiveText: "#ffffff",

      settingsSubnavBg: "#fef3c7",
      settingsSubnavText: "#78350f",
      settingsSubnavHoverBg: "#fde68a",
      settingsSubnavActiveBg: "#D97706",
      settingsSubnavActiveText: "#ffffff",

      btnClearBg: "#78350f",
      btnClearText: "#ffffff",
      btnSaveBg: "#d97706",
      btnSaveText: "#ffffff",
      btnImportBg: "#fef3c7",
      btnImportText: "#78350f",
      btnExportBg: "#fef3c7",
      btnExportText: "#78350f",
      btnDeleteBg: "#78350f",
      btnDeleteText: "#ffffff",
      btnPrintBg: "#d97706",
      btnPrintText: "#ffffff",
      btnHoverBg: "",

      toggleActiveBg: "#d97706",
      toggleActiveText: "#ffffff",
      toggleInactiveBg: "#fde68a",
      toggleInactiveText: "#78350f",

      tableHeaderBg: "#D97706",
      tableHeaderText: "#ffffff",
      tableRowEvenBg: "#ffffff",
      tableRowOddBg: "#fffbeb",
      tableRowHoverBg: "#fef3c7",
      tableBorderColor: "#fde68a",
      
      primary: "#D97706",
      tableFooter: "#D97706",
      background: "#f8f6f0",
      cardBg: "#ffffff",
    },
  },
  {
    id: "deep-slate-dark",
    name: "Dark Slate Executive",
    colors: {
      headerBg: "#0F172A",
      headerMenuText: "#F5A623",
      headerHoverBg: "#1E293B",
      headerActiveBg: "#334155",
      profileAvatarBg: "#F5A623",
      
      submenuBg: "#0f172a",
      submenuText: "#f8fafc",
      submenuIcon: "#F5A623",
      submenuHoverBg: "#1e293b",
      submenuHoverText: "#f5a623",
      submenuActiveBg: "#F5A623",
      submenuActiveText: "#020617",

      settingsSubnavBg: "#1e293b",
      settingsSubnavText: "#94a3b8",
      settingsSubnavHoverBg: "#334155",
      settingsSubnavActiveBg: "#F5A623",
      settingsSubnavActiveText: "#020617",

      btnClearBg: "#334155",
      btnClearText: "#ffffff",
      btnSaveBg: "#f5a623",
      btnSaveText: "#020617",
      btnImportBg: "#1e293b",
      btnImportText: "#f8fafc",
      btnExportBg: "#1e293b",
      btnExportText: "#f8fafc",
      btnDeleteBg: "#991b1b",
      btnDeleteText: "#ffffff",
      btnPrintBg: "#f5a623",
      btnPrintText: "#020617",
      btnHoverBg: "",

      toggleActiveBg: "#f5a623",
      toggleActiveText: "#020617",
      toggleInactiveBg: "#334155",
      toggleInactiveText: "#94a3b8",

      tableHeaderBg: "#1E293B",
      tableHeaderText: "#F5A623",
      tableRowEvenBg: "#0f172a",
      tableRowOddBg: "#182234",
      tableRowHoverBg: "#334155",
      tableBorderColor: "#334155",
      
      primary: "#0F172A",
      tableFooter: "#1E293B",
      background: "#09090B",
      cardBg: "#18181B",
    },
  },
  {
    id: "emerald-finance",
    name: "Emerald Green Finance",
    colors: {
      headerBg: "#059669",
      headerMenuText: "#ffffff",
      headerHoverBg: "#047857",
      headerActiveBg: "#065F46",
      profileAvatarBg: "#047857",
      
      submenuBg: "#ffffff",
      submenuText: "#14532d",
      submenuIcon: "#059669",
      submenuHoverBg: "#f0fdf4",
      submenuHoverText: "#047857",
      submenuActiveBg: "#059669",
      submenuActiveText: "#ffffff",

      settingsSubnavBg: "#d1fae5",
      settingsSubnavText: "#065f46",
      settingsSubnavHoverBg: "#a7f3d0",
      settingsSubnavActiveBg: "#059669",
      settingsSubnavActiveText: "#ffffff",

      btnClearBg: "#065f46",
      btnClearText: "#ffffff",
      btnSaveBg: "#059669",
      btnSaveText: "#ffffff",
      btnImportBg: "#d1fae5",
      btnImportText: "#065f46",
      btnExportBg: "#d1fae5",
      btnExportText: "#065f46",
      btnDeleteBg: "#991b1b",
      btnDeleteText: "#ffffff",
      btnPrintBg: "#059669",
      btnPrintText: "#ffffff",
      btnHoverBg: "",

      toggleActiveBg: "#059669",
      toggleActiveText: "#ffffff",
      toggleInactiveBg: "#a7f3d0",
      toggleInactiveText: "#065f46",

      tableHeaderBg: "#059669",
      tableHeaderText: "#ffffff",
      tableRowEvenBg: "#ffffff",
      tableRowOddBg: "#f0fdf4",
      tableRowHoverBg: "#d1fae5",
      tableBorderColor: "#a7f3d0",
      
      primary: "#059669",
      tableFooter: "#047857",
      background: "#f0fdf4",
      cardBg: "#ffffff",
    },
  },
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
    headerBg: "#F5A623",
    headerMenuText: "#020617",
    headerHoverBg: "#D9820B",
    headerActiveBg: "#B86A00",
    profileAvatarBg: "#020617",

    submenuBg: "#ffffff",
    submenuText: "#334155",
    submenuIcon: "#F5A623",
    submenuHoverBg: "#fff7ed",
    submenuHoverText: "#ea580c",
    submenuActiveBg: "#F5A623",
    submenuActiveText: "#ffffff",

    settingsSubnavBg: "#F1E6F2",
    settingsSubnavText: "#334155",
    settingsSubnavHoverBg: "#e2d1e4",
    settingsSubnavActiveBg: "#F5A623",
    settingsSubnavActiveText: "#020617",
    settingsSubnavBorder: "#e2d1e4",

    tabBarBg: "#F0E6D6",
    tabBarText: "#78350F",
    tabBarHoverBg: "#FDE68A",
    tabBarHoverText: "#451A03",
    tabBarActiveBg: "#B45309",
    tabBarActiveText: "#ffffff",
    tabBarBorder: "#FCD34D",

    btnClearBg: "#2d3748",
    btnClearText: "#ffffff",
    btnSaveBg: "#e58e12",
    btnSaveText: "#ffffff",
    btnImportBg: "#f1f5f9",
    btnImportText: "#334155",
    btnExportBg: "#f1f5f9",
    btnExportText: "#334155",
    btnDeleteBg: "#2d3748",
    btnDeleteText: "#ffffff",
    btnPrintBg: "#e58e12",
    btnPrintText: "#ffffff",
    btnHoverBg: "",

    toggleActiveBg: "#e58e12",
    toggleActiveText: "#ffffff",
    toggleInactiveBg: "#cbd5e1",
    toggleInactiveText: "#475569",

    dropdownBg: "#ffffff",
    dropdownText: "#334155",
    dropdownHoverBg: "#fff7ed",
    dropdownHoverText: "#ea580c",
    dropdownActiveBg: "#F5A623",
    dropdownActiveText: "#ffffff",
    dropdownBorder: "#cbd5e1",

    tableHeaderBg: "#e2e8f0",
    tableHeaderText: "#1e293b",
    tableRowEvenBg: "#ffffff",
    tableRowOddBg: "#f8fafc",
    tableRowHoverBg: "#f1f5f9",
    tableBorderColor: "#cbd5e1",

    primary: "#F5A623",
    tableFooter: "#F5A623",
    background: "#f4f1ea",
    cardBg: "#ffffff",
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
    try {
      syncGlobalPresetsFromCloud().then((presets) => {
        if (presets && presets.length > 0) {
          setThemes(presets);
        }
      });

      const activeId = localStorage.getItem(ACTIVE_THEME_KEY);
      if (activeId) setActiveThemeId(activeId);
      const savedColors = localStorage.getItem(CURRENT_COLORS_KEY);
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
  }, []);

  const updateSingleColor = (key: keyof typeof customColors, val: string) => {
    const updated = { ...customColors, [key]: val };
    if (key === "submenuText") updated.submenuIcon = val;
    setCustomColors(updated);
    applyThemeColors(updated, undefined, false);
  };

  const handleSelectPreset = (preset: CustomThemePreset) => applyThemeColors(preset.colors, preset.id, true);

  const handleUpdateActivePreset = () => {
    const currentActive = themes.find((t) => t.id === activeThemeId);
    if (!currentActive) {
      toast({ title: "No active preset selected to update", variant: "destructive" });
      return;
    }
    const updatedPresets = themes.map((t) =>
      t.id === activeThemeId
        ? { ...t, colors: { ...customColors } }
        : t
    );
    setThemes(updatedPresets);
    saveGlobalPresetToCloud(updatedPresets);
    saveUserActiveTheme(customColors, activeThemeId);
    toast({ title: `Preset "${currentActive.name}" updated & saved globally!`, variant: "success" });
  };

  const handleSaveCustomTheme = () => {
    if (!newThemeName.trim()) {
      toast({ title: "Please enter a theme name", variant: "destructive" });
      return;
    }
    const newPreset: CustomThemePreset = {
      id: `custom-${Date.now()}`,
      name: newThemeName.trim(),
      colors: { ...customColors },
    };

    const updated = [...themes, newPreset];
    setThemes(updated);
    setActiveThemeId(newPreset.id);
    saveGlobalPresetToCloud(updated);
    saveUserActiveTheme(customColors, newPreset.id);
    setNewThemeName("");
    toast({ title: `Theme preset "${newPreset.name}" saved globally!`, variant: "success" });
  };

  const handleDeleteTheme = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

          <Button
            variant="outline"
            size="sm"
            onClick={handleResetDefault}
            className="text-slate-700 bg-white hover:bg-slate-50 border-slate-300 text-xs h-8 shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset Presets
          </Button>
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

                  {!DEFAULT_THEMES.some((d) => d.id === preset.id) && (
                    <button
                      onClick={(e) => handleDeleteTheme(preset.id, e)}
                      className="absolute bottom-2 right-2 p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-100 transition-colors"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-blue-50/40 p-3.5 rounded-xl border border-blue-200/80">
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
    </Card>
  );
}
