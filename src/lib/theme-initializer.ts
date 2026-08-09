/**
 * Global Theme Initializer Utility
 * Reads saved theme colors from localStorage ('jrmd_current_colors' or 'jrmd_active_theme_id')
 * and applies them to document.documentElement CSS variables immediately on page load / refresh.
 */

export const DEFAULT_THEME_COLORS: Record<string, any> = {
  "warm-marigold": {
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
    primary: "#F5A623",
    tableFooter: "#F5A623",
    background: "#f4f1ea",
    cardBg: "#ffffff",
  }
};

export function parseColorOpacity(color: string) {
  if (!color) return { hex: '#000000', opacity: 1 };
  if (color.startsWith('#')) return { hex: color, opacity: 1 };
  const rgbaMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
    const opacity = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
    return { hex: `#${r}${g}${b}`, opacity };
  }
  return { hex: color, opacity: 1 };
}

export function hexToHSL(hexStr: string): string {
  try {
    const { hex } = parseColorOpacity(hexStr);
    let c = hex.replace("#", "");
    if (c.length === 3) c = c.split("").map((x) => x + x).join("");
    const r = parseInt(c.substring(0, 2), 16) / 255;
    const g = parseInt(c.substring(2, 4), 16) / 255;
    const b = parseInt(c.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  } catch (e) {
    return '38 92% 55%';
  }
}

export function applyStoredThemeColors() {
  if (typeof window === 'undefined') return;

  try {
    let colors: any = null;

    // 1. Try reading jrmd_current_colors or antigravity_current_colors
    const savedColors = localStorage.getItem('jrmd_current_colors') || localStorage.getItem('antigravity_current_colors');
    if (savedColors) {
      colors = JSON.parse(savedColors);
    }

    // 2. If no saved colors, check active theme preset id
    if (!colors) {
      const activeId = localStorage.getItem('jrmd_active_theme_id');
      const presetsRaw = localStorage.getItem('jrmd_theme_presets');
      if (presetsRaw) {
        try {
          const presets = JSON.parse(presetsRaw);
          const found = presets.find((p: any) => p.id === activeId);
          if (found) colors = found.colors;
        } catch (e) {}
      }
      if (!colors && activeId && DEFAULT_THEME_COLORS[activeId]) {
        colors = DEFAULT_THEME_COLORS[activeId];
      }
    }

    // 3. Fallback to Marigold default
    if (!colors) {
      colors = DEFAULT_THEME_COLORS["warm-marigold"];
    }

    const root = document.documentElement;

    if (colors.headerBg) {
      root.style.setProperty("--header-bg", colors.headerBg);
      root.style.setProperty("--primary-bg-custom", colors.headerBg);
      const headerHsl = hexToHSL(colors.headerBg);
      root.style.setProperty("--primary", headerHsl);
      root.style.setProperty("--ring", headerHsl);
    }
    if (colors.headerMenuText) root.style.setProperty("--header-text-color", colors.headerMenuText);
    if (colors.headerHoverBg) root.style.setProperty("--header-hover-bg", colors.headerHoverBg);
    if (colors.headerActiveBg) root.style.setProperty("--header-active-bg", colors.headerActiveBg);
    if (colors.profileAvatarBg) root.style.setProperty("--profile-avatar-bg", colors.profileAvatarBg);

    if (colors.submenuBg) root.style.setProperty("--submenu-bg", colors.submenuBg);
    if (colors.submenuText) root.style.setProperty("--submenu-text", colors.submenuText);
    if (colors.submenuIcon) root.style.setProperty("--submenu-icon", colors.submenuIcon);
    if (colors.submenuHoverBg) root.style.setProperty("--submenu-hover-bg", colors.submenuHoverBg);
    if (colors.submenuHoverText) root.style.setProperty("--submenu-hover-text", colors.submenuHoverText);
    if (colors.submenuActiveBg) root.style.setProperty("--submenu-active-bg", colors.submenuActiveBg);
    if (colors.submenuActiveText) root.style.setProperty("--submenu-active-text", colors.submenuActiveText);

    if (colors.settingsSubnavBg) root.style.setProperty("--settings-subnav-bg", colors.settingsSubnavBg);
    if (colors.settingsSubnavText) root.style.setProperty("--settings-subnav-text", colors.settingsSubnavText);
    if (colors.settingsSubnavHoverBg) root.style.setProperty("--settings-subnav-hover-bg", colors.settingsSubnavHoverBg);
    if (colors.settingsSubnavActiveBg) root.style.setProperty("--settings-subnav-active-bg", colors.settingsSubnavActiveBg);
    if (colors.settingsSubnavActiveText) root.style.setProperty("--settings-subnav-active-text", colors.settingsSubnavActiveText);
    if (colors.settingsSubnavBorder) root.style.setProperty("--settings-subnav-border", colors.settingsSubnavBorder);

    if (colors.tabBarBg) root.style.setProperty("--tab-bar-bg", colors.tabBarBg);
    if (colors.tabBarText) root.style.setProperty("--tab-bar-text", colors.tabBarText);
    if (colors.tabBarHoverBg) root.style.setProperty("--tab-bar-hover-bg", colors.tabBarHoverBg);
    if (colors.tabBarHoverText) root.style.setProperty("--tab-bar-hover-text", colors.tabBarHoverText);
    if (colors.tabBarActiveBg) root.style.setProperty("--tab-bar-active-bg", colors.tabBarActiveBg);
    if (colors.tabBarActiveText) root.style.setProperty("--tab-bar-active-text", colors.tabBarActiveText);
    if (colors.tabBarBorder) root.style.setProperty("--tab-bar-border", colors.tabBarBorder);

    if (colors.btnClearBg) root.style.setProperty("--btn-clear-bg", colors.btnClearBg);
    if (colors.btnClearText) root.style.setProperty("--btn-clear-text", colors.btnClearText);
    if (colors.btnSaveBg) root.style.setProperty("--btn-save-bg", colors.btnSaveBg);
    if (colors.btnSaveText) root.style.setProperty("--btn-save-text", colors.btnSaveText);
    if (colors.btnImportBg) root.style.setProperty("--btn-import-bg", colors.btnImportBg);
    if (colors.btnImportText) root.style.setProperty("--btn-import-text", colors.btnImportText);
    if (colors.btnExportBg) root.style.setProperty("--btn-export-bg", colors.btnExportBg);
    if (colors.btnExportText) root.style.setProperty("--btn-export-text", colors.btnExportText);
    if (colors.btnDeleteBg) root.style.setProperty("--btn-delete-bg", colors.btnDeleteBg);
    if (colors.btnDeleteText) root.style.setProperty("--btn-delete-text", colors.btnDeleteText);
    if (colors.btnPrintBg) root.style.setProperty("--btn-print-bg", colors.btnPrintBg);
    if (colors.btnPrintText) root.style.setProperty("--btn-print-text", colors.btnPrintText);
    root.style.setProperty("--btn-hover-bg", colors.btnHoverBg || "");

    if (colors.toggleActiveBg) root.style.setProperty("--toggle-active-bg", colors.toggleActiveBg);
    if (colors.toggleActiveText) root.style.setProperty("--toggle-active-text", colors.toggleActiveText);
    if (colors.toggleInactiveBg) root.style.setProperty("--toggle-inactive-bg", colors.toggleInactiveBg);
    if (colors.toggleInactiveText) root.style.setProperty("--toggle-inactive-text", colors.toggleInactiveText);

    if (colors.dropdownBg) root.style.setProperty("--dropdown-bg", colors.dropdownBg);
    if (colors.dropdownText) root.style.setProperty("--dropdown-text", colors.dropdownText);
    if (colors.dropdownHoverBg) root.style.setProperty("--dropdown-hover-bg", colors.dropdownHoverBg);
    if (colors.dropdownHoverText) root.style.setProperty("--dropdown-hover-text", colors.dropdownHoverText);
    if (colors.dropdownActiveBg) root.style.setProperty("--dropdown-active-bg", colors.dropdownActiveBg);
    if (colors.dropdownActiveText) root.style.setProperty("--dropdown-active-text", colors.dropdownActiveText);
    if (colors.dropdownBorder) root.style.setProperty("--dropdown-border", colors.dropdownBorder);

    if (colors.tableHeaderBg) root.style.setProperty("--tbl-header-bg", colors.tableHeaderBg);
    if (colors.tableHeaderText) root.style.setProperty("--tbl-header-text", colors.tableHeaderText);
    if (colors.tableRowEvenBg) root.style.setProperty("--tbl-row-even-bg", colors.tableRowEvenBg);
    if (colors.tableRowOddBg) root.style.setProperty("--tbl-row-odd-bg", colors.tableRowOddBg);
    if (colors.tableRowHoverBg) root.style.setProperty("--tbl-row-hover-bg", colors.tableRowHoverBg);
    if (colors.tableBorderColor) root.style.setProperty("--tbl-border-color", colors.tableBorderColor);

    if (colors.background) {
      root.style.setProperty("--background", hexToHSL(colors.background));
      document.body.style.backgroundColor = colors.background;
    }
    if (colors.cardBg) {
      root.style.setProperty("--card", hexToHSL(colors.cardBg));
    }
  } catch (e) {
    console.error("Failed to restore stored theme:", e);
  }
}
