"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";
import SimpleSupplierEntryAllFields from "@/app/sales/supplier-entry/simple-supplier-entry-all-fields";
import CustomerEntryClient from "@/components/sales/customer-entry/customer-entry-client";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function UnifiedEntryPage({ defaultTab = "supplier" }: { defaultTab?: "supplier" | "customer" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"supplier" | "customer">(defaultTab);
  
  // Update tab when defaultTab changes (from URL query)
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const handleTabChange = (value: "supplier" | "customer") => {
    setActiveTab(value);
    // Update URL query parameter
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.push(`/sales/entry?${params.toString()}`, { scroll: false });
  };

  // Keep both components mounted but hide inactive one (like SPMS behavior)
  return (
    <div className="space-y-4 w-full">
      <Tabs value={activeTab} onValueChange={(value) => handleTabChange(value as "supplier" | "customer")} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="supplier">Supplier Entry</TabsTrigger>
          <TabsTrigger value="customer">Customer Entry</TabsTrigger>
        </TabsList>
        
        {/* Keep both components mounted - just hide/show with CSS */}
        <div className="mt-4">
          <div className={activeTab === "supplier" ? "block" : "hidden"}>
            <SimpleSupplierEntryAllFields />
          </div>
          <div className={activeTab === "customer" ? "block" : "hidden"}>
            <CustomerEntryClient />
          </div>
        </div>
      </Tabs>
    </div>
  );
}

