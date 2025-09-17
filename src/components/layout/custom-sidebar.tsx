
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
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            className={cn(
              "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
              isSubMenuActive && "bg-accent text-accent-foreground"
            )}
          >
            <span className="icon mr-2">{React.createElement(item.icon)}</span>
            <span className="item">{item.name}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent sideOffset={8} alignOffset={-5}>
                <DropdownMenuItem className="font-bold text-base mb-1 pointer-events-none">{item.name}</DropdownMenuItem>
                {item.subMenus.map(subItem => (
                  <DropdownMenuItem key={subItem.id} onClick={() => handleLinkClick(subItem)}>
                    {subItem.name}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      );
    }

    return (
        <DropdownMenuItem onClick={() => handleLinkClick(item)} className={cn(isActive && "bg-accent text-accent-foreground")}>
             <span className="icon mr-2">{React.createElement(item.icon)}</span>
             <span className="item">{item.name}</span>
        </DropdownMenuItem>
    );
  };

  return (
    <div className={cn("wrapper", isSidebarActive && "active")}>
        <aside className="side_bar">
        <div className="side_bar_top">
            <div className="logo_wrap">
             <button onClick={() => onTabSelect(allMenuItems.find(i => i.id === 'dashboard-overview')!)} className='flex items-center gap-2'>
                    <span className="icon"><Sparkles/></span>
                    <span className="text">{companyName}</span>
            </button>
            </div>
        </div>
        <div className="side_bar_bottom scrollbar-hide">
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="w-full h-auto py-2 flex-col gap-1 text-xs">
                        <Menu/> Menu
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start">
                    {allMenuItems.map(item => (
                        <React.Fragment key={item.id}>
                            {renderMenuItem(item)}
                        </React.Fragment>
                    ))}
                </DropdownMenuContent>
             </DropdownMenu>
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
