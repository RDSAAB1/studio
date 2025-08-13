"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Home,
  Settings as SettingsIcon,
  BarChart3,
  Users,
  LogOut,
  Menu,
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
} from 'lucide-react';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

// Sidebar Navigation Data
const menuItems = [
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

interface MenuItem {
  id: string;
  name: string;
  icon: React.ElementType;
  href?: string;
  subMenus?: MenuItem[];
}

interface SubMenuProps {
  item: MenuItem;
  isSidebarOpen: boolean;
  hoveredMenuItemId: string | null;
  setHoveredMenuItemId: (id: string | null) => void;
  activePath: string;
  onLinkClick: (path: string) => void;
  setIsSidebarOpen: (isOpen: boolean) => void;
  isDesktop: boolean;
}

const SubMenu: React.FC<SubMenuProps> = ({ item, isSidebarOpen, hoveredMenuItemId, setHoveredMenuItemId, activePath, onLinkClick, setIsSidebarOpen, isDesktop }) => {
  const isActiveParent = item.subMenus && item.subMenus.some(sub => activePath.startsWith(sub.href || ''));
  const [isOpen, setIsOpen] = useState(isActiveParent);
  const Icon = item.icon;
  
  // Updated logic: Parent item glows if hovered OR if it's the active parent in a minimized state.
  const isCurrentlyHovered = hoveredMenuItemId === item.id;
  const shouldParentGlow = isCurrentlyHovered || (!isSidebarOpen && isActiveParent);
  
  useEffect(() => {
    if (isSidebarOpen && isActiveParent) {
      setIsOpen(true);
    } else if (isSidebarOpen) {
      setIsOpen(false);
    }
  }, [isSidebarOpen, isActiveParent]);

  const handleToggle = () => {
    if (isSidebarOpen && item.subMenus) {
      setIsOpen(!isOpen);
    } else if (item.href) {
      onLinkClick(item.href);
      setIsSidebarOpen(false);
    }
  };

  return (
    <li
      className="my-1 relative"
      onMouseEnter={() => setHoveredMenuItemId(item.id)}
      onMouseLeave={() => setHoveredMenuItemId(null)}
    >
      <div
        className={cn(
          "flex items-center justify-between p-2 cursor-pointer rounded-md h-12 group transition-all duration-300 ease-in-out",
          "text-[#E5D4CD] transform-gpu",
          shouldParentGlow && "scale-[1.02] shadow-md shadow-[#E5D4CD]/30",
          "relative overflow-visible"
        )}
        onClick={handleToggle}
      >
        <span className={cn(
          "absolute inset-x-0 h-[2px] bg-[#E5D4CD] transition-transform duration-300",
          "top-0 origin-left transform",
          shouldParentGlow ? "scale-x-100 shadow-[0_0_5px_#E5D4CD,0_0_10px_#E5D4CD]" : "scale-x-0"
        )}></span>
        <span className={cn(
          "absolute inset-x-0 h-[2px] bg-[#E5D4CD] transition-transform duration-300",
          "bottom-0 origin-right transform",
          shouldParentGlow ? "scale-x-100 shadow-[0_0_5px_#E5D4CD,0_0_10px_#E5D4CD]" : "scale-x-0"
        )}></span>
        <div className="flex items-center flex-grow">
          {Icon && <Icon className={cn("mr-3 h-6 w-6 transition-colors", "text-[#E5D4CD]")} />}
          {isSidebarOpen && (
            <span className={cn("text-base font-medium whitespace-nowrap overflow-hidden text-ellipsis transition-colors", "text-[#E5D4CD]")}>
              {item.name}
            </span>
          )}
        </div>
        {item.subMenus && isSidebarOpen && (
          <div className="flex-shrink-0">
            {isOpen ? <ChevronDown className={cn("h-6 w-6 transition-colors", "text-[#E5D4CD]")} /> : <ChevronRight className={cn("h-6 w-6 transition-colors", "text-[#E5D4CD]")} />}
          </div>
        )}
      </div>
      {item.subMenus && isOpen && isSidebarOpen && (
        <ul className="ml-6 py-2">
          {item.subMenus.map(subItem => {
            const SubIcon = subItem.icon;
            const isActive = activePath.startsWith(subItem.href || '');
            const isSubItemHovered = hoveredMenuItemId === subItem.id;
            const shouldSubItemGlow = isSubItemHovered || (isActive && hoveredMenuItemId === null);
            return (
              <li 
                key={subItem.id} 
                className="my-1"
                onMouseEnter={() => setHoveredMenuItemId(subItem.id)}
                onMouseLeave={() => setHoveredMenuItemId(null)}
              >
                <Link
                  href={subItem.href || '#'}
                  onClick={() => {
                    onLinkClick(subItem.href || '#');
                    setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "flex items-center p-2 rounded-md relative overflow-visible group transition-all duration-300 ease-in-out",
                    "text-sm text-[#E5D4CD] transform-gpu",
                    shouldSubItemGlow ? "scale-[1.02] shadow-md shadow-[#E5D4CD]/30" : "",
                  )}
                >
                  <span className={cn(
                    "absolute inset-x-0 h-[2px] bg-[#E5D4CD] transition-transform duration-300",
                    "top-0 origin-left transform",
                    shouldSubItemGlow ? "scale-x-100 shadow-[0_0_5px_#E5D4CD,0_0_10px_#E5D4CD]" : "scale-x-0"
                  )}></span>
                  <span className={cn(
                    "absolute inset-x-0 h-[2px] bg-[#E5D4CD] transition-transform duration-300",
                    "bottom-0 origin-right transform",
                    shouldSubItemGlow ? "scale-x-100 shadow-[0_0_5px_#E5D4CD,0_0_10px_#E5D4CD]" : "scale-x-0"
                  )}></span>
                  {SubIcon && <SubIcon className={cn("h-5 w-5 mr-3 transition-colors", "text-[#E5D4CD]")} />}
                  <span className={cn("whitespace-nowrap overflow-hidden text-ellipsis transition-colors", "text-[#E5D4CD]")}>
                    {subItem.name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
};

interface CustomSidebarProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  activePath: string;
  onLinkClick: (path: string) => void;
  setIsSidebarOpen: (isOpen: boolean) => void;
  sidebarRef: React.RefObject<HTMLElement>;
}

const CustomSidebar: React.FC<CustomSidebarProps> = ({ isSidebarOpen, toggleSidebar, activePath, onLinkClick, setIsSidebarOpen, sidebarRef }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDesktop, setIsDesktop] = useState(false);
  const [hoveredMenuItemId, setHoveredMenuItemId] = useState<string | null>(null);
  const [isExplicitlyOpen, setIsExplicitlyOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setIsSidebarOpen(false);
      setIsDesktop(window.innerWidth >= 768);
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [setIsSidebarOpen]);

  const handleToggleSidebar = () => {
    const newState = !isSidebarOpen;
    setIsSidebarOpen(newState);
    setIsExplicitlyOpen(newState);
  };

  const handleMouseEnterSidebar = () => {
    if (!isSidebarOpen && isDesktop && !isExplicitlyOpen) setIsSidebarOpen(true);
  };

  const handleMouseLeaveSidebar = () => {
    if (!isExplicitlyOpen && isDesktop) setIsSidebarOpen(false);
  };

  const filteredMenuItems = menuItems.filter(item => {
    const matchesMain = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSub = item.subMenus && item.subMenus.some(sub =>
      sub.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return matchesMain || matchesSub;
  });

  const currentYear = new Date().getFullYear();

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        "fixed inset-y-0 left-0 flex flex-col transition-all duration-300 ease-in-out z-40 shadow-xl",
        "bg-[#B59283]",
        isDesktop ? (isSidebarOpen ? "w-64" : "w-20") : (isSidebarOpen ? "w-64" : "w-0 overflow-hidden"),
        "pt-4",
        !isSidebarOpen && isDesktop && "overflow-visible"
      )}
      onMouseEnter={handleMouseEnterSidebar}
      onMouseLeave={handleMouseLeaveSidebar}
      style={{ overflowY: 'auto' }}
    >
      <div className="flex items-center justify-between px-4 pb-4 border-b border-[#E5D4CD] mb-4">
        {isSidebarOpen ? (
          <h1 className="text-2xl font-bold whitespace-nowrap overflow-hidden text-[#E5D4CD]">BizSuite</h1>
        ) : (
          <div className="flex items-center justify-center w-full h-8 bg-[#E5D4CD] rounded-full"></div>
        )}
        <button
          onClick={handleToggleSidebar}
          className="p-2 rounded-full hover:bg-[#E5D4CD] focus:outline-none focus:ring-2 focus:ring-[#B59283] transition-colors"
          aria-label={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          <Menu className="h-6 w-6 text-[#E5D4CD] hover:text-[#B59283]" />
        </button>
      </div>

      <div className="px-4 mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder={isSidebarOpen ? "Search..." : ""}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              "w-full p-2 pl-10 rounded-md focus:outline-none focus:ring-2",
              "bg-[#9d8075] text-[#E5D4CD] placeholder-[#E5D4CD] focus:ring-[#E5D4CD]",
              !isSidebarOpen && "md:opacity-0 md:pointer-events-none md:w-0"
            )}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#E5D4CD]" />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 scrollbar-hide">
        <ul className="space-y-1">
          {filteredMenuItems.map(item =>
            item.subMenus ? (
              <SubMenu
                key={item.id}
                item={item}
                isSidebarOpen={isSidebarOpen}
                activePath={activePath}
                onLinkClick={onLinkClick}
                setIsSidebarOpen={setIsSidebarOpen}
                isDesktop={isDesktop}
                hoveredMenuItemId={hoveredMenuItemId}
                setHoveredMenuItemId={setHoveredMenuItemId}
              />
            ) : (
              <li 
                key={item.id}
                onMouseEnter={() => setHoveredMenuItemId(item.id)}
                onMouseLeave={() => setHoveredMenuItemId(null)}
              >
                <Link
                  href={item.href || '#'}
                  onClick={() => {
                    setHoveredMenuItemId(null);
                    onLinkClick(item.href || '#');
                    setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "flex items-center p-2 rounded-md h-12 group relative transition-all duration-300 ease-in-out",
                    "text-[#E5D4CD] transform-gpu",
                    (activePath === item.href && hoveredMenuItemId === null) && "scale-[1.02] shadow-md shadow-[#E5D4CD]/30",
                    hoveredMenuItemId === item.id && "scale-[1.02] shadow-md shadow-[#E5D4CD]/30",
                    "relative overflow-visible"
                  )}
                >
                  <span className={cn(
                    "absolute inset-x-0 h-[2px] bg-[#E5D4CD] transition-transform duration-300",
                    "top-0 origin-left transform",
                    (activePath === item.href && hoveredMenuItemId === null) ? "scale-x-100 shadow-[0_0_5px_#E5D4CD,0_0_10px_#E5D4CD]" : "scale-x-0",
                    hoveredMenuItemId === item.id && "scale-x-100 shadow-[0_0_5px_#E5D4CD,0_0_10px_#E5D4CD]"
                  )}></span>
                  <span className={cn(
                    "absolute inset-x-0 h-[2px] bg-[#E5D4CD] transition-transform duration-300",
                    "bottom-0 origin-right transform",
                    (activePath === item.href && hoveredMenuItemId === null) ? "scale-x-100 shadow-[0_0_5px_#E5D4CD,0_0_10px_#E5D4CD]" : "scale-x-0",
                    hoveredMenuItemId === item.id && "scale-x-100 shadow-[0_0_5px_#E5D4CD,0_0_10px_#E5D4CD]"
                  )}></span>
                  <div className={isSidebarOpen ? "mr-3" : "w-full text-center"}>
                    {React.createElement(item.icon, { className: "h-6 w-6 text-[#E5D4CD]" })}
                  </div>
                  {isSidebarOpen && (
                    <span className="text-base font-medium whitespace-nowrap overflow-hidden text-ellipsis text-[#E5D4CD]">
                      {item.name}
                    </span>
                  )}
                </Link>
              </li>
            )
          )}
        </ul>
      </nav>

      <div className="mt-auto px-4 py-2 text-center text-xs text-[#E5D4CD] opacity-70">
        {isSidebarOpen && `© ${currentYear} BizSuite`}
      </div>
    </aside>
  );
};

export default CustomSidebar;
