
"use client";

import { Suspense, useEffect, useState, useRef, useTransition, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { allMenuItems, type MenuItem } from "@/hooks/use-tabs";
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import CustomSidebar from '@/components/layout/custom-sidebar';
import TabBar from '@/components/layout/tab-bar';
import { Header } from "@/components/layout/header";
import { usePersistedState } from '@/hooks/use-persisted-state';
import { SupplierHubProvider } from '@/app/sales/supplier-hub/context/supplier-hub-context';
import { Truck, Users, Wallet, FilePlus, Banknote } from 'lucide-react';

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
      serialize: (tabs) => JSON.stringify(tabs.map(t => ({ id: t.id, name: t.name, icon: t.icon }))),
      deserialize: (str) => {
        const parsed = JSON.parse(str);
        return parsed.map((t: any) => {
          const fullMenuItem = allMenuItems.flatMap(i => i.subMenus ? i.subMenus : i).find(item => item.id === t.id);
          return fullMenuItem || t;
        });
      }
    }
  );
  const [activeTabId, setActiveTabId] = usePersistedState<string>('app-active-tab', 'dashboard-overview');
  const [isSidebarActive, setIsSidebarActive] = useState(false);
  const [isNavigating, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const lastPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip if pathname hasn't changed
    if (lastPathnameRef.current === pathname) return;
    lastPathnameRef.current = pathname;
    
    // Handle direct payment paths - map to menu item IDs
    let currentPathId = pathname === '/' ? 'dashboard-overview' : pathname.substring(1);
    
    if (pathname === '/sales/payments-supplier') {
      currentPathId = 'payments-supplier';
    } else if (pathname === '/sales/payments-customer') {
      currentPathId = 'payments-customer';
    } else if (pathname === '/sales/payments-outsider') {
      currentPathId = 'payments-outsider';
    }
    
    const menuItem = allMenuItems.flatMap(i => i.subMenus ? i.subMenus : i).find(item => item.id === currentPathId);
    
    // Check if this is Entry page - if so, create sub-tabs
    const isEntryPage = pathname === '/sales/entry' || pathname.startsWith('/sales/entry');
    
    // Get tab from URL query for entry pages
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const tabParam = urlParams?.get('tab') || 'supplier';
    
    if (isEntryPage) {
      const subTabs = createSubTabs('entry');
      const activeSubTabId = `entry-${tabParam}`;
      
      setOpenTabs(prev => {
        // Remove old parent tab and other entry tabs if exist
        const filtered = prev.filter(tab => 
          tab.id !== 'entry' && 
          tab.id !== 'sales/entry' &&
          !tab.id.startsWith('entry-')
        );
        
        // Add sub-tabs if they don't exist
        const newTabs = [...filtered];
        subTabs.forEach(subTab => {
          if (!newTabs.some(t => t.id === subTab.id)) {
            newTabs.push(subTab);
          }
        });
        
        return newTabs;
      });
      
      setActiveTabId(activeSubTabId);
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
      
      setOpenTabs(prev => {
        // Remove old parent tab and other payment tabs if exist
        const filtered = prev.filter(tab => 
          tab.id !== 'sales/payments' && 
          tab.id !== 'payments' &&
          !tab.id.startsWith('payments-')
        );
        
        // Add sub-tabs if they don't exist
        const newTabs = [...filtered];
        subTabs.forEach(subTab => {
          if (!newTabs.some(t => t.id === subTab.id)) {
            newTabs.push(subTab);
          }
        });
        
        return newTabs;
      });
      
      setActiveTabId(activeSubTabId);
      return;
    }
    
    if (menuItem) {
      // Use callback form to avoid race conditions
      setOpenTabs(prev => {
        const tabExists = prev.some(tab => tab.id === currentPathId);
        if (tabExists) {
          return prev; // No change needed
        }
        return [...prev, menuItem]; // Add new tab
      });
      
      // Set as active
      if (activeTabId !== currentPathId) {
        setActiveTabId(currentPathId);
      }
    } else if (openTabs.length === 0) {
      // Fallback: If no tabs and current page not in menu, open dashboard
      const dashboardTab = allMenuItems.find(item => item.id === 'dashboard-overview');
      if (dashboardTab) {
        setOpenTabs([dashboardTab]);
        setActiveTabId('dashboard-overview');
      }
    }
  }, [pathname, activeTabId]);

  const handleTabSelect = (tabIdOrMenuItem: string | MenuItem) => {
    // Handle both string (tabId from TabBar) and MenuItem (from CustomSidebar)
    const menuItem = typeof tabIdOrMenuItem === 'string' 
      ? openTabs.find(tab => tab.id === tabIdOrMenuItem) || allMenuItems.flatMap(i => i.subMenus ? i.subMenus : i).find(item => item.id === tabIdOrMenuItem)
      : tabIdOrMenuItem;
    
    if (!menuItem) return;
    
    // Use href if available, otherwise construct from id
    let targetPath = menuItem.href 
      ? menuItem.href 
      : (menuItem.id === 'dashboard-overview' ? '/' : `/${menuItem.id}`);
    
    // Handle sub-tabs for Entry and Payments
    if (menuItem.id.startsWith('entry-')) {
      let tabType = 'supplier';
      if (menuItem.id.includes('supplier')) {
        tabType = 'supplier';
      } else if (menuItem.id.includes('customer')) {
        tabType = 'customer';
      }
      targetPath = `/sales/entry?tab=${tabType}`;
    } else if (menuItem.id.startsWith('payments-')) {
      // Payments now use direct paths, not query parameters
      if (menuItem.href) {
        targetPath = menuItem.href;
      } else if (menuItem.id.includes('supplier')) {
        targetPath = '/sales/payments-supplier';
      } else if (menuItem.id.includes('customer')) {
        targetPath = '/sales/payments-customer';
      } else if (menuItem.id.includes('outsider')) {
        targetPath = '/sales/payments-outsider';
      }
    }
    
    if (pathname === targetPath.split('?')[0] && pathname.includes(targetPath)) {
      setActiveTabId(menuItem.id);
      return;
    }

    setActiveTabId(menuItem.id);

    // Navigate in a transition to keep UI responsive and guard against transient errors
    startTransition(() => {
      try {
        // Check if we're already on this path to avoid unnecessary navigation
        const currentPath = pathname.split('?')[0];
        const targetPathBase = targetPath.split('?')[0];
        
        if (currentPath === targetPathBase) {
          // Already on this page, just update the active tab
          return;
        }
        
        // Use router.push with error handling
        const pushPromise = router.push(targetPath);
        
        // Handle promise rejection (prefetch failures)
        if (pushPromise && typeof pushPromise.catch === 'function') {
          pushPromise.catch((err: any) => {
            // Prefetch failures are often non-critical - try direct navigation
            console.warn('Router push failed, using fallback:', err);
            if (typeof window !== 'undefined') {
              // Use replace to avoid adding to history
              window.location.href = targetPath;
            }
          });
        }
      } catch (err) {
        console.warn('Navigation error:', err);
        // As a resilience fallback (e.g., dev server hiccup), force a hard navigation
        try {
          if (typeof window !== 'undefined') {
            window.location.href = targetPath;
          }
        } catch (_) {
          // noop
        }
      }
    });
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
        startTransition(() => {
          try {
            router.push(path);
          } catch {
            try { if (typeof window !== 'undefined') window.location.assign(path); } catch {}
          }
        });
      } else {
        // This case should ideally not happen if dashboard is always present
        // but as a fallback, go to dashboard
        const dashboardTab = allMenuItems.find(item => item.id === 'dashboard-overview');
        if (dashboardTab) {
            setOpenTabs([dashboardTab]);
            setActiveTabId(dashboardTab.id);
            startTransition(() => {
              try {
                router.push('/');
              } catch {
                try { if (typeof window !== 'undefined') window.location.assign('/'); } catch {}
              }
            });
        }
      }
    }
  };

  const handleOpenTab = (menuItem: MenuItem) => {
    // Find the parent menu item from allMenuItems
    const parentMenuItem = allMenuItems.find(item => item.id === menuItem.id) || 
                          allMenuItems.find(item => item.subMenus?.some(sub => sub.id === menuItem.id));
    
    // If clicked item is a sub-menu, find its parent
    let targetMenu: MenuItem | undefined;
    if (parentMenuItem && parentMenuItem.id === menuItem.id) {
      // Clicked on parent menu itself
      targetMenu = parentMenuItem;
    } else {
      // Clicked on sub-menu item - find parent
      targetMenu = allMenuItems.find(item => item.subMenus?.some(sub => sub.id === menuItem.id));
      if (targetMenu) {
        // Use the sub-menu item that was clicked
        const clickedSubItem = targetMenu.subMenus?.find(sub => sub.id === menuItem.id);
        if (clickedSubItem) {
          // Clear all tabs and show only this menu's sub-menus
          const allSubMenus = targetMenu.subMenus || [];
          setOpenTabs(allSubMenus);
          setActiveTabId(menuItem.id);
          const path = clickedSubItem.href || menuItem.href || `/${menuItem.id}`;
          startTransition(() => {
            try {
              router.push(path);
            } catch {
              try { if (typeof window !== 'undefined') window.location.assign(path); } catch {}
            }
          });
          return;
        }
      }
    }
    
    // If parent menu has subMenus, show all subMenus as tabs
    if (targetMenu && targetMenu.subMenus && targetMenu.subMenus.length > 0) {
      // Clear all existing tabs and set only this menu's sub-menus
      setOpenTabs(targetMenu.subMenus);
      // Set first sub-menu as active
      const firstSubMenu = targetMenu.subMenus[0];
      setActiveTabId(firstSubMenu.id);
      const path = firstSubMenu.href || `/${firstSubMenu.id}`;
      startTransition(() => {
        try {
          router.push(path);
        } catch {
          try { if (typeof window !== 'undefined') window.location.assign(path); } catch {}
        }
      });
      return;
    }
    
    // If no subMenus, clear all tabs and show only this menu item
    setOpenTabs([menuItem]);
    setActiveTabId(menuItem.id);
    // Use href if available, otherwise construct from id
    const path = menuItem.href 
      ? menuItem.href 
      : (menuItem.id === 'dashboard-overview' ? '/' : `/${menuItem.id}`);
    startTransition(() => {
      try {
        router.push(path);
      } catch {
        try { if (typeof window !== 'undefined') window.location.assign(path); } catch {}
      }
    });
  };

  const toggleSidebar = () => setIsSidebarActive(prev => !prev);
  const pageId = pathname.substring(1);

  return (
    <SupplierHubProvider>
    <div className={cn("wrapper", isSidebarActive && "active")}>
        <CustomSidebar onTabSelect={handleOpenTab} isSidebarActive={isSidebarActive} toggleSidebar={toggleSidebar}>
          <div className="flex flex-col flex-grow min-h-0 h-screen overflow-hidden">
              <div className="sticky top-0 z-30 flex-shrink-0 bg-card" style={{ borderRadius: 0 }}>
              <Header toggleSidebar={toggleSidebar} />
              <TabBar openTabs={openTabs} activeTabId={activeTabId} setActiveTabId={(tabId: string) => {
                const menuItem = openTabs.find(tab => tab.id === tabId) || allMenuItems.flatMap(i => i.subMenus ? i.subMenus : i).find(item => item.id === tabId);
                if (menuItem) handleTabSelect(menuItem);
              }} closeTab={handleTabClose} />
            </div>
              <div className="flex-grow relative overflow-y-auto overflow-x-hidden">
                <main className="p-4 sm:p-6" style={{ margin: '-16px' }}>
                {children}
              </main>
            </div>
          </div>
        </CustomSidebar>
    </div>
    </SupplierHubProvider>
  );
}
