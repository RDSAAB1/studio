
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
    id: "dashboard", 
    name: "Dashboard", 
    icon: LayoutDashboard, 
    href: "/sales/dashboard-overview" 
  },
  {
    id: "supplier",
    name: "Supplier",
    icon: Truck,
    subMenus: [
      { id: "supplier-entry", name: "Supplier Entry", icon: ChevronRight, href: "/sales/supplier-entry" },
      { id: "supplier-payments", name: "Supplier Payments", icon: ChevronRight, href: "/sales/supplier-payments" },
      { id: "supplier-profile", name: "Supplier Profile", icon: ChevronRight, href: "/sales/supplier-profile" },
    ],
  },
    {
    id: "customer",
    name: "Customer",
    icon: Users,
    subMenus: [
      { id: "customer-entry", name: "Customer Entry", icon: ChevronRight, href: "/sales/customer-entry" },
      { id: "customer-payments", name: "Customer Payments", icon: ChevronRight, href: "/sales/customer-payments" },
      { id: "customer-profile", name: "Customer Profile", icon: ChevronRight, href: "/sales/customer-profile" },
    ],
  },
  {
    id: "finance",
    name: "Finance",
    icon: Scale,
    subMenus: [
        { id: "income-expense", name: "Income & Expense", icon: ChevronRight, href: "/expense-tracker" },
        { id: "cash-bank", name: "Cash & Bank", icon: ChevronRight, href: "/cash-bank" },
    ]
  },
  {
    id: "reports",
    name: "Reports",
    icon: FileText,
    subMenus: [
        { id: "rtgs-report", name: "RTGS Report", icon: ChevronRight, href: "/sales/rtgs-report" },
    ]
  },
  {
    id: "hr",
    name: "HR Management",
    icon: Users2,
    subMenus: [
      { id: "employee-db", name: "Employee Database", icon: ChevronRight, href: "/hr/employee-database" },
      { id: "payroll", name: "Payroll Management", icon: ChevronRight, href: "/hr/payroll-management" },
      { id: "attendance", name: "Attendance Tracking", icon: ChevronRight, href: "/hr/attendance-tracking" },
    ],
  },
  {
    id: "inventory",
    name: "Inventory",
    icon: PackageIcon,
    subMenus: [
      { id: "inventory-mgmt", name: "Inventory", icon: ChevronRight, href: "/inventory/inventory-management" },
      { id: "purchase-orders", name: "Purchase Orders", icon: ChevronRight, href: "/inventory/purchase-orders" },
    ],
  },
  {
    id: "projects",
    name: "Projects",
    icon: Briefcase,
    subMenus: [
        { id: "project-dashboard", name: "Dashboard", icon: ChevronRight, href: "/projects/dashboard" },
        { id: "tasks", name: "Tasks", icon: ClipboardCheck, href: "/projects/tasks" },
        { id: "collaboration", name: "Collaboration", icon: Users, href: "/projects/collaboration" },
    ]
  },
  {
    id: "data-capture",
    name: "Data Capture",
    icon: Upload,
    href: "/data-capture",
  },
  { 
    id: "settings", 
    name: "Settings", 
    icon: Settings, 
    href: "/settings" 
  },
];
