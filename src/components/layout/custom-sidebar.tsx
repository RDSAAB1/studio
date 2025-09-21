
"use client";

import React, { useState, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { allMenuItems, type MenuItem as MenuItemType } from '@/hooks/use-tabs';
import { cn } from '@/lib/utils';
import { Sparkles, Menu, ChevronDown } from 'lucide-react';
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

const SidebarMenuItem = ({ item, activePath, onTabSelect, isMobile, isSidebarActive, toggleSidebar }: { item: MenuItemType, activePath: string, onTabSelect: (menuItem: MenuItemType) => void, isMobile: boolean, isSidebarActive: boolean, toggleSidebar: () => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const isSubMenuActive = item.subMenus?.some(sub => `/${sub.id}` === activePath) ?? false;
    const isActive = `/${item.id}` === activePath || (item.id === "dashboard-overview" && activePath === "/");


    const handleLinkClick = (menuItem: MenuItemType) => {
        onTabSelect(menuItem);
        if (isMobile) {
            toggleSidebar();
        }
    };
    
    // Mobile rendering
    if(isMobile) {
        if (!item.subMenus) {
            return (
                 <li key={item.id} className="item">
                    <button onClick={() => handleLinkClick(item)} className={cn("link", isActive && "active")}>
                        <span className="icon">{React.createElement(item.icon, { className: "h-5 w-5" })}</span>
                        <span className="text">{item.name}</span>
                    </button>
                </li>
            )
        }

        return (
            <li className={cn("item", (isSubMenuActive || isOpen) && 'active')}>
                <button className="link" onClick={() => setIsOpen(prev => !prev)}>
                     <div className="flex items-center">
                        <span className="icon">{React.createElement(item.icon, { className: "h-5 w-5" })}</span>
                        <span className="text">{item.name}</span>
                    </div>
                    <ChevronDown className={cn("fas fa-angle-right dropdown transition-transform", isOpen && 'rotate-90')} />
                </button>
                 {isOpen && (
                    <ul className="sub_menu">
                        {item.subMenus.map(subItem => (
                            <li key={subItem.id}>
                                <button onClick={() => handleLinkClick(subItem)} className={cn("link", `/${subItem.id}` === activePath && "active")}>
                                     <span className="text">{subItem.name}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </li>
        )
    }

    // Desktop rendering
    if (!item.subMenus) {
        return (
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
                className="w-[var(--sidebar-width-icon)]" 
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
  const [isMobile, setIsMobile] = useState(false);
  const activePath = usePathname();

  useEffect(() => {
    const handleResize = () => {
        setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    <>
      <aside className="side_bar">
        <div className="side_bar_top">
            <div className="logo_wrap">
             <button onClick={() => onTabSelect(allMenuItems.find(i => i.id === 'dashboard-overview')!)} className='flex items-center gap-2'>
                    <span className="icon text-primary"><Sparkles/></span>
                    <span className="text">{companyName}</span>
            </button>
            </div>
            {isMobile && <Button variant="ghost" size="icon" className="text-primary-foreground" onClick={toggleSidebar}><Menu/></Button>}
        </div>
        <div className="side_bar_bottom scrollbar-hide">
            <ul className={cn(!isMobile && 'space-y-1')}>
                 <TooltipProvider>
                    {allMenuItems.map(item => (
                        <SidebarMenuItem 
                            key={item.id} 
                            item={item} 
                            activePath={activePath} 
                            onTabSelect={onTabSelect} 
                            isMobile={isMobile}
                            isSidebarActive={isSidebarActive}
                            toggleSidebar={toggleSidebar}
                        />
                    ))}
                 </TooltipProvider>
            </ul>
        </div>
        </aside>
        <div className="main_container">
            {children}
        </div>
        {isSidebarActive && isMobile && (
            <div className="shadow" onClick={toggleSidebar}></div>
        )}
    </>
  );
};

export default CustomSidebar;
