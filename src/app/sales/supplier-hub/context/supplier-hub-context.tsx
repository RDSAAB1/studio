"use client";

import { createContext, useContext, ReactNode } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";

type SectionKey = "overview" | "entry" | "payments";

interface SupplierHubContextType {
  activeSection: SectionKey;
  setActiveSection: (section: SectionKey) => void;
}

const SupplierHubContext = createContext<SupplierHubContextType | undefined>(undefined);

export function SupplierHubProvider({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = usePersistedState<SectionKey>(
    "supplier-hub:active-section",
    "overview"
  );

  return (
    <SupplierHubContext.Provider value={{ activeSection, setActiveSection }}>
      {children}
    </SupplierHubContext.Provider>
  );
}

export function useSupplierHubContext() {
  const context = useContext(SupplierHubContext);
  if (!context) {
    return null;
  }
  return context;
}

