
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
  Banknote,
  FileText,
  Settings,
  Upload,
  List,
  Printer,
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
    id: "supplier",
    name: "Supplier",
    icon: Truck,
    subMenus: [
      { id: "supplier-entry", name: "Supplier Entry", icon: UserPlus },
      { id: "supplier-payments", name: "Supplier Payments", icon: Wallet },
      { id: "supplier-profile", name: "Supplier Profile", icon: UserCircle },
    ],
  },
    {
    id: "customer",
    name: "Customer",
    icon: Users,
    subMenus: [
      { id: "customer-entry", name: "Customer Entry", icon: UserPlus },
      { id: "customer-payments", name: "Customer Payments", icon: Wallet },
      { id: "customer-profile", name: "Customer Profile", icon: UserCircle },
    ],
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
  },
  {
    id: "reports",
    name: "Reports",
    icon: FileText,
    subMenus: [
        { id: "rtgs-report", name: "RTGS Report", icon: FileText },
    ]
  },
  {
    id: "hr",
    name: "HR Management",
    icon: Users2,
    subMenus: [
      { id: "employee-db", name: "Employee Database", icon: Database },
      { id: "payroll", name: "Payroll Management", icon: Calculator },
      { id: "attendance", name: "Attendance Tracking", icon: CalendarCheck },
    ],
  },
  {
    id: "inventory",
    name: "Inventory",
    icon: PackageIcon,
    subMenus: [
      { id: "inventory-mgmt", name: "Inventory", icon: Boxes },
      { id: "purchase-orders", name: "Purchase Orders", icon: ShoppingCart },
    ],
  },
  {
    id: "projects",
    name: "Projects",
    icon: Briefcase,
    subMenus: [
        { id: "project-dashboard", name: "Dashboard", icon: LayoutDashboard },
        { id: "project-management", name: "Management", icon: List },
        { id: "tasks", name: "Tasks", icon: ClipboardCheck },
        { id: "collaboration", name: "Collaboration", icon: Users },
    ]
  },
  {
    id: "data-capture",
    name: "Data Capture",
    icon: Upload,
  },
   {
    id: "printer-settings",
    name: "Printer Settings",
    icon: Printer,
  },
  { 
    id: "settings", 
    name: "Settings", 
    icon: Settings, 
  },
];
