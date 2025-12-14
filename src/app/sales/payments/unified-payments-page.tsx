"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SupplierPaymentsClient from '../supplier-payments/unified-payments-client';

export default function UnifiedPaymentsPage({ defaultTab = "supplier" }: { defaultTab?: "supplier" | "customer" | "outsider" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"supplier" | "customer" | "outsider">(defaultTab);
  
  // Update tab when defaultTab changes (from URL query)
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);
  
  const handleTabChange = (value: "supplier" | "customer" | "outsider") => {
    setActiveTab(value);
    // Update URL query parameter
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.push(`/sales/payments?${params.toString()}`, { scroll: false });
  };

  // Keep all components mounted but hide inactive ones (SPMS behavior)
  return (
    <div className="space-y-4 w-full">
      <Tabs value={activeTab} onValueChange={(value) => handleTabChange(value as "supplier" | "customer" | "outsider")} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="supplier">Supplier Payments</TabsTrigger>
          <TabsTrigger value="customer">Customer Payments</TabsTrigger>
          <TabsTrigger value="outsider">RTGS Outsider</TabsTrigger>
        </TabsList>
        
        {/* Keep all components mounted - just hide/show with CSS */}
        <div className="mt-4">
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
      </Tabs>
    </div>
  );
}

