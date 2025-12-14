"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SimpleSupplierEntryAllFields from "./supplier-entry/simple-supplier-entry-all-fields";
import CustomerEntryClient from "@/components/sales/customer-entry/customer-entry-client";
import SupplierPaymentsClient from "./supplier-payments/unified-payments-client";
import IncomeExpenseClient from "@/app/expense-tracker/expense-tracker-client";
import LedgerPageComponent from "./ledger/page";
import DailyPaymentsPage from "./daily-payments/page";
import RtgsReportClient from "./rtgs-report/rtgs-report-client";
import DailySupplierReportClient from "./daily-supplier-report/daily-supplier-report-client";
import SixRReportPage from "./6r-report/page";
import VoucherImportTool from "@/app/tools/voucher-import/page";
import { MandiReportHistory } from "@/components/sales/mandi-report-history";
import FirestoreMonitorPage from "@/app/admin/firestore-monitor/page";

type SalesTab = "supplier-entry" | "customer-entry" | "supplier-payments" | "customer-payments" | "rtgs-outsider" | "income-expense" | "ledger" | "daily-payments" | "rtgs-report" | "daily-supplier-report" | "6r-report" | "voucher-import" | "mandi-report-history" | "firestore-monitor";
type MenuType = "entry" | "payments" | "reports";

