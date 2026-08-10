/**
 * User-Based Cloud D1 Theme Sync Engine
 * Handles user-based theme preferences and Cloud D1 Database synchronization.
 * Completely removed Firestore dependency.
 */

import { DEFAULT_WORKER_URL } from "@/lib/d1-sync";
import { applyStoredThemeColors } from "../theme-initializer";
import { DEFAULT_THEMES, type CustomThemePreset } from "@/components/settings/theme-settings-card";
import { getFirebaseAuth } from "../firebase";

export const STORAGE_KEY = "jrmd_theme_presets";
export const ACTIVE_THEME_KEY = "jrmd_active_theme_id";
export const CURRENT_COLORS_KEY = "jrmd_current_colors";

export function getCurrentUserId(): string {
  if (typeof window === "undefined") return "guest";
  try {
    const auth = getFirebaseAuth();
    const firebaseUser = auth?.currentUser;
    if (firebaseUser?.uid) return firebaseUser.uid;
    if (firebaseUser?.email) return firebaseUser.email.replace(/[^a-zA-Z0-9]/g, "_");
  } catch (e) {}

  const memberUsername = localStorage.getItem("companyUser_username");
  if (memberUsername) return memberUsername.replace(/[^a-zA-Z0-9]/g, "_");

  const lastUserId = localStorage.getItem("lastUserId");
  if (lastUserId) return lastUserId.replace(/[^a-zA-Z0-9]/g, "_");

  return "guest";
}

export function getUserColorsKey(userId?: string): string {
  const uid = userId || getCurrentUserId();
  return `jrmd_current_colors_${uid}`;
}

export function getUserActiveThemeKey(userId?: string): string {
  const uid = userId || getCurrentUserId();
  return `jrmd_active_theme_id_${uid}`;
}

export function getUserPresetsKey(userId?: string): string {
  const uid = userId || getCurrentUserId();
  return `jrmd_theme_presets_${uid}`;
}

let lastThemeSignalTimestamp = 0;
let lastPresetSignalTimestamp = 0;

/**
 * Save user's active theme selection to Cloud D1 Database and LocalStorage (namespaced per User ID)
 */
