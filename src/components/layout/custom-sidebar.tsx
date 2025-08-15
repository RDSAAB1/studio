
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Menu,
} from 'lucide-react';
import { allMenuItems } from '@/hooks/use-tabs'; // Import from central location

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

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
    setIsOpen(isActiveParent);
  }, [isActiveParent]);

  const handleToggle = () => {
    if (isSidebarOpen && item.subMenus) {
      setIsOpen(!isOpen);
    } else if (item.href) {
      onLinkClick(item.href);
    }
  };

  return (
    <li className="my-1" >
       <div
        className={cn(
          "flex items-center justify-between p-2 cursor-pointer h-12 group transition-all duration-300 ease-in-out relative rounded-lg",
          isActiveParent 
            ? 'bg-transparent text-primary' 
            : 'text-primary-foreground hover:bg-primary/90',
           isSidebarOpen ? "px-4" : "px-2.5 justify-center"
        )}
        onClick={handleToggle}
      >
        <div className="flex items-center flex-grow">
          {Icon && <Icon className="mr-3 h-6 w-6 flex-shrink-0" />}
          {isSidebarOpen && (
            <span className="text-base font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              {item.name}
            </span>
          )}
        </div>
      </div>

      {item.subMenus && isOpen && isSidebarOpen && (
        <ul className="ml-4 pl-2 border-l border-primary-foreground/20 py-2">
          {item.subMenus.map(subItem => {
            const SubIcon = subItem.icon;
            const isActive = activePath.startsWith(subItem.href || '');
            return (
              <li 
                key={subItem.id} 
                className="my-1 relative"
              >
                <Link
                  href={subItem.href || '#'}
                  onClick={() => onLinkClick(subItem.href || '#')}
                  className={cn(
                    "flex items-center p-3 relative group transition-colors duration-200 ease-in-out rounded-lg",
                    "text-sm",
                    isActive 
                      ? 'bg-background text-primary font-semibold' 
                      : 'text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  {isActive && (
                    <>
                      <div className="absolute -top-4 right-0 h-4 w-4 bg-transparent" style={{background: 'radial-gradient(circle at 0 0, transparent 0, transparent 15px, hsl(var(--background)) 16px)'}} />
                      <div className="absolute -bottom-4 right-0 h-4 w-4 bg-transparent" style={{background: 'radial-gradient(circle at 0 100%, transparent 0, transparent 15px, hsl(var(--background)) 16px)'}} />
                    </>
                  )}

                  {SubIcon && <SubIcon className="h-5 w-5 mr-3 flex-shrink-0" />}
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

  const handleToggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };
  
  const currentYear = new Date().getFullYear();

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        "fixed inset-y-0 left-0 flex flex-col transition-all duration-300 ease-in-out z-40",
        "bg-primary", // Background of sidebar
        isSidebarOpen ? "w-64" : "w-20"
      )}
    >
      <div className={cn(
          "flex items-center justify-between border-b border-primary-foreground/20 mb-4",
          isSidebarOpen ? "h-[61px] px-4" : "h-[61px] px-2.5"
          )}
      >
        {isSidebarOpen ? (
          <h1 className="text-2xl font-bold whitespace-nowrap overflow-hidden text-primary-foreground">BizSuite</h1>
        ) : (
          <div className="flex items-center justify-center w-full h-8">
             <LayoutDashboard className="h-6 w-6 text-primary-foreground" />
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 scrollbar-hide">
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
              >
                <Link
                  href={item.href || '#'}
                  onClick={() => onLinkClick(item.href || '#')}
                  className={cn(
                    "flex items-center p-3 relative group transition-colors duration-200 ease-in-out rounded-lg",
                    activePath.startsWith(item.href || '@@')
                      ? 'bg-background text-primary font-semibold' 
                      : 'text-primary-foreground hover:bg-primary/90',
                    !isSidebarOpen && "justify-center"
                  )}
                >
                  {activePath.startsWith(item.href || '@@') && (
                    <>
                      <div className="absolute -top-4 right-0 h-4 w-4 bg-transparent" style={{background: 'radial-gradient(circle at 0 0, transparent 0, transparent 15px, hsl(var(--background)) 16px)'}} />
                      <div className="absolute -bottom-4 right-0 h-4 w-4 bg-transparent" style={{background: 'radial-gradient(circle at 0 100%, transparent 0, transparent 15px, hsl(var(--background)) 16px)'}} />
                    </>
                  )}
                  {React.createElement(item.icon, { className: cn("h-6 w-6 flex-shrink-0", isSidebarOpen && "mr-3") })}
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
