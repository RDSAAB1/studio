"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { PageMeta } from "@/app/types";
import {
  Menu,
  LayoutDashboard,
  Home,
  Settings as SettingsIcon, 
  BarChart3,
  Users,
  LogOut,
  ChevronRight,
  ChevronDown,
  Search,
  UserCircle,
  TrendingUp,
  ShoppingCart,
  PackageCheck,
  Banknote,
  Truck,
  UserPlus,
  Wallet,
  Scale,
  Calculator,
  Landmark,
  Database,
  CalendarCheck,
  Boxes,
  Building2,
  Sparkles,
  Rocket,
  Mail,
  LineChart,
  ClipboardCheck,
  Briefcase,
  Users2,
  Package as PackageIcon 
} from "lucide-react";

interface HeaderProps {
  pageMeta?: PageMeta;
  toggleSidebar: () => void; 
  isSidebarOpen: boolean; 
}

// NOTE: This menuItems array is duplicated from custom-sidebar.tsx to allow Header
// to determine the current page's icon and title based on the full menu structure.
const allMenuItems = [
  {
    id: "main-home",
    name: "Home",
    icon: Home,
    href: "/sales/dashboard-overview", 
  },
  {
    id: "main-dashboard-from-image",
    name: "Dashboard", 
    icon: SettingsIcon, 
    href: "/sales/dashboard-overview", 
  },
  {
    id: "main-settings-from-image",
    name: "Settings",
    icon: SettingsIcon,
    href: "/settings",
  },
  {
    id: "main-reports-from-image",
    name: "Reports",
    icon: BarChart3,
    href: "/sales/sales-reports", 
  },
  {
    id: "main-users-from-image",
    name: "Users",
    icon: Users,
    href: "/hr/employee-database", 
  },
  // Your original detailed menu items follow:
  {
    id: "main-sales",
    name: "Sales",
    icon: TrendingUp,
    subMenus: [
      { id: "sub-sales-1", name: "Product Catalog", href: "/sales/product-catalog", icon: ShoppingCart },
      { id: "sub-sales-2", name: "Order Tracking", href: "/sales/order-tracking", icon: PackageCheck },
      { id: "sub-sales-3", name: "Sales Reports", href: "/sales/sales-reports", icon: BarChart3 },
      { id: "sub-sales-4", name: "RTGS Payment", href: "/sales/rtgs-payment", icon: Banknote },
    ],
  },
  {
    id: "main-suppliers",
    name: "Suppliers",
    icon: Truck,
    subMenus: [
      { id: "sub-suppliers-1", name: "Supplier Entry", href: "/sales/supplier-entry", icon: UserPlus },
      { id: "sub-suppliers-2", name: "Supplier Payments", href: "/sales/supplier-payments", icon: Wallet },
      { id: "sub-suppliers-3", name: "Supplier Profile", href: "/sales/supplier-profile", icon: UserCircle },
    ],
  },
  {
    id: "main-customers",
    name: "Customers",
    icon: Users,
    subMenus: [
      { id: "sub-customers-1", name: "Customer Entry", href: "/sales/customer-entry", icon: UserPlus },
      { id: "sub-customers-2", name: "Customer Payments", href: "/sales/customer-payments", icon: Wallet },
      { id: "sub-customers-3", name: "Customer Profile", href: "/sales/customer-profile", icon: UserCircle },
    ],
  },
  {
    id: "main-income-expense",
    name: "Income & Expense",
    icon: Scale,
    subMenus: [
      { id: "sub-income-expense-1", name: "Income & Expense Tracker", href: "/expense-tracker", icon: Calculator },
    ],
  },
  {
    id: "main-cash-bank",
    name: "Cash & Bank",
    icon: Landmark,
    subMenus: [
      { id: "sub-cash-bank-1", name: "Cash & Bank Management", href: "/cash-bank", icon: Landmark },
    ],
  },
  {
    id: "main-hr-payroll",
    name: "HR & Payroll",
    icon: Users2,
    subMenus: [
      { id: "sub-hr-1", name: "Employee Database", href: "/hr/employee-database", icon: Database },
      { id: "sub-hr-2", name: "Payroll Management", href: "/hr/payroll-management", icon: Calculator },
      { id: "sub-hr-3", name: "Attendance Tracking", href: "/hr/attendance-tracking", icon: CalendarCheck },
    ],
  },
  {
    id: "main-inventory",
    name: "Inventory",
    icon: PackageIcon,
    subMenus: [
      { id: "sub-inventory-1", name: "Inventory Management", href: "/inventory/inventory-management", icon: Boxes },
      { id: "sub-inventory-2", name: "Supplier Information", href: "/inventory/supplier-information", icon: Building2 },
      { id: "sub-inventory-3", name: "Purchase Orders", href: "/inventory/purchase-orders", icon: ShoppingCart },
    ],
  },
  {
    id: "main-marketing",
    name: "Marketing",
    icon: Sparkles,
    subMenus: [
      { id: "sub-marketing-1", name: "Campaigns", href: "/marketing/campaigns", icon: Rocket },
      { id: "sub-marketing-2", name: "Email Marketing", href: "/marketing/email-marketing", icon: Mail },
      { id: "sub-marketing-3", name: "Analytics", href: "/marketing/analytics", icon: LineChart },
    ],
  },
  {
    id: "main-project-management",
    name: "Project Management",
    icon: Briefcase,
    subMenus: [
      { id: "sub-project-1", name: "Project Dashboard", href: "/projects/dashboard", icon: LayoutDashboard },
      { id: "sub-project-2", name: "Task Management", href: "/projects/tasks", icon: ClipboardCheck },
      { id: "sub-project-3", name: "Team Collaboration", href: "/projects/collaboration", icon: Users2 },
    ],
  },
  {
    id: "main-logout",
    name: "Logout",
    icon: LogOut,
    href: "/logout", 
  },
];

