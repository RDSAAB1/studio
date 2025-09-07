
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
const SETUP_ROUTES = ['/setup/connect-gmail', '/setup/company-details'];

const findTabForPath = (path: string): MenuItem | undefined => {
    const basePath = path.split('?')[0];
    for (const item of allMenuItems) {
        if (item.href === basePath) {
            return item;
        }
        if (item.subMenus) {
            const subItem = item.subMenus.find(sub => sub.href === basePath);
            if (subItem) return subItem;
        }
    }
    return undefined;
};


export default function MainLayout({ children }: MainLayoutProps) {
  const [isSidebarActive, setIsSidebarActive] = useState(false);
  const [openTabs, setOpenTabs] = useState<MenuItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
            setUser(currentUser);
            const companySettings = await getCompanySettings(currentUser.uid);
            const rtgsSettings = await getRtgsSettings();

            if (!companySettings || !companySettings.appPassword) {
                if (pathname !== '/setup/connect-gmail') router.replace('/setup/connect-gmail');
            } else if (!rtgsSettings) {
                if (pathname !== '/setup/company-details') router.replace('/setup/company-details');
            } else if (UNPROTECTED_ROUTES.includes(pathname)) {
                 router.replace('/sales/dashboard-overview');
            }
        } else {
            setUser(null);
            if (!UNPROTECTED_ROUTES.includes(pathname)) {
                router.replace('/login');
            }
        }
        setAuthChecked(true);
        setLoading(false);
    });
    return () => unsubscribe();
  }, [pathname, router]);

   useEffect(() => {
    if (!authChecked || !user) return;

    // Set the dashboard as the initial tab if no tabs are open.
    const dashboardTab = allMenuItems.find(item => item.id === 'dashboard');
    if (dashboardTab && openTabs.length === 0) {
        setOpenTabs([dashboardTab]);
        setActiveTabId(dashboardTab.id);
    }
  }, [authChecked, user, openTabs.length]);


  useEffect(() => {
    if (!authChecked || !user || UNPROTECTED_ROUTES.includes(pathname)) return;
    
    const currentTabInfo = findTabForPath(pathname);
    
    if (currentTabInfo) {
      // Logic to add the tab if it's not already open
      if (!openTabs.some(tab => tab.id === currentTabInfo.id)) {
        setOpenTabs(prevTabs => [...prevTabs, currentTabInfo]);
      }
      // Always set the active tab, even if it's already open
      setActiveTabId(currentTabInfo.id);
    }
  }, [pathname, authChecked, user]);

  const handleTabClick = (tabId: string) => {
    const tab = openTabs.find(t => t.id === tabId);
    if (tab?.href) {
        setActiveTabId(tabId);
        router.push(tab.href);
    }
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (tabId === 'dashboard') return;

    setOpenTabs(prevTabs => {
        const tabIndex = prevTabs.findIndex(tab => tab.id === tabId);
        const newTabs = prevTabs.filter(tab => tab.id !== tabId);

        if (activeTabId === tabId) {
            const newActiveTab = newTabs[tabIndex - 1] || newTabs[0];
            if (newActiveTab && newActiveTab.href) {
                router.push(newActiveTab.href);
                setActiveTabId(newActiveTab.id);
            }
        }
        return newTabs;
    });
  };

  const handleSidebarItemClick = (item: MenuItem) => {
    if (item.href) {
      if (!openTabs.some(tab => tab.id === item.id)) {
        setOpenTabs([...openTabs, item]);
      }
      setActiveTabId(item.id);
      if (window.innerWidth < 1024) {
          setIsSidebarActive(false);
      } else {
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

  if (!authChecked) {
      return (
          <div className="flex h-screen w-screen items-center justify-center bg-background">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      );
  }
  
  if (!user && !UNPROTECTED_ROUTES.includes(pathname)) {
    // If not authenticated and not on a public route, show loading or nothing while redirecting
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  // If user is on an unprotected route, just render children without the layout
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
