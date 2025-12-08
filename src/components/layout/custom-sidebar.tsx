
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

const SidebarMenuItem = ({ item, activePath, onTabSelect, isMobile, isSidebarActive, toggleSidebar, openMenuId, setOpenMenuId, scheduleClose }: { item: MenuItemType, activePath: string, onTabSelect: (menuItem: MenuItemType) => void, isMobile: boolean, isSidebarActive: boolean, toggleSidebar: () => void, openMenuId: string | null, setOpenMenuId: (id: string | null) => void, scheduleClose: () => void }) => {
    const isOpen = openMenuId === item.id;
    
    // Normalize activePath - remove leading slash
    const normalizedPath = activePath === '/' ? '/' : activePath;
    const pathWithoutSlash = normalizedPath.substring(1);
    
    // Check if any sub-menu is active by comparing href or id
    const isSubMenuActive = item.subMenus?.some(sub => {
        if (sub.href) {
            // Check if href matches (including query params)
            const [hrefPath] = sub.href.split('?');
            const [currentPath] = normalizedPath.split('?');
            return currentPath === hrefPath || currentPath.startsWith(hrefPath + '/');
        }
        // Fallback to id matching
        return sub.id === pathWithoutSlash || pathWithoutSlash.includes(sub.id);
    }) ?? false;
    
    // Check if the item itself is active
    let isActive = false;
    if (normalizedPath === '/') {
        isActive = item.id === 'dashboard-overview';
    } else {
        // Check if path matches item id or href
        if (item.href) {
            const [hrefPath] = item.href.split('?');
            const [currentPath] = normalizedPath.split('?');
            isActive = currentPath === hrefPath || currentPath.startsWith(hrefPath + '/');
        } else {
            isActive = pathWithoutSlash === item.id || pathWithoutSlash.startsWith(item.id + '/');
        }
    }

    const handleLinkClick = (menuItem: MenuItemType) => {
        onTabSelect(menuItem);
        setOpenMenuId(null);
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
                <button className="link" onClick={() => {
                    // When parent menu is clicked, open all its sub-menus as tabs
                    if (item.subMenus && item.subMenus.length > 0) {
                        handleLinkClick(item);
                    } else {
                        setOpenMenuId(isOpen ? null : item.id);
                    }
                }}>
                     <div className="flex items-center">
                        <span className="icon">{React.createElement(item.icon, { className: "h-5 w-5" })}</span>
                        <span className="text">{item.name}</span>
                    </div>
                    <ChevronDown className={cn("fas fa-angle-right dropdown", isOpen && 'rotate-90')} />
                </button>
                 {isOpen && (
                    <ul className="sub_menu">
                        {item.subMenus.map(subItem => {
                            // Check if this sub-menu is active
                            let isSubActive = false;
                            if (subItem.href) {
                                const [hrefPath] = subItem.href.split('?');
                                const [currentPath] = normalizedPath.split('?');
                                isSubActive = currentPath === hrefPath || currentPath.startsWith(hrefPath + '/');
                            } else {
                                isSubActive = pathWithoutSlash === subItem.id || pathWithoutSlash.startsWith(subItem.id + '/');
                            }
                            return (
                                <li key={subItem.id}>
                                    <button onClick={() => handleLinkClick(subItem)} className={cn("link", isSubActive && "active")}>
                                         <span className="text">{subItem.name}</span>
                                    </button>
                                </li>
                            );
                        })}
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
                    <button 
                        onClick={() => handleLinkClick(item)} 
                    className={cn(
                        "w-full h-12 flex items-center justify-center cursor-pointer border-none bg-transparent p-0",
                        isActive && "bg-accent/60"
                    )}
                    >
                        <span className="icon">{React.createElement(item.icon, { className: "h-5 w-5" })}</span>
                    </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                    <p>{item.name}</p>
                </TooltipContent>
            </Tooltip>
        )
    }
    
    return (
        <DropdownMenu open={isOpen} onOpenChange={(open) => setOpenMenuId(open ? item.id : null)}>
            <DropdownMenuTrigger asChild>
                <button 
                    onClick={() => {
                        // When parent menu is clicked, open all its sub-menus as tabs
                        if (item.subMenus && item.subMenus.length > 0) {
                            // Pass the parent menu item so handleOpenTab can find all sub-menus
                            handleLinkClick(item);
                        }
                    }}
                    onPointerEnter={() => setOpenMenuId(item.id)}
                    onPointerLeave={scheduleClose}
                    className={cn(
                        "w-full h-12 flex items-center justify-center cursor-pointer border-none bg-transparent p-0",
                        (isSubMenuActive || isOpen) && "bg-accent/60"
                    )}
                 >
                    <span className="icon">{React.createElement(item.icon, { className: "h-5 w-5" })}</span>
                </button>
            </DropdownMenuTrigger>
                    <DropdownMenuContent 
                side="right" 
                align="start"
                sideOffset={4}
                className="w-[var(--sidebar-width-icon)] rounded-none"
                onPointerEnter={() => setOpenMenuId(item.id)}
                onPointerLeave={scheduleClose}
             >
                <DropdownMenuLabel className="font-bold text-base mb-1">{item.name}</DropdownMenuLabel>
                {item.subMenus.map(subItem => {
                    // Check if this sub-menu is active
                    let isSubActive = false;
                    if (subItem.href) {
                        const [hrefPath] = subItem.href.split('?');
                        const [currentPath] = normalizedPath.split('?');
                        isSubActive = currentPath === hrefPath || currentPath.startsWith(hrefPath + '/');
                    } else {
                        isSubActive = pathWithoutSlash === subItem.id || pathWithoutSlash.startsWith(subItem.id + '/');
                    }
                    return (
                        <DropdownMenuItem 
                            key={subItem.id} 
                            onClick={() => handleLinkClick(subItem)} 
                            className={cn(
                                "cursor-pointer",
                                isSubActive && "bg-accent"
                            )}
                        >
                            {subItem.name}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

const CustomSidebar: React.FC<CustomSidebarProps> = ({ children, onTabSelect, isSidebarActive, toggleSidebar }) => {
  const [companyName, setCompanyName] = useState('BizSuite DataFlow');
  const [isMobile, setIsMobile] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const closeTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const activePath = usePathname();
  
  const handleSetOpenMenu = (menuId: string | null) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpenMenuId(menuId);
  };
  
  const handleScheduleClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      setOpenMenuId(null);
    }, 200);
  };

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
                            openMenuId={openMenuId}
                            setOpenMenuId={handleSetOpenMenu}
                            scheduleClose={handleScheduleClose}
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
