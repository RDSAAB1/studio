
"use client";

import React, { useState, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from 'next/navigation';
import CustomSidebar from "./custom-sidebar";
import { cn } from "@/lib/utils";
import { allMenuItems, type MenuItem } from '@/hooks/use-tabs';
import { Header } from "./header";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

type MainLayoutProps = {
    children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [isSidebarActive, setIsSidebarActive] = useState(false);
  const [openTabs, setOpenTabs] = useState<MenuItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        router.replace('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);
  
  useEffect(() => {
    if (isAuthenticated === null) return;
    
    let initialTab: MenuItem | undefined;
    for (const item of allMenuItems) {
      if (item.href === pathname) {
        initialTab = item;
        break;
      }
      if (item.subMenus) {
        initialTab = item.subMenus.find(sub => sub.href === pathname);
        if (initialTab) break;
      }
    }
    
    if (initialTab) {
      setActiveTabId(initialTab.id);
      if (!openTabs.some(tab => tab.id === initialTab!.id)) {
        setOpenTabs(prev => [...prev, initialTab!]);
      }
    } else {
        const dashboard = allMenuItems.find(item => item.id === 'dashboard');
        if (dashboard) {
            setActiveTabId(dashboard.id);
             if(pathname !== dashboard.href) {
                // Do not redirect here to avoid conflicts with auth check
            }
        }
    }
  }, [pathname, isAuthenticated]);

  useEffect(() => {
    // Ensure dashboard is always present if authenticated
    if (isAuthenticated && !openTabs.some(tab => tab.id === 'dashboard')) {
        const dashboard = allMenuItems.find(item => item.id === 'dashboard');
        if (dashboard) {
            setOpenTabs([dashboard]);
            if (pathname === '/'){
                router.replace(dashboard.href || '/');
            }
        }
    }
  }, [isAuthenticated, openTabs, pathname, router]);

  const handleTabClick = (tabId: string) => {
    setActiveTabId(tabId);
    const tab = allMenuItems.flatMap(i => i.subMenus || i).find(t => t.id === tabId);
    if(tab?.href) {
        router.push(tab.href);
    }
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (tabId === 'dashboard') return;

    const tabIndex = openTabs.findIndex(tab => tab.id === tabId);
    let newActiveTabId = activeTabId;
    let newPath = '';
    
    if(activeTabId === tabId) {
        newActiveTabId = openTabs[tabIndex - 1]?.id || 'dashboard';
        const newActiveTab = allMenuItems.flatMap(i => i.subMenus || i).find(t => t.id === newActiveTabId);
        newPath = newActiveTab?.href || '/';
    } else {
        const currentActiveTab = openTabs.find(tab => tab.id === activeTabId);
        if (currentActiveTab) newPath = currentActiveTab.href || '/';
    }
    
    const newOpenTabs = openTabs.filter(tab => tab.id !== tabId);
    setOpenTabs(newOpenTabs);
    setActiveTabId(newActiveTabId);
    if (newPath) router.push(newPath);
  };

  const handleSidebarItemClick = (item: MenuItem) => {
    if (item.href) {
      if (!openTabs.some(tab => tab.id === item.id)) {
        setOpenTabs([...openTabs, item]);
      }
      setActiveTabId(item.id);
      if (window.innerWidth < 1024) {
          setIsSidebarActive(false);
      }
    }
  };
  
  const toggleSidebar = () => setIsSidebarActive(!isSidebarActive);

  if (isAuthenticated === null) {
      return (
          <div className="flex h-screen w-screen items-center justify-center bg-background">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      );
  }
  
  if (!isAuthenticated) {
      // While redirecting, can show a loader or just the children (which would be the login page)
      return <>{children}</>;
  }
  
  return (
    <div className={cn("wrapper", isSidebarActive && "active")}>
        <CustomSidebar 
            isSidebarActive={isSidebarActive}
            onMenuItemClick={handleSidebarItemClick}
            toggleSidebar={toggleSidebar}
        />
        <div className="main_container">
            <Header 
              openTabs={openTabs}
              activeTabId={activeTabId}
              onTabClick={handleTabClick}
              onCloseTab={handleCloseTab}
              toggleSidebar={toggleSidebar}
            />
            <div className="content">
                {children}
            </div>
            {isSidebarActive && <div className="shadow" onClick={toggleSidebar}></div>}
        </div>
    </div>
  );
}
