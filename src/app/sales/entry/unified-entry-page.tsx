"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import SimpleSupplierEntryAllFields from "@/app/sales/supplier-entry/simple-supplier-entry-all-fields";
import CustomerEntryClient from "@/components/sales/customer-entry/customer-entry-client";

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

  return (
    <div className="space-y-4 w-full">
      <Tabs value={activeTab} onValueChange={(value) => handleTabChange(value as "supplier" | "customer")} className="w-full">
        <TabsContent value="supplier" className="mt-0">
          <SimpleSupplierEntryAllFields />
        </TabsContent>
        <TabsContent value="customer" className="mt-0">
          <CustomerEntryClient />
        </TabsContent>
      </Tabs>
    </div>
  );
}

