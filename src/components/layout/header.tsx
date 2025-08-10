
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport, 
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PageMeta } from "@/app/types";
import { cva } from "class-variance-authority";
import { 
  Briefcase, Users, Package, LayoutDashboard, FilePlus, 
  PackageCheck, BarChart3, Wallet, UserCircle, Banknote, Database, 
  Calculator, CalendarCheck, Boxes, Building2, ShoppingCart, Mail, 
  LineChart, ClipboardCheck, Users2, UserPlus, Landmark, Truck, 
  Scale, Rocket, TrendingUp, Sparkles
} from "lucide-react";

const menuItems = [
   {
    id: "Main0",
    name: "Dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
    href: "/sales/dashboard-overview",
  },
  {
    id: "Main1",
    name: "Sales",
    icon: <TrendingUp className="h-5 w-5" />,
    subMenus: [
      { id: "Sub1-3", name: "Product Catalog", href: "/sales/product-catalog", icon: <ShoppingCart className="h-5 w-5" /> },
      { id: "Sub1-4", name: "Order Tracking", href: "/sales/order-tracking", icon: <PackageCheck className="h-5 w-5" /> },
      { id: "Sub1-5", name: "Sales Reports", href: "/sales/sales-reports", icon: <BarChart3 className="h-5 w-5" /> },
      { id: "Sub1-8", name: "RTGS Payment", href: "/sales/rtgs-payment", icon: <Banknote className="h-5 w-5" /> },
    ],
  },
  {
    id: "Main8",
    name: "Supplier",
    icon: <Truck className="h-5 w-5" />,
    subMenus: [
       { id: "Sub8-1", name: "Supplier Entry", href: "/sales/supplier-entry", icon: <UserPlus className="h-5 w-5" /> },
       { id: "Sub8-2", name: "Supplier Payments", href: "/sales/supplier-payments", icon: <Wallet className="h-5 w-5" /> },
       { id: "Sub8-3", name: "Supplier Profile", href: "/sales/supplier-profile", icon: <UserCircle className="h-5 w-5" /> },
    ],
  },
   {
    id: "Main9",
    name: "Customer",
    icon: <Users className="h-5 w-5" />,
    subMenus: [
       { id: "Sub9-1", name: "Customer Entry", href: "/sales/customer-entry", icon: <UserPlus className="h-5 w-5" /> },
       { id: "Sub9-2", name: "Customer Payments", href: "/sales/customer-payments", icon: <Wallet className="h-5 w-5" /> },
       { id: "Sub9-3", name: "Customer Profile", href: "/sales/customer-profile", icon: <UserCircle className="h-5 w-5" /> },
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


export function Header({ pageMeta }: { pageMeta?: PageMeta }) {
  const pathname = usePathname();

  const currentPage = menuItems.flatMap(m => m.subMenus || []).find(s => s.href === pathname);
  const currentDirectPage = menuItems.find(m => m.href === pathname);
  const currentMainMenu = menuItems.find(m => (m.subMenus && m.subMenus.some(s => s.href === pathname)) || m.href === pathname);

  const displayTitle = currentDirectPage?.name || currentPage?.name || pageMeta?.title || 'BizSuite';
  const displayIcon = currentMainMenu?.icon || pageMeta?.icon;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center justify-between">
        <div className="flex items-center space-x-2">
            <div className="text-primary">{displayIcon}</div>
            <span className="font-bold font-headline sm:inline-block">
                {displayTitle}
            </span>
        </div>
        <NavigationMenu className="relative"> 
          <TooltipProvider>
            <NavigationMenuList>
              {menuItems.map((item) => (
                <NavigationMenuItem key={item.id} value={item.id}> 
                  {item.href ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                         <NavigationMenuLink
                            asChild
                            className={cn(navigationMenuTriggerStyle(), "px-2 h-12 w-12", pathname === item.href && "bg-accent text-accent-foreground")}
                          >
                            <Link href={item.href}> {/* Removed passHref and legacyBehavior={false} */} 
                                {item.icon}
                                <span className="sr-only">{item.name}</span>
                            </Link>
                          </NavigationMenuLink>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{item.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <NavigationMenuTrigger className="px-2 h-12 w-12">
                      {item.icon}
                      <span className="sr-only">{item.name}</span>
                    </NavigationMenuTrigger>
                  )}
                  {item.subMenus && (
                    <NavigationMenuContent>
                      <ul className="grid w-[250px] gap-2 p-4">
                        {item.subMenus.map((subItem) => (
                          <ListItem
                            key={subItem.id}
                            href={subItem.href}
                            title={subItem.name}
                            icon={subItem.icon}
                            active={pathname === subItem.href}
                          />
                        ))}
                      </ul>
                    </NavigationMenuContent>
                  )}
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </TooltipProvider>
          <NavigationMenuViewport />
        </NavigationMenu>
      </div>
    </header>
  );
}

const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a"> & { active?: boolean; icon?: React.ReactNode }
>(({ className, title, icon, children, active, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          href={props.href || "#"}
          ref={ref}
          className={cn(
            "flex items-center gap-3 select-none space-y-1 rounded-md p-2 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:focus:text-accent-foreground focus:outline-none",
            active ? "bg-accent/50" : "",
            className
          )}
          {...props}
        >
          <div className="text-primary">{icon}</div>
          <div className="flex flex-col">
            <div className="text-sm font-medium leading-none">{title}</div>
            <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
              {children}
            </p>
          </div>
        </Link>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";
