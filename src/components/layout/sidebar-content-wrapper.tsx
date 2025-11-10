"use client";

import React, { useState, useEffect } from "react";
import { Header } from "./header";
import type { PageLayoutProps } from "@/app/types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Briefcase, Users, Package, LayoutDashboard, FilePlus,
  PackageCheck, BarChart3, Wallet, UserCircle, Banknote, Database,
  Calculator, CalendarCheck, Boxes, Building2, ShoppingCart, Mail,
  LineChart, ClipboardCheck, Users2, UserPlus, Landmark, Truck,
  Scale, Rocket, TrendingUp, Sparkles, ChevronRight, Settings, BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";

const menuItems = [
  {
    id: "MainDashboard",
    name: "Dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
    href: "/sales/dashboard-overview",
  },
  {
    id: "MainSupplier",
    name: "Supplier",
    icon: <Truck className="h-5 w-5" />,
    subMenus: [
      { id: "Supplier-Entry", name: "Supplier Entry", href: "/sales/supplier-entry", icon: <UserPlus className="h-5 w-5" /> },
      { id: "Supplier-Payments", name: "Supplier Payments", href: "/sales/supplier-payments", icon: <Wallet className="h-5 w-5" /> },
      { id: "Supplier-Profile", name: "Supplier Profile", href: "/sales/supplier-profile", icon: <UserCircle className="h-5 w-5" /> },
    ],
  },
  {
    id: "MainCustomer",
    name: "Customer",
    icon: <Users className="h-5 w-5" />,
    subMenus: [
      { id: "Customer-Entry", name: "Customer Entry", href: "/sales/customer-entry", icon: <UserPlus className="h-5 w-5" /> },
      { id: "Customer-Payments", name: "Customer Payments", href: "/sales/customer-payments", icon: <Wallet className="h-5 w-5" /> },
      { id: "Customer-Profile", name: "Customer Profile", href: "/sales/customer-profile", icon: <UserCircle className="h-5 w-5" /> },
    ],
  },
  {
    id: "MainReports",
    name: "Reports",
    icon: <BarChart3 className="h-5 w-5" />,
    subMenus: [
      { id: "Reports-Sales", name: "Sales Reports", href: "/sales/sales-reports", icon: <BarChart3 className="h-5 w-5" /> },
      { id: "Reports-OrderTracking", name: "Order Tracking", href: "/sales/order-tracking", icon: <PackageCheck className="h-5 w-5" /> },
      { id: "Reports-ProductCatalog", name: "Product Catalog", href: "/sales/product-catalog", icon: <ShoppingCart className="h-5 w-5" /> },
    ],
  },
  {
    id: "MainCashBank",
    name: "Cash & Bank",
    icon: <Landmark className="h-5 w-5" />,
    subMenus: [
      { id: "CashBank-Management", name: "Cash & Bank Management", href: "/cash-bank", icon: <Landmark className="h-5 w-5" /> },
      { id: "CashBank-Ledger", name: "Ledger Accounting", href: "/sales/ledger", icon: <BookOpen className="h-5 w-5" /> },
      { id: "CashBank-RTGS", name: "RTGS Payment", href: "/sales/rtgs-payment", icon: <Banknote className="h-5 w-5" /> },
    ],
  },
  {
    id: "Main6",
    name: "Income & Expense",
    icon: <Scale className="h-5 w-5" />,
    subMenus: [
      { id: "Sub6-1", name: "Income & Expense Tracker", href: "/expense-tracker", icon: <Calculator className="h-5 w-5" /> },
    ],
  },
  {
    id: "Main7",
    name: "Cash & Bank",
    icon: <Landmark className="h-5 w-5" />,
    subMenus: [
      { id: "Sub7-1", name: "Cash & Bank Management", href: "/cash-bank", icon: <Landmark className="h-5 w-5" /> },
      { id: "Sub7-2", name: "Ledger Accounting", href: "/sales/ledger", icon: <BookOpen className="h-5 w-5" /> },
    ],
  },
  {
    id: "Main2",
    name: "HR & Payroll",
    icon: <Users2 className="h-5 w-5" />,
    subMenus: [
      { id: "Sub2-1", name: "Employee Database", href: "/hr/employee-database", icon: <Database className="h-5 w-5" /> },
      { id: "Sub2-2", name: "Payroll Management", href: "/hr/payroll-management", icon: <Calculator className="h-5 w-5" /> },
      { id: "Sub2-3", name: "Attendance Tracking", href: "/hr/attendance-tracking", icon: <CalendarCheck className="h-5 w-5" /> },
    ],
  },
  {
    id: "Main3",
    name: "Inventory",
    icon: <Package className="h-5 w-5" />,
    subMenus: [
      { id: "Sub3-1", name: "Inventory Management", href: "/inventory/inventory-management", icon: <Boxes className="h-5 w-5" /> },
      { id: "Sub3-2", name: "Supplier Information", href: "/inventory/supplier-information", icon: <Building2 className="h-5 w-5" /> },
      { id: "Sub3-3", name: "Purchase Orders", href: "/inventory/purchase-orders", icon: <ShoppingCart className="h-5 w-5" /> },
    ],
  },
  {
    id: "Main4",
    name: "Marketing",
    icon: <Sparkles className="h-5 w-5" />,
    subMenus: [
      { id: "Sub4-1", name: "Campaigns", href: "/marketing/campaigns", icon: <Rocket className="h-5 w-5" /> },
      { id: "Sub4-2", name: "Email Marketing", href: "/marketing/email-marketing", icon: <Mail className="h-5 w-5" /> },
      { id: "Sub4-3", name: "Analytics", href: "/marketing/analytics", icon: <LineChart className="h-5 w-5" /> },
    ],
  },
  {
    id: "Main5",
    name: "Project Management",
    icon: <Briefcase className="h-5 w-5" />,
    subMenus: [
      { id: "Sub5-1", name: "Project Dashboard", href: "/projects/dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
      { id: "Sub5-2", name: "Task Management", href: "/projects/tasks", icon: <ClipboardCheck className="h-5 w-5" /> },
      { id: "Sub5-3", name: "Team Collaboration", href: "/projects/collaboration", icon: <Users2 className="h-5 w-5" /> },
    ],
  },
];

export default function SidebarContentWrapper({ children, pageMeta }: PageLayoutProps) {
  const pathname = usePathname();
  const { isMobile, state: sidebarState } = useSidebar();
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);

  useEffect(() => {
    setOpenSubMenu(null);
  }, [pathname, sidebarState]);

  const handleSubMenuToggle = (id: string) => {
    if (isMobile || sidebarState === "expanded") {
      setOpenSubMenu(openSubMenu === id ? null : id);
    }
  };

  const handleMouseEnter = (id: string) => {
    // Only open sub-menu on hover if not mobile and sidebar is collapsed to icons
    if (!isMobile && sidebarState === "collapsed") {
      setOpenSubMenu(id);
    }
  };

  const handleMouseLeave = () => {
    // Only close sub-menu on hover if not mobile and sidebar is collapsed to icons
    if (!isMobile && sidebarState === "collapsed") {
      setOpenSubMenu(null);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsible="offcanvas" variant="sidebar"> {/* Changed to collapsible="offcanvas" */}
        <SidebarHeader className="flex items-center justify-center p-2">
          <Link href="/" className="flex items-center gap-2">
            {pageMeta?.icon || <Sparkles className="h-6 w-6 text-primary" />}
            <span className="text-lg font-bold group-data-[state=collapsed]:hidden">
              {pageMeta?.title || "BizSuite"}
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <SidebarMenu>
            {menuItems.map((item) => (
              <React.Fragment key={item.id}>
                {item.href ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.name}>
                      <Link href={item.href}>
                        {item.icon}
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : (
                  <SidebarMenuItem
                    data-state={openSubMenu === item.id ? "open" : "closed"}
                    onMouseEnter={() => handleMouseEnter(item.id)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <SidebarMenuButton
                      tooltip={item.name}
                      className="justify-between"
                      onClick={() => handleSubMenuToggle(item.id)}
                    >
                      <div className="flex items-center gap-2">
                        {item.icon}
                        <span>{item.name}</span>
                      </div>
                      {item.subMenus && (
                        <ChevronRight className={`size-4 shrink-0 transition-transform ${openSubMenu === item.id ? "rotate-90" : ""}`} />
                      )}
                    </SidebarMenuButton>
                    {item.subMenus && openSubMenu === item.id && (
                      <SidebarMenuSub>
                        {item.subMenus.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.id}>
                            <SidebarMenuSubButton asChild isActive={pathname === subItem.href} tooltip={subItem.name}>
                              <Link href={subItem.href}>
                                {subItem.icon}
                                <span>{subItem.name}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                )}
              </React.Fragment>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="flex items-center justify-center p-2">
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Settings className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm group-data-[state=collapsed]:hidden">
              Settings
          </span>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <Header pageMeta={pageMeta} />
        <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </SidebarInset>
    </div>
  );
}
