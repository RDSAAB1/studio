
"use client";

import React, { useState, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { allMenuItems, type MenuItem as MenuItemType } from '@/hooks/use-tabs';
import { cn } from '@/lib/utils';
import { Sparkles, Menu } from 'lucide-react';
import { Button } from '../ui/button';
import { getRtgsSettings } from '@/lib/firestore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';


interface CustomSidebarProps {
  children: ReactNode;
  onTabSelect: (menuItem: MenuItemType) => void;
  isSidebarActive: boolean;
  toggleSidebar: () => void;
}

const CustomSidebar: React.FC<CustomSidebarProps> = ({ children, onTabSelect, isSidebarActive, toggleSidebar }) => {
  const [companyName, setCompanyName] = useState('BizSuite DataFlow');
  const activePath = usePathname();

  useEffect(() => {
    const fetchCompanyName = async () => {
      try {
        const settings = await getRtgsSettings();
        if (settings && settings.companyName) {
          setCompanyName(settings.companyName);
        }
      } catch (error) {
        console.error("Could not fetch company settings:", error);
      }
    };
    fetchCompanyName();
  }, []);

  const handleLinkClick = (menuItem: MenuItemType) => {
    onTabSelect(menuItem);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      toggleSidebar();
    }
  };

  const renderMenuItem = (item: MenuItemType) => {
    const isActive = `/${item.id}` === activePath;
    const isSubMenuActive = item.subMenus?.some(sub => `/${sub.id}` === activePath) ?? false;

    if (item.subMenus) {
      return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={cn("w-full h-auto py-2 flex-col gap-1 text-xs", isSubMenuActive && "bg-accent")}>
                    <span className="icon">{React.createElement(item.icon)}</span>
                </Button>
            </DropdownMenuTrigger>
             <DropdownMenuContent side="right" align="start">
                <DropdownMenuLabel className="font-bold text-base mb-1">{item.name}</DropdownMenuLabel>
                {item.subMenus.map(subItem => (
                    <DropdownMenuItem key={subItem.id} onClick={() => handleLinkClick(subItem)} className={cn(`/${subItem.id}` === activePath && "bg-accent")}>
                        {subItem.name}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
        <Button variant="ghost" onClick={() => handleLinkClick(item)} className={cn("w-full h-auto py-2 flex-col gap-1 text-xs", isActive && "bg-accent")}>
            <span className="icon">{React.createElement(item.icon)}</span>
        </Button>
    );
  };

  return (
    <div className={cn("wrapper", isSidebarActive && "active")}>
        <aside className="side_bar">
        <div className="side_bar_top justify-center">
            <div className="logo_wrap">
             <button onClick={() => onTabSelect(allMenuItems.find(i => i.id === 'dashboard-overview')!)} className='flex items-center justify-center'>
                    <span className="icon"><Sparkles/></span>
            </button>
            </div>
        </div>
        <div className="side_bar_bottom scrollbar-hide">
             <div className="space-y-2">
                {allMenuItems.map(item => (
                    <React.Fragment key={item.id}>
                        {renderMenuItem(item)}
                    </React.Fragment>
                ))}
            </div>
        </div>
        </aside>
        <div className="main_container">
            {children}
        </div>
        {isSidebarActive && typeof window !== 'undefined' && window.innerWidth < 1024 && (
            <div className="shadow" onClick={toggleSidebar}></div>
        )}
    </div>
  );
};

export default CustomSidebar;