export async function saveUserActiveTheme(colors: Record<string, any>, themeId?: string): Promise<void> {
  if (typeof window === "undefined") return;

  const userId = getCurrentUserId();
  const colorsKey = getUserColorsKey(userId);
  const themeKey = getUserActiveThemeKey(userId);

  const colorsJson = JSON.stringify(colors);
  const existingColors = localStorage.getItem(colorsKey);
  const existingThemeId = localStorage.getItem(themeKey);

  // Skip duplicate saves if colors and themeId haven't changed
  const isUnchanged = existingColors === colorsJson && (!themeId || existingThemeId === themeId);

  // 1. Save to User-Namespaced LocalStorage immediately
  if (themeId) {
    localStorage.setItem(themeKey, themeId);
    localStorage.setItem(ACTIVE_THEME_KEY, themeId);
  }
  localStorage.setItem(colorsKey, colorsJson);
  localStorage.setItem(CURRENT_COLORS_KEY, colorsJson);

  // 2. Apply theme live
  applyStoredThemeColors(userId);

  if (isUnchanged) {
    return; // 0 Extra DB Writes/Reads if unchanged
  }

  const now = Date.now();
  lastThemeSignalTimestamp = now;

  // 3. Sync to Cloud D1 Database via D1 Proxy
  try {
    const payload = {
      url: `${DEFAULT_WORKER_URL}/sync`,
      method: "POST",
      headers: {
        "Authorization": "Bearer jrmd2026",
        "Content-Type": "application/json",
        "X-User-Id": userId
      },
      body: {
        collection: "user_themes",
        changes: [{
          id: userId,
          data: {
            activeThemeId: themeId || null,
            colors,
            userId,
            updatedAt: new Date(now).toISOString()
          },
          operation: "upsert",
          updated_at: now
        }]
      }
    };

    fetch("/api/d1-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => {});
  } catch (e) {
    console.warn("Could not sync user theme to Cloud D1 (saved locally):", e);
  }

  // 4. Broadcast Instant Real-Time Cross-Device Signal via Firebase RTDB
  try {
    const { rtdb, ref, set } = await import("@/lib/firebase");
    const signalRef = ref(rtdb, `theme_signals/${userId}`);
    await set(signalRef, {
      updatedAt: now,
      userId,
      activeThemeId: themeId || null,
      colors
    });
  } catch (e) {
    console.warn("RTDB cross-device theme signal broadcast error:", e);
  }
}

/**
 * Subscribe to Instant Cross-Device Live Theme Signals via Firebase RTDB
 * @param onUpdate - optional callback when theme signal is received
 * @param overrideUserId - if provided, subscribes to this userId's signals (used after auth loads)
 */
export function subscribeUserThemeSignals(
  onUpdate?: (colors: Record<string, any>, themeId?: string) => void,
  overrideUserId?: string
): () => void {
  if (typeof window === "undefined") return () => {};
  const userId = overrideUserId || getCurrentUserId();
  let unsub: (() => void) | null = null;

  // Reset timestamp gate when subscribing for a specific user
  // so fresh signals from RTDB are always applied
  if (overrideUserId) {
    lastThemeSignalTimestamp = 0;
  }

  try {
    import("@/lib/firebase").then(({ rtdb, ref, onValue }) => {
      const signalRef = ref(rtdb, `theme_signals/${userId}`);
      unsub = onValue(signalRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.colors && data.updatedAt) {
          // Gate by timestamp to prevent duplicate reads on listener attach
          if (data.updatedAt <= lastThemeSignalTimestamp) {
            return;
          }
          lastThemeSignalTimestamp = data.updatedAt;

          const colorsKey = getUserColorsKey(userId);
          const themeKey = getUserActiveThemeKey(userId);

          localStorage.setItem(colorsKey, JSON.stringify(data.colors));
          localStorage.setItem(CURRENT_COLORS_KEY, JSON.stringify(data.colors));
          if (data.activeThemeId) {
            localStorage.setItem(themeKey, data.activeThemeId);
            localStorage.setItem(ACTIVE_THEME_KEY, data.activeThemeId);
          }
          applyStoredThemeColors(userId);
          onUpdate?.(data.colors, data.activeThemeId);
        }
      });
    }).catch(() => {});
  } catch (e) {}

  return () => {
    if (unsub) unsub();
  };
}


/**
 * Sync user theme from Cloud D1 Database on Login or Page Load
 */
