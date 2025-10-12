
"use client";

import { Suspense, useEffect, useState, useRef, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { allMenuItems, type MenuItem } from "@/hooks/use-tabs";
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import CustomSidebar from '@/components/layout/custom-sidebar';
import TabBar from '@/components/layout/tab-bar';
import { Header } from "@/components/layout/header";
import { usePersistedState } from '@/hooks/use-persisted-state';

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
  const router = useRouter();
  const pathname = usePathname();
  const lastPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip if pathname hasn't changed
    if (lastPathnameRef.current === pathname) return;
    lastPathnameRef.current = pathname;
    
    const currentPathId = pathname === '/' ? 'dashboard-overview' : pathname.substring(1);
    const menuItem = allMenuItems.flatMap(i => i.subMenus ? i.subMenus : i).find(item => item.id === currentPathId);
    
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

  const handleTabSelect = (tabId: string) => {
    setActiveTabId(tabId);
    const path = tabId === 'dashboard-overview' ? '/' : `/${tabId}`;
    router.push(path);
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
        const path = newActiveTab.id === 'dashboard-overview' ? '/' : `/${newActiveTab.id}`;
        router.push(path);
      } else {
        // This case should ideally not happen if dashboard is always present
        // but as a fallback, go to dashboard
        const dashboardTab = allMenuItems.find(item => item.id === 'dashboard-overview');
        if (dashboardTab) {
            setOpenTabs([dashboardTab]);
            setActiveTabId(dashboardTab.id);
            router.push('/');
        }
      }
    }
  };

  const handleOpenTab = (menuItem: MenuItem) => {
    if (!openTabs.some(tab => tab.id === menuItem.id)) {
      setOpenTabs(prev => [...prev, menuItem]);
    }
    setActiveTabId(menuItem.id);
    const path = menuItem.id === 'dashboard-overview' ? '/' : `/${menuItem.id}`;
    router.push(path);
  };

  const toggleSidebar = () => setIsSidebarActive(prev => !prev);
  const pageId = pathname.substring(1);

  return (
    <div className={cn("wrapper", isSidebarActive && "active")}>
        <CustomSidebar onTabSelect={handleOpenTab} isSidebarActive={isSidebarActive} toggleSidebar={toggleSidebar}>
          <div className="flex flex-col flex-grow min-h-0 h-screen overflow-hidden">
            <div className="sticky top-0 z-30 flex-shrink-0">
              <TabBar openTabs={openTabs} activeTabId={activeTabId} setActiveTabId={handleTabSelect} closeTab={handleTabClose} />
              <Header toggleSidebar={toggleSidebar} />
            </div>
            <div className="flex-grow relative overflow-y-auto">
              <main className="p-4 sm:p-6">
                {children}
              </main>
            </div>
          </div>
        </CustomSidebar>
    </div>
  );
}
