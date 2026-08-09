"use client";

import { useEffect } from "react";
import { applyStoredThemeColors } from "@/lib/theme-initializer";

export function ThemeInitializerProvider() {
  useEffect(() => {
    applyStoredThemeColors();
  }, []);

  return null;
}
