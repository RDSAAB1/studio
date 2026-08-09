"use client";

import { useEffect } from "react";
import { applyStoredThemeColors } from "@/lib/theme-initializer";
import { syncUserThemeFromCloud } from "@/lib/firestore/theme-sync";
import { getFirebaseAuth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export function ThemeInitializerProvider() {
  useEffect(() => {
    // 1. Instant local restore
    applyStoredThemeColors();

    // 2. Cloud user theme sync
    syncUserThemeFromCloud();

    // 3. Listen to auth changes
    try {
      const auth = getFirebaseAuth();
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user) {
          syncUserThemeFromCloud();
        }
      });
      return () => unsub();
    } catch (e) {}
  }, []);

  return null;
}