export function Header({ pageMeta, toggleSidebar, isSidebarOpen }: HeaderProps) {
  const pathname = usePathname();

  // Determine current page details based on pathname from the consolidated menuItems
  const currentPage = allMenuItems.flatMap(m => m.subMenus || []).find(s => pathname.startsWith(s.href || '')) ||
                      allMenuItems.find(m => pathname.startsWith(m.href || ''));

  const DisplayIconComponent = currentPage?.icon || pageMeta?.icon;
  const displayIcon = DisplayIconComponent ? <DisplayIconComponent className="h-5 w-5"  /> : null;
  const displayTitle = currentPage?.name || pageMeta?.title || 'BizSuite';

  return (
    <header className="sticky top-0 z-30 w-full bg-[--sidebar-bg] text-[--sidebar-text] shadow-md"> 
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4"> 
        {/* Left section: Toggle button, Page Icon, Page Title */}
        <div className="flex items-center space-x-4">
          {/* Mobile menu toggle button (visible on small screens) */}
          <button
            onClick={toggleSidebar}
            className={cn(
              "p-2 rounded-full hover:bg-[--sidebar-hover-bg] focus:outline-none focus:ring-2 focus:ring-[--sidebar-focus-ring]", 
              "lg:hidden" 
            )}
            aria-label={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
          >
            <Menu className="h-6 w-6 text-[--sidebar-text]" /> 
          </button>

          {displayIcon && <div className="text-[--sidebar-text]">{displayIcon}</div>} 
          <span className="text-xl font-bold whitespace-nowrap overflow-hidden text-ellipsis text-[--sidebar-text]"> 
            {displayTitle}
          </span>
        </div>

        {/* Right section: Profile Icon, Settings Icon */}
        <div className="flex items-center space-x-4">
          {/* Profile Icon */}
          <button 
            className="p-2 rounded-full hover:bg-[--sidebar-hover-bg] focus:outline-none focus:ring-2 focus:ring-[--sidebar-focus-ring] transition-colors"
            aria-label="User Profile"
          >
            <UserCircle className="h-6 w-6 text-[--sidebar-text]" />
          </button>

          {/* Settings Icon */}
          <button 
            className="p-2 rounded-full hover:bg-[--sidebar-hover-bg] focus:outline-none focus:ring-2 focus:ring-[--sidebar-focus-ring] transition-colors"
            aria-label="Settings"
          >
            <SettingsIcon className="h-6 w-6 text-[--sidebar-text]" />
          </button>
        </div>
      </div>
    </header>
  );
}
