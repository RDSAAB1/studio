
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
      { id: "sales/supplier-entry", name: "Supplier Entry", icon: UserPlus },
      { id: "sales/supplier-payments", name: "Supplier Payments", icon: Wallet },
      { id: "sales/supplier-profile", name: "Supplier Profile", icon: UserCircle },
    ],
  },
    {
    id: "customer",
    name: "Customer",
    icon: Users,
    subMenus: [
      { id: "sales/customer-entry", name: "Customer Entry", icon: UserPlus },
      { id: "sales/customer-payments", name: "Customer Payments", icon: Wallet },
      { id: "sales/customer-profile", name: "Customer Profile", icon: UserCircle },
    ],
  },
  {
    id: "cash-bank",
    name: "Cash & Bank",
    icon: Landmark,
  },
  { 
    id: "expense-tracker", 
    name: "Income & Expense", 
    icon: Scale, 
  },
  {
    id: "reports",
    name: "Reports",
    icon: FileText,
    subMenus: [
        { id: "sales/rtgs-report", name: "RTGS Report", icon: FileText },
        { id: "sales/daily-supplier-report", name: "Daily Supplier Report", icon: FileText },
    ]
  },
  {
    id: "hr",
    name: "HR Management",
    icon: Users2,
    subMenus: [
      { id: "hr/employee-database", name: "Employee Database", icon: Database },
      { id: "hr/payroll-management", name: "Payroll Management", icon: Calculator },
      { id: "hr/attendance-tracking", name: "Attendance Tracking", icon: CalendarCheck },
    ],
  },
  {
    id: "inventory",
    name: "Inventory",
    icon: PackageIcon,
    subMenus: [
      { id: "inventory/inventory-management", name: "Inventory", icon: Boxes },
      { id: "inventory/purchase-orders", name: "Purchase Orders", icon: ShoppingCart },
    ],
  },
  {
    id: "projects",
    name: "Projects",
    icon: Briefcase,
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
];
