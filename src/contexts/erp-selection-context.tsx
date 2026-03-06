"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useLayoutEffect, type ReactNode } from "react";
import { refreshTenantFirestoreBindings } from "@/lib/firestore";
import { clearLocalDataForContextSwitch } from "@/lib/tenancy";

export type ErpSelection = {
  companyId: string;
  subCompanyId: string;
  seasonKey: string;
} | null;

const ERP_SELECTION_KEY = "erpSelection";

/** Read company/sub/season from localStorage (client-only). Exported so selector can use it before context has restored. */
export function loadStoredErpSelection(): ErpSelection {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ERP_SELECTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ErpSelection;
    if (parsed && parsed.companyId && parsed.subCompanyId && parsed.seasonKey) {
      return parsed;
    }
  } catch {}
  return null;
}

function loadStored(): ErpSelection {
  return loadStoredErpSelection();
}

function saveStored(sel: ErpSelection) {
  if (typeof window === "undefined") return;
  if (sel) {
    localStorage.setItem(ERP_SELECTION_KEY, JSON.stringify(sel));
  } else {
    localStorage.removeItem(ERP_SELECTION_KEY);
  }
  window.dispatchEvent(new CustomEvent("erp:selection-changed", { detail: sel }));
}

type SetSelectionOptions = { skipReload?: boolean };

type ErpContextValue = {
  selection: ErpSelection;
  setSelection: (sel: ErpSelection, options?: SetSelectionOptions) => void | Promise<void>;
  isErpMode: boolean;
};

const ErpSelectionContext = createContext<ErpContextValue | null>(null);

export function ErpSelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelectionState] = useState<ErpSelection>(null);

  // Restore from localStorage as early as possible (useLayoutEffect runs before paint so selection is set before children's effects).
  useLayoutEffect(() => {
    const stored = loadStored();
    if (stored) setSelectionState(stored);
  }, []);

  const setSelection = useCallback(async (sel: ErpSelection, options?: SetSelectionOptions) => {
    setSelectionState(sel);
    saveStored(sel);
    refreshTenantFirestoreBindings();
    await clearLocalDataForContextSwitch();
    if (!options?.skipReload && typeof window !== "undefined") {
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    const handler = () => setSelectionState(loadStored());
    window.addEventListener("erp:selection-changed", handler);
    return () => window.removeEventListener("erp:selection-changed", handler);
  }, []);

  const value: ErpContextValue = {
    selection,
    setSelection,
    isErpMode: !!selection,
  };

  return (
    <ErpSelectionContext.Provider value={value}>
      {children}
    </ErpSelectionContext.Provider>
  );
}

export function useErpSelection() {
  const ctx = useContext(ErpSelectionContext);
  if (!ctx) throw new Error("useErpSelection must be used within ErpSelectionProvider");
  return ctx;
}

export function useErpSelectionOptional() {
  return useContext(ErpSelectionContext);
}
