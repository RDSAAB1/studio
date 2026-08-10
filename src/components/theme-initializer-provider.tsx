"use client";

import { useEffect, useRef } from "react";
import { applyStoredThemeColors } from "@/lib/theme-initializer";
import {
  syncUserThemeFromCloud,
  subscribeUserThemeSignals,
  subscribeGlobalPresetSignals,
  getCurrentUserId,
  STORAGE_KEY,
} from "@/lib/firestore/theme-sync";
import { getFirebaseAuth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export function ThemeInitializerProvider() {
  // Ref to always hold the latest unsubscribe function for user theme signals
  const unsubUserSignalRef = useRef<(() => void) | null>(null);
  // Track the userId we are currently subscribed to, avoid duplicate re-subscriptions
  const subscribedUserIdRef = useRef<string>("");

  useEffect(() => {
    // 1. Instant local restore — applies saved theme immediately on page load
    applyStoredThemeColors();

    // 2. Cloud user theme sync — pull latest from D1 on startup
    syncUserThemeFromCloud();

    // ------------------------------------------------------------------
    // Helper: re-subscribe RTDB user theme listener for the given userId.
    // Called on initial load AND every time auth/user changes to make sure
    // Device B always listens on the correct RTDB path (theme_signals/<userId>)
    // ------------------------------------------------------------------
    const resubscribeUserSignal = (userId?: string) => {
      const uid = userId || getCurrentUserId();
      // Skip if already subscribed to same uid to avoid double-listeners
      if (uid === subscribedUserIdRef.current && unsubUserSignalRef.current) return;

      // Unsubscribe old listener first
      if (unsubUserSignalRef.current) {
        unsubUserSignalRef.current();
        unsubUserSignalRef.current = null;
      }

      subscribedUserIdRef.current = uid;
      unsubUserSignalRef.current = subscribeUserThemeSignals(undefined, uid);
    };

    // 3. Initial subscription (userId might be 'guest' before Firebase auth resolves)
    resubscribeUserSignal();

    // ------------------------------------------------------------------
    // FIX 1: Global Preset Delete Sync
    // Subscribe to global preset signals at APP LEVEL (not just settings page)
    // so ALL devices receive preset changes (including deletes) at all times.
    // ------------------------------------------------------------------
    const unsubGlobalPresets = subscribeGlobalPresetSignals((newPresets) => {
      // Persist the updated preset list to shared localStorage key so
      // the next time settings page loads, it shows the correct list.
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newPresets));
      } catch (e) {}
      // No React state update needed here — settings page has its own subscriber.
    });

    // 4. Listen to cross-tab localStorage changes (companyUser login switch)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "companyUser_username" || e.key === "lastUserId") {
        syncUserThemeFromCloud();
        // Re-subscribe RTDB listener with potentially new userId
        resubscribeUserSignal();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // ------------------------------------------------------------------
    // FIX 2: Theme Selection Sync Across Devices
    // On EVERY auth state change re-subscribe the RTDB listener with the
    // now-authenticated userId. Previously it was locked to 'guest' path.
    // ------------------------------------------------------------------
    let unsubAuth: (() => void) | undefined;
    try {
      const auth = getFirebaseAuth();
      unsubAuth = onAuthStateChanged(auth, (user) => {
        // Pull latest theme from cloud for the authenticated user
        syncUserThemeFromCloud();
        // Re-subscribe RTDB listener to the correct authenticated userId path
        resubscribeUserSignal();
      });
    } catch (e) {
      // Firebase unavailable — local-only mode, still works
    }

    return () => {
      if (unsubUserSignalRef.current) unsubUserSignalRef.current();
      unsubGlobalPresets();
      window.removeEventListener("storage", handleStorageChange);
      if (unsubAuth) unsubAuth();
    };
  }, []);

  return null;
}
