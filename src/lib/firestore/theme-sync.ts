import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { firestoreDB, getFirebaseAuth } from "../firebase";
import { applyStoredThemeColors } from "../theme-initializer";
import { DEFAULT_THEMES, type CustomThemePreset } from "@/components/settings/theme-settings-card";

export const STORAGE_KEY = "jrmd_theme_presets";
export const ACTIVE_THEME_KEY = "jrmd_active_theme_id";
export const CURRENT_COLORS_KEY = "jrmd_current_colors";

export function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  const auth = getFirebaseAuth();
  const firebaseUser = auth.currentUser;
  if (firebaseUser?.uid) return firebaseUser.uid;
  if (firebaseUser?.email) return firebaseUser.email.replace(/[^a-zA-Z0-9]/g, "_");
  
  const memberUsername = localStorage.getItem("companyUser_username");
  if (memberUsername) return memberUsername.replace(/[^a-zA-Z0-9]/g, "_");

  const lastUserId = localStorage.getItem("lastUserId");
  if (lastUserId) return lastUserId.replace(/[^a-zA-Z0-9]/g, "_");

  return null;
}

/**
 * Save user's active theme selection to Cloud (Firestore) and LocalStorage
 */
export async function saveUserActiveTheme(colors: Record<string, any>, themeId?: string): Promise<void> {
  if (typeof window === "undefined") return;

  // 1. Save to LocalStorage immediately
  if (themeId) {
    localStorage.setItem(ACTIVE_THEME_KEY, themeId);
  }
  localStorage.setItem(CURRENT_COLORS_KEY, JSON.stringify(colors));

  // 2. Apply theme live
  applyStoredThemeColors();

  // 3. Sync to Firestore under User ID if logged in
  const userId = getCurrentUserId();
  if (userId) {
    try {
      const userThemeDocRef = doc(firestoreDB, "user_themes", userId);
      await setDoc(userThemeDocRef, {
        activeThemeId: themeId || null,
        colors,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn("Could not sync user theme to cloud (saved locally):", e);
    }
  }
}

/**
 * Sync user theme from Cloud on Login or Page Load
 */
export async function syncUserThemeFromCloud(): Promise<void> {
  if (typeof window === "undefined") return;
  const userId = getCurrentUserId();
  if (!userId) {
    applyStoredThemeColors();
    return;
  }

  try {
    const userThemeDocRef = doc(firestoreDB, "user_themes", userId);
    const docSnap = await getDoc(userThemeDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.colors) {
        localStorage.setItem(CURRENT_COLORS_KEY, JSON.stringify(data.colors));
      }
      if (data.activeThemeId) {
        localStorage.setItem(ACTIVE_THEME_KEY, data.activeThemeId);
      }
      applyStoredThemeColors();
    } else {
      applyStoredThemeColors();
    }
  } catch (e) {
    applyStoredThemeColors();
  }
}

/**
 * Sync Global Presets from Cloud
 */
export async function syncGlobalPresetsFromCloud(): Promise<CustomThemePreset[]> {
  if (typeof window === "undefined") return DEFAULT_THEMES;

  let localPresets = DEFAULT_THEMES;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      localPresets = JSON.parse(saved);
    } catch (e) {}
  }

  try {
    const globalDocRef = doc(firestoreDB, "app_settings", "theme_presets");
    const docSnap = await getDoc(globalDocRef);
    if (docSnap.exists()) {
      const cloudPresets = docSnap.data().presets as CustomThemePreset[];
      if (Array.isArray(cloudPresets) && cloudPresets.length > 0) {
        // Merge cloud presets with default presets
        const presetMap = new Map<string, CustomThemePreset>();
        DEFAULT_THEMES.forEach(p => presetMap.set(p.id, p));
        cloudPresets.forEach(p => presetMap.set(p.id, p));
        const merged = Array.from(presetMap.values());
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
    }
  } catch (e) {
    console.warn("Could not fetch global theme presets from cloud (using local presets):", e);
  }

  return localPresets;
}

/**
 * Save / Update Global Preset in Cloud
 */
export async function saveGlobalPresetToCloud(updatedPresets: CustomThemePreset[]): Promise<void> {
  if (typeof window === "undefined") return;

  // Local save first
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPresets));

  // Sync to Cloud
  try {
    const globalDocRef = doc(firestoreDB, "app_settings", "theme_presets");
    await setDoc(globalDocRef, {
      presets: updatedPresets,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.warn("Could not save theme presets to cloud (saved locally):", e);
  }
}
