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

// HR Modules
const EmployeeDatabasePage = dynamic(() => import("@/app/hr/employee-database/page"));
const PayrollManagementPage = dynamic(() => import("@/app/hr/payroll-management/page"));
const AttendanceTrackingPage = dynamic(() => import("@/app/hr/attendance-tracking/page"));
const ContractPaymentsPage = dynamic(() => import("@/app/hr/contract-payments/page"));

// Inventory Modules
const InventoryManagementPage = dynamic(() => import("@/app/inventory/inventory-management/page"));

// Project Management Modules
const ProjectDashboardPage = dynamic(() => import("@/app/projects/dashboard/page"));
const ProjectTasksPage = dynamic(() => import("@/app/projects/tasks/page"));
const ProjectCollaborationPage = dynamic(() => import("@/app/projects/collaboration/page"));

// Cash & Bank Modules
const CashBankPage = dynamic(() => import("@/app/cash-bank/page"));

// Settings Modules
const BankAccountsPage = dynamic(() => import("@/app/settings/bank-accounts/page"));
const BankManagementPage = dynamic(() => import("@/app/settings/bank-management/page"));
const ErpMigrationPage = dynamic(() => import("@/app/settings/erp-migration/page"));
const AddCompanyUserCard = dynamic(() => import("@/components/settings/add-company-user-card").then(m => ({ default: m.AddCompanyUserCard })));
import ActivityHistoryPage from "@/app/activity-history/page";
import { ErrorBoundary } from "@/components/error-boundary";

type SalesTab = 
  | "dashboard" 
  | "supplier-entry" | "customer-entry" 
  | "supplier-payments" | "customer-payments" | "rtgs-outsider" | "income-expense" | "ledger" 
  | "daily-payments" | "rtgs-report" | "daily-supplier-report" | "6r-report" | "voucher-import" | "mandi-report-history" | "firestore-monitor"
  | "hr-employee-database" | "hr-payroll-management" | "hr-attendance-tracking" | "hr-contract-payments"
  | "inventory-management"
  | "project-dashboard" | "project-tasks" | "project-collaboration"
  | "cash-bank-management" | "settings-bank-accounts" | "settings-bank-management"
  | "history-new" | "history-edit" | "history-recycle" | "history-delete"
  | "settings-team" | "settings-data-migration";