export async function syncUserThemeFromCloud(forceFetch = false): Promise<void> {
  if (typeof window === "undefined") return;
  const userId = getCurrentUserId();

  const colorsKey = getUserColorsKey(userId);
  const themeKey = getUserActiveThemeKey(userId);
  const userLocalColors = localStorage.getItem(colorsKey);

  // 1. Apply user local theme if available for this specific user
  if (userLocalColors) {
    try {
      localStorage.setItem(CURRENT_COLORS_KEY, userLocalColors);
      const userThemeId = localStorage.getItem(themeKey);
      if (userThemeId) localStorage.setItem(ACTIVE_THEME_KEY, userThemeId);
    } catch (e) {}
    applyStoredThemeColors(userId);
    if (!forceFetch) {
      return; // Skip cloud network read if local user cache is present (0 extra reads)
    }
  } else {
    try {
      localStorage.removeItem(CURRENT_COLORS_KEY);
      localStorage.removeItem(ACTIVE_THEME_KEY);
    } catch (e) {}
    applyStoredThemeColors(userId);
  }

  // 2. Fetch User Theme from Cloud D1
  try {
    const payload = {
      url: `${DEFAULT_WORKER_URL}/sync`,
      method: "GET",
      headers: {
        "Authorization": "Bearer jrmd2026",
        "X-User-Id": userId
      }
    };

    const response = await fetch("/api/d1-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const resData = await response.json();
      const results = resData.results || resData;
      if (Array.isArray(results) && results.length > 0) {
        let userDocData: any = null;

        for (const rec of results) {
          try {
            const parsed = typeof rec.data === "string" ? JSON.parse(rec.data) : rec.data;
            if (parsed && (parsed.userId === userId || rec.docId === userId || rec.id?.endsWith(userId))) {
              userDocData = parsed;
              break;
            }
          } catch (e) {}
        }

        if (!userDocData) {
          const directMatch = results.find((r: any) => r.docId === userId || (typeof r.id === 'string' && r.id.endsWith(`:${userId}`)));
          if (directMatch) {
            try {
              userDocData = typeof directMatch.data === "string" ? JSON.parse(directMatch.data) : directMatch.data;
            } catch (e) {}
          }
        }

        if (userDocData && userDocData.colors) {
          localStorage.setItem(colorsKey, JSON.stringify(userDocData.colors));
          localStorage.setItem(CURRENT_COLORS_KEY, JSON.stringify(userDocData.colors));
          if (userDocData.activeThemeId) {
            localStorage.setItem(themeKey, userDocData.activeThemeId);
            localStorage.setItem(ACTIVE_THEME_KEY, userDocData.activeThemeId);
          }
          applyStoredThemeColors(userId);
        }
      }
    }
  } catch (e) {
    console.warn("Cloud D1 theme fetch error (using local theme):", e);
  }
}

/**
 * Sync Global / User Presets from Cloud D1
 */
export async function syncGlobalPresetsFromCloud(): Promise<CustomThemePreset[]> {
  if (typeof window === "undefined") return DEFAULT_THEMES;

  const userId = getCurrentUserId();
  let localPresets = DEFAULT_THEMES;

  // Always read from shared global STORAGE_KEY first
  const savedGlobal = localStorage.getItem(STORAGE_KEY);
  if (savedGlobal) {
    try {
      const parsed = JSON.parse(savedGlobal);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const presetMap = new Map<string, CustomThemePreset>();
        parsed.forEach(p => presetMap.set(p.id, p));
        // DEFAULT_THEMES system presets always override stale local data
        DEFAULT_THEMES.forEach(p => presetMap.set(p.id, p));
        localPresets = Array.from(presetMap.values()).filter(p => !['classic-amber', 'deep-slate-dark', 'emerald-finance'].includes(p.id));
      }
    } catch (e) {}
  }

  try {
    const payload = {
      url: `${DEFAULT_WORKER_URL}/sync`,
      method: "GET",
      headers: {
        "Authorization": "Bearer jrmd2026",
        "X-User-Id": userId
      }
    };

    const response = await fetch("/api/d1-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const resData = await response.json();
      const results = resData.results || resData;
      if (Array.isArray(results) && results.length > 0) {
        let cloudPresets: CustomThemePreset[] = [];

        // Search for global_presets doc or app_theme_presets collection records
        for (const r of results) {
          if (r.collection === "app_theme_presets" || r.docId === "global_presets" || (typeof r.id === 'string' && r.id.includes("global_presets"))) {
            try {
              const data = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
              const list = data.presets || data;
              if (Array.isArray(list) && list.length > 0) {
                cloudPresets = list;
                break;
              }
            } catch (e) {}
          }
        }

        if (cloudPresets.length > 0) {
          // Cloud D1 is AUTHORITATIVE — do NOT merge with local stale data.
          // Merging local would resurrect deleted presets on Device B.
          const presetMap = new Map<string, CustomThemePreset>();
          cloudPresets.forEach(p => presetMap.set(p.id, p));
          // Always ensure system DEFAULT_THEMES are present (they cannot be deleted)
          DEFAULT_THEMES.forEach(p => presetMap.set(p.id, p));

          const merged = Array.from(presetMap.values()).filter(p => !['classic-amber', 'deep-slate-dark', 'emerald-finance'].includes(p.id));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          return merged;
        }
      }
    }
  } catch (e) {
    console.warn("Could not fetch theme presets from Cloud D1 (using local presets):", e);
  }

  return localPresets;
}

