
"use client";

import React, { useState, useEffect, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { allMenuItems, type MenuItem as MenuItemType } from '@/hooks/use-tabs';
import { cn, formatCurrency } from '@/lib/utils';
import { Sparkles, Menu, ChevronDown, Bell, Calculator, GripVertical, X } from 'lucide-react';
import { Button } from '../ui/button';
import { getLoansRealtime, getRtgsSettings } from '@/lib/firestore';
import type { Loan } from '@/lib/definitions';
import { format } from 'date-fns';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AdvancedCalculator } from '../calculator/advanced-calculator';


interface CustomSidebarProps {
  children: ReactNode;
  onTabSelect: (menuItem: MenuItemType) => void;
  isSidebarActive: boolean;
  toggleSidebar: () => void;
}

const SidebarNotificationBell = ({ isMobile, toggleSidebar }: { isMobile: boolean; toggleSidebar: () => void }) => {
    const [loans, setLoans] = useState<Loan[]>([]);
    const [pendingNotifications, setPendingNotifications] = useState<Loan[]>([]);
    const [open, setOpen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = getLoansRealtime(
            (data) => setLoans(data),
            () => {}
        );
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (Array.isArray(loans)) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const pending = loans.filter(loan =>
                loan.nextEmiDueDate && new Date(loan.nextEmiDueDate) <= today
            );
            setPendingNotifications(pending);
        }
    }, [loans]);

    const handleNotificationClick = (e: React.MouseEvent, loan: Loan) => {
        e.preventDefault();
        setOpen(false);
        const params = new URLSearchParams({
            loanId: loan.id,
            amount: String(loan.emiAmount || 0),
            payee: loan.lenderName || loan.productName || 'Loan Payment',
            description: `EMI for ${loan.loanName}`
        }).toString();
        router.push(`/expense-tracker?${params}`);
        if (isMobile) toggleSidebar();
    };

    return (
        <li className="item">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    {isMobile ? (
                        <button type="button" className="link" title="Notifications">
                            <span className="icon relative">
                                <Bell className="h-5 w-5" />
                                {pendingNotifications.length > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 block h-1.5 w-1.5 rounded-full bg-destructive" />
                                )}
                            </span>
                            <span className="text">Notifications</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            title="Notifications"
                            className={cn(
                                "relative mx-2 my-1 h-10 w-[calc(100%-16px)] rounded-lg flex items-center justify-center cursor-pointer bg-transparent text-white/80 hover:bg-white/12 hover:text-white",
                                open && "bg-white/14 text-white"
                            )}
                        >
                            <Bell className="h-4 w-4" />
                            {pendingNotifications.length > 0 && (
                                <span className="absolute top-2.5 right-2.5 block h-1.5 w-1.5 rounded-full bg-destructive" />
                            )}
                        </button>
                    )}
                </PopoverTrigger>
                <PopoverContent
                    side="right"
                    align="start"
                    sideOffset={8}
                    className="w-80 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-lg"
                >
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Pending EMIs</h4>
                        {pendingNotifications.length > 0 ? (
                            pendingNotifications.slice(0, 5).map(loan => (
                                <button
                                    key={loan.id}
                                    onClick={(e) => handleNotificationClick(e, loan)}
                                    className="w-full text-left p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                                >
                                    <p className="text-sm font-medium">{loan.loanName}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Due: {loan.nextEmiDueDate ? format(new Date(loan.nextEmiDueDate), "dd MMM yyyy") : 'N/A'} • {formatCurrency(loan.emiAmount || 0)}
                                    </p>
                                </button>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground p-2 text-center">No new notifications.</p>
                        )}
                    </div>
                </PopoverContent>
            </Popover>
        </li>
    )
}

