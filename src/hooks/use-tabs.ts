
"use client";

import {
  LayoutDashboard,
  TrendingUp,
  ShoppingCart,
  PackageCheck,
  BarChart3,
  Truck,
  UserPlus,
  Wallet,
  Users,
  Calculator,
  Landmark,
  Users2,
  Database,
  CalendarCheck,
  Package as PackageIcon,
  Boxes,
  Building2,
  Sparkles,
  Rocket,
  Mail,
  LineChart,
  Briefcase,
  ClipboardCheck,
  ChevronRight,
  FilePlus,
  Banknote,
  FileText,
  Settings,
  Upload,
  FileSpreadsheet,
  List,
  Printer,
  AreaChart,
  Lightbulb,
  User,
  HandCoins,
  CircleDollarSign,
  PieChart,
  CalendarClock,
  UserCheck,
  Wrench,
  Search,
  BookOpen,
  Activity,
  Compass,
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
    href: "/sales?menu=entry&tab=supplier-entry",
  },
  {
    id: "sales-payments",
    name: "Payments",
    icon: Wallet,
    href: "/sales?menu=payments&tab=supplier-payments",
  },
  {
    id: "cash-bank",
    name: "Cash & Bank",
    icon: Landmark,
    href: "/sales?menu=cash-bank&tab=cash-bank-management",
  },
  {
    id: "sales-reports",
    name: "Reports",
    icon: PieChart,
    href: "/sales?menu=reports&tab=daily-payments",
  },
  {
    id: "hr",
    name: "HR Management",
    icon: Users,
    subMenus: [
      { id: "hr-employee-database", name: "Employee Database", icon: Database, href: "/sales?menu=hr&tab=hr-employee-database" },
      { id: "hr-payroll-management", name: "Payroll Management", icon: Calculator, href: "/sales?menu=hr&tab=hr-payroll-management" },
      { id: "hr-attendance-tracking", name: "Attendance Tracking", icon: CalendarCheck, href: "/sales?menu=hr&tab=hr-attendance-tracking" },
      { id: "hr-contract-payments", name: "Contract Payments", icon: FileText, href: "/sales?menu=hr&tab=hr-contract-payments" },
    ],
  },
  {
    id: "inventory",
    name: "Inventory",
    icon: Building2,
    subMenus: [
      { id: "inventory-management", name: "Inventory Management", icon: Boxes, href: "/sales?menu=inventory&tab=inventory-management" },
      { id: "inventory-supplier-info", name: "Supplier Info", icon: Building2, href: "/sales?menu=inventory&tab=inventory-supplier-info" },
      { id: "inventory-purchase-orders", name: "Purchase Orders", icon: ShoppingCart, href: "/sales?menu=inventory&tab=inventory-purchase-orders" },
    ],
  },
  {
    id: "marketing",
    name: "Marketing",
    icon: Rocket,
    subMenus: [
      { id: "marketing-campaigns", name: "Campaigns", icon: TrendingUp, href: "/sales?menu=marketing&tab=marketing-campaigns" },
      { id: "marketing-email", name: "Email Marketing", icon: Mail, href: "/sales?menu=marketing&tab=marketing-email" },
      { id: "marketing-analytics", name: "Analytics", icon: LineChart, href: "/sales?menu=marketing&tab=marketing-analytics" },
    ],
  },
  {
    id: "projects",
    name: "Projects",
    icon: Lightbulb,
    subMenus: [
      { id: "project-dashboard", name: "Project Dashboard", icon: LayoutDashboard, href: "/sales?menu=projects&tab=project-dashboard" },
      { id: "project-tasks", name: "Tasks", icon: ClipboardCheck, href: "/sales?menu=projects&tab=project-tasks" },
      { id: "project-collaboration", name: "Collaboration", icon: Users2, href: "/sales?menu=projects&tab=project-collaboration" },
    ]
  },
  {
    id: "tools",
    name: "Tools",
    icon: Compass,
    subMenus: [
      { id: "tools-protractor", name: "Protractor Designer", icon: Compass, href: "/tools/protractor" },
    ]
  },
  {
    id: "settings", 
    name: "Settings", 
    icon: Settings,
    subMenus: [
      { id: "settings-bank-accounts", name: "Bank Accounts", icon: Landmark, href: "/sales?menu=settings&tab=settings-bank-accounts" },
      { id: "settings-bank-management", name: "Bank Management", icon: Banknote, href: "/sales?menu=settings&tab=settings-bank-management" },
      { id: "settings-printer", name: "Printer Settings", icon: Printer, href: "/sales?menu=settings&tab=settings-printer" },
      { id: "settings-theme", name: "Theme", icon: Sparkles, href: "/sales?menu=settings&tab=settings-theme" },
    ]
  },
  {
    id: "admin",
    name: "Admin Tools",
    icon: Wrench,
    subMenus: [
        { id: "admin/migrations", name: "Database Migrations", icon: Database },
        { id: "admin/diagnostics", name: "ID Diagnostics", icon: Search },
        { id: "admin/tasks", name: "Task Progress", icon: ClipboardCheck },
    ]
  },
];
