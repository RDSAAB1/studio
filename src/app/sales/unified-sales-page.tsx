"use client";

import React, { useCallback, useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLayoutSubnav } from "@/components/layout/app-layout";

// Core components - Static imports for instant access
import SimpleSupplierEntryAllFields from "./supplier-entry/simple-supplier-entry-all-fields";
import CustomerEntryClient from "@/components/sales/customer-entry/customer-entry-client";
import SupplierPaymentsClient from "./supplier-payments/unified-payments-client";
import IncomeExpenseClient from "@/app/expense-tracker/expense-tracker-client";
import LedgerPageComponent from "./ledger/page";
import DailyPaymentsPage from "./daily-payments/page";
import DashboardClient from "@/app/dashboard-client";

// Secondary components - Dynamic imports with prefetching
const RtgsReportClient = dynamic(() => import("./rtgs-report/rtgs-report-client"));
const DailySupplierReportClient = dynamic(() => import("./daily-supplier-report/daily-supplier-report-client"));
const SixRReportPage = dynamic(() => import("./6r-report/page"));
const VoucherImportTool = dynamic(() => import("@/app/tools/voucher-import/page"));
const MandiReportHistory = dynamic(() => import("@/components/sales/mandi-report-history").then(m => m.MandiReportHistory));
const FirestoreMonitorPage = dynamic(() => import("@/app/admin/firestore-monitor/page"));
const SalesReportsPage = dynamic(() => import("@/app/sales/sales-reports/page"));
const OrderTrackingPage = dynamic(() => import("@/app/sales/order-tracking/page"));
const ProductCatalogPage = dynamic(() => import("@/app/sales/product-catalog/page"));

// HR Modules
const EmployeeDatabasePage = dynamic(() => import("@/app/hr/employee-database/page"));
const PayrollManagementPage = dynamic(() => import("@/app/hr/payroll-management/page"));
const AttendanceTrackingPage = dynamic(() => import("@/app/hr/attendance-tracking/page"));
const ContractPaymentsPage = dynamic(() => import("@/app/hr/contract-payments/page"));

// Inventory Modules
const InventoryManagementPage = dynamic(() => import("@/app/inventory/inventory-management/page"));
const SupplierInformationPage = dynamic(() => import("@/app/inventory/supplier-information/page"));
const PurchaseOrdersPage = dynamic(() => import("@/app/inventory/purchase-orders/page"));

// Marketing Modules
const CampaignsPage = dynamic(() => import("@/app/marketing/campaigns/page"));
const EmailMarketingPage = dynamic(() => import("@/app/marketing/email-marketing/page"));
const AnalyticsPage = dynamic(() => import("@/app/marketing/analytics/page"));

// Project Management Modules
const ProjectDashboardPage = dynamic(() => import("@/app/projects/dashboard/page"));
const ProjectTasksPage = dynamic(() => import("@/app/projects/tasks/page"));
const ProjectCollaborationPage = dynamic(() => import("@/app/projects/collaboration/page"));

// Cash & Bank Modules
const CashBankPage = dynamic(() => import("@/app/cash-bank/page"));

// Settings Modules
const BankAccountsPage = dynamic(() => import("@/app/settings/bank-accounts/page"));
const BankManagementPage = dynamic(() => import("@/app/settings/bank-management/page"));
const PrinterSettingsPage = dynamic(() => import("@/app/settings/printer/page"));
const ThemeCustomizationPage = dynamic(() => import("@/app/settings/theme-customization/page"));

type SalesTab = 
  | "dashboard" 
  | "supplier-entry" | "customer-entry" 
  | "supplier-payments" | "customer-payments" | "rtgs-outsider" | "income-expense" | "ledger" 
  | "daily-payments" | "rtgs-report" | "daily-supplier-report" | "6r-report" | "voucher-import" | "mandi-report-history" | "firestore-monitor" | "sales-reports" | "order-tracking" | "product-catalog"
  | "hr-employee-database" | "hr-payroll-management" | "hr-attendance-tracking" | "hr-contract-payments"
  | "inventory-management" | "inventory-supplier-info" | "inventory-purchase-orders"
  | "marketing-campaigns" | "marketing-email" | "marketing-analytics"
  | "project-dashboard" | "project-tasks" | "project-collaboration"
  | "cash-bank-management"
  | "settings-bank-accounts" | "settings-bank-management" | "settings-printer" | "settings-theme";

