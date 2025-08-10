"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Home,
  Settings as SettingsIcon, // Renamed to avoid conflict with 'Settings' text
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
  Package as PackageIcon // Use PackageIcon for Inventory main icon
} from 'lucide-react';

// A simple 'cn' utility similar to shadcn/ui for conditional class merging
function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// --- Sidebar Navigation Data (Full menu re-integrated, with image-specific icons/labels for prominent items) ---
const menuItems = [
  {
    id: "main-home",
    name: "Home",
    icon: Home,
    href: "/sales/dashboard-overview", // Mapping to an existing dashboard page
  },
  {
    id: "main-dashboard-from-image",
    name: "Dashboard", // Label from image
    icon: SettingsIcon, // Using Settings icon as per image for Dashboard
    href: "/sales/dashboard-overview", // Mapping to an existing dashboard route for functionality
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
    href: "/sales/sales-reports", // Mapping to existing sales reports
  },
  {
    id: "main-users-from-image",
    name: "Users",
    icon: Users,
    href: "/hr/employee-database", // Mapping to existing employee database
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
    href: "/logout", // Assuming a logout route or handler
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
  activePath: string;
  onLinkClick: (path: string) => void;
  setIsSidebarOpen: (isOpen: boolean) => void;
  isDesktop: boolean; // Add isDesktop prop
}

const SubMenu: React.FC<SubMenuProps> = ({ item, isSidebarOpen, activePath, onLinkClick, setIsSidebarOpen, isDesktop }) => {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = item.icon;

  useEffect(() => {
    // Open parent if any sub-item is active
    if (item.subMenus && item.subMenus.some(sub => activePath.startsWith(sub.href || ''))) {
      setIsOpen(true);
    } else {
      // Close if no sub-item is active AND sidebar is expanded
      // This prevents sub-menus from closing when sidebar is collapsed and you hover away
      if (isSidebarOpen) {
        setIsOpen(false);
      }
    }
  }, [activePath, item.subMenus, isSidebarOpen]);

  const handleToggle = () => {
    if (!isSidebarOpen && isDesktop) { // If sidebar is collapsed on desktop, expand it and open sub-menu
      setIsSidebarOpen(true);
      setIsOpen(true);
    } else { // Otherwise, just toggle the sub-menu
      setIsOpen(!isOpen);
    }
  };

  const handleMouseEnter = () => {
    if (!isSidebarOpen && isDesktop) { // Only on desktop when sidebar is collapsed
      setIsOpen(true);
    }
  };

  const handleMouseLeave = () => {
    // Only on desktop when sidebar is collapsed, and no sub-item is active
    if (!isSidebarOpen && isDesktop && !item.subMenus?.some(sub => activePath.startsWith(sub.href || ''))) {
      setIsOpen(false);
    }
  };

  const isActiveParent = item.subMenus && item.subMenus.some(sub => activePath.startsWith(sub.href || ''));

  return (
    <li className="my-1 relative"> 
      <div
        className={cn(
          "flex items-center justify-between p-2 cursor-pointer rounded-md transition-colors h-12",
          "bg-red-900 text-white", // Direct red background and white text
          "hover:bg-red-700", // Direct red hover
          (item.subMenus && isOpen) || isActiveParent ? "bg-red-700" : "", // Direct red active
        )}
        onClick={handleToggle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex items-center flex-grow">
          {Icon && <Icon className="mr-3 h-6 w-6 text-white" />} {/* Direct white icons */}
          {isSidebarOpen && (
            <span className="text-base font-medium whitespace-nowrap overflow-hidden text-ellipsis text-white"> 
              {item.name}
            </span>
          )}
        </div>
        {item.subMenus && isSidebarOpen && ( /* Only show chevron if sidebar is open and has sub-menus */
          <div className="flex-shrink-0">
            {isOpen ? <ChevronDown className="h-6 w-6 text-white" /> : <ChevronRight className="h-6 w-6 text-white" />} {/* Direct white icons */}
          </div>
        )}
      </div>
      {item.subMenus && isOpen && (
        <ul className={cn("ml-6", !isSidebarOpen && isDesktop && "absolute left-full top-0 bg-red-900 border border-red-700 rounded-md shadow-lg py-2 w-48 z-50", !isSidebarOpen && !isDesktop && "hidden")}>
          {item.subMenus.map(subItem => {
            const SubIcon = subItem.icon;
            const isActive = activePath.startsWith(subItem.href || '');
            return (
              <li key={subItem.id} className="my-1">
                <Link
                  href={subItem.href || '#'}
                  onClick={() => {
                    onLinkClick(subItem.href || '#');
                    setIsSidebarOpen(false); // Minimize on sub-item click
                  }}
                  className={cn(
                    "flex items-center p-2 rounded-md transition-colors relative overflow-hidden", // Added relative & overflow-hidden for glow
                    "hover:bg-red-700 text-white text-sm", // Direct red hover and white text
                    isActive ? "bg-red-700 font-semibold" : "", // Direct red active
                    'menu-item-outlined', // Apply outlined style
                    isSidebarOpen && "h-12", 
                    { 'active': isActive, 'menu-item-glow': true } 
                  )}
                >
                  {SubIcon && <SubIcon className="mr-3 h-5 w-5 text-white" />}
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis text-white">
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

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768); // md breakpoint
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Set initial state
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filter menu items based on search term
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
        "fixed inset-y-0 left-0 bg-red-900 text-white flex flex-col transition-all duration-300 ease-in-out z-40 shadow-xl",
        isSidebarOpen ? "w-64" : "w-20",
        isDesktop ? (isSidebarOpen ? "w-64" : "w-20") : (isSidebarOpen ? "w-64" : "w-0 overflow-hidden"),
        "pt-4",
        !isSidebarOpen && isDesktop && "overflow-visible" // Allows hover sub-menu to escape bounds
      )}
      style={{ overflowY: isSidebarOpen ? 'auto' : 'hidden' }}
    >
      {/* Top Section: Logo/Title and Toggle Button */}
      <div className="flex items-center justify-between px-4 pb-4 border-b border-red-700 mb-4"> {/* Direct red border */}
        {isSidebarOpen ? (
          <h1 className="text-2xl font-bold whitespace-nowrap overflow-hidden text-white">SM</h1>
        ) : (
          <h1 className="text-2xl font-bold whitespace-nowrap overflow-hidden text-white w-full text-center">S</h1> // Collapsed logo
        )}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-full hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-white transition-colors" // Direct red hover, white ring
          aria-label={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          <Menu className="h-6 w-6 text-white" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-4 mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder={isSidebarOpen ? "Search..." : ""}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              "w-full p-2 pl-10 rounded-md bg-red-800 text-white placeholder-red-300 focus:outline-none focus:ring-2 focus:ring-white", // Direct red colors
              !isSidebarOpen && "md:opacity-0 md:pointer-events-none md:w-0"
            )}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white" />
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-4 scrollbar-hide"> {/* Direct red scrollbar colors */}
        <ul>
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
              />
            ) : (
              <li key={item.id} className="my-1"> {/* Added relative here for consistency with Link's pseudo-element if needed */}
                <Link
                  href={item.href || '#'}
                  onClick={() => {
                    onLinkClick(item.href || '#');
                    setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "flex items-center p-2 rounded-md transition-colors relative overflow-hidden", 
                    "hover:bg-red-700 text-white", // Direct red hover, white text
                    activePath === item.href ? "bg-red-700 font-semibold" : "",
                    'menu-item-outlined', // Apply outlined style
                    isSidebarOpen && "h-12", 
                    { 'active': activePath === item.href, 'menu-item-glow': true } 
                  )}
                >
                  {React.createElement(item.icon, { className: "mr-3 h-6 w-6 text-white" })} 
                  {isSidebarOpen && (
                    <span className="text-base font-medium whitespace-nowrap overflow-hidden text-ellipsis text-white">
                      {item.name}
                    </span>
                  )}
                </Link>
              </li>
            )
          )}
        </ul>
      </nav>

      {/* User Profile / Footer Section */}
      <div className="mt-auto px-4 py-4 border-t border-red-700 flex items-center justify-between text-white"> {/* Direct red border, white text */}
        <div className="flex items-center">
          <UserCircle className="h-8 w-8 text-white mr-3" />
          {isSidebarOpen && (
            <div className="flex flex-col">
              <span className="text-sm font-medium">John Doe</span>
              <span className="text-xs text-white">Admin</span>
            </div>
          )}
        </div>
        {isSidebarOpen && (
          <button className="p-2 rounded-full hover:bg-red-700 text-white transition-colors" aria-label="Logout"> 
            <LogOut className="h-5 w-5" />
          </button>
        )}
      </div>
      {/* Copyright or version info */}
      <div className="px-4 py-2 text-center text-xs text-white opacity-70">
        {isSidebarOpen && `© ${new Date().getFullYear()} BizSuite`}
      </div>
    </aside>
  );
};

export default CustomSidebar;
