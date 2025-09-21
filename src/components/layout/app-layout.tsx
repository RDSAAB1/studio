
"use client";

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { allMenuItems, type MenuItem } from "@/hooks/use-tabs";
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import CustomSidebar from '@/components/layout/custom-sidebar';
import TabBar from '@/components/layout/tab-bar';
import { Header } from "@/components/layout/header";

export default function AppLayoutWrapper({ children }: { children: ReactNode }) {
  const [openTabs, setOpenTabs] = useState<MenuItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('dashboard-overview');
  const [isSidebarActive, setIsSidebarActive] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const dashboardTab = allMenuItems.find(item => item.id === 'dashboard-overview');
    if (dashboardTab && openTabs.length === 0) {
      setOpenTabs([dashboardTab]);
      setActiveTabId('dashboard-overview');
      if (pathname !== '/') {
         router.push('/');
      }
    }
  }, [openTabs.length, pathname, router]);

  useEffect(() => {
    const currentPathId = pathname === '/' ? 'dashboard-overview' : pathname.substring(1);
    if (currentPathId && currentPathId !== activeTabId) {
      const menuItem = allMenuItems.flatMap(i => i.subMenus ? i.subMenus : i).find(item => item.id === currentPathId);
      if (menuItem) {
        if (!openTabs.some(tab => tab.id === currentPathId)) {
          setOpenTabs(prev => [...prev, menuItem]);
        }
        setActiveTabId(currentPathId);
      }
    }
  }, [pathname, activeTabId, openTabs]);

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
