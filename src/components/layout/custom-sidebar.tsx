
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
} from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"


interface CustomSidebarProps {
  children: ReactNode;
  onTabSelect: (menuItem: MenuItemType) => void;
  isSidebarActive: boolean;
  toggleSidebar: () => void;
}

const SidebarMenuItem = ({ item, activePath, onTabSelect, toggleSidebar }: { item: MenuItemType, activePath: string, onTabSelect: (menuItem: MenuItemType) => void, toggleSidebar: () => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const isSubMenuActive = item.subMenus?.some(sub => `/${sub.id}` === activePath) ?? false;
    const isActive = `/${item.id}` === activePath;

    const handleLinkClick = (menuItem: MenuItemType) => {
        onTabSelect(menuItem);
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            toggleSidebar();
        }
    };

    if (!item.subMenus) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                         <Button variant="ghost" onClick={() => handleLinkClick(item)} className={cn("w-full h-auto py-2 flex-col gap-1 text-xs", isActive && "bg-accent")}>
                            <span className="icon">{React.createElement(item.icon, { className: "h-5 w-5" })}</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                        <p>{item.name}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )
    }
    
    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button 
                    variant="ghost" 
                    onMouseEnter={() => setIsOpen(true)} 
                    onMouseLeave={() => setIsOpen(false)}
                    className={cn("w-full h-auto py-2 flex-col gap-1 text-xs", (isSubMenuActive || isOpen) && "bg-accent")}
                 >
                    <span className="icon">{React.createElement(item.icon, { className: "h-5 w-5" })}</span>
                </Button>
            </DropdownMenuTrigger>
             <DropdownMenuContent 
                side="right" 
                align="start" 
                onMouseEnter={() => setIsOpen(true)}
                onMouseLeave={() => setIsOpen(false)}
             >
                <DropdownMenuLabel className="font-bold text-base mb-1">{item.name}</DropdownMenuLabel>
                {item.subMenus.map(subItem => (
                    <DropdownMenuItem key={subItem.id} onClick={() => handleLinkClick(subItem)} className={cn(`/${subItem.id}` === activePath && "bg-accent")}>
                        {subItem.name}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
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
             <div className="space-y-1">
                {allMenuItems.map(item => (
                    <SidebarMenuItem 
                        key={item.id} 
                        item={item} 
                        activePath={activePath} 
                        onTabSelect={onTabSelect} 
                        toggleSidebar={toggleSidebar} 
                    />
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