export default function UnifiedSalesPage({ defaultTab = "supplier-entry", defaultMenu = "entry" }: { defaultTab?: SalesTab; defaultMenu?: MenuType }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SalesTab>(defaultTab);
  const [menuType, setMenuType] = useState<MenuType>(defaultMenu);
  
  // Get menu type from URL or use default
  useEffect(() => {
    const menuParam = searchParams.get('menu') as MenuType;
    if (menuParam === 'entry' || menuParam === 'payments' || menuParam === 'reports') {
      setMenuType(menuParam);
    } else {
      // Auto-detect menu type from tab
      if (defaultTab === 'supplier-entry' || defaultTab === 'customer-entry') {
        setMenuType('entry');
      } else if (defaultTab === 'daily-payments' || defaultTab === 'rtgs-report' || defaultTab === 'daily-supplier-report' || defaultTab === '6r-report' || defaultTab === 'voucher-import' || defaultTab === 'mandi-report-history' || defaultTab === 'firestore-monitor') {
        setMenuType('reports');
      } else {
        setMenuType('payments');
      }
    }
  }, [searchParams, defaultTab]);
  
  // Update menu type and tab from URL query
  useEffect(() => {
    const menuParam = searchParams.get('menu') as MenuType;
    const tabParam = searchParams.get('tab') as SalesTab;
    
    if (menuParam === 'entry' || menuParam === 'payments' || menuParam === 'reports') {
      setMenuType(menuParam);
    }
    
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);
  
  const handleTabChange = (value: SalesTab) => {
    setActiveTab(value);
    // Update URL query parameter
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    params.set('menu', menuType);
    router.push(`/sales?${params.toString()}`, { scroll: false });
  };
  
  // Define tabs based on menu type
  const entryTabs: SalesTab[] = ["supplier-entry", "customer-entry"];
  const paymentTabs: SalesTab[] = ["supplier-payments", "customer-payments", "rtgs-outsider", "income-expense", "ledger"];
  const reportTabs: SalesTab[] = ["daily-payments", "rtgs-report", "daily-supplier-report", "6r-report", "voucher-import", "mandi-report-history", "firestore-monitor"];
  const visibleTabs = menuType === "entry" ? entryTabs : menuType === "reports" ? reportTabs : paymentTabs;
  
  // Ensure active tab is valid for current menu type
  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      // Switch to first tab of current menu type
      const firstTab = visibleTabs[0];
      setActiveTab(firstTab);
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', firstTab);
      params.set('menu', menuType);
      router.push(`/sales?${params.toString()}`, { scroll: false });
    }
  }, [menuType, visibleTabs, activeTab, searchParams, router]);

  // Keep all components mounted but hide inactive ones (SPMS behavior)
  // Data loads initially via global context, then uses realtime CRUD
  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={(value) => handleTabChange(value as SalesTab)} className="w-full">
        {/* Sticky Tab Bar - stays fixed when page scrolls, shows tabs based on menu type */}
        <div className="sticky top-0 z-40 bg-card border-b mb-4 -mx-4 px-4 pt-2 pb-2">
          <TabsList className={`flex w-full h-auto items-center justify-start rounded-md bg-muted p-1 text-muted-foreground gap-1 overflow-x-hidden`}>
            {menuType === "entry" ? (
              <>
                <TabsTrigger value="supplier-entry" className="flex-1 whitespace-nowrap px-2 py-1.5 text-xs text-center">Supplier Entry</TabsTrigger>
                <TabsTrigger value="customer-entry" className="flex-1 whitespace-nowrap px-2 py-1.5 text-xs text-center">Customer Entry</TabsTrigger>
              </>
            ) : menuType === "reports" ? (
              <>
                <TabsTrigger value="daily-payments" className="flex-1 whitespace-nowrap px-2 py-1.5 text-xs text-center">Daily Payments</TabsTrigger>
                <TabsTrigger value="rtgs-report" className="flex-1 whitespace-nowrap px-2 py-1.5 text-xs text-center">RTGS Report</TabsTrigger>
                <TabsTrigger value="daily-supplier-report" className="flex-1 whitespace-nowrap px-2 py-1.5 text-xs text-center">Daily Supplier Report</TabsTrigger>
                <TabsTrigger value="6r-report" className="flex-1 whitespace-nowrap px-2 py-1.5 text-xs text-center">6R Report</TabsTrigger>
                <TabsTrigger value="voucher-import" className="flex-1 whitespace-nowrap px-2 py-1.5 text-xs text-center">Mandi Import</TabsTrigger>
                <TabsTrigger value="mandi-report-history" className="flex-1 whitespace-nowrap px-2 py-1.5 text-xs text-center">Mandi History</TabsTrigger>
                <TabsTrigger value="firestore-monitor" className="flex-1 whitespace-nowrap px-2 py-1.5 text-xs text-center">Firestore Monitor</TabsTrigger>
              </>
            ) : (
              <>
                <TabsTrigger value="supplier-payments" className="flex-1 whitespace-nowrap px-2 py-1.5 text-xs text-center">Supplier Payments</TabsTrigger>
                <TabsTrigger value="customer-payments" className="flex-1 whitespace-nowrap px-2 py-1.5 text-xs text-center">Customer Payments</TabsTrigger>
                <TabsTrigger value="rtgs-outsider" className="flex-1 whitespace-nowrap px-2 py-1.5 text-xs text-center">RTGS Outsider</TabsTrigger>
                <TabsTrigger value="income-expense" className="flex-1 whitespace-nowrap px-2 py-1.5 text-xs text-center">Income & Expense</TabsTrigger>
                <TabsTrigger value="ledger" className="flex-1 whitespace-nowrap px-2 py-1.5 text-xs text-center">Ledger</TabsTrigger>
              </>
            )}
          </TabsList>
        </div>
        
        {/* Keep all components mounted - just hide/show with CSS (SPMS behavior) */}
        <div className="mt-4">
          <div className={activeTab === "supplier-entry" ? "block" : "hidden"}>
            <SimpleSupplierEntryAllFields />
          </div>
          <div className={activeTab === "customer-entry" ? "block" : "hidden"}>
            <CustomerEntryClient />
          </div>
          <div className={activeTab === "supplier-payments" ? "block" : "hidden"}>
            <SupplierPaymentsClient type="supplier" />
          </div>
          <div className={activeTab === "customer-payments" ? "block" : "hidden"}>
            <SupplierPaymentsClient type="customer" />
          </div>
          <div className={activeTab === "rtgs-outsider" ? "block" : "hidden"}>
            <SupplierPaymentsClient type="outsider" />
          </div>
          <div className={activeTab === "income-expense" ? "block" : "hidden"}>
            <IncomeExpenseClient />
          </div>
          <div className={activeTab === "ledger" ? "block" : "hidden"}>
            <LedgerPageComponent />
          </div>
          <div className={activeTab === "daily-payments" ? "block" : "hidden"}>
            <DailyPaymentsPage />
          </div>
          <div className={activeTab === "rtgs-report" ? "block" : "hidden"}>
            <RtgsReportClient />
          </div>
          <div className={activeTab === "daily-supplier-report" ? "block" : "hidden"}>
            <DailySupplierReportClient />
          </div>
          <div className={activeTab === "6r-report" ? "block" : "hidden"}>
            <SixRReportPage />
          </div>
          <div className={activeTab === "voucher-import" ? "block" : "hidden"}>
            <VoucherImportTool />
          </div>
          <div className={activeTab === "mandi-report-history" ? "block" : "hidden"}>
            <MandiReportHistory />
          </div>
          <div className={activeTab === "firestore-monitor" ? "block" : "hidden"}>
            <FirestoreMonitorPage />
          </div>
        </div>
      </Tabs>
    </div>
  );
}

