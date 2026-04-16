
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
  Building,
  Mail,
  ShieldCheck,
  List,
  UserCircle,
  Star,
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
    name: "Dashboard (Alt+D)",
    icon: LayoutDashboard,
  },
  {
    id: "sales-entry",
    name: "Entry (Alt+E)",
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
    name: "Payments (Alt+P)",
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
    name: "Cash & Bank (Alt+B)",
    icon: Landmark,
    subMenus: [
      { id: "cash-bank-management", name: "Cash & Bank", icon: Landmark, href: "/sales?menu=cash-bank&tab=cash-bank-management" },
      { id: "settings-bank-accounts", name: "Bank Accounts", icon: Landmark, href: "/sales?menu=cash-bank&tab=settings-bank-accounts" },
      { id: "settings-bank-management", name: "Bank Management", icon: Banknote, href: "/sales?menu=cash-bank&tab=settings-bank-management" },
    ],
  },
  {
    id: "sales-reports",
    name: "Reports (Alt+R)",
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
    name: "Settings (Alt+T)", 
    icon: Settings,
    subMenus: [
      { id: "settings-company", name: "Company", icon: Building, href: "/sales?menu=settings&tab=settings-company" },
      { id: "settings-email", name: "Email", icon: Mail, href: "/sales?menu=settings&tab=settings-email" },
      { id: "settings-team", name: "Team", icon: Users2, href: "/sales?menu=settings&tab=settings-team" },
      { id: "settings-security", name: "Security", icon: ShieldCheck, href: "/sales?menu=settings&tab=settings-security" },
      { id: "settings-general", name: "General", icon: Settings, href: "/sales?menu=settings&tab=settings-general" },
      { id: "settings-banks", name: "Banks", icon: Landmark, href: "/sales?menu=settings&tab=settings-banks" },
      { id: "settings-receipts", name: "Receipts", icon: FileText, href: "/sales?menu=settings&tab=settings-receipts" },
      { id: "settings-formats", name: "Formats", icon: List, href: "/sales?menu=settings&tab=settings-formats" },
      { id: "settings-account", name: "Account", icon: UserCircle, href: "/sales?menu=settings&tab=settings-account" },
    ],
  },
  {
    id: "admin",
    name: "Admin (Alt+A)",
    icon: Wrench,
    subMenus: [
        // All admin tools now live inside unified /sales SPA (single route)
        { id: "admin/migrations", name: "Data Migration", icon: Database, href: "/sales?menu=admin&tab=admin-local-hub" },
    ]
  },
  {
    id: "fav",
    name: "Fav (Alt+F)",
    icon: Star,
    href: "/sales?menu=fav",
    subMenus: [], // This will be dynamic in the UI
  },
];
