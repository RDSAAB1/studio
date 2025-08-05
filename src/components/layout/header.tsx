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
} from "@/components/ui/navigation-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PageMeta } from "@/app/types";
import { HeartHandshake, Briefcase, Users, Package, Megaphone } from "lucide-react";

const menuItems = [
  {
    id: "Main1",
    name: "Sales & CRM",
    icon: <HeartHandshake className="h-5 w-5" />,
    subMenus: [
      { id: "Sub1-1", name: "Dashboard Overview", href: "/sales/dashboard-overview" },
      { id: "Sub1-2", name: "Supplier Entry", href: "/sales/customer-management" },
      { id: "Sub1-3", name: "Product Catalog", href: "/sales/product-catalog" },
      { id: "Sub1-4", name: "Order Tracking", href: "/sales/order-tracking" },
      { id: "Sub1-5", name: "Sales Reports", href: "/sales/sales-reports" },
      { id: "Sub1-6", name: "Customer Payments", href: "/sales/customer-payments" },
      { id: "Sub1-7", name: "Customer Profile", href: "/sales/customer-profile" },
      { id: "Sub1-8", name: "RTGS Payment", href: "/sales/rtgs-payment" },
    ],
  },
  {
    id: "Main2",
    name: "HR & Payroll",
    icon: <Users className="h-5 w-5" />,
    subMenus: [
      { id: "Sub2-1", name: "Employee Database", href: "/hr/employee-database" },
      { id: "Sub2-2", name: "Payroll Management", href: "/hr/payroll-management" },
      { id: "Sub2-3", name: "Attendance Tracking", href: "/hr/attendance-tracking" },
    ],
  },
  {
    id: "Main3",
    name: "Inventory",
    icon: <Package className="h-5 w-5" />,
    subMenus: [
      { id: "Sub3-1", name: "Inventory Management", href: "/inventory/inventory-management" },
      { id: "Sub3-2", name: "Supplier Information", href: "/inventory/supplier-information" },
      { id: "Sub3-3", name: "Purchase Orders", href: "/inventory/purchase-orders" },
    ],
  },
  {
    id: "Main4",
    name: "Marketing",
    icon: <Megaphone className="h-5 w-5" />,
    subMenus: [
      { id: "Sub4-1", name: "Campaigns", href: "/marketing/campaigns" },
      { id: "Sub4-2", name: "Email Marketing", href: "/marketing/email-marketing" },
      { id: "Sub4-3", name: "Analytics", href: "/marketing/analytics" },
    ],
  },
  {
    id: "Main5",
    name: "Project Management",
    icon: <Briefcase className="h-5 w-5" />,
    subMenus: [
      { id: "Sub5-1", name: "Project Dashboard", href: "/projects/dashboard" },
      { id: "Sub5-2", name: "Task Management", href: "/projects/tasks" },
      { id: "Sub5-3", name: "Team Collaboration", href: "/projects/collaboration" },
    ],
  },
];


export function Header({ pageMeta }: { pageMeta?: PageMeta }) {
  const pathname = usePathname();

  const currentPage = menuItems.flatMap(m => m.subMenus).find(s => s.href === pathname);
  const currentMainMenu = menuItems.find(m => m.subMenus.some(s => s.href === pathname));

  const displayTitle = currentPage?.name || pageMeta?.title || 'BizSuite';
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
        <NavigationMenu>
          <TooltipProvider>
            <NavigationMenuList>
              {menuItems.map((item) => (
                <NavigationMenuItem key={item.id} value={item.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavigationMenuTrigger className="px-2 h-9 w-9">
                        {item.icon}
                        <span className="sr-only">{item.name}</span>
                      </NavigationMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{item.name}</p>
                    </TooltipContent>
                  </Tooltip>
                  <NavigationMenuContent>
                    <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px] ">
                      {item.subMenus.map((subItem) => (
                        <ListItem
                          key={subItem.id}
                          href={subItem.href}
                          title={subItem.name}
                          active={pathname === subItem.href}
                        />
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </TooltipProvider>
        </NavigationMenu>
      </div>
    </header>
  );
}

const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a"> & { active?: boolean }
>(({ className, title, children, active, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          href={props.href || "#"}
          ref={ref}
          className={cn(
            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            active ? "bg-accent/50" : "",
            className
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </Link>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";
