"use client";

import React, { useCallback, useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { electronNavigate } from "@/lib/electron-navigate";
import { cn } from "@/lib/utils";
import { allMenuItems } from "@/hooks/use-tabs";
import { useToast } from "@/hooks/use-toast";
import { useLayoutSubnav } from "@/components/layout/app-layout";

import { 
  Star, Check, X, AlertCircle, LayoutDashboard, FilePlus, Users2, Package, Wallet, 
  Users, Banknote, Landmark, Database, PieChart, Search, Factory, Plus, Pen, 
  RotateCcw, Trash2, ShieldCheck, RefreshCw, Building, Mail, FileText, List, 
  UserCircle, Settings, ShoppingCart, TrendingUp, CreditCard, Coins, Send, Receipt, 
  BarChart3, Import, PlusCircle, PenTool, Palette 
} from "lucide-react";
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
import { ErrorBoundary } from "@/components/error-boundary";
import { ProcessingOverlay } from "@/components/ui/processing-overlay";
import SimpleSupplierEntryAllFields from "./purchase/simple-supplier-entry-all-fields";
import CustomerEntryClient from "@/components/sales/customer-entry/customer-entry-client";
import SupplierPaymentsClient from "./payment-payable/unified-payments-client";
import IncomeExpenseClient from "@/app/expense-tracker/expense-tracker-client";
import LedgerPageComponent from "./ledger/page";
import DailyPaymentsPage from "./daily-payments/page";
import DashboardClient from "@/app/dashboard-client";

// Secondary components - Dynamic imports with prefetching
const RtgsReportClient = dynamic(() => import("./rtgs-report/rtgs-report-client"));
const DailyBusinessReport = dynamic(() => import("../finance/daily-business-report/page"), { ssr: false });
const VoucherImportTool = dynamic(() => import("@/app/tools/voucher-import/page"));
const DataAuditPage = dynamic(() => import("@/app/sales/reports/data-audit/page"));
const ManufacturingCosting = dynamic(() => import("@/components/dashboard/manufacturing-costing").then(m => m.ManufacturingCosting));
const StockManagementClient = dynamic(() => import("@/app/expense-tracker/components/stock-management"), { ssr: false });

// Inventory Modules

// Cash & Bank Modules

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
type SalesTab = 
  | "dashboard" 
  | "purchase" | "sales" | "stock"
  | "payment-payable" | "payment-receivable" | "rtgs-outsider" | "income-expense" | "ledger" 
  | "daily-business-report" | "daily-payments" | "rtgs-report" | "voucher-import" | "reports-data-audit" | "manufacturing-costing"
  | "cash-bank-management" | "settings-bank-accounts" | "settings-bank-management"
  | "history-new" | "history-edit" | "history-recycle" | "history-delete"
  | "admin-local-hub" | "admin-erp-migrate" | "admin-secure-vault" | "admin-collection-sync"
  | "settings-company" | "settings-theme" | "settings-email" | "settings-team" | "settings-security" | "settings-general" | "settings-banks" | "settings-receipts" | "settings-formats" | "settings-account";

type MenuType = "dashboard" | "entry" | "payments" | "reports" | "cash-bank" | "history" | "settings" | "admin" | "tools-menu" | "fav";

const TAB_LABELS: Record<SalesTab, string> = {
  "dashboard": "Dashboard Overview",
  "purchase": "Purchase",
  "sales": "Sales",
  "stock": "Stock Management",
  "payment-payable": "Payment Payable",
  "payment-receivable": "Payment Receivable",
  "rtgs-outsider": "RTGS Outsider",
  "income-expense": "Income & Expense",
  "ledger": "Ledger",
  "daily-business-report": "360° Business Report",
  "daily-payments": "Daily Payments",
  "rtgs-report": "RTGS Report",
  "voucher-import": "Mandi Import",
  "reports-data-audit": "Data Audit",
  "manufacturing-costing": "Manufacturing Costing",
  
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
  "settings-theme": "Theme Presets",
  "settings-email": "Email",
  "settings-team": "Team",
  "settings-security": "Security",
  "settings-general": "General",
  "settings-banks": "Banks",
  "settings-receipts": "Receipts",
  "settings-formats": "Formats",
  "settings-account": "Account",
};

const TAB_ICONS: Record<SalesTab, React.ComponentType<any>> = {
  "dashboard": LayoutDashboard,
  "purchase": ShoppingCart,
  "sales": TrendingUp,
  "stock": Package,
  "payment-payable": CreditCard,
  "payment-receivable": Coins,
  "rtgs-outsider": Send,
  "income-expense": Receipt,
  "ledger": Database,
  "daily-business-report": PieChart,
  "daily-payments": Wallet,
  "rtgs-report": BarChart3,
  "voucher-import": Import,
  "reports-data-audit": Search,
  "manufacturing-costing": Factory,
  "cash-bank-management": Landmark,
  "settings-bank-accounts": Building,
  "settings-bank-management": Banknote,
  "history-new": PlusCircle,
  "history-edit": PenTool,
  "history-recycle": RotateCcw,
  "history-delete": Trash2,
  "admin-local-hub": Database,
  "admin-erp-migrate": RefreshCw,
  "admin-secure-vault": ShieldCheck,
  "admin-collection-sync": RefreshCw,
  "settings-company": Building,
  "settings-theme": Palette,
  "settings-email": Mail,
  "settings-team": Users2,
  "settings-security": ShieldCheck,
  "settings-general": Settings,
  "settings-banks": Landmark,
  "settings-receipts": FileText,
  "settings-formats": List,
  "settings-account": UserCircle,
};

export default function UnifiedSalesPage({ defaultTab = "dashboard", defaultMenu = "dashboard" }: { defaultTab?: SalesTab; defaultMenu?: MenuType }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SalesTab>(defaultTab);
  const [menuType, setMenuType] = useState<MenuType>(defaultMenu);
  const [mountedTabs, setMountedTabs] = useState<SalesTab[]>([defaultTab]);
  const navTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [isTabTransitioning, setIsTabTransitioning] = useState(false);
  const [transitionTargetTab, setTransitionTargetTab] = useState("");
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
  


  // Silent mount of critical tabs for data warm-up (prefetch removed - was causing ChunkLoadError 404s)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Silent Mount of Critical Tabs (Data Fetching Warm-up)
      // This ensures that when user clicks "Supplier Entry" or "Payments", 
      // the component is ALREADY mounted and data is ALREADY fetched.
      setMountedTabs(prev => {
        const criticalTabs: SalesTab[] = [
          "purchase", 
          "sales",
          "payment-payable",
          "payment-receivable",
          "ledger",
          "daily-payments"
        ];
        
        // Only add if not already present
        const toAdd = criticalTabs.filter(t => !prev.includes(t));
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
      
    }, 2500); // 2.5s delay to not impact initial dashboard render
    
    return () => {
      clearTimeout(timer);
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
    };
  }, []);
  
  // Update tab and menu from URL query (handles sidebar clicks and initial load)
  useEffect(() => {
    const menuParam = searchParams.get('menu') as MenuType;
    const tabParam = searchParams.get('tab') as SalesTab;

    if (menuParam && menuParam !== menuType) {
      setMenuType(menuParam);
      
      // Smart Mount Strategy: Immediately mount ALL tabs for this section
      setMountedTabs(prev => {
        let tabsToMount: SalesTab[] = [];
        if (menuParam === 'main' || menuParam === 'entry') tabsToMount = ['purchase', 'sales', 'stock', 'payment-payable', 'payment-receivable', 'rtgs-outsider', 'income-expense', 'cash-bank-management', 'daily-business-report', 'rtgs-report', 'voucher-import'];
        else if (menuParam === 'payments') tabsToMount = ['payment-payable', 'payment-receivable', 'rtgs-outsider', 'income-expense', 'ledger'];
        else if (menuParam === 'reports') {
          tabsToMount = ['daily-business-report', 'daily-payments', 'rtgs-report', 'voucher-import', 'reports-data-audit', 'manufacturing-costing'];
        } else if (menuParam === 'cash-bank') tabsToMount = ['cash-bank-management', 'settings-bank-accounts', 'settings-bank-management'];
        else if (menuParam === 'history') tabsToMount = ['history-new', 'history-edit', 'history-recycle', 'history-delete'];
        else if (menuParam === 'admin') tabsToMount = ['admin-local-hub', 'admin-erp-migrate', 'admin-secure-vault', 'admin-collection-sync'];
        
        const toAdd = tabsToMount.filter(t => !prev.includes(t));
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
    }

    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
      setMountedTabs((prev) => (prev.includes(tabParam) ? prev : [...prev, tabParam]));
    }
  }, [searchParams, activeTab, menuType]);
  
  const handleTabChange = useCallback((value: SalesTab) => {
    if (value === activeTab) return;

    // 1. Show the overlay instantly
    setIsTabTransitioning(true);
    setTransitionTargetTab(TAB_LABELS[value] || value);

    // 2. Perform actual tab transition in the next tick to let browser draw the overlay
    setTimeout(() => {
      setActiveTab(value);
      setMountedTabs((prev) => (prev.includes(value) ? prev : [...prev, value]));
      
      // Determine menu type based on tab (for top bar highlighting)
      let newMenuType: MenuType = 'dashboard';
      if (value === 'dashboard') newMenuType = 'dashboard';
      else if (menuType === 'fav') newMenuType = 'fav'; // Stay in Fav context if already there
      else if (['purchase', 'sales', 'stock', 'payment-payable', 'payment-receivable', 'rtgs-outsider', 'income-expense', 'cash-bank-management', 'daily-business-report', 'rtgs-report', 'voucher-import'].includes(value)) {
        newMenuType = 'main' as MenuType;
      }
      else if (['reports-data-audit', 'manufacturing-costing', 'history-new', 'history-edit', 'history-recycle', 'history-delete'].includes(value)) {
        newMenuType = 'history';
      }
      else if (value.startsWith('settings-')) newMenuType = 'settings';
      else if (['admin-local-hub', 'admin-erp-migrate', 'admin-secure-vault', 'admin-collection-sync'].includes(value)) newMenuType = 'admin';
      else newMenuType = 'main' as MenuType;
      
      setMenuType(newMenuType);

      // Debounce URL router transition to prevent Next.js router from choking on rapid switches
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
      navTimeoutRef.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', value);
        params.set('menu', newMenuType);
        electronNavigate(`/sales?${params.toString()}`, router, { method: 'replace' });
      }, 10);

      // Hide the overlay after browser paints the frame and settles the tab rendering
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            setIsTabTransitioning(false);
          }, 20);
        });
      });
    }, 10);
  }, [router, searchParams, menuType, activeTab]);
  const subTabs = useMemo(() => {
    if (menuType === ("main" as MenuType) || activeTab === "dashboard") {
      return [
        { value: "dashboard" as const, label: TAB_LABELS["dashboard"] },
        { value: "purchase" as const, label: TAB_LABELS["purchase"] },
        { value: "sales" as const, label: TAB_LABELS["sales"] },
        { value: "stock" as const, label: TAB_LABELS["stock"] },
        { value: "payment-payable" as const, label: TAB_LABELS["payment-payable"] },
        { value: "payment-receivable" as const, label: TAB_LABELS["payment-receivable"] },
        { value: "rtgs-outsider" as const, label: TAB_LABELS["rtgs-outsider"] },
        { value: "income-expense" as const, label: TAB_LABELS["income-expense"] },
        { value: "cash-bank-management" as const, label: TAB_LABELS["cash-bank-management"] },
        { value: "daily-business-report" as const, label: TAB_LABELS["daily-business-report"] },
        { value: "rtgs-report" as const, label: TAB_LABELS["rtgs-report"] },
        { value: "voucher-import" as const, label: TAB_LABELS["voucher-import"] },
      ];
    }

    if (menuType === "history") {
      return [
        { value: "reports-data-audit" as const, label: TAB_LABELS["reports-data-audit"] },
        { value: "manufacturing-costing" as const, label: TAB_LABELS["manufacturing-costing"] },
        { value: "history-new" as const, label: TAB_LABELS["history-new"] },
        { value: "history-edit" as const, label: TAB_LABELS["history-edit"] },
        { value: "history-recycle" as const, label: TAB_LABELS["history-recycle"] },
        { value: "history-delete" as const, label: TAB_LABELS["history-delete"] },
      ];
    }

    if (menuType === "settings") {
      return [
        { value: "settings-company" as const, label: TAB_LABELS["settings-company"] },
        { value: "settings-theme" as const, label: TAB_LABELS["settings-theme"] },
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

    if (menuType === "tools-menu") {
      return [
        { value: "ledger" as const, label: TAB_LABELS["ledger"] },
        { value: "settings-bank-accounts" as const, label: TAB_LABELS["settings-bank-accounts"] },
        { value: "settings-bank-management" as const, label: TAB_LABELS["settings-bank-management"] },
        { value: "daily-payments" as const, label: TAB_LABELS["daily-payments"] },
        { value: "reports-data-audit" as const, label: TAB_LABELS["reports-data-audit"] },
        { value: "manufacturing-costing" as const, label: TAB_LABELS["manufacturing-costing"] },
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
      const allSubMenuOptions = allMenuItems.flatMap(m => m.subMenus || []).filter(sub => sub.href);
      return allSubMenuOptions
        .filter(sub => favorites.includes(sub.id))
        .map(sub => {
          const tabParamMatch = sub.href!.match(/[?&]tab=([^&]+)/);
          const tabVal = (tabParamMatch ? tabParamMatch[1] : sub.id) as SalesTab;
          return { value: tabVal, label: sub.name };
        });
    }

    // 2. Fallback matching by activeTab if menuType param is not defined
    if (["purchase", "sales", "stock"].includes(activeTab)) {
      return [
        { value: "purchase" as const, label: TAB_LABELS["purchase"] },
        { value: "sales" as const, label: TAB_LABELS["sales"] },
        { value: "stock" as const, label: TAB_LABELS["stock"] },
      ];
    }

    if (["payment-payable", "payment-receivable", "rtgs-outsider", "income-expense", "ledger"].includes(activeTab)) {
      return [
        { value: "payment-payable" as const, label: TAB_LABELS["payment-payable"] },
        { value: "payment-receivable" as const, label: TAB_LABELS["payment-receivable"] },
        { value: "rtgs-outsider" as const, label: TAB_LABELS["rtgs-outsider"] },
        { value: "income-expense" as const, label: TAB_LABELS["income-expense"] },
        { value: "ledger" as const, label: TAB_LABELS["ledger"] },
      ];
    }

    if (["cash-bank-management", "settings-bank-accounts", "settings-bank-management"].includes(activeTab)) {
      return [
        { value: "cash-bank-management" as const, label: TAB_LABELS["cash-bank-management"] },
        { value: "settings-bank-accounts" as const, label: TAB_LABELS["settings-bank-accounts"] },
        { value: "settings-bank-management" as const, label: TAB_LABELS["settings-bank-management"] },
      ];
    }

    if (["daily-business-report", "daily-payments", "rtgs-report", "voucher-import"].includes(activeTab)) {
      return [
        { value: "daily-business-report" as const, label: TAB_LABELS["daily-business-report"] },
        { value: "daily-payments" as const, label: TAB_LABELS["daily-payments"] },
        { value: "rtgs-report" as const, label: TAB_LABELS["rtgs-report"] },
        { value: "voucher-import" as const, label: TAB_LABELS["voucher-import"] },
      ];
    }

    if (["history-new", "history-edit", "history-recycle", "history-delete", "reports-data-audit", "manufacturing-costing"].includes(activeTab)) {
      return [
        { value: "reports-data-audit" as const, label: TAB_LABELS["reports-data-audit"] },
        { value: "manufacturing-costing" as const, label: TAB_LABELS["manufacturing-costing"] },
        { value: "history-new" as const, label: TAB_LABELS["history-new"] },
        { value: "history-edit" as const, label: TAB_LABELS["history-edit"] },
        { value: "history-recycle" as const, label: TAB_LABELS["history-recycle"] },
        { value: "history-delete" as const, label: TAB_LABELS["history-delete"] },
      ];
    }

    if (activeTab.startsWith("settings-")) {
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

    if (activeTab.startsWith("admin-")) {
      return [
        { value: "admin-local-hub" as const, label: TAB_LABELS["admin-local-hub"] },
        { value: "admin-erp-migrate" as const, label: TAB_LABELS["admin-erp-migrate"] },
        { value: "admin-secure-vault" as const, label: TAB_LABELS["admin-secure-vault"] },
        { value: "admin-collection-sync" as const, label: TAB_LABELS["admin-collection-sync"] },
      ];
    }

    return [
      { value: "dashboard" as const, label: TAB_LABELS["dashboard"] },
      { value: "purchase" as const, label: TAB_LABELS["purchase"] },
      { value: "sales" as const, label: TAB_LABELS["sales"] },
      { value: "stock" as const, label: TAB_LABELS["stock"] },
    ];
  }, [menuType, activeTab, favorites]);

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
        case "purchase":
          return <SimpleSupplierEntryAllFields />;
        case "sales":
          return <CustomerEntryClient />;
        case "stock":
          return <StockManagementClient />;
        case "payment-payable":
          return <SupplierPaymentsClient type="supplier" />;
        case "payment-receivable":
          return <SupplierPaymentsClient type="customer" />;
        case "rtgs-outsider":
          return <SupplierPaymentsClient type="outsider" />;
        case "income-expense":
          return <IncomeExpenseClient />;
        case "ledger":
          return <LedgerPageComponent />;
        case "daily-business-report":
          return <DailyBusinessReport isActive={activeTab === "daily-business-report"} />;
        case "daily-payments":
          return <DailyPaymentsPage />;
        case "rtgs-report":
          return <RtgsReportClient />;
        case "voucher-import":
          return <VoucherImportTool />;
        case "reports-data-audit":
          return <DataAuditPage />;
        case "manufacturing-costing":
          return <ManufacturingCosting />;
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
    [activeTab]
  );
  const isSettingsActive = activeTab.startsWith('settings-');
  const { setSubnav } = useLayoutSubnav();

  // Inject Subnav Bar into sticky AppLayout Header (Zero gap & 100% frozen on scroll)
  useEffect(() => {
    if (subTabs.length === 0) {
      setSubnav(null);
      return;
    }

    setSubnav(
      <div className="flex items-stretch gap-0 w-full h-11 rounded-none overflow-x-auto no-scrollbar scroll-smooth transition-colors">
        {subTabs.map((t, index) => {
          const active = activeTab === t.value;
          const isFav = favorites.includes(t.value);
          const Icon = TAB_ICONS[t.value];

          return (
            <div key={t.value} className="relative group flex-1 min-w-[95px] sm:min-w-0 flex items-stretch h-full border-r border-solid last:border-r-0" style={{ borderColor: "var(--settings-subnav-border, rgba(203, 213, 225, 0.6))" }}>
              <button
                type="button"
                onClick={() => handleTabChange(t.value)}
                style={{
                  backgroundColor: active 
                    ? "var(--settings-subnav-active-bg, #F5A623)" 
                    : undefined,
                  color: active 
                    ? "var(--settings-subnav-active-text, #020617)" 
                    : "var(--settings-subnav-text, #334155)",
                  borderColor: active 
                    ? "var(--settings-subnav-active-bg, #F5A623)" 
                    : "transparent",
                }}
                className={cn(
                  "w-full flex flex-col items-center justify-center text-center py-1 px-1.5 transition-all duration-200 relative select-none h-full border-none",
                  active 
                    ? "font-black relative z-10 shadow-xs" 
                    : "hover:bg-[var(--settings-subnav-hover-bg,#e2d1e4)]"
                )}
              >
                {/* 2-Row Stacked Layout */}
                <div className="flex flex-col items-center justify-center gap-0.5 w-full">
                  {/* Row 1: Logo Icon + Shortcut Badge */}
                  <div className="flex items-center gap-1 justify-center">
                    {Icon && (
                      <Icon 
                        style={{
                          color: active 
                            ? "var(--settings-subnav-active-text, #020617)" 
                            : "var(--settings-subnav-text, #334155)"
                        }}
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 transition-transform duration-200", 
                          active ? "scale-105" : "group-hover:scale-105"
                        )} 
                      />
                    )}
                    {index < 18 && (
                      <kbd 
                        style={{
                          backgroundColor: active 
                            ? "var(--settings-subnav-active-text, #020617)" 
                            : "var(--settings-subnav-text, #334155)",
                          color: active 
                            ? "var(--settings-subnav-active-bg, #F5A623)" 
                            : "#ffffff"
                        }}
                        className="inline-flex items-center px-1 py-0.2 text-[8px] font-bold rounded border font-mono leading-none shrink-0 shadow-xs border-transparent"
                      >
                        <span className="text-[7.5px] opacity-80 mr-0.5 font-bold">Alt+</span>
                        <span className="font-extrabold uppercase text-[8px]">
                          {['1','2','3','4','5','6','7','8','9','0','Z','X','C','V','B','N','M'][index]}
                        </span>
                      </kbd>
                    )}
                  </div>

                  {/* Row 2: Text Label under logo & shortcut */}
                  <span className={cn(
                    "w-full truncate text-[10.5px] sm:text-[11px] tracking-normal leading-none text-center",
                    active ? "font-semibold" : "font-medium"
                  )}>
                    {t.label}
                  </span>
                </div>
              </button>

              <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setConfirmFav({ id: t.value, label: t.label, isFav: favorites.includes(t.value) });
                }}
                style={{
                  borderColor: isFav ? 'var(--header-active-bg, var(--header-bg, #b86a00))' : 'rgba(203, 213, 225, 0.8)',
                  color: 'var(--header-active-bg, var(--header-bg, #b86a00))'
                }}
                className={cn(
                  "absolute top-1 right-1 z-10 p-0.5 rounded-full bg-white shadow-xs border transition-all duration-200",
                  "opacity-0 group-hover:opacity-100",
                  isFav && "opacity-100 shadow-sm"
                )}
                title={isFav ? "Remove from Favorites" : "Add to Favorites"}
              >
                <Star 
                  className="h-2.5 w-2.5" 
                  style={{ 
                    fill: isFav ? 'var(--header-active-bg, var(--header-bg, #b86a00))' : 'none',
                    color: 'var(--header-active-bg, var(--header-bg, #b86a00))'
                  }} 
                />
              </button>
            </div>
          );
        })}
      </div>
    );

    return () => setSubnav(null);
  }, [subTabs, activeTab, favorites, setSubnav, handleTabChange]);

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex-1">
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
        <AlertDialogContent className="w-[90vw] max-w-sm rounded-[8px] p-6">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 shrink-0" style={{ color: 'var(--header-bg, var(--header-active-bg, var(--primary-bg-custom, hsl(var(--primary)))))' }} />
              <AlertDialogTitle className="font-black text-lg" style={{ color: 'var(--header-bg, var(--header-active-bg, var(--primary-bg-custom, hsl(var(--primary)))))' }}>Confirmation</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-800 text-sm font-medium leading-relaxed">
              Are you sure you want to {confirmFav?.isFav ? 'REMOVE' : 'ADD'} <span className="font-black" style={{ color: 'var(--header-bg, var(--header-active-bg, var(--primary-bg-custom, hsl(var(--primary)))))' }}>"{confirmFav?.label}"</span> {confirmFav?.isFav ? 'from' : 'to'} your Favorites menu?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2.5 mt-5">
            <AlertDialogCancel 
              className="flex-1 mt-0 text-slate-800 font-bold rounded-[6px] h-10 border transition-all active:scale-95 cursor-pointer shadow-xs"
              style={{
                background: 'linear-gradient(180deg, #ffffff 0%, #f1f3f6 100%)',
                borderTop: '1px solid #ffffff',
                borderLeft: '1px solid #ffffff',
                borderRight: '1px solid #cbd5e1',
                borderBottom: '1px solid #94a3b8',
                boxShadow: 'inset 0 1px 0 #ffffff, 0 2px 5px rgba(0,0,0,0.1)'
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (confirmFav) {
                  toggleFavorite(confirmFav.id);
                  setConfirmFav(null);
                }
              }}
              className="flex-1 font-bold rounded-[6px] h-10 transition-all active:scale-95 border-0 cursor-pointer shadow-md"
              style={{
                backgroundColor: 'var(--header-bg, var(--header-active-bg, var(--primary-bg-custom, hsl(var(--primary)))))',
                backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(0,0,0,0.15) 100%)',
                color: 'var(--header-text-color, #ffffff)',
                borderTop: '1px solid rgba(255,255,255,0.35)',
                borderBottom: '1px solid rgba(0,0,0,0.3)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 14px rgba(0,0,0,0.22)'
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProcessingOverlay
        show={isTabTransitioning}
        title={`Loading ${transitionTargetTab}`}
        description="Switching views and preparing records, please wait..."
      />
    </div>
  );
}
