
"use client";

import { Fragment, Suspense, createContext, useContext, useEffect, useLayoutEffect, useState, useRef, useTransition, useMemo, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { allMenuItems, type MenuItem } from "@/hooks/use-tabs";
import { Loader2, Bell, Calculator, ChevronDown, GripVertical, Menu, X } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import TabBar from '@/components/layout/tab-bar';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { Truck, Users, Wallet, FilePlus, Banknote } from 'lucide-react';
import { logError } from '@/lib/error-logger';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AdvancedCalculator } from '@/components/calculator/advanced-calculator';
import { getLoansRealtime } from '@/lib/firestore';
import type { Loan } from '@/lib/definitions';
import { setErpMode } from '@/lib/tenancy';
import { format } from 'date-fns';
import { ProfileDropdown } from '@/components/layout/profile-dropdown';
import { ErpCompanySelector } from '@/components/layout/erp-company-selector';
import { listErpCompanies } from '@/lib/erp-migration';
import { getElectronBaseUrl, electronNavigate } from '@/lib/electron-navigate';
import { useScrollContainer } from '@/contexts/scroll-container-context';

// Pre-compute flattened menu items once (outside component to avoid recalculation)
const flattenedMenuItems = allMenuItems.flatMap(i => i.subMenus ? i.subMenus : i);

type LayoutSubnavContextValue = {
  setSubnav: (node: ReactNode | null) => void;
};

const LayoutSubnavContext = createContext<LayoutSubnavContextValue | null>(null);

export function useLayoutSubnav() {
  const ctx = useContext(LayoutSubnavContext);
  return ctx?.setSubnav ?? (() => {});
}

// Helper function to create sub-tabs for Entry and Payments
const createSubTabs = (parentId: string): MenuItem[] => {
  if (parentId === 'entry' || parentId === 'sales/entry') {
    return [
      { id: 'entry-supplier', name: 'Supplier Entry', icon: Truck, href: '/sales/entry?tab=supplier' },
      { id: 'entry-customer', name: 'Customer Entry', icon: Users, href: '/sales/entry?tab=customer' },
    ];
  }
  if (parentId === 'sales/payments' || parentId === 'payments') {
    const paymentsMenu = allMenuItems.find(item => item.id === 'payments');
    return paymentsMenu?.subMenus || [
      { id: 'payments-supplier', name: 'Supplier Payments', icon: Truck, href: '/sales/payments-supplier' },
      { id: 'payments-customer', name: 'Customer Payments', icon: Users, href: '/sales/payments-customer' },
      { id: 'payments-outsider', name: 'RTGS Outsider', icon: Banknote, href: '/sales/payments-outsider' },
    ];
  }
  return [];
};

