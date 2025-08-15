
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
import { allMenuItems } from '@/hooks/use-tabs'; // Import from central location

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

// Sidebar Navigation Data is now imported from use-tabs.ts

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
}

const SubMenu: React.FC<SubMenuProps> = ({ item, isSidebarOpen, activePath, onLinkClick }) => {
  const isActiveParent = item.subMenus && item.subMenus.some(sub => activePath.startsWith(sub.href || ''));
  const [isOpen, setIsOpen] = useState(isActiveParent);
  const Icon = item.icon;
  
  useEffect(() => {
    if (isSidebarOpen && isActiveParent) {
      setIsOpen(true);
    } else if (isSidebarOpen) {
      if (!isActiveParent) setIsOpen(false);
    }
  }, [isSidebarOpen, isActiveParent]);

  const handleToggle = () => {
    if (isSidebarOpen && item.subMenus) {
      setIsOpen(!isOpen);
    } else if (item.href) {
      onLinkClick(item.href);
    }
  };
  
  const cornerStyle = {
    '--corner-bg': 'hsl(var(--primary))',
    '--content-bg': 'hsl(var(--background))',
  };

  return (
    <li className="my-1 relative" style={cornerStyle as React.CSSProperties}>
       <div
        className={cn(
          "flex items-center justify-between p-2 cursor-pointer h-12 group transition-all duration-300 ease-in-out relative",
          isActiveParent 
            ? 'bg-background text-foreground rounded-l-lg' 
            : 'text-primary-foreground hover:bg-primary/80 rounded-md'
        )}
        onClick={handleToggle}
      >
        {isActiveParent && (
            <>
                <div 
                    className="absolute top-[-16px] right-0 h-4 w-4 bg-[var(--corner-bg)]"
                    style={{
                        clipPath: 'path("M 0 16 C 8.837 16 16 8.837 16 0 L 16 16 Z")'
                    }}
                />
                <div 
                    className="absolute bottom-[-16px] right-0 h-4 w-4 bg-[var(--corner-bg)]"
                    style={{
                        clipPath: 'path("M 16 16 C 16 7.163 8.837 0 0 0 L 16 0 Z")'
                    }}
                />
            </>
        )}
        <div className="flex items-center flex-grow">
          {Icon && <Icon className="mr-3 h-6 w-6" />}
          {isSidebarOpen && (
            <span className="text-base font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              {item.name}
            </span>
          )}
        </div>
        {item.subMenus && isSidebarOpen && (
          <div className="flex-shrink-0">
            {isOpen ? <ChevronDown className="h-6 w-6" /> : <ChevronRight className="h-6 w-6" />}
          </div>
        )}
      </div>

      {item.subMenus && isOpen && isSidebarOpen && (
        <ul className="ml-6 py-2">
          {item.subMenus.map(subItem => {
            const SubIcon = subItem.icon;
            const isActive = activePath.startsWith(subItem.href || '');
            return (
              <li 
                key={subItem.id} 
                className="my-1 relative"
                style={cornerStyle as React.CSSProperties}
              >
                <Link
                  href={subItem.href || '#'}
                  onClick={() => onLinkClick(subItem.href || '#')}
                  className={cn(
                    "flex items-center p-2 relative overflow-visible group transition-all duration-300 ease-in-out",
                    "text-sm",
                    isActive 
                      ? 'bg-background text-foreground rounded-l-lg' 
                      : 'text-primary-foreground hover:bg-primary/80 rounded-md',
                  )}
                >
                  {isActive && (
                    <>
                        <div 
                            className="absolute top-[-16px] right-0 h-4 w-4 bg-[var(--corner-bg)]"
                            style={{
                                clipPath: 'path("M 0 16 C 8.837 16 16 8.837 16 0 L 16 16 Z")'
                            }}
                        />
                        <div 
                            className="absolute bottom-[-16px] right-0 h-4 w-4 bg-[var(--corner-bg)]"
                            style={{
                                clipPath: 'path("M 16 16 C 16 7.163 8.837 0 0 0 L 16 0 Z")'
                            }}
                        />
                    </>
                  )}

                  {SubIcon && <SubIcon className="h-5 w-5 mr-3" />}
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis">
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
  const [isDesktop, setIsDesktop] = useState(false);
  const [isExplicitlyOpen, setIsExplicitlyOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleToggleSidebar = () => {
    const newState = !isSidebarOpen;
    setIsSidebarOpen(newState);
    if (isDesktop) {
      setIsExplicitlyOpen(newState);
    }
  };

  const handleMouseEnterSidebar = () => {
    if (!isSidebarOpen && isDesktop && !isExplicitlyOpen) {
      setIsSidebarOpen(true);
    }
  };

  const handleMouseLeaveSidebar = () => {
    if (!isExplicitlyOpen && isDesktop) {
      setIsSidebarOpen(false);
    }
  };
  
  const currentYear = new Date().getFullYear();
  const cornerStyle = {
    '--corner-bg': 'hsl(var(--primary))',
    '--content-bg': 'hsl(var(--background))',
  };

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        "fixed inset-y-0 left-0 flex flex-col transition-all duration-300 ease-in-out z-40 shadow-xl",
        "bg-primary", // Background of sidebar
        isDesktop ? (isSidebarOpen ? "w-64" : "w-20") : (isSidebarOpen ? "w-64" : "w-0 overflow-hidden"),
        "pt-4",
        !isSidebarOpen && isDesktop && "overflow-visible"
      )}
      onMouseEnter={handleMouseEnterSidebar}
      onMouseLeave={handleMouseLeaveSidebar}
      style={{ overflowY: 'auto' }}
    >
      <div className="flex items-center justify-between px-4 pb-4 border-b border-primary-foreground/20 mb-4">
        {isSidebarOpen ? (
          <h1 className="text-2xl font-bold whitespace-nowrap overflow-hidden text-primary-foreground">BizSuite</h1>
        ) : (
          <div className="flex items-center justify-center w-full h-8">
             <LayoutDashboard className="h-6 w-6 text-primary-foreground" />
          </div>
        )}
        <button
          onClick={handleToggleSidebar}
          className="p-2 rounded-full text-primary-foreground hover:bg-primary-foreground/10 focus:outline-none focus:ring-2 focus:ring-primary-foreground transition-colors"
          aria-label={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 scrollbar-hide">
        <ul className="space-y-1">
          {allMenuItems.map(item =>
            item.subMenus ? (
              <SubMenu
                key={item.id}
                item={item}
                isSidebarOpen={isSidebarOpen}
                activePath={activePath}
                onLinkClick={onLinkClick}
              />
            ) : (
              <li 
                key={item.id}
                className="my-1 relative"
                style={cornerStyle as React.CSSProperties}
              >
                <Link
                  href={item.href || '#'}
                  onClick={() => onLinkClick(item.href || '#')}
                  className={cn(
                    "flex items-center p-2 h-12 group relative transition-all duration-300 ease-in-out",
                    activePath === item.href 
                      ? 'bg-background text-foreground rounded-l-lg' 
                      : 'text-primary-foreground hover:bg-primary/80 rounded-md',
                  )}
                >
                  {activePath === item.href && (
                    <>
                        <div 
                            className="absolute top-[-16px] right-0 h-4 w-4 bg-[var(--corner-bg)]"
                            style={{
                                clipPath: 'path("M 0 16 C 8.837 16 16 8.837 16 0 L 16 16 Z")'
                            }}
                        />
                        <div 
                            className="absolute bottom-[-16px] right-0 h-4 w-4 bg-[var(--corner-bg)]"
                            style={{
                                clipPath: 'path("M 16 16 C 16 7.163 8.837 0 0 0 L 16 0 Z")'
                            }}
                        />
                    </>
                  )}
                  <div className={isSidebarOpen ? "mr-3" : "w-full text-center"}>
                    {React.createElement(item.icon, { className: "h-6 w-6" })}
                  </div>
                  {isSidebarOpen && (
                    <span className="text-base font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                      {item.name}
                    </span>
                  )}
                </Link>
              </li>
            )
          )}
        </ul>
      </nav>

      <div className="mt-auto px-4 py-2 text-center text-xs text-primary-foreground/50">
        {isSidebarOpen && `© ${currentYear} BizSuite`}
      </div>
    </aside>
  );
};

export default CustomSidebar;
