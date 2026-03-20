"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Syncs ?electron=1 from URL and sets __ELECTRON__ so navigation uses full http URLs.
 * Must be wrapped in <Suspense> because it uses useSearchParams().
 */
export function ElectronParamSync() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (searchParams.get("electron") === "1") {
      (window as any).__ELECTRON__ = true;
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete("electron");
      const q = sp.toString();
      const clean = (pathname || "/") + (q ? "?" + q : "");
      router.replace(clean);
    }
  }, [searchParams, router, pathname]);

  return null;
}
