
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { genId } from './use-toast'; // Re-use the unique ID generator
import {
  LayoutDashboard,
  Settings as SettingsIcon,
  BarChart3,
  Users,
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
  Package as PackageIcon,
} from 'lucide-react';
import React from 'react';

export interface TabType {
  id: string;
  path: string;
  title: string;
  icon: React.ReactNode;
}

export const allMenuItems = [
  { id: "main-dashboard-from-image", name: "Dashboard", icon: SettingsIcon, href: "/sales/dashboard-overview" },
  {
    id: "main-sales",
    name: "Sales",
    icon: TrendingUp,
    subMenus: [
      { id: "sub-sales-1", name: "Product Catalog", href: "/sales/product-catalog", icon: ShoppingCart },
      { id: "sub-sales-2", name: "Order Tracking", href: "/sales/order-tracking", icon: PackageCheck },
      { id: "sub-sales-3", name: "Sales Reports", href: "/sales/sales-reports", icon: BarChart3 },
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
];

const getMenuItem = (path: string) => {
  return allMenuItems.flatMap(item => item.subMenus || [item]).find(item => item.href === path);
};

export const useTabs = () => {
  const [tabs, setTabs] = useState<TabType[]>([]);
  const [activeTab, setActiveTabPath] = useState<string>('');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Load tabs from localStorage on initial client-side render
    const savedTabs = localStorage.getItem('openTabs');
    if (savedTabs) {
      const parsedTabs: Omit<TabType, 'icon'>[] = JSON.parse(savedTabs);
      const hydratedTabs = parsedTabs.map(t => {
          const menuItem = getMenuItem(t.path);
          const IconComponent = menuItem?.icon;
          return {...t, icon: IconComponent ? React.createElement(IconComponent, { className: "h-4 w-4" }) : React.createElement(React.Fragment)};
      });
      setTabs(hydratedTabs);
    }
  }, []);

  useEffect(() => {
    // Save tabs to localStorage whenever they change
    const tabsToSave = tabs.map(({ icon, ...rest }) => rest); // Exclude icon before saving
    localStorage.setItem('openTabs', JSON.stringify(tabsToSave));
  }, [tabs]);

  useEffect(() => {
    // Sync active tab with the current pathname
    if (pathname && tabs.some(tab => tab.path === pathname)) {
      setActiveTabPath(pathname);
    } else if (tabs.length > 0) {
      // If current path is not in tabs (e.g., after closing a tab), switch to the last tab
      const lastTab = tabs[tabs.length - 1];
      if(lastTab) {
        router.push(lastTab.path);
        setActiveTabPath(lastTab.path);
      }
    } else if (pathname !== '/sales/dashboard-overview') {
        // If no tabs are open, redirect to a default page
        router.push('/sales/dashboard-overview');
    }
  }, [pathname, tabs, router]);

  const addTab = useCallback((path: string) => {
    setTabs(prevTabs => {
      if (prevTabs.some(tab => tab.path === path)) {
        return prevTabs; // Don't add if it already exists
      }
      const menuItem = getMenuItem(path);
      if (menuItem) {
        const IconComponent = menuItem.icon;
        const newTab: TabType = {
          id: genId(),
          path: menuItem.href!,
          title: menuItem.name,
          icon: React.createElement(IconComponent, { className: "h-4 w-4" }),
        };
        return [...prevTabs, newTab];
      }
      return prevTabs;
    });
  }, []);

  const removeTab = useCallback((path: string) => {
    setTabs(prevTabs => prevTabs.filter(tab => tab.path !== path));
  }, []);

  const setActiveTab = useCallback((path: string) => {
    router.push(path);
    setActiveTabPath(path);
  }, [router]);

  return { tabs, activeTab, addTab, removeTab, setActiveTab };
};