type MenuType = "dashboard" | "entry" | "payments" | "reports" | "hr" | "inventory" | "marketing" | "projects" | "cash-bank" | "settings";

const TAB_LABELS: Record<SalesTab, string> = {
  "dashboard": "Dashboard Overview",
  "supplier-entry": "Supplier Entry",
  "customer-entry": "Customer Entry",
  "supplier-payments": "Supplier Payments",
  "customer-payments": "Customer Payments",
  "rtgs-outsider": "RTGS Outsider",
  "income-expense": "Income & Expense",
  "ledger": "Ledger",
  "daily-payments": "Daily Payments",
  "rtgs-report": "RTGS Report",
  "daily-supplier-report": "Daily Supplier Report",
  "6r-report": "6R Report",
  "voucher-import": "Mandi Import",
  "mandi-report-history": "Mandi History",
  "firestore-monitor": "Firestore Monitor",
  "sales-reports": "Sales Reports",
  "order-tracking": "Order Tracking",
  "product-catalog": "Product Catalog",
  
  // HR
  "hr-employee-database": "Employee Database",
  "hr-payroll-management": "Payroll Management",
  "hr-attendance-tracking": "Attendance Tracking",
  "hr-contract-payments": "Contract Payments",
  
  // Inventory
  "inventory-management": "Inventory Management",
  "inventory-supplier-info": "Supplier Info",
  "inventory-purchase-orders": "Purchase Orders",
  
  // Marketing
  "marketing-campaigns": "Campaigns",
  "marketing-email": "Email Marketing",
  "marketing-analytics": "Analytics",
  
  // Projects
  "project-dashboard": "Project Dashboard",
  "project-tasks": "Project Tasks",
  "project-collaboration": "Collaboration",
  
  // Cash & Bank
  "cash-bank-management": "Cash & Bank",
  
  // Settings
  "settings-bank-accounts": "Bank Accounts",
  "settings-bank-management": "Bank Management",
  "settings-printer": "Printer Settings",
  "settings-theme": "Theme Customization",
};