const SidebarDraggableCalculator = ({ isMobile }: { isMobile: boolean }) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = React.useRef({ x: 0, y: 0 });
    const dialogRef = React.useRef<HTMLDivElement>(null);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging && dialogRef.current) {
            const newX = e.clientX - dragStartRef.current.x;
            const newY = e.clientY - dragStartRef.current.y;
            setPosition({ x: newX, y: newY });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const desktopButtonClassName = "mx-2 my-1 h-10 w-[calc(100%-16px)] rounded-lg flex items-center justify-center cursor-pointer bg-transparent text-white/80 hover:bg-white/12 hover:text-white";

    return (
        <li className="item">
            <Dialog modal={false}>
                <DialogTrigger asChild>
                    {isMobile ? (
                        <button type="button" className="link" title="Calculator">
                            <span className="icon">
                                <Calculator className="h-5 w-5" />
                            </span>
                            <span className="text">Calculator</span>
                        </button>
                    ) : (
                        <button type="button" className={desktopButtonClassName} title="Calculator">
                            <Calculator className="h-4 w-4" />
                        </button>
                    )}
                </DialogTrigger>
                <DialogContent
                    ref={dialogRef}
                    className="p-0 max-w-lg"
                    style={{
                        transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
                    }}
                    onInteractOutside={(e) => {
                        if (isDragging) {
                            e.preventDefault();
                        }
                    }}
                >
                    <DialogHeader className="p-0 sr-only">
                        <DialogTitle>Advanced Calculator</DialogTitle>
                    </DialogHeader>
                    <div
                        onMouseDown={handleMouseDown}
                        className="relative cursor-grab active:cursor-grabbing w-full h-8 flex items-center justify-center bg-muted/50 rounded-t-lg"
                    >
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <DialogClose className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-background">
                            <X className="h-3 w-3" />
                        </DialogClose>
                    </div>
                    <AdvancedCalculator />
                </DialogContent>
            </Dialog>
        </li>
    );
};

