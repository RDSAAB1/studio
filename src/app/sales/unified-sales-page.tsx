"use client";

import React, { useCallback, useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { electronNavigate } from "@/lib/electron-navigate";
import { cn } from "@/lib/utils";
import { useLayoutSubnav } from "@/components/layout/app-layout";
import { allMenuItems } from "@/hooks/use-tabs";
import { useToast } from "@/hooks/use-toast";

import { Star, Check, X, AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
const DailyBusinessReport = dynamic(() => import("../finance/daily-business-report/page"), { ssr: false });
const VoucherImportTool = dynamic(() => import("@/app/tools/voucher-import/page"));
const MandiReportHistory = dynamic(() => import("@/components/sales/mandi-report-history").then(m => m.MandiReportHistory));
const FirestoreMonitorPage = dynamic(() => import("@/app/admin/firestore-monitor/page"));
const DataAuditPage = dynamic(() => import("@/app/sales/reports/data-audit/page"));

// Inventory Modules

// Inventory Modules
const InventoryManagementPage = dynamic(() => import("@/app/inventory/inventory-management/page"));
const InventoryAddPage = dynamic(() => import("@/app/inventory/inventory-add/page"));

// Cash \u0026 Bank Modules

// Cash & Bank Modules
const CashBankPage = dynamic(() => import("@/app/cash-bank/page"));

// Settings Modules
const BankAccountsPage = dynamic(() => import("@/app/settings/bank-accounts/page"));
const BankManagementPage = dynamic(() => import("@/app/settings/bank-management/page"));
const ErpMigrationPage = dynamic(() => import("@/app/settings/erp-migration/page"));
// Admin Modules (moved into Unified Sales SPA)
const AdminMigrationsPage = dynamic(() => import("@/app/admin/migrations/page"));
const SettingsPage = dynamic(() => import("../settings/page"), { ssr: false });
import ActivityHistoryPage from "@/app/activity-history/page";
import { ErrorBoundary } from "@/components/error-boundary";

type SalesTab = 
  | "dashboard" 
  | "supplier-entry" | "customer-entry" 
  | "supplier-payments" | "customer-payments" | "rtgs-outsider" | "income-expense" | "ledger" 
  | "daily-business-report" | "daily-payments" | "rtgs-report" | "daily-supplier-report" | "6r-report" | "voucher-import" | "mandi-report-history" | "firestore-monitor" | "reports-data-audit"
  | "inventory-management" | "inventory-add"
  | "cash-bank-management" | "settings-bank-accounts" | "settings-bank-management"
  | "history-new" | "history-edit" | "history-recycle" | "history-delete"
  | "admin-local-hub" | "admin-erp-migrate" | "admin-secure-vault" | "admin-collection-sync"
  | "settings-company" | "settings-email" | "settings-team" | "settings-security" | "settings-general" | "settings-banks" | "settings-receipts" | "settings-formats" | "settings-account";

type MenuType = "dashboard" | "entry" | "payments" | "reports" | "cash-bank" | "history" | "settings" | "admin" | "fav";

const TAB_LABELS: Record<SalesTab, string> = {
  "dashboard": "Dashboard Overview",
  "supplier-entry": "Supplier Entry",
  "customer-entry": "Customer Entry",
  "supplier-payments": "Supplier Payments",
  "customer-payments": "Customer Payments",
  "rtgs-outsider": "RTGS Outsider",
  "income-expense": "Income & Expense",
  "ledger": "Ledger",
  "daily-business-report": "360° Business Report",
  "daily-payments": "Daily Payments",
  "rtgs-report": "RTGS Report",
  "daily-supplier-report": "Daily Supplier Report",
  "6r-report": "6R Report",
  "voucher-import": "Mandi Import",
  "mandi-report-history": "Mandi History",
  "firestore-monitor": "Firestore Monitor",
  "reports-data-audit": "Data Audit",
  
  // Inventory
  "inventory-management": "Inventory",
  "inventory-add": "Add Stock",
  
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
  "admin-local-hub": "Local Hub",
  "admin-erp-migrate": "ERP Migrate",
  "admin-secure-vault": "Secure Vault",
  "admin-collection-sync": "Collection Sync",
  
  // Settings
  "settings-company": "Company",
  "settings-email": "Email",
  "settings-team": "Team",
  "settings-security": "Security",
  "settings-general": "General",
  "settings-banks": "Banks",
  "settings-receipts": "Receipts",
  "settings-formats": "Formats",
  "settings-account": "Account",
};

export default function UnifiedSalesPage({ defaultTab = "dashboard", defaultMenu = "dashboard" }: { defaultTab?: SalesTab; defaultMenu?: MenuType }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSubnav = useLayoutSubnav();
  const [activeTab, setActiveTab] = useState<SalesTab>(defaultTab);
  const [menuType, setMenuType] = useState<MenuType>(defaultMenu);
  const [mountedTabs, setMountedTabs] = useState<SalesTab[]>([defaultTab]);
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isFavLoaded, setIsFavLoaded] = useState(false);
  const [confirmFav, setConfirmFav] = useState<{ id: string, label: string, isFav: boolean } | null>(null);

  // Load favorites from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('erp_favorites');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load favorites", e);
      }
    }
    setIsFavLoaded(true);
  }, []);

  // Save favorites to localStorage
  useEffect(() => {
    if (isFavLoaded) {
      localStorage.setItem('erp_favorites', JSON.stringify(favorites));
    }
  }, [favorites, isFavLoaded]);

  const toggleFavorite = (tabId: string) => {
    const isAdding = !favorites.includes(tabId);
    setFavorites(prev => 
      isAdding ? [...prev, tabId] : prev.filter(id => id !== tabId)
    );
    toast({
      title: isAdding ? "Added to Favorites" : "Removed from Favorites",
      description: `${TAB_LABELS[tabId as SalesTab]} has been ${isAdding ? 'added to' : 'removed from'} your Fav menu.`,
    });
  };
  
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
          tabsToMount = ['supplier-entry', 'customer-entry', 'inventory-management', 'inventory-add'];
        } else if (menuParam === 'payments') {
          tabsToMount = ['supplier-payments', 'customer-payments', 'rtgs-outsider', 'income-expense', 'ledger'];
        } else if (menuParam === 'reports') {
          // Mount frequently used reports immediately
          tabsToMount = [
            'daily-business-report',
            'daily-payments', 
            'rtgs-report', 
            'daily-supplier-report',
            '6r-report',
            'mandi-report-history',
            'voucher-import',
            'firestore-monitor',
            'reports-data-audit'
          ];
        } else if (menuParam === 'cash-bank') {
          tabsToMount = ['cash-bank-management', 'settings-bank-accounts', 'settings-bank-management'];
        } else if (menuParam === 'history') {
          tabsToMount = ['history-new', 'history-edit', 'history-recycle', 'history-delete'];
        } else if (menuParam === 'settings') {
          tabsToMount = [];
        } else if (menuParam === 'admin') {
          tabsToMount = ['admin-local-hub', 'admin-erp-migrate', 'admin-secure-vault', 'admin-collection-sync'];
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
          "inventory-add",
          "supplier-payments",
          "customer-payments",
          "ledger",
          "daily-business-report",
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
    else if (menuType === 'fav') newMenuType = 'fav'; // Fix: Stay in Fav context if already there
    else if (['supplier-entry', 'customer-entry', 'inventory-management', 'inventory-add'].includes(value)) newMenuType = 'entry';
    else if (['daily-business-report', 'daily-payments', 'rtgs-report', 'daily-supplier-report', '6r-report', 'voucher-import', 'mandi-report-history', 'firestore-monitor', 'reports-data-audit'].includes(value)) newMenuType = 'reports';
    else if (['cash-bank-management', 'settings-bank-accounts', 'settings-bank-management'].includes(value)) newMenuType = 'cash-bank';
    else if (['history-new', 'history-edit', 'history-recycle', 'history-delete'].includes(value)) newMenuType = 'history';
    else if (['admin-local-hub', 'admin-erp-migrate', 'admin-secure-vault', 'admin-collection-sync'].includes(value)) newMenuType = 'admin';
    else if (value.startsWith('settings-')) newMenuType = 'settings';
    else newMenuType = 'payments';
    
    setMenuType(newMenuType);

    // Update URL query parameter
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    params.set('menu', newMenuType);
    electronNavigate(`/sales?${params.toString()}`, router, { method: 'push' });
  }, [router, searchParams, menuType]);
  
  const subTabs = useMemo(() => {
    if (menuType === "dashboard") return [{ value: "dashboard" as const, label: TAB_LABELS["dashboard"] }];
    if (menuType === "entry") return [{ value: "supplier-entry" as const, label: TAB_LABELS["supplier-entry"] }, { value: "customer-entry" as const, label: TAB_LABELS["customer-entry"] }, { value: "inventory-management" as const, label: TAB_LABELS["inventory-management"] }, { value: "inventory-add" as const, label: TAB_LABELS["inventory-add"] }];
    if (menuType === "reports") {
      return [
        { value: "daily-business-report" as const, label: TAB_LABELS["daily-business-report"] },
        { value: "daily-payments" as const, label: TAB_LABELS["daily-payments"] },
        { value: "rtgs-report" as const, label: TAB_LABELS["rtgs-report"] },
        { value: "daily-supplier-report" as const, label: TAB_LABELS["daily-supplier-report"] },
        { value: "6r-report" as const, label: TAB_LABELS["6r-report"] },
        { value: "mandi-report-history" as const, label: TAB_LABELS["mandi-report-history"] },
        { value: "voucher-import" as const, label: TAB_LABELS["voucher-import"] },
        { value: "firestore-monitor" as const, label: TAB_LABELS["firestore-monitor"] },
        { value: "reports-data-audit" as const, label: TAB_LABELS["reports-data-audit"] },
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
    if (menuType === "settings") {
      return [
        { value: "settings-company" as const, label: TAB_LABELS["settings-company"] },
        { value: "settings-email" as const, label: TAB_LABELS["settings-email"] },
        { value: "settings-team" as const, label: TAB_LABELS["settings-team"] },
        { value: "settings-security" as const, label: TAB_LABELS["settings-security"] },
        { value: "settings-general" as const, label: TAB_LABELS["settings-general"] },
        { value: "settings-banks" as const, label: TAB_LABELS["settings-banks"] },
        { value: "settings-receipts" as const, label: TAB_LABELS["settings-receipts"] },
        { value: "settings-formats" as const, label: TAB_LABELS["settings-formats"] },
        { value: "settings-account" as const, label: TAB_LABELS["settings-account"] },
      ];
    }
    if (menuType === "admin") {
      return [
        { value: "admin-local-hub" as const, label: TAB_LABELS["admin-local-hub"] },
        { value: "admin-erp-migrate" as const, label: TAB_LABELS["admin-erp-migrate"] },
        { value: "admin-secure-vault" as const, label: TAB_LABELS["admin-secure-vault"] },
        { value: "admin-collection-sync" as const, label: TAB_LABELS["admin-collection-sync"] },
      ];
    }
    if (menuType === "fav") {
      // Collect all possible sub-menu items from all top-level menus
      const allSubMenuOptions = allMenuItems.flatMap(m => m.subMenus || []).filter(sub => sub.href);
      return allSubMenuOptions
        .filter(sub => favorites.includes(sub.id))
        .map(sub => {
          // Robust extraction of tab param without needing URL constructor
          const tabParamMatch = sub.href!.match(/[?&]tab=([^&]+)/);
          const tabVal = (tabParamMatch ? tabParamMatch[1] : sub.id) as SalesTab;
          return { value: tabVal, label: sub.name };
        });
    }

    return [
      { value: "supplier-payments" as const, label: TAB_LABELS["supplier-payments"] },
      { value: "customer-payments" as const, label: TAB_LABELS["customer-payments"] },
      { value: "rtgs-outsider" as const, label: TAB_LABELS["rtgs-outsider"] },
      { value: "income-expense" as const, label: TAB_LABELS["income-expense"] },
      { value: "ledger" as const, label: TAB_LABELS["ledger"] },
    ];
  }, [menuType, favorites]);

  useEffect(() => {
    setSubnav(
      <div className="flex items-center gap-1 w-full pb-1 sm:pb-0 px-1">
        {subTabs.map((t, index) => {
          const active = activeTab === t.value;
          const isFav = favorites.includes(t.value);

          return (
            <div key={t.value} className="relative group flex-1 min-w-0">
              <button
                type="button"
                onClick={() => handleTabChange(t.value)}
                className={cn(
                  "h-7 sm:h-8 w-full flex items-center justify-center text-center rounded-[5px] px-1 sm:px-3 text-[9px] min-[400px]:text-[10px] sm:text-[11.5px] font-semibold transition-all duration-200",
                  "text-slate-600 hover:bg-white/40 hover:text-slate-900 border border-transparent",
                  active && "bg-white text-slate-950 shadow-sm border-slate-200"
                )}
              >
                <span className="truncate">{index + 1}. {t.label}</span>
              </button>

              <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setConfirmFav({ id: t.value, label: t.label, isFav: favorites.includes(t.value) });
                }}
                className={cn(
                  "absolute -top-1 -right-1 z-10 p-0.5 rounded-full bg-white shadow-sm border transition-all",
                  "opacity-0 group-hover:opacity-100",
                  isFav ? "text-violet-600 border-violet-200 shadow-violet-100" : "text-slate-400 hover:text-violet-400"
                )}
              >
                <Star className={cn("h-2.5 w-2.5", isFav && "fill-violet-600")} />
              </button>
            </div>
          );
        })}
      </div>
    );

    return () => setSubnav(null);
  }, [activeTab, handleTabChange, setSubnav, subTabs]);

  // Keyboard Shortcut Listener for Sub-Tabs (Alt + 1-9)
  useEffect(() => {
    const handleSwitchSubTab = (e: any) => {
      const { index } = e.detail;
      if (subTabs[index]) {
        handleTabChange(subTabs[index].value);
      }
    };
    window.addEventListener('app:switch-sub-tab', handleSwitchSubTab);
    return () => window.removeEventListener('app:switch-sub-tab', handleSwitchSubTab);
  }, [subTabs, handleTabChange]);

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
        case "daily-business-report":
          return <DailyBusinessReport />;
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
        case "reports-data-audit":
          return <DataAuditPage />;
        // Inventory
        case "inventory-management":
          return <InventoryManagementPage />;
        case "inventory-add":
          return <InventoryAddPage />;
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
        case "settings-bank-accounts":
          return <BankAccountsPage />;
        case "settings-bank-management":
          return <BankManagementPage />;
        case "admin-local-hub":
          return <AdminMigrationsPage activeTab="sqlite" />;
        case "admin-erp-migrate":
          return <AdminMigrationsPage activeTab="erp" />;
        case "admin-secure-vault":
          return <AdminMigrationsPage activeTab="backups" />;
        case "admin-collection-sync":
          return <AdminMigrationsPage activeTab="collection-sync" />;
        // Settings
        case "settings-company":
        case "settings-email":
        case "settings-team":
        case "settings-security":
        case "settings-general":
        case "settings-banks":
        case "settings-receipts":
        case "settings-formats":
        case "settings-account":
          const settingsCategory = tab.replace('settings-', '');
          return <SettingsPage searchParams={Promise.resolve({ tab: settingsCategory })} />;
        default:
          return null;
      }
    },
    []
  );

  const isSettingsActive = activeTab.startsWith('settings-');

  return (
    <div className="w-full">
      <div>
        {/* General Tabs */}
        {mountedTabs
          .filter((tab) => !tab.startsWith("settings-"))
          .map((tab) => (
            <div key={tab} className={activeTab === tab ? "block" : "hidden"}>
              {renderTabContent(tab)}
            </div>
          ))}

        {/* Unified Settings Root (Prevents multiple instances/state conflicts) */}
        {mountedTabs.some((tab) => tab.startsWith("settings-")) && (
          <div className={isSettingsActive ? "block" : "hidden"}>
             <SettingsPage 
               activeTabOverride={activeTab.startsWith('settings-') ? activeTab.replace('settings-', '') : 'company'}
             />
          </div>
        )}
      </div>

      <AlertDialog open={confirmFav !== null} onOpenChange={(open) => !open && setConfirmFav(null)}>
        <AlertDialogContent className="w-[90vw] max-w-sm rounded-[10px]">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-violet-600 mb-2">
              <AlertCircle className="h-5 w-5" />
              <AlertDialogTitle>Confirmation</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-900 text-sm font-medium">
              Are you sure you want to {confirmFav?.isFav ? 'REMOVE' : 'ADD'} <span className="font-bold text-violet-700">"{confirmFav?.label}"</span> {confirmFav?.isFav ? 'from' : 'to'} your Favorites menu?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4">
            <AlertDialogCancel className="flex-1 mt-0 border-slate-200 hover:bg-slate-50 rounded-[8px]">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (confirmFav) {
                  toggleFavorite(confirmFav.id);
                  setConfirmFav(null);
                }
              }}
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-[8px]"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