export default function UnifiedSalesPage({ defaultTab = "dashboard", defaultMenu = "dashboard" }: { defaultTab?: SalesTab; defaultMenu?: MenuType }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSubnav = useLayoutSubnav();
  const [activeTab, setActiveTab] = useState<SalesTab>(defaultTab);
  const [menuType, setMenuType] = useState<MenuType>(defaultMenu);
  const [mountedTabs, setMountedTabs] = useState<SalesTab[]>([defaultTab]);
  
  // Get menu type from URL or use default
  useEffect(() => {
    const menuParam = searchParams.get('menu') as MenuType;
    if (menuParam) {
      setMenuType(menuParam);
      
      // Smart Mount Strategy: Immediately mount ALL tabs for this section
      // This ensures sub-menu switching is instant
      setMountedTabs(prev => {
        let tabsToMount: SalesTab[] = [];
        
        if (menuParam === 'entry') {
          tabsToMount = ['supplier-entry', 'customer-entry'];
        } else if (menuParam === 'payments') {
          tabsToMount = ['supplier-payments', 'customer-payments', 'rtgs-outsider', 'income-expense', 'ledger'];
        } else if (menuParam === 'reports') {
          // Mount frequently used reports immediately
          tabsToMount = [
            'daily-payments', 
            'rtgs-report', 
            'daily-supplier-report',
            '6r-report',
            'sales-reports',
            'order-tracking',
            'product-catalog',
            'mandi-report-history',
            'voucher-import',
            'firestore-monitor'
          ];
        } else if (menuParam === 'hr') {
          tabsToMount = ['hr-employee-database', 'hr-payroll-management', 'hr-attendance-tracking'];
        } else if (menuParam === 'inventory') {
          tabsToMount = ['inventory-management', 'inventory-supplier-info', 'inventory-purchase-orders'];
        } else if (menuParam === 'marketing') {
          tabsToMount = ['marketing-campaigns', 'marketing-email', 'marketing-analytics'];
        } else if (menuParam === 'projects') {
          tabsToMount = ['project-dashboard', 'project-tasks', 'project-collaboration'];
        } else if (menuParam === 'cash-bank') {
          tabsToMount = ['cash-bank-management'];
        } else if (menuParam === 'settings') {
          tabsToMount = ['settings-bank-accounts', 'settings-bank-management', 'settings-printer', 'settings-theme'];
        }
        
        const toAdd = tabsToMount.filter(t => !prev.includes(t));
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
    }
  }, [searchParams]);

  // Prefetch heavy report components after mount
  useEffect(() => {
    // Small delay to let main thread clear first
    const timer = setTimeout(() => {
      // 1. Prefetch Report Modules (Code Splitting)
      import("./rtgs-report/rtgs-report-client");
      import("./daily-supplier-report/daily-supplier-report-client");
      import("./6r-report/page");
      import("@/app/tools/voucher-import/page");
      import("@/components/sales/mandi-report-history");
      import("@/app/admin/firestore-monitor/page");
      import("@/app/sales/sales-reports/page");
      import("@/app/sales/order-tracking/page");
      import("@/app/sales/product-catalog/page");
      
      // 3. Prefetch Other Modules (HR, Inventory, etc.)
      import("@/app/hr/employee-database/page");
      import("@/app/inventory/inventory-management/page");
      import("@/app/marketing/campaigns/page");
      import("@/app/projects/dashboard/page");
      import("@/app/cash-bank/page");
      import("@/app/settings/bank-accounts/page");
      
      // 2. Silent Mount of Critical Tabs (Data Fetching Warm-up)
      // This ensures that when user clicks "Supplier Entry" or "Payments", 
      // the component is ALREADY mounted and data is ALREADY fetched.
      setMountedTabs(prev => {
        const criticalTabs: SalesTab[] = [
          "supplier-entry", 
          "customer-entry", 
          "supplier-payments", 
          "customer-payments",
          "ledger",
          "daily-payments"
        ];
        
        // Only add if not already present
        const toAdd = criticalTabs.filter(t => !prev.includes(t));
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
      
    }, 2500); // 2.5s delay to not impact initial dashboard render
    
    return () => clearTimeout(timer);
  }, []);
  
  // Update tab from URL query
  useEffect(() => {
    const tabParam = searchParams.get('tab') as SalesTab;
    if (tabParam) {
      setActiveTab(tabParam);
      setMountedTabs((prev) => (prev.includes(tabParam) ? prev : [...prev, tabParam]));
    }
  }, [searchParams]);
  
  const handleTabChange = useCallback((value: SalesTab) => {
    setActiveTab(value);
    
    // Determine menu type based on tab (for sidebar highlighting)
    let newMenuType: MenuType = 'dashboard';
    if (value === 'dashboard') newMenuType = 'dashboard';
    else if (['supplier-entry', 'customer-entry'].includes(value)) newMenuType = 'entry';
    else if (['daily-payments', 'rtgs-report', 'daily-supplier-report', '6r-report', 'voucher-import', 'mandi-report-history', 'firestore-monitor', 'sales-reports', 'order-tracking', 'product-catalog'].includes(value)) newMenuType = 'reports';
    else if (['hr-employee-database', 'hr-payroll-management', 'hr-attendance-tracking'].includes(value)) newMenuType = 'hr';
    else if (['inventory-management', 'inventory-supplier-info', 'inventory-purchase-orders'].includes(value)) newMenuType = 'inventory';
    else if (['marketing-campaigns', 'marketing-email', 'marketing-analytics'].includes(value)) newMenuType = 'marketing';
    else if (['project-dashboard', 'project-tasks', 'project-collaboration'].includes(value)) newMenuType = 'projects';
    else if (['cash-bank-management'].includes(value)) newMenuType = 'cash-bank';
    else if (['settings-bank-accounts', 'settings-bank-management', 'settings-printer', 'settings-theme'].includes(value)) newMenuType = 'settings';
    else newMenuType = 'payments';
    
    setMenuType(newMenuType);

    // Update URL query parameter
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    params.set('menu', newMenuType);
    router.push(`/sales?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);
  
  const subTabs = useMemo(() => {
    if (menuType === "dashboard") return [{ value: "dashboard" as const, label: TAB_LABELS["dashboard"] }];
    if (menuType === "entry") return [{ value: "supplier-entry" as const, label: TAB_LABELS["supplier-entry"] }, { value: "customer-entry" as const, label: TAB_LABELS["customer-entry"] }];
    if (menuType === "reports") {
      return [
        { value: "daily-payments" as const, label: TAB_LABELS["daily-payments"] },
        { value: "rtgs-report" as const, label: TAB_LABELS["rtgs-report"] },
        { value: "daily-supplier-report" as const, label: TAB_LABELS["daily-supplier-report"] },
        { value: "6r-report" as const, label: TAB_LABELS["6r-report"] },
        { value: "sales-reports" as const, label: TAB_LABELS["sales-reports"] },
        { value: "order-tracking" as const, label: TAB_LABELS["order-tracking"] },
        { value: "product-catalog" as const, label: TAB_LABELS["product-catalog"] },
        { value: "voucher-import" as const, label: TAB_LABELS["voucher-import"] },
        { value: "mandi-report-history" as const, label: TAB_LABELS["mandi-report-history"] },
        { value: "firestore-monitor" as const, label: TAB_LABELS["firestore-monitor"] },
      ];
    }
    if (menuType === "hr") {
      return [
        { value: "hr-employee-database" as const, label: TAB_LABELS["hr-employee-database"] },
        { value: "hr-payroll-management" as const, label: TAB_LABELS["hr-payroll-management"] },
        { value: "hr-attendance-tracking" as const, label: TAB_LABELS["hr-attendance-tracking"] },
      ];
    }
    if (menuType === "inventory") {
      return [
        { value: "inventory-management" as const, label: TAB_LABELS["inventory-management"] },
        { value: "inventory-supplier-info" as const, label: TAB_LABELS["inventory-supplier-info"] },
        { value: "inventory-purchase-orders" as const, label: TAB_LABELS["inventory-purchase-orders"] },
      ];
    }
    if (menuType === "marketing") {
      return [
        { value: "marketing-campaigns" as const, label: TAB_LABELS["marketing-campaigns"] },
        { value: "marketing-email" as const, label: TAB_LABELS["marketing-email"] },
        { value: "marketing-analytics" as const, label: TAB_LABELS["marketing-analytics"] },
      ];
    }
    if (menuType === "projects") {
      return [
        { value: "project-dashboard" as const, label: TAB_LABELS["project-dashboard"] },
        { value: "project-tasks" as const, label: TAB_LABELS["project-tasks"] },
        { value: "project-collaboration" as const, label: TAB_LABELS["project-collaboration"] },
      ];
    }
    if (menuType === "cash-bank") return [{ value: "cash-bank-management" as const, label: TAB_LABELS["cash-bank-management"] }];
    if (menuType === "settings") {
      return [
        { value: "settings-bank-accounts" as const, label: TAB_LABELS["settings-bank-accounts"] },
        { value: "settings-bank-management" as const, label: TAB_LABELS["settings-bank-management"] },
        { value: "settings-printer" as const, label: TAB_LABELS["settings-printer"] },
        { value: "settings-theme" as const, label: TAB_LABELS["settings-theme"] },
      ];
    }
    return [
      { value: "supplier-payments" as const, label: TAB_LABELS["supplier-payments"] },
      { value: "customer-payments" as const, label: TAB_LABELS["customer-payments"] },
      { value: "rtgs-outsider" as const, label: TAB_LABELS["rtgs-outsider"] },
      { value: "income-expense" as const, label: TAB_LABELS["income-expense"] },
      { value: "ledger" as const, label: TAB_LABELS["ledger"] },
    ];
  }, [menuType]);

  useEffect(() => {
    setSubnav(
      <div
        className="grid w-full gap-1"
        style={{ gridTemplateColumns: `repeat(${subTabs.length}, minmax(0, 1fr))` }}
      >
        {subTabs.map((t) => {
          const isActive = activeTab === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => handleTabChange(t.value)}
              className={cn(
                "h-8 w-full rounded-md px-2 text-xs font-semibold transition-colors",
                "text-slate-700 hover:bg-white/60 hover:text-slate-950",
                isActive && "bg-white/80 text-slate-950 border border-slate-200/80"
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    );

    return () => setSubnav(null);
  }, [activeTab, handleTabChange, setSubnav, subTabs]);

  const renderTabContent = useMemo(
    () => (tab: SalesTab) => {
      switch (tab) {
        case "dashboard":
          return <DashboardClient />;
        case "supplier-entry":
          return <SimpleSupplierEntryAllFields />;
        case "customer-entry":
          return <CustomerEntryClient />;
        case "supplier-payments":
          return <SupplierPaymentsClient type="supplier" />;
        case "customer-payments":
          return <SupplierPaymentsClient type="customer" />;
        case "rtgs-outsider":
          return <SupplierPaymentsClient type="outsider" />;
        case "income-expense":
          return <IncomeExpenseClient />;
        case "ledger":
          return <LedgerPageComponent />;
        case "daily-payments":
          return <DailyPaymentsPage />;
        case "rtgs-report":
          return <RtgsReportClient />;
        case "daily-supplier-report":
          return <DailySupplierReportClient />;
        case "6r-report":
          return <SixRReportPage />;
        case "voucher-import":
          return <VoucherImportTool />;
        case "mandi-report-history":
          return <MandiReportHistory />;
        case "firestore-monitor":
          return <FirestoreMonitorPage />;
        case "sales-reports":
          return <SalesReportsPage />;
        case "order-tracking":
          return <OrderTrackingPage />;
        case "product-catalog":
          return <ProductCatalogPage />;
        // HR
        case "hr-employee-database":
          return <EmployeeDatabasePage />;
        case "hr-payroll-management":
          return <PayrollManagementPage />;
        case "hr-attendance-tracking":
          return <AttendanceTrackingPage />;
        case "hr-contract-payments":
          return <ContractPaymentsPage />;
        // Inventory
        case "inventory-management":
          return <InventoryManagementPage />;
        case "inventory-supplier-info":
          return <SupplierInformationPage />;
        case "inventory-purchase-orders":
          return <PurchaseOrdersPage />;
        // Marketing
        case "marketing-campaigns":
          return <CampaignsPage />;
        case "marketing-email":
          return <EmailMarketingPage />;
        case "marketing-analytics":
          return <AnalyticsPage />;
        // Projects
        case "project-dashboard":
          return <ProjectDashboardPage />;
        case "project-tasks":
          return <ProjectTasksPage />;
        case "project-collaboration":
          return <ProjectCollaborationPage />;
        // Cash & Bank
        case "cash-bank-management":
          return <CashBankPage />;
        // Settings
        case "settings-bank-accounts":
          return <BankAccountsPage />;
        case "settings-bank-management":
          return <BankManagementPage />;
        case "settings-printer":
          return <PrinterSettingsPage />;
        case "settings-theme":
          return <ThemeCustomizationPage />;
        default:
          return null;
      }
    },
    []
  );

  return (
    <div className="w-full">
      <div>
        {mountedTabs.map((tab) => (
          <div key={tab} className={activeTab === tab ? "block" : "hidden"}>
            {renderTabContent(tab)}
          </div>
        ))}
      </div>
    </div>
  );
}
