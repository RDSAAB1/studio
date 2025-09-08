
"use client";

import React, { useState, useEffect, type ReactNode, useCallback } from "react";
import { usePathname, useRouter } from 'next/navigation';
import CustomSidebar from "./custom-sidebar";
import { cn } from "@/lib/utils";
import { allMenuItems, type MenuItem } from '@/hooks/use-tabs';
import { Header } from "./header";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { getCompanySettings, getRtgsSettings } from "@/lib/firestore";
import { Loader2 } from "lucide-react";

type MainLayoutProps = {
    children: ReactNode;
}

const UNPROTECTED_ROUTES = ['/login', '/setup/connect-gmail', '/setup/company-details'];

const findTabForPath = (path: string): MenuItem | undefined => {
    const basePath = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path.split('?')[0];
    for (const item of allMenuItems) {
        if (item.href === basePath) return item;
        if (item.subMenus) {
            const subItem = item.subMenus.find(sub => sub.href === basePath);
            if (subItem) return subItem;
        }
    }
    return allMenuItems.find(item => item.id === 'dashboard');
};

export default function MainLayout({ children }: MainLayoutProps) {
  const [isSidebarActive, setIsSidebarActive] = useState(false);
  const [openTabs, setOpenTabs] = useState<MenuItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setLoading(true);
        if (currentUser) {
            setUser(currentUser);
            const companySettings = await getCompanySettings(currentUser.uid);
            const rtgsSettings = await getRtgsSettings();

            if (!companySettings || !companySettings.appPassword) {
                if (pathname !== '/setup/connect-gmail') router.replace('/setup/connect-gmail');
            } else if (!rtgsSettings) {
                if (pathname !== '/setup/company-details') router.replace('/setup/company-details');
            } else if (UNPROTECTED_ROUTES.includes(pathname) || pathname === '/') {
                 router.replace('/dashboard-overview');
            }
        } else {
            setUser(null);
            if (!UNPROTECTED_ROUTES.includes(pathname)) {
                router.replace('/login');
            }
        }
        setLoading(false);
    });
    return () => unsubscribe();
  }, [pathname, router]);

  useEffect(() => {
    if (loading || UNPROTECTED_ROUTES.includes(pathname)) return;

    const currentTabInfo = findTabForPath(pathname);
    
    if (currentTabInfo) {
      setActiveTabId(currentTabInfo.id);
      
      if (!openTabs.some(tab => tab.id === currentTabInfo.id)) {
        setOpenTabs(prevTabs => [...prevTabs, currentTabInfo]);
      }
    }
  }, [pathname, loading, openTabs]);


  const handleTabClick = (tabId: string) => {
    const tab = openTabs.find(t => t.id === tabId);
    if (tab?.href && pathname !== tab.href) {
        router.push(tab.href);
    }
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabId === 'dashboard') return;

    const tabIndex = openTabs.findIndex(tab => tab.id === tabId);
    const newTabs = openTabs.filter(tab => tab.id !== tabId);

    if (activeTabId === tabId) {
        const newActiveTab = newTabs[tabIndex] || newTabs[tabIndex - 1] || newTabs[0];
        if (newActiveTab?.href) {
            router.push(newActiveTab.href);
        } else if (newTabs.length === 0) {
            const dashboard = allMenuItems.find(item => item.id === 'dashboard');
            if (dashboard) {
                router.push(dashboard.href!);
                setOpenTabs([dashboard]);
                setActiveTabId(dashboard.id);
            }
        }
    }
    setOpenTabs(newTabs);
  };

  const handleSidebarItemClick = (item: MenuItem) => {
    if (item.href) {
      if (!openTabs.some(tab => tab.id === item.id)) {
        setOpenTabs([...openTabs, item]);
      }
      setActiveTabId(item.id);
      // Let the <Link> component handle the navigation
      if (window.innerWidth < 1024) {
          setIsSidebarActive(false);
      }
    }
  };
  
  const toggleSidebar = () => setIsSidebarActive(!isSidebarActive);

  const handleSignOut = async () => {
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
      setOpenTabs([]);
      router.replace('/login');
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  if (loading) {
      return (
          <div className="flex h-screen w-screen items-center justify-center bg-background">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      );
  }
  
  if (!user && !UNPROTECTED_ROUTES.includes(pathname)) {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  if (UNPROTECTED_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }
  
  return (
    <div className={cn("wrapper", isSidebarActive && "active")}>
        <div onMouseEnter={() => setIsSidebarActive(true)}>
            <CustomSidebar 
                isSidebarActive={isSidebarActive}
                onMenuItemClick={handleSidebarItemClick}
            />
        </div>
        <div 
            className="main_container"
            onMouseEnter={() => setIsSidebarActive(false)}
        >
            <Header 
              openTabs={openTabs}
              activeTabId={activeTabId}
              onTabClick={handleTabClick}
              onCloseTab={handleCloseTab}
              toggleSidebar={toggleSidebar}
              user={user}
              onSignOut={handleSignOut}
            />
            <div className="content">
                 {children}
            </div>
            {isSidebarActive && window.innerWidth < 1024 && <div className="shadow" onClick={toggleSidebar}></div>}
        </div>
    </div>
  );
}
