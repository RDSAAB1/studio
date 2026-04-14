
"use client";

import {
  LayoutDashboard,
  Truck,
  Wallet,
  Users,
  Landmark,
  Users2,
  Database,

  FilePlus,
  Banknote,
  FileText,
  Settings,
  Lightbulb,
  ClipboardCheck,
  Wrench,
  Search,
  Plus,
  Pen,
  RotateCcw,
  Trash2,
  PieChart,
  History,
  Calculator,
  Warehouse,
  Package,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type MenuItem = {
    id: string;
    name: string;
    icon: LucideIcon;
    href?: string;
    subMenus?: MenuItem[];
}

export const allMenuItems: MenuItem[] = [
  {
    id: "dashboard-overview",
    name: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "sales-entry",
    name: "Entry",
    icon: FilePlus,
    subMenus: [
      { id: "supplier-entry", name: "Supplier Entry", icon: FilePlus, href: "/sales?menu=entry&tab=supplier-entry" },
      { id: "customer-entry", name: "Customer Entry", icon: Users2, href: "/sales?menu=entry&tab=customer-entry" },
      { id: "inventory-management", name: "Inventory", icon: Warehouse, href: "/sales?menu=entry&tab=inventory-management" },
      { id: "inventory-add", name: "Add Stock", icon: Package, href: "/sales?menu=entry&tab=inventory-add" },
    ],
  },
  {
    id: "sales-payments",
    name: "Payments",
    icon: Wallet,
    subMenus: [
      { id: "supplier-payments", name: "Supplier Payments", icon: Wallet, href: "/sales?menu=payments&tab=supplier-payments" },
      { id: "customer-payments", name: "Customer Payments", icon: Users, href: "/sales?menu=payments&tab=customer-payments" },
      { id: "rtgs-outsider", name: "RTGS Outsider", icon: Banknote, href: "/sales?menu=payments&tab=rtgs-outsider" },
      { id: "income-expense", name: "Incomes & Expenses", icon: Landmark, href: "/sales?menu=payments&tab=income-expense" },
      { id: "ledger", name: "Ledgers", icon: Database, href: "/sales?menu=payments&tab=ledger" },
    ],
  },
  {
    id: "cash-bank",
    name: "Cash & Bank",
    icon: Landmark,
    subMenus: [
      { id: "cash-bank-management", name: "Cash & Bank", icon: Landmark, href: "/sales?menu=cash-bank&tab=cash-bank-management" },
      { id: "settings-bank-accounts", name: "Bank Accounts", icon: Landmark, href: "/sales?menu=cash-bank&tab=settings-bank-accounts" },
      { id: "settings-bank-management", name: "Bank Management", icon: Banknote, href: "/sales?menu=cash-bank&tab=settings-bank-management" },
    ],
  },
  {
    id: "sales-reports",
    name: "Reports",
    icon: PieChart,
    subMenus: [
      { id: "daily-business-report", name: "360° Business Report", icon: PieChart, href: "/sales?menu=reports&tab=daily-business-report" },
      { id: "daily-payments", name: "Daily Payments", icon: Wallet, href: "/sales?menu=reports&tab=daily-payments" },
      { id: "daily-supplier-report", name: "Daily Supplier Report", icon: FileText, href: "/sales?menu=reports&tab=daily-supplier-report" },
      { id: "rtgs-report", name: "RTGS Report", icon: Banknote, href: "/sales?menu=reports&tab=rtgs-report" },
      { id: "6r-report", name: "6R Report", icon: FileText, href: "/sales?menu=reports&tab=6r-report" },
      { id: "mandi-report-history", name: "Mandi History", icon: History, href: "/sales?menu=reports&tab=mandi-report-history" },
      { id: "voucher-import", name: "Mandi Import", icon: Database, href: "/sales?menu=reports&tab=voucher-import" },
      { id: "reports-data-audit", name: "Data Audit", icon: Search, href: "/sales?menu=reports&tab=reports-data-audit" },
    ],
  },
  {
    id: "history",
    name: "History",
    icon: History,
    subMenus: [
      { id: "history-new", name: "New Entry", icon: Plus, href: "/sales?menu=history&tab=history-new" },
      { id: "history-edit", name: "Edit History", icon: Pen, href: "/sales?menu=history&tab=history-edit" },
      { id: "history-recycle", name: "Recycle Bin", icon: RotateCcw, href: "/sales?menu=history&tab=history-recycle" },
      { id: "history-delete", name: "Delete History", icon: Trash2, href: "/sales?menu=history&tab=history-delete" },
    ]
  },
  {
    id: "settings", 
    name: "Settings", 
    icon: Settings,
    // Route Settings through unified /sales SPA for single-page feel
    href: "/settings",
  },
  {
    id: "admin",
    name: "Admin Tools",
    icon: Wrench,
    subMenus: [
        // All admin tools now live inside unified /sales SPA (single route)
        { id: "admin/migrations", name: "Data Migration", icon: Database, href: "/sales?menu=admin&tab=admin-local-hub" },
    ]
  },
];
