"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { electronNavigate } from "@/lib/electron-navigate";
import { Tabs } from "@/components/ui/tabs";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

const SimpleSupplierEntryAllFields = dynamic(
  () => import("@/app/sales/supplier-entry/simple-supplier-entry-all-fields"),
  { 
    loading: () => <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>,
    ssr: false 
  }
);
const CustomerEntryClient = dynamic(
  () => import("@/components/sales/customer-entry/customer-entry-client"),
  { 
    loading: () => <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>,
    ssr: false
  }
);

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
    electronNavigate(`/sales/entry?${params.toString()}`, router, { method: 'push' });
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

