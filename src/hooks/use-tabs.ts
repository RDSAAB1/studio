
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
  UserCircle,
  Users,
  Scale,
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
  },
  { 
    id: "income-expense", 
    name: "Income & Expense", 
    icon: Scale, 
    subMenus: [
      { id: "expense-tracker/payee-profile", name: "Payee Profile", icon: UserCircle },
    ],
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
      { id: "hr/employee-database", name: "Employee Database", icon: Database },
      { 
        id: "hr/payroll", 
        name: "Payroll", 
        icon: Calculator,
        subMenus: [
            { id: "hr/payroll-management", name: "Salary Processing", icon: UserCheck, href: "/hr/payroll-management" },
            { id: "hr/contract-payments", name: "Contractual Payments", icon: FileText, href: "/hr/contract-payments" },
        ]
      },
      { id: "hr/attendance-tracking", name: "Attendance Tracking", icon: CalendarCheck },
    ],
  },
  {
    id: "inventory",
    name: "Inventory",
    icon: Building2,
    subMenus: [
      { id: "inventory/inventory-management", name: "Inventory", icon: Boxes },
      { id: "inventory/purchase-orders", name: "Purchase Orders", icon: ShoppingCart },
    ],
  },
  {
    id: "projects",
    name: "Projects",
    icon: Lightbulb,
    subMenus: [
        { id: "projects/dashboard", name: "Dashboard", icon: LayoutDashboard },
        { id: "projects/management", name: "Management", icon: List },
        { id: "projects/tasks", name: "Tasks", icon: ClipboardCheck },
        { id: "projects/collaboration", name: "Collaboration", icon: Users },
    ]
  },
  {
    id: "data-capture",
    name: "Data Capture",
    icon: Upload,
  },
  { 
    id: "settings", 
    name: "Settings", 
    icon: Settings,
    subMenus: [
        { id: "settings", name: "General Settings", icon: Settings },
        { id: "settings/bank-management", name: "Bank Management", icon: Landmark },
        { id: "settings/printer", name: "Printer Settings", icon: Printer },
    ]
  },
  {
    id: "admin",
    name: "Admin Tools",
    icon: Wrench,
    subMenus: [
        { id: "admin/migrations", name: "Database Migrations", icon: Database },
        { id: "admin/diagnostics", name: "ID Diagnostics", icon: Search },
    ]
  },
];