type MenuType = "dashboard" | "entry" | "payments" | "reports" | "hr" | "projects" | "cash-bank" | "history" | "settings" | "admin";

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
  
  // HR
  "hr-employee-database": "Employee Database",
  "hr-payroll-management": "Payroll Management",
  "hr-attendance-tracking": "Attendance Tracking",
  "hr-contract-payments": "Contract Payments",
  
  // Inventory
  "inventory-management": "Inventory Management",
  
  // Projects
  "project-dashboard": "Project Dashboard",
  "project-tasks": "Project Tasks",
  "project-collaboration": "Collaboration",
  
  // Cash & Bank
  "cash-bank-management": "Cash & Bank",
  "settings-bank-accounts": "Bank Accounts",
  "settings-bank-management": "Bank Management",
  
  // History
  "history-new": "New Entry",
  "history-edit": "Edit History",
  "history-recycle": "Recycle Bin",
  "history-delete": "Delete History",
  
  // Settings / Admin
  "settings-team": "Team",
  "settings-data-migration": "Data Migration",
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
          tabsToMount = ['supplier-entry', 'customer-entry', 'inventory-management'];
        } else if (menuParam === 'payments') {
          tabsToMount = ['supplier-payments', 'customer-payments', 'rtgs-outsider', 'income-expense', 'ledger'];
        } else if (menuParam === 'reports') {
          // Mount frequently used reports immediately
          tabsToMount = [
            'daily-payments', 
            'rtgs-report', 
            'daily-supplier-report',
            '6r-report',
            'mandi-report-history',
            'voucher-import',
            'firestore-monitor'
          ];
        } else if (menuParam === 'hr') {
          tabsToMount = ['hr-employee-database', 'hr-payroll-management', 'hr-attendance-tracking', 'hr-contract-payments'];
        } else if (menuParam === 'projects') {
          tabsToMount = ['project-dashboard', 'project-tasks', 'project-collaboration'];
        } else if (menuParam === 'cash-bank') {
          tabsToMount = ['cash-bank-management', 'settings-bank-accounts', 'settings-bank-management'];
        } else if (menuParam === 'history') {
          tabsToMount = ['history-new', 'history-edit', 'history-recycle', 'history-delete'];
        } else if (menuParam === 'settings') {
          tabsToMount = ['settings-team'];
        } else if (menuParam === 'admin') {
          tabsToMount = ['settings-data-migration'];
        }
        
        const toAdd = tabsToMount.filter(t => !prev.includes(t));
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
    }
  }, [searchParams]);

  // Silent mount of critical tabs for data warm-up (prefetch removed - was causing ChunkLoadError 404s)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Silent Mount of Critical Tabs (Data Fetching Warm-up)
      // This ensures that when user clicks "Supplier Entry" or "Payments", 
      // the component is ALREADY mounted and data is ALREADY fetched.
      setMountedTabs(prev => {
        const criticalTabs: SalesTab[] = [
          "supplier-entry", 
          "customer-entry", 
          "inventory-management",
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
    
    // Determine menu type based on tab (for top bar highlighting)
    let newMenuType: MenuType = 'dashboard';
    if (value === 'dashboard') newMenuType = 'dashboard';
    else if (['supplier-entry', 'customer-entry', 'inventory-management'].includes(value)) newMenuType = 'entry';
    else if (['daily-payments', 'rtgs-report', 'daily-supplier-report', '6r-report', 'voucher-import', 'mandi-report-history', 'firestore-monitor'].includes(value)) newMenuType = 'reports';
    else if (['hr-employee-database', 'hr-payroll-management', 'hr-attendance-tracking', 'hr-contract-payments'].includes(value)) newMenuType = 'hr';
    else if (['project-dashboard', 'project-tasks', 'project-collaboration'].includes(value)) newMenuType = 'projects';
    else if (['cash-bank-management', 'settings-bank-accounts', 'settings-bank-management'].includes(value)) newMenuType = 'cash-bank';
    else if (['history-new', 'history-edit', 'history-recycle', 'history-delete'].includes(value)) newMenuType = 'history';
    else if (['settings-team'].includes(value)) newMenuType = 'settings';
    else if (['settings-data-migration'].includes(value)) newMenuType = 'admin';
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
    if (menuType === "entry") return [{ value: "supplier-entry" as const, label: TAB_LABELS["supplier-entry"] }, { value: "customer-entry" as const, label: TAB_LABELS["customer-entry"] }, { value: "inventory-management" as const, label: TAB_LABELS["inventory-management"] }];
    if (menuType === "reports") {
      return [
        { value: "daily-payments" as const, label: TAB_LABELS["daily-payments"] },
        { value: "rtgs-report" as const, label: TAB_LABELS["rtgs-report"] },
        { value: "daily-supplier-report" as const, label: TAB_LABELS["daily-supplier-report"] },
        { value: "6r-report" as const, label: TAB_LABELS["6r-report"] },
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
        { value: "hr-contract-payments" as const, label: TAB_LABELS["hr-contract-payments"] },
      ];
    }
    if (menuType === "projects") {
      return [
        { value: "project-dashboard" as const, label: TAB_LABELS["project-dashboard"] },
        { value: "project-tasks" as const, label: TAB_LABELS["project-tasks"] },
        { value: "project-collaboration" as const, label: TAB_LABELS["project-collaboration"] },
      ];
    }
    if (menuType === "cash-bank") return [
      { value: "cash-bank-management" as const, label: TAB_LABELS["cash-bank-management"] },
      { value: "settings-bank-accounts" as const, label: TAB_LABELS["settings-bank-accounts"] },
      { value: "settings-bank-management" as const, label: TAB_LABELS["settings-bank-management"] },
    ];
    if (menuType === "history") {
      return [
        { value: "history-new" as const, label: TAB_LABELS["history-new"] },
        { value: "history-edit" as const, label: TAB_LABELS["history-edit"] },
        { value: "history-recycle" as const, label: TAB_LABELS["history-recycle"] },
        { value: "history-delete" as const, label: TAB_LABELS["history-delete"] },
      ];
    }
    if (menuType === "settings") return [{ value: "settings-team" as const, label: TAB_LABELS["settings-team"] }];
    if (menuType === "admin") return [{ value: "settings-data-migration" as const, label: TAB_LABELS["settings-data-migration"] }];
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
        // History
        case "history-new":
          return <ErrorBoundary><ActivityHistoryPage initialTab="new" /></ErrorBoundary>;
        case "history-edit":
          return <ErrorBoundary><ActivityHistoryPage initialTab="edit" /></ErrorBoundary>;
        case "history-recycle":
          return <ErrorBoundary><ActivityHistoryPage initialTab="recycle" /></ErrorBoundary>;
        case "history-delete":
          return <ErrorBoundary><ActivityHistoryPage initialTab="delete" /></ErrorBoundary>;
        // Settings
        case "settings-team":
          return <AddCompanyUserCard />;
        case "settings-bank-accounts":
          return <BankAccountsPage />;
        case "settings-bank-management":
          return <BankManagementPage />;
        case "settings-data-migration":
          return <ErpMigrationPage />;
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
