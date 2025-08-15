
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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type MenuItem = {
    id: string;
    name: string;
    icon: LucideIcon;
    href?: string;
    subMenus?: Omit<MenuItem, 'icon' | 'subMenus'>[];
}

export const allMenuItems: MenuItem[] = [
  { 
    id: "dashboard", 
    name: "Dashboard", 
    icon: LayoutDashboard, 
    href: "/sales/dashboard-overview" 
  },
  {
    id: "sales",
    name: "Sales",
    icon: TrendingUp,
    subMenus: [
      { id: "supplier-entry", name: "Supplier Entry", href: "/sales/supplier-entry" },
      { id: "supplier-payments", name: "Supplier Payments", href: "/sales/supplier-payments" },
      { id: "supplier-profile", name: "Supplier Profile", href: "/sales/supplier-profile" },
      { id: "customer-entry", name: "Customer Entry", href: "/sales/customer-entry" },
      { id: "customer-payments", name: "Customer Payments", href: "/sales/customer-payments" },
      { id: "customer-profile", name: "Customer Profile", href: "/sales/customer-profile" },
    ],
  },
  {
    id: "finance",
    name: "Finance",
    icon: Scale,
    subMenus: [
        { id: "income-expense", name: "Income & Expense", href: "/expense-tracker" },
        { id: "cash-bank", name: "Cash & Bank", href: "/cash-bank" },
    ]
  },
  {
    id: "hr",
    name: "HR & Payroll",
    icon: Users2,
    subMenus: [
      { id: "employee-db", name: "Employee Database", href: "/hr/employee-database" },
      { id: "payroll", name: "Payroll", href: "/hr/payroll-management" },
    ],
  },
  {
    id: "inventory",
    name: "Inventory",
    icon: PackageIcon,
    subMenus: [
      { id: "inventory-mgmt", name: "Inventory", href: "/inventory/inventory-management" },
      { id: "purchase-orders", name: "Purchase Orders", href: "/inventory/purchase-orders" },
    ],
  },
  {
    id: "projects",
    name: "Projects",
    icon: Briefcase,
    subMenus: [
        { id: "project-dashboard", name: "Dashboard", href: "/projects/dashboard" },
    ]
  },
];