export default function AppLayoutWrapper({ children }: { children: ReactNode }) {
  const [openTabs, setOpenTabs] = usePersistedState<MenuItem[]>(
    'app-open-tabs',
    [],
    {
      serialize: (tabs) => JSON.stringify(tabs.map((t: MenuItem) => ({ id: t.id, name: t.name, icon: t.icon }))),
      deserialize: (str) => {
        const parsed = JSON.parse(str);
        return parsed.map((t: { id: string; name: string; icon?: unknown }) => {
          const fullMenuItem = flattenedMenuItems.find(item => item.id === t.id);
          return fullMenuItem || t;
        });
      }
    }
  );
  const [activeTabId, setActiveTabId] = usePersistedState<string>('app-active-tab', 'dashboard-overview');
  const [subnav, setSubnav] = useState<ReactNode | null>(null);
  const [isNavigating, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPathnameRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const isProcessingRef = useRef(false);
  const activeTabIdRef = useRef(activeTabId);
  const openTabsRef = useRef(openTabs);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isBrowser = typeof window !== 'undefined';
  const [erpCompanies, setErpCompanies] = useState<{ id: string; name: string }[]>([]);

  const performNavigation = (path: string, options?: { forceWindow?: boolean }) => {
    // Prefer client-side navigation (no full refresh). Use full page load only when forceWindow is true.
    const shouldUseWindowLocation = options?.forceWindow === true;
    startTransition(() => {
      if (!isBrowser) {
        return;
      }
      try {
        if (shouldUseWindowLocation) {
          electronNavigate(path);
          return;
        }
        electronNavigate(path, router, { method: 'push' });
      } catch (error) {
        logError(error, `app-layout: navigate to ${path}`, 'high');
        try {
          electronNavigate(path, router, { method: 'push' });
        } catch (hardError) {
          logError(hardError, `app-layout: electronNavigate to ${path}`, 'critical');
          electronNavigate(path);
        }
      }
    });
  };

  // Keep refs in sync with state
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
    openTabsRef.current = openTabs;
  }, [activeTabId, openTabs]);

  useEffect(() => {
    if (!isBrowser) return;
    listErpCompanies()
      .then((list) => {
        setErpCompanies(list.map((c) => ({ id: c.id, name: c.name })));
        setErpMode(list.length > 0);
      })
      .catch(() => {
        setErpCompanies([]);
        setErpMode(false);
      });
  }, [isBrowser]);

  // Initialize tabs on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    // If no tabs exist, initialize with dashboard
    if (openTabs.length === 0) {
      const dashboardTab = allMenuItems.find(item => item.id === 'dashboard-overview');
      if (dashboardTab) {
        setOpenTabs([dashboardTab]);
        setActiveTabId('dashboard-overview');
      }
    }
  }, []);

  // Track pathname changes using useMemo to avoid unnecessary re-runs
  const pathnameChanged = useMemo(() => {
    if (lastPathnameRef.current === pathname) {
      return false;
    }
    const changed = lastPathnameRef.current !== null; // Only true if not initial mount
    lastPathnameRef.current = pathname;
    return changed;
  }, [pathname]);

  useEffect(() => {
    // Skip if pathname hasn't actually changed (initial mount is handled separately)
    if (!pathnameChanged) {
      // On initial mount, still need to set up tabs
      if (lastPathnameRef.current === null) {
        lastPathnameRef.current = pathname;
      } else {
        return;
      }
    }
    
    // Prevent infinite loops by checking if we're already processing
    if (isProcessingRef.current) {
      return;
    }
    
    // Clear any existing reset timeout
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
    
    // Mark as processing BEFORE any state updates
    isProcessingRef.current = true;
    const processingPathname = pathname;
    
    // Schedule flag reset AFTER all synchronous code completes
    // Use queueMicrotask to ensure it runs after current execution but before next render
    queueMicrotask(() => {
      // Then use setTimeout to ensure it runs after all state updates and re-renders
      resetTimeoutRef.current = setTimeout(() => {
        // Only reset if we're still processing the same pathname
        if (lastPathnameRef.current === processingPathname && isProcessingRef.current) {
          isProcessingRef.current = false;
        }
        resetTimeoutRef.current = null;
      }, 1000); // Increased to 1 second to be absolutely sure
    });
    
    // Cleanup function to clear timeout if effect re-runs or component unmounts
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
    };
    
    // pathname never includes query string; normalize for trailingSlash (pathname can be /sales or /sales/)
    const pathBase = pathname.replace(/\/$/, '') || '/';
    
    // Handle direct payment paths - map to menu item IDs
    let currentPathId = pathBase === '/' ? 'dashboard-overview' : pathBase.substring(1);
    
    if (pathBase === '/sales/payments-supplier') {
      currentPathId = 'payments-supplier';
    } else if (pathBase === '/sales/payments-customer') {
      currentPathId = 'payments-customer';
    } else if (pathBase === '/sales/payments-outsider') {
      currentPathId = 'payments-outsider';
    }
    
    const menuItem = flattenedMenuItems.find(item => item.id === currentPathId);
    
    // Check if this is unified Sales page - if so, create sub-tabs
    const isSalesPage = pathBase === '/sales';
    const isEntryPage = pathBase === '/sales/entry' || pathBase.startsWith('/sales/entry');
    const isUnifiedPaymentsPage = pathBase === '/sales/payments' || pathBase.startsWith('/sales/payments');
    
    // Get tab and menu from URL query for sales, entry and payments pages
    const urlParams = isBrowser ? new URLSearchParams(window.location.search) : null;
    const menuParam = urlParams?.get('menu') || (isSalesPage ? 'entry' : null);
    const tabParam = urlParams?.get('tab') || (isEntryPage ? 'supplier' : isUnifiedPaymentsPage ? 'supplier' : isSalesPage ? 'supplier-entry' : null);
    
    if (isEntryPage) {
      const subTabs = createSubTabs('entry');
      const activeSubTabId = `entry-${tabParam}`;
      
      // Batch state updates in a transition to prevent infinite loops
      startTransition(() => {
        setOpenTabs(prev => {
          // Remove old parent tab and other entry tabs if exist
          const filtered = prev.filter(tab => 
            tab.id !== 'entry' && 
            tab.id !== 'sales/entry' &&
            !tab.id.startsWith('entry-')
          );
          
          // Add sub-tabs if they don't exist
          const newTabs = [...filtered];
          let hasChanges = false;
          subTabs.forEach(subTab => {
            if (!newTabs.some(t => t.id === subTab.id)) {
              newTabs.push(subTab);
              hasChanges = true;
            }
          });
          
          // Only return new array if there were actual changes
          if (!hasChanges && filtered.length === prev.length) {
            return prev; // Return same reference to avoid re-render
          }
          
          return newTabs;
        });
        
        // Only update activeTabId if it actually changed
        if (activeTabIdRef.current !== activeSubTabId) {
          setActiveTabId(activeSubTabId);
        }
      });
      
      return;
    }
    
    if (isSalesPage && menuParam && tabParam) {
      // Get menu type from URL and map to menu item ID
      let menuItemId: string;
      if (menuParam === 'entry') menuItemId = 'sales-entry';
      else if (menuParam === 'payments') menuItemId = 'sales-payments';
      else if (menuParam === 'cash-bank') menuItemId = 'cash-bank';
      else if (menuParam === 'reports') menuItemId = 'sales-reports';
      else if (menuParam === 'settings') menuItemId = 'settings';
      else if (menuParam === 'history') menuItemId = 'history';
      else if (menuParam === 'admin') menuItemId = 'admin';
      else menuItemId = menuParam ?? 'entry'; // hr, projects match their IDs

      // Try to find the specific tab item first (leaf node)
      const targetTabId = String(tabParam);
      
      // Find the menu item in flattened list (for sub-menus) or allMenuItems (for top-level)
      const menuItem = flattenedMenuItems.find(item => item.id === targetTabId) || 
                       allMenuItems.find(item => item.id === menuItemId);
      
      if (!menuItem) {
        return;
      }

      const selectedMenuItem = menuItem as MenuItem;
      const parentMenu = allMenuItems.find((p) => p.subMenus?.some((s) => s.id === targetTabId));
      const parentSubMenus = parentMenu?.subMenus;
      let tabsToShow: MenuItem[] = [selectedMenuItem];
      if (parentSubMenus) {
        if (parentSubMenus!.some((s) => s.id === targetTabId)) {
          tabsToShow = parentSubMenus!;
        }
      }
      const activeId = flattenedMenuItems.some(m => m.id === targetTabId) ? targetTabId : selectedMenuItem.id;

      // Batch state updates in a transition
      startTransition(() => {
        setOpenTabs(prev => {
            // Remove old entry/payment/other unified tabs
            const filtered = prev.filter(tab => 
              tab.id !== 'sales-entry' &&
              tab.id !== 'sales-payments' &&
              !tab.id.startsWith('entry-') &&
              !tab.id.startsWith('payments-') &&
              !tab.id.startsWith('hr-') &&
              !tab.id.startsWith('inventory-') &&
              !tab.id.startsWith('project-') &&
              !tab.id.startsWith('history-') &&
              !tab.id.startsWith('settings-')
            );
            
            const newTabs = [...filtered];
            let hasChanges = false;
            for (const t of tabsToShow) {
              if (!newTabs.some((tab: MenuItem) => tab.id === t.id)) {
                newTabs.push(t);
                hasChanges = true;
              }
            }
            if (!hasChanges && filtered.length === prev.length && filtered.every((t, i) => t.id === prev[i]?.id)) {
              return prev;
            }
            return newTabs;
        });
          
          if (activeTabIdRef.current !== activeId) {
            setActiveTabId(activeId);
          }
      });
      
      return;
    }
    
    if (isUnifiedPaymentsPage && tabParam) {
      const subTabs = createSubTabs('sales/payments');
      const activeSubTabId = `payments-${tabParam}`;
      
      // Batch state updates in a transition
      startTransition(() => {
        setOpenTabs(prev => {
          // Remove old parent tab and other payment tabs if exist
          const filtered = prev.filter(tab => 
            tab.id !== 'sales/payments' && 
            tab.id !== 'payments' &&
            !tab.id.startsWith('payments-')
          );
          
          // Add sub-tabs if they don't exist
          const newTabs = [...filtered];
          let hasChanges = false;
          subTabs.forEach(subTab => {
            if (!newTabs.some((t: MenuItem) => t.id === subTab.id)) {
              newTabs.push(subTab);
              hasChanges = true;
            }
          });
          
          // Only return new array if there were actual changes
          if (!hasChanges && filtered.length === prev.length) {
            return prev; // Return same reference to avoid re-render
          }
          
          return newTabs;
        });
        
        // Only update activeTabId if it actually changed
        if (activeTabIdRef.current !== activeSubTabId) {
          setActiveTabId(activeSubTabId);
        }
      });
      
      return;
    }
    
    // Check if this is a payments page with direct paths
    const isPaymentsPage = pathname === '/sales/payments-supplier' || 
                          pathname === '/sales/payments-customer' || 
                          pathname === '/sales/payments-outsider';
    
    if (isPaymentsPage) {
      // Extract tab type from pathname
      let tabType = 'supplier';
      if (pathname.includes('customer')) {
        tabType = 'customer';
      } else if (pathname.includes('outsider')) {
        tabType = 'outsider';
      }
      
      const subTabs = createSubTabs('sales/payments');
      const activeSubTabId = `payments-${tabType}`;
      
      // Batch state updates in a transition
      startTransition(() => {
        setOpenTabs(prev => {
          // Remove old parent tab and other payment tabs if exist
          const filtered = prev.filter(tab => 
            tab.id !== 'sales/payments' && 
            tab.id !== 'payments' &&
            !tab.id.startsWith('payments-')
          );
          
          // Add sub-tabs if they don't exist
          const newTabs = [...filtered];
          let hasChanges = false;
          subTabs.forEach(subTab => {
            if (!newTabs.some(t => t.id === subTab.id)) {
              newTabs.push(subTab);
              hasChanges = true;
            }
          });
          
          // Only return new array if there were actual changes
          if (!hasChanges && filtered.length === prev.length) {
            return prev; // Return same reference to avoid re-render
          }
          
          return newTabs;
        });
        
        // Only update activeTabId if it actually changed
        if (activeTabIdRef.current !== activeSubTabId) {
          setActiveTabId(activeSubTabId);
        }
      });
      
      return;
    }
    
    if (menuItem) {
      const selectedMenuItem = menuItem!;
      // Batch state updates in a transition
      startTransition(() => {
        setOpenTabs(prev => {
          const tabExists = prev.some(tab => tab.id === currentPathId);
          if (tabExists) {
            return prev; // No change needed
          }
          return [...prev, selectedMenuItem]; // Add new tab
        });
        
        // Set as active
        if (activeTabIdRef.current !== currentPathId) {
          setActiveTabId(currentPathId);
        }
      });
    } else if (openTabsRef.current.length === 0) {
      // Fallback: If no tabs and current page not in menu, open dashboard
      const dashboardTab = allMenuItems.find(item => item.id === 'dashboard-overview');
      if (dashboardTab) {
        const selectedDashboardTab = dashboardTab!;
        startTransition(() => {
          setOpenTabs([selectedDashboardTab]);
          setActiveTabId('dashboard-overview');
        });
      }
    }
    // Note: Flag reset is handled by the cleanup function above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathnameChanged]);

  const handleTabSelect = (tabIdOrMenuItem: string | MenuItem) => {
    // Handle both string (tabId from TabBar) and MenuItem
    const menuItem = typeof tabIdOrMenuItem === 'string' 
      ? openTabs.find(tab => tab.id === tabIdOrMenuItem) || flattenedMenuItems.find(item => item.id === tabIdOrMenuItem)
      : tabIdOrMenuItem;
    
    if (!menuItem) return;
    
    // Use href if available, otherwise construct from id
    let targetPath = menuItem.href 
      ? menuItem.href 
      : (menuItem.id === 'dashboard-overview' ? '/' : `/${menuItem.id}`);
    
    // Using href from menu config
    
    // Check if we're already on the target path (including query params)
    const currentPathWithQuery = isBrowser ? window.location.pathname + window.location.search : pathname;
    const targetPathBase = targetPath.split('?')[0];
    
    if (pathname === targetPathBase) {
      // Same base path - check if query params match or need update
      if (targetPath.includes('?')) {
        // Has query params - navigate to update them
        setActiveTabId(menuItem.id);
        performNavigation(targetPath);
        return;
      } else {
        // No query params needed, just update active tab
        setActiveTabId(menuItem.id);
        return;
      }
    }

    setActiveTabId(menuItem.id);

    const currentPath = pathname.split('?')[0];
    if (currentPath === targetPathBase && !targetPath.includes('?')) {
      return;
    }
    performNavigation(targetPath);
  };

  const handleTabClose = (tabIdToClose: string) => {
    if (tabIdToClose === 'dashboard-overview') return;

    const tabIndex = openTabs.findIndex(tab => tab.id === tabIdToClose);
    const newTabs = openTabs.filter(tab => tab.id !== tabIdToClose);
    setOpenTabs(newTabs);

    if (activeTabId === tabIdToClose) {
      const newActiveTab = newTabs[tabIndex - 1] || newTabs[0];
      if (newActiveTab) {
        setActiveTabId(newActiveTab.id);
        // Use href if available, otherwise construct from id
        const path = newActiveTab.href 
          ? newActiveTab.href 
          : (newActiveTab.id === 'dashboard-overview' ? '/' : `/${newActiveTab.id}`);
        performNavigation(path);
      } else {
        // This case should ideally not happen if dashboard is always present
        // but as a fallback, go to dashboard
        const dashboardTab = allMenuItems.find(item => item.id === 'dashboard-overview');
        if (dashboardTab) {
            setOpenTabs([dashboardTab]);
            setActiveTabId(dashboardTab.id);
            performNavigation('/');
        }
      }
    }
  };

  const handleOpenTab = (menuItem: MenuItem) => {
    // Find the menu item from allMenuItems
    const foundMenuItem = allMenuItems.find(item => item.id === menuItem.id);
    
    // If clicked item is a sub-menu, find its parent
    const parentWithSubMenu = allMenuItems.find(item => item.subMenus?.some(sub => sub.id === menuItem.id));
    
    if (parentWithSubMenu && !foundMenuItem) {
      // Clicked on sub-menu item - navigate to that sub-menu
      const clickedSubItem = parentWithSubMenu.subMenus?.find(sub => sub.id === menuItem.id);
      if (clickedSubItem) {
        // Clear all tabs and show only this menu's sub-menus
        const allSubMenus = parentWithSubMenu.subMenus || [];
        setOpenTabs(allSubMenus);
        setActiveTabId(menuItem.id);
        const path = clickedSubItem.href || menuItem.href || `/${menuItem.id}`;
        performNavigation(path);
        return;
      }
    }
    
    // Use the found menu item or the passed menuItem
    const targetMenu = foundMenuItem || menuItem;
    
    // If parent menu has subMenus, show all subMenus as tabs
    if (targetMenu.subMenus && targetMenu.subMenus.length > 0) {
      // Clear all existing tabs and set only this menu's sub-menus
      setOpenTabs(targetMenu.subMenus);
      // Set first sub-menu as active
      const firstSubMenu = targetMenu.subMenus[0];
      setActiveTabId(firstSubMenu.id);
      const path = firstSubMenu.href || `/${firstSubMenu.id}`;
      performNavigation(path);
      return;
    }
    
    // If no subMenus, clear all tabs and show only this menu item
    setOpenTabs([targetMenu]);
    setActiveTabId(targetMenu.id);
    // Use href if available, otherwise construct from id
    const path = targetMenu.href 
      ? targetMenu.href 
      : (targetMenu.id === 'dashboard-overview' ? '/' : `/${targetMenu.id}`);
    
    performNavigation(path);
  };

  const [loans, setLoans] = useState<Loan[]>([]);
  const [pendingNotifications, setPendingNotifications] = useState<Loan[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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
      setPendingNotifications(
        loans.filter(loan => loan.nextEmiDueDate && new Date(loan.nextEmiDueDate) <= today)
      );
    }
  }, [loans]);

  const [calculatorPosition, setCalculatorPosition] = useState({ x: 0, y: 0 });
  const [isDraggingCalculator, setIsDraggingCalculator] = useState(false);
  const calculatorDragStartRef = useRef({ x: 0, y: 0 });
  const calculatorDialogRef = useRef<HTMLDivElement>(null);

  const handleCalculatorMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    setIsDraggingCalculator(true);
    calculatorDragStartRef.current = {
      x: e.clientX - calculatorPosition.x,
      y: e.clientY - calculatorPosition.y,
    };
  };

  const handleCalculatorMouseMove = (e: MouseEvent) => {
    if (isDraggingCalculator && calculatorDialogRef.current) {
      const newX = e.clientX - calculatorDragStartRef.current.x;
      const newY = e.clientY - calculatorDragStartRef.current.y;
      setCalculatorPosition({ x: newX, y: newY });
    }
  };

  const handleCalculatorMouseUp = () => {
    setIsDraggingCalculator(false);
  };

  useEffect(() => {
    if (isDraggingCalculator) {
      window.addEventListener('mousemove', handleCalculatorMouseMove);
      window.addEventListener('mouseup', handleCalculatorMouseUp);
    } else {
      window.removeEventListener('mousemove', handleCalculatorMouseMove);
      window.removeEventListener('mouseup', handleCalculatorMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleCalculatorMouseMove);
      window.removeEventListener('mouseup', handleCalculatorMouseUp);
    };
  }, [isDraggingCalculator]);

  // Use URL params when on /sales so highlight updates immediately (no wait for effect)
  const isSalesPath = pathname === "/sales" || pathname === "/sales/" || pathname.startsWith("/sales/");
  const menuParam = isSalesPath ? searchParams.get("menu") : null;
  const tabParam = isSalesPath ? searchParams.get("tab") : null;

  // Map menu param to top-level menu item id (entry->sales-entry, payments->sales-payments, etc.)
  const menuParamToId: Record<string, string> = {
    entry: "sales-entry",
    payments: "sales-payments",
    reports: "sales-reports",
  };
  const effectiveMenuId = (pathname === "/sales" || pathname === "/sales/") && menuParam
    ? (menuParamToId[menuParam] ?? menuParam)
    : null;

  const tabFromUrl =
    pathname === "/sales"
      ? tabParam
      : pathname === "/sales/entry"
        ? (tabParam ? `entry-${tabParam}` : null)
        : pathname.startsWith("/sales/payments")
          ? (tabParam ? `payments-${tabParam}` : null)
          : null;
  const effectiveActiveTabId = tabFromUrl ?? activeTabId;

  const isTopMenuActive = (item: MenuItem) => {
    // On /sales: use menu param to determine which top-level item is active
    if ((pathname === "/sales" || pathname === "/sales/") && effectiveMenuId) {
      return item.id === effectiveMenuId;
    }
    if (item.subMenus && item.subMenus.length > 0) {
      if (item.subMenus.some(sub => sub.id === effectiveActiveTabId)) return true;
      return item.subMenus.some(sub => {
        if (sub.href) {
          const base = sub.href.split('?')[0];
          return pathname === base || pathname.startsWith(base + '/');
        }
        const base = `/${sub.id}`;
        return pathname === base || pathname.startsWith(base + '/');
      });
    }
    if (item.href) {
      const base = item.href.split('?')[0];
      return pathname === base || pathname.startsWith(base + '/');
    }
    if (item.id === 'dashboard-overview') return pathname === '/';
    if (item.id === effectiveActiveTabId) return true;
    const base = `/${item.id}`;
    return pathname === base || pathname.startsWith(base + '/');
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const scrollCtx = useScrollContainer();
  const isSalesRoute = pathname.startsWith('/sales');
  const hasSubnav = isSalesRoute && !!subnav;

  return (
    <LayoutSubnavContext.Provider value={{ setSubnav }}>
      <div className="min-h-screen flex flex-col">
        <div className="sticky top-0 z-50">
          <div className="border-b border-[#24003A] bg-[#2E004F] text-white">
            <div className="flex h-12 w-full items-center gap-1.5 px-1.5 sm:px-3">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2 text-white/90 hover:bg-white/10 hover:text-white lg:hidden"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 bg-[#2E004F] border-violet-900/30 p-0">
                  <SheetHeader className="p-4 border-b border-white/10">
                    <SheetTitle className="text-white text-left">Menu</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col py-2">
                    {allMenuItems.map((item) => {
                      if (item.subMenus && item.subMenus.length > 0) {
                        const parentActive = item.subMenus.some(sub => sub.id === effectiveActiveTabId);
                        return (
                          <div key={item.id} className="px-2">
                            <p className={cn(
                              "px-3 py-2 text-xs font-semibold uppercase rounded-md",
                              parentActive ? "text-white bg-white/12" : "text-white/60"
                            )}>{item.name}</p>
                            {item.subMenus.map((sub) => (
                              <button
                                key={sub.id}
                                className={cn(
                                  "flex w-full items-center gap-3 px-4 py-2.5 text-sm rounded-md",
                                  sub.id === effectiveActiveTabId ? "bg-white/12 text-white" : "text-white/90 hover:bg-white/10"
                                )}
                                onClick={() => {
                                  handleOpenTab(sub);
                                  setMobileMenuOpen(false);
                                }}
                              >
                                {sub.icon ? <sub.icon className="h-4 w-4" /> : null}
                                {sub.name}
                              </button>
                            ))}
                          </div>
                        );
                      }
                      const active =
                        item.id === effectiveMenuId ||
                        item.id === effectiveActiveTabId ||
                        (item.href && (pathname === item.href.split('?')[0] || pathname === item.href.split('?')[0] + '/'));
                      return (
                        <button
                          key={item.id}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-2.5 text-sm rounded-md",
                            active ? "bg-white/12 text-white" : "text-white/90 hover:bg-white/10"
                          )}
                          onClick={() => {
                            handleOpenTab(item);
                            setMobileMenuOpen(false);
                          }}
                        >
                          {item.icon ? <item.icon className="h-4 w-4" /> : null}
                          {item.name}
                        </button>
                      );
                    })}
                  </div>
                </SheetContent>
              </Sheet>

              <div className="flex-1 overflow-x-auto no-scrollbar hidden lg:block">
                <div className="flex min-w-max items-stretch h-12">
                  {allMenuItems.map((item) => {
                    const active = isTopMenuActive(item);
                    if (item.subMenus && item.subMenus.length > 0) {
                      return (
                        <DropdownMenu key={item.id}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-full min-w-9 px-2 text-white/90 hover:bg-white/10 hover:text-white rounded-none transition-colors",
                                active && "bg-white/25 text-white"
                              )}
                              title={item.name}
                              onClick={() => handleOpenTab(item)}
                            >
                              {item.icon ? <item.icon className="h-4 w-4" /> : null}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="min-w-56 rounded-lg border border-violet-900/30 bg-violet-950/90 text-white shadow-[0_18px_50px_rgba(2,6,23,0.35)] backdrop-blur-[20px]"
                          >
                            <DropdownMenuLabel className="font-bold text-sm text-white">{item.name}</DropdownMenuLabel>
                            {item.subMenus.map((sub) => (
                              <DropdownMenuItem
                                key={sub.id}
                                className="cursor-pointer focus:bg-white/10"
                                onClick={() => handleOpenTab(sub)}
                              >
                                {sub.icon ? <sub.icon className="mr-2 h-4 w-4" /> : null}
                                <span className="text-sm">{sub.name}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      );
                    }

                    return (
                      <Button
                        key={item.id}
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-full min-w-9 px-2 text-white/90 hover:bg-white/10 hover:text-white rounded-none transition-colors",
                          active && "bg-white/25 text-white"
                        )}
                        title={item.name}
                        onClick={() => handleOpenTab(item)}
                      >
                        {item.icon ? <item.icon className="h-4 w-4" /> : null}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="ml-auto flex items-center gap-1">
                <ErpCompanySelector
                  hasErpCompanies={erpCompanies.length > 0}
                  tenants={[]}
                  activeTenant={null}
                  hideCompanySelector
                />
                <ProfileDropdown />
              </div>

              <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-9 w-9 text-white/90 hover:bg-white/10 hover:text-white"
                  >
                    <Bell className="h-5 w-5" />
                    {pendingNotifications.length > 0 && (
                      <span className="absolute top-2 right-2 block h-1.5 w-1.5 rounded-full bg-destructive" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="end"
                  sideOffset={8}
                  className="w-80 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-lg"
                >
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">Pending EMIs</h4>
                    {pendingNotifications.length > 0 ? (
                      pendingNotifications.slice(0, 6).map(loan => (
                        <button
                          key={loan.id}
                          onClick={(e) => {
                            e.preventDefault();
                            setNotificationsOpen(false);
                            const params = new URLSearchParams({
                              loanId: loan.id,
                              amount: String(loan.emiAmount || 0),
                              payee: loan.lenderName || loan.productName || 'Loan Payment',
                              description: `EMI for ${loan.loanName}`
                            }).toString();
                            performNavigation(`/expense-tracker?${params}`);
                          }}
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

              <Dialog modal={false}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-white/90 hover:bg-white/10 hover:text-white"
                  >
                    <Calculator className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent
                  ref={calculatorDialogRef}
                  className="p-0 max-w-lg"
                  style={{
                    transform: `translate(calc(-50% + ${calculatorPosition.x}px), calc(-50% + ${calculatorPosition.y}px))`,
                  }}
                  onInteractOutside={(e) => {
                    if (isDraggingCalculator) {
                      e.preventDefault();
                    }
                  }}
                >
                  <DialogHeader className="p-0 sr-only">
                    <DialogTitle>Advanced Calculator</DialogTitle>
                  </DialogHeader>
                  <div
                    onMouseDown={handleCalculatorMouseDown}
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
            </div>
          </div>

          {hasSubnav ? (
            <div className="border-b border-[#24003A] bg-[#F1E6F2] text-slate-900">
              <div className="flex h-10 w-full items-center px-1.5 sm:px-3">
                <div className="flex-1 overflow-x-auto no-scrollbar">
                  {subnav}
                </div>
              </div>
            </div>
          ) : null}
        </div>

      {!pathname.startsWith('/sales') && (
        <div className="sticky top-12 z-40 bg-background/70 backdrop-blur-[18px]">
          <TabBar
            openTabs={openTabs}
            activeTabId={activeTabId}
            setActiveTabId={(tabId: string) => {
              const menuItem = openTabs.find(tab => tab.id === tabId) || flattenedMenuItems.find(item => item.id === tabId);
              if (menuItem) handleTabSelect(menuItem);
            }}
            closeTab={handleTabClose}
          />
        </div>
      )}

      <div
        ref={scrollCtx?.setScrollContainer ?? undefined}
        className={cn("flex-1 overflow-y-auto overflow-x-hidden relative", isSalesRoute && "bg-[#F3F4F6]")}
      >
        <main className={cn(isSalesRoute ? "p-2" : "p-1.5 sm:p-2.5")}>
          {children}
        </main>
      </div>
      </div>
    </LayoutSubnavContext.Provider>
  );
}
