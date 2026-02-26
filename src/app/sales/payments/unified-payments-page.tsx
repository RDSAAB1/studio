"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLayoutSubnav } from "@/components/layout/app-layout";
import SupplierPaymentsClient from '../supplier-payments/unified-payments-client';

export default function UnifiedPaymentsPage({ defaultTab = "supplier" }: { defaultTab?: "supplier" | "customer" | "outsider" }) {
  const searchParams = useSearchParams();
  const setSubnav = useLayoutSubnav();
  const [activeTab, setActiveTab] = useState<"supplier" | "customer" | "outsider">(defaultTab);
  
  // Update tab when defaultTab changes (from URL query)
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);
  
  const handleTabChange = useCallback((value: "supplier" | "customer" | "outsider") => {
    setActiveTab(value);
    // Update URL query parameter silently without triggering Next.js navigation to avoid lag
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
  }, [searchParams]);

  const subTabs = useMemo(
    () =>
      [
        { value: "supplier" as const, label: "Supplier Payments" },
        { value: "customer" as const, label: "Customer Payments" },
        { value: "outsider" as const, label: "RTGS Outsider" },
      ],
    []
  );

  useEffect(() => {
    setSubnav(
      <div
        className="grid w-full gap-1"
        style={{ gridTemplateColumns: `repeat(${subTabs.length}, minmax(0, 1fr))` }}
      >
        {subTabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => handleTabChange(t.value)}
            className={cn(
              "h-8 w-full rounded-md px-2 text-xs font-semibold transition-colors",
              "text-slate-700 hover:bg-white/60 hover:text-slate-950",
              activeTab === t.value && "bg-white/80 text-slate-950 border border-slate-200/80"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    );

    return () => setSubnav(null);
  }, [activeTab, handleTabChange, setSubnav, subTabs]);

  // Keep all components mounted but hide inactive ones (SPMS behavior)
  return (
    <div className="w-full">
      <div className={activeTab === "supplier" ? "block" : "hidden"}>
        <SupplierPaymentsClient type="supplier" />
      </div>
      <div className={activeTab === "customer" ? "block" : "hidden"}>
        <SupplierPaymentsClient type="customer" />
      </div>
      <div className={activeTab === "outsider" ? "block" : "hidden"}>
        <SupplierPaymentsClient type="outsider" />
      </div>
    </div>
  );
}