const SidebarMenuItem = ({ item, activePath, onTabSelect, isMobile, isSidebarActive, toggleSidebar, openMenuId, setOpenMenuId, scheduleClose }: { item: MenuItemType, activePath: string, onTabSelect: (menuItem: MenuItemType) => void, isMobile: boolean, isSidebarActive: boolean, toggleSidebar: () => void, openMenuId: string | null, setOpenMenuId: (id: string | null) => void, scheduleClose: () => void }) => {
    const isOpen = openMenuId === item.id;
    const searchParams = useSearchParams();
    
    // Normalize activePath - remove leading slash
    const normalizedPath = activePath === '/' ? '/' : activePath;
    const pathWithoutSlash = normalizedPath.substring(1);
    
    // Check if any sub-menu is active by comparing href or id
    const isSubMenuActive = item.subMenus?.some(sub => {
        if (sub.href) {
            // Check if href matches (including query params)
            const [hrefPath, hrefQuery] = sub.href.split('?');
            const [currentPath] = normalizedPath.split('?');
            
            // Base path check
            const isPathMatch = currentPath === hrefPath || currentPath.startsWith(hrefPath + '/');
            if (!isPathMatch) return false;
            
            // Query param check if present in href
            if (hrefQuery) {
                const urlParams = new URLSearchParams(hrefQuery);
                const currentParams = new URLSearchParams(searchParams.toString());
                for (const [key, value] of urlParams.entries()) {
                    if (currentParams.get(key) !== value) return false;
                }
            }
            return true;
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
            const [hrefPath, hrefQuery] = item.href.split('?');
            const [currentPath] = normalizedPath.split('?');
            
            // Base path check
            const isPathMatch = currentPath === hrefPath || currentPath.startsWith(hrefPath + '/');
            
            if (isPathMatch) {
                // Query param check if present in href
                if (hrefQuery) {
                    const urlParams = new URLSearchParams(hrefQuery);
                    const currentParams = new URLSearchParams(searchParams.toString());
                    let allParamsMatch = true;
                    for (const [key, value] of urlParams.entries()) {
                        if (currentParams.get(key) !== value) {
                            allParamsMatch = false;
                            break;
                        }
                    }
                    isActive = allParamsMatch;
                } else {
                    // If no query params in href, it's a match (unless we want to be strict about having NO params)
                    // For now, let's assume if href has no params, it matches any params on that path (less strict)
                    // OR, if it's the sales page root, maybe we should be strict?
                    // Let's stick to: if href has params, they must match.
                    isActive = true;
                }
            }
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
                                const [hrefPath, hrefQuery] = subItem.href.split('?');
                                const [currentPath] = normalizedPath.split('?');
                                const isPathMatch = currentPath === hrefPath || currentPath.startsWith(hrefPath + '/');
                                
                                if (isPathMatch && hrefQuery) {
                                    const urlParams = new URLSearchParams(hrefQuery);
                                    const currentParams = new URLSearchParams(searchParams.toString());
                                    let allParamsMatch = true;
                                    for (const [key, value] of urlParams.entries()) {
                                        if (currentParams.get(key) !== value) {
                                            allParamsMatch = false;
                                            break;
                                        }
                                    }
                                    isSubActive = allParamsMatch;
                                } else {
                                    isSubActive = isPathMatch;
                                }
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
    // For sales-entry, sales-payments, and cash-bank, don't show dropdown - direct click navigation
    if (!item.subMenus || item.id === 'sales-entry' || item.id === 'sales-payments' || item.id === 'cash-bank') {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <button 
                        onClick={() => handleLinkClick(item)} 
                    className={cn(
                        "mx-2 my-1 h-10 w-[calc(100%-16px)] rounded-lg flex items-center justify-center cursor-pointer bg-transparent text-white/80 hover:bg-white/12 hover:text-white",
                        isActive && "bg-white/14 text-white"
                    )}
                    >
                        <span className="icon">{React.createElement(item.icon, { className: "h-4 w-4" })}</span>
                    </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                    <p>{item.name}</p>
                </TooltipContent>
            </Tooltip>
        )
    }
    
    // For sales-entry, sales-payments, sales-reports, and cash-bank, don't show dropdown - direct click navigation
    if (item.id === 'sales-entry' || item.id === 'sales-payments' || item.id === 'sales-reports' || item.id === 'cash-bank') {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <button 
                        onClick={() => handleLinkClick(item)} 
                        className={cn(
                            "mx-2 my-1 h-10 w-[calc(100%-16px)] rounded-lg flex items-center justify-center cursor-pointer bg-transparent text-white/80 hover:bg-white/12 hover:text-white",
                            isActive && "bg-white/14 text-white"
                        )}
                    >
                        <span className="icon">{React.createElement(item.icon, { className: "h-4 w-4" })}</span>
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
                        "mx-2 my-1 h-10 w-[calc(100%-16px)] rounded-lg flex items-center justify-center cursor-pointer bg-transparent text-white/80 hover:bg-white/12 hover:text-white",
                        (isSubMenuActive || isOpen) && "bg-white/14 text-white"
                    )}
                 >
                    <span className="icon">{React.createElement(item.icon, { className: "h-4 w-4" })}</span>
                </button>
            </DropdownMenuTrigger>
                    <DropdownMenuContent 
                side="right" 
                align="start"
                sideOffset={4}
                className="w-56 rounded-lg border border-violet-900/30 bg-violet-950/90 text-white shadow-[0_18px_50px_rgba(2,6,23,0.35)] backdrop-blur-[20px]"
                onPointerEnter={() => setOpenMenuId(item.id)}
                onPointerLeave={scheduleClose}
             >
                <DropdownMenuLabel className="font-bold text-sm mb-1 text-white">{item.name}</DropdownMenuLabel>
                {item.subMenus.map(subItem => {
                    // Check if this sub-menu is active
                    let isSubActive = false;
                    if (subItem.href) {
                        const [hrefPath, hrefQuery] = subItem.href.split('?');
                        const [currentPath] = normalizedPath.split('?');
                        const isPathMatch = currentPath === hrefPath || currentPath.startsWith(hrefPath + '/');
                        
                        if (isPathMatch && hrefQuery) {
                            const urlParams = new URLSearchParams(hrefQuery);
                            const currentParams = new URLSearchParams(searchParams.toString());
                            let allParamsMatch = true;
                            for (const [key, value] of urlParams.entries()) {
                                if (currentParams.get(key) !== value) {
                                    allParamsMatch = false;
                                    break;
                                }
                            }
                            isSubActive = allParamsMatch;
                        } else {
                            isSubActive = isPathMatch;
                        }
                    } else {
                        isSubActive = pathWithoutSlash === subItem.id || pathWithoutSlash.startsWith(subItem.id + '/');
                    }
                    return (
                        <DropdownMenuItem 
                            key={subItem.id} 
                            onClick={() => handleLinkClick(subItem)} 
                            className={cn(
                                "cursor-pointer rounded-lg text-white/85 focus:bg-white/10 focus:text-white",
                                isSubActive && "bg-white/12 text-white"
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
                    <span className="icon text-white/90"><Sparkles className="h-4 w-4" /></span>
                    <span className="text">{companyName}</span>
            </button>
            </div>
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                className="text-white/85 hover:bg-white/10 hover:text-white"
                onClick={toggleSidebar}
              >
                <Menu />
              </Button>
            )}
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
                    <SidebarNotificationBell isMobile={isMobile} toggleSidebar={toggleSidebar} />
                    <SidebarDraggableCalculator isMobile={isMobile} />
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
