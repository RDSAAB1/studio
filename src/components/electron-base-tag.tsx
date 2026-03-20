"use client";

import { useEffect } from "react";
import { getAppBaseUrl, isElectron } from "@/lib/electron-navigate";

/**
 * In Electron, sets <base href="http://127.0.0.1:3000/"> so relative URLs
 * (fetch, links, assets) resolve to the Next.js server instead of app://
 */
export function ElectronBaseTag() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isElectron()) return;
    const baseUrl = getAppBaseUrl();
    if (!baseUrl || !baseUrl.startsWith("http")) return;

    let base = document.querySelector('base[data-electron-base]');
    if (!base) {
      base = document.createElement("base");
      base.setAttribute("data-electron-base", "true");
      document.head.insertBefore(base, document.head.firstChild);
    }
    (base as HTMLBaseElement).href = baseUrl.replace(/\/$/, "") + "/";
  }, []);

  return null;
}