/**
 * Save / Update Preset in Cloud D1 and Broadcast Realtime Signal to All Devices
 */
export async function saveGlobalPresetToCloud(updatedPresets: CustomThemePreset[]): Promise<void> {
  if (typeof window === "undefined") return;

  const userId = getCurrentUserId();
  const presetsKey = getUserPresetsKey(userId);

  localStorage.setItem(presetsKey, JSON.stringify(updatedPresets));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPresets));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("jrmd-presets-updated", { detail: updatedPresets }));
  }

  // 1. Cloud D1 Push
  try {
    const payload = {
      url: `${DEFAULT_WORKER_URL}/sync`,
      method: "POST",
      headers: {
        "Authorization": "Bearer jrmd2026",
        "Content-Type": "application/json",
        "X-User-Id": userId
      },
      body: {
        collection: "app_theme_presets",
        changes: [{
          id: "global_presets",
          data: { presets: updatedPresets, updatedAt: new Date().toISOString() },
          operation: "upsert",
          updated_at: Date.now()
        }]
      }
    };

    fetch("/api/d1-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => {});
  } catch (e) {
    console.warn("Could not save theme presets to Cloud D1 (saved locally):", e);
  }

  // 2. Broadcast Instant Real-Time Preset Signal to All Devices via Firebase RTDB
  try {
    const { rtdb, ref, set } = await import("@/lib/firebase");
    const signalRef = ref(rtdb, "global_preset_signals/current");
    await set(signalRef, {
      updatedAt: Date.now(),
      presets: updatedPresets
    });
  } catch (e) {
    console.warn("RTDB global preset broadcast error:", e);
  }
}

/**
 * Subscribe to Real-Time Global Preset Signals (Firebase RTDB + Local Events) across all devices
 */
export function subscribeGlobalPresetSignals(onPresetsUpdated: (presets: CustomThemePreset[]) => void): () => void {
  if (typeof window === "undefined") return () => {};
  let unsubRTDB: (() => void) | null = null;

  const handleEvent = (e: any) => {
    if (e.detail && Array.isArray(e.detail)) {
      onPresetsUpdated(e.detail);
    } else {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try { onPresetsUpdated(JSON.parse(saved)); } catch (err) {}
      }
    }
  };

  window.addEventListener("jrmd-presets-updated", handleEvent as any);

  try {
    import("@/lib/firebase").then(({ rtdb, ref, onValue }) => {
      const signalRef = ref(rtdb, "global_preset_signals/current");
      unsubRTDB = onValue(signalRef, (snapshot) => {
        const data = snapshot.val();
        if (data && Array.isArray(data.presets)) {
          const cloudPresets = data.presets as CustomThemePreset[];

          // RTDB signal is AUTHORITATIVE — do NOT merge with local stale data.
          // If we merge local into the map first, deleted presets get resurrected
          // on Device B (they exist in local but not in cloudPresets anymore).
          const presetMap = new Map<string, CustomThemePreset>();
          cloudPresets.forEach(p => presetMap.set(p.id, p));
          // Always ensure system DEFAULT_THEMES are present (they cannot be deleted)
          DEFAULT_THEMES.forEach(p => presetMap.set(p.id, p));

          const merged = Array.from(presetMap.values()).filter(p => !['classic-amber', 'deep-slate-dark', 'emerald-finance'].includes(p.id));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          onPresetsUpdated(merged);
        }
      });
    }).catch(() => {});
  } catch (e) {}

  return () => {
    window.removeEventListener("jrmd-presets-updated", handleEvent as any);
    if (unsubRTDB) unsubRTDB();
  };
}
