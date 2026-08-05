
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
  Factory,
  GraduationCap,
  Layers,
  Compass,
  FileSpreadsheet,
  Globe,
  ShoppingBag,
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
    id: "main",
    name: "Main (Alt+M)",
    icon: Layers,
    subMenus: [
      { id: "purchase", name: "Purchase", icon: FilePlus, href: "/sales?menu=main&tab=purchase" },
      { id: "sales", name: "Sales", icon: Users2, href: "/sales?menu=main&tab=sales" },
      { id: "stock", name: "Stock Management", icon: Package, href: "/sales?menu=main&tab=stock" },
      { id: "payment-payable", name: "Payment Payable", icon: Wallet, href: "/sales?menu=main&tab=payment-payable" },
      { id: "payment-receivable", name: "Payment Receivable", icon: Users, href: "/sales?menu=main&tab=payment-receivable" },
      { id: "rtgs-outsider", name: "RTGS Outsider", icon: Banknote, href: "/sales?menu=main&tab=rtgs-outsider" },
      { id: "income-expense", name: "Incomes & Expenses", icon: Landmark, href: "/sales?menu=main&tab=income-expense" },
      { id: "cash-bank-management", name: "Cash & Bank", icon: Landmark, href: "/sales?menu=main&tab=cash-bank-management" },
      { id: "daily-business-report", name: "360° Business Report", icon: PieChart, href: "/sales?menu=main&tab=daily-business-report" },
      { id: "rtgs-report", name: "RTGS Report", icon: Banknote, href: "/sales?menu=main&tab=rtgs-report" },
      { id: "voucher-import", name: "Mandi Import", icon: Database, href: "/sales?menu=main&tab=voucher-import" },
    ],
  },
  {
    id: "history",
    name: "History (Alt+H)",
    icon: History,
    subMenus: [
      { id: "reports-data-audit", name: "Data Audit", icon: Search, href: "/sales?menu=history&tab=reports-data-audit" },
      { id: "manufacturing-costing", name: "Manufacturing Costing", icon: Factory, href: "/sales?menu=history&tab=manufacturing-costing" },
      { id: "history-new", name: "New Entry", icon: Plus, href: "/sales?menu=history&tab=history-new" },
      { id: "history-edit", name: "Edit History", icon: Pen, href: "/sales?menu=history&tab=history-edit" },
      { id: "history-recycle", name: "Recycle Bin", icon: RotateCcw, href: "/sales?menu=history&tab=history-recycle" },
      { id: "history-delete", name: "Delete History", icon: Trash2, href: "/sales?menu=history&tab=history-delete" },
    ]
  },
  {
    id: "tools-menu",
    name: "Tools (Alt+O)",
    icon: Compass,
    subMenus: [
      { id: "ledger", name: "Ledger", icon: Database, href: "/sales?menu=tools-menu&tab=ledger" },
      { id: "settings-bank-accounts", name: "Bank Accounts", icon: Building, href: "/sales?menu=tools-menu&tab=settings-bank-accounts" },
      { id: "settings-bank-management", name: "Bank Management", icon: Banknote, href: "/sales?menu=tools-menu&tab=settings-bank-management" },
      { id: "daily-payments", name: "Daily Payments", icon: Wallet, href: "/sales?menu=tools-menu&tab=daily-payments" },
      { id: "reports-data-audit", name: "Data Audit", icon: Search, href: "/sales?menu=tools-menu&tab=reports-data-audit" },
      { id: "manufacturing-costing", name: "Manufacturing Costing", icon: Factory, href: "/sales?menu=tools-menu&tab=manufacturing-costing" },
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
  {
    id: "student-practice",
    name: "Student Practice (Quiz)",
    icon: GraduationCap,
    href: "/practice",
  },
];
