
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

// Helper to find a menu item by its href
const findMenuItemByHref = (href: string): MenuItem | undefined => {
    for (const item of allMenuItems) {
        if (item.href === href) return item;
        if (item.subMenus) {
            const subMenuItem = item.subMenus.find(sub => sub.href === href);
            if (subMenuItem) return subMenuItem;
        }
    }
    return undefined;
};


export default function MainLayout({ children }: MainLayoutProps) {
  const [isSidebarActive, setIsSidebarActive] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // State for tab management
  const [openTabs, setOpenTabs] = useState<MenuItem[]>([allMenuItems[0]]);
  const [activeTabId, setActiveTabId] = useState<string>(allMenuItems[0].id);
  const [pageContent, setPageContent] = useState<React.ReactNode>(children);
  const [cachedPages, setCachedPages] = useState<{[key: string]: React.ReactNode}>({});
  
  const pathname = usePathname();
  const router = useRouter();
  
  useEffect(() => {
    setCachedPages(prev => ({...prev, [pathname]: children}));
    setPageContent(children);
  }, [children, pathname]);

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

  const handleMenuItemClick = useCallback((item: MenuItem) => {
    if (!item.href) return;
    
    // Check if the tab is already open
    if (!openTabs.find(tab => tab.id === item.id)) {
        setOpenTabs(prevTabs => [...prevTabs, item]);
    }
    setActiveTabId(item.id);

    if (window.innerWidth < 1024) {
        setIsSidebarActive(false);
    }
  }, [openTabs]);

  const handleTabClick = (tabId: string) => {
      const tab = openTabs.find(t => t.id === tabId);
      if (tab?.href) {
          setActiveTabId(tabId);
          router.push(tab.href);
      }
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the tab click from firing
    const tabIndex = openTabs.findIndex(tab => tab.id === tabId);
    
    // Prevent closing the last tab
    if (openTabs.length === 1) return;

    // Remove the tab
    const newTabs = openTabs.filter(tab => tab.id !== tabId);
    setOpenTabs(newTabs);

    // If the closed tab was the active one, switch to another tab
    if (activeTabId === tabId) {
        const newActiveTab = tabIndex > 0 ? newTabs[tabIndex - 1] : newTabs[0];
        setActiveTabId(newActiveTab.id);
        router.push(newActiveTab.href || '/');
    }
  };
  
    // Effect to sync active tab with the current route
    useEffect(() => {
        const currentItem = findMenuItemByHref(pathname);
        if (currentItem) {
            // Check if tab is not already open, then add it
            if (!openTabs.some(tab => tab.id === currentItem.id)) {
                setOpenTabs(prev => [...prev, currentItem]);
            }
            setActiveTabId(currentItem.id);
        }
    }, [pathname, openTabs]);


  const toggleSidebar = () => setIsSidebarActive(!isSidebarActive);

  const handleSignOut = async () => {
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
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
        <div onMouseEnter={() => setIsSidebarActive(true)} onMouseLeave={() => setIsSidebarActive(false)}>
            <CustomSidebar 
                isSidebarActive={isSidebarActive}
                onMenuItemClick={handleMenuItemClick}
            />
        </div>
        <div className="main_container">
            <Header 
              toggleSidebar={toggleSidebar}
              user={user}
              onSignOut={handleSignOut}
              openTabs={openTabs}
              activeTabId={activeTabId}
              onTabClick={handleTabClick}
              onCloseTab={handleCloseTab}
            />
            <main className="content">
                 {openTabs.map(tab => (
                    <div key={tab.id} style={{ display: tab.id === activeTabId ? 'block' : 'none' }}>
                        {cachedPages[tab.href || '']}
                    </div>
                ))}
            </main>
            {isSidebarActive && window.innerWidth < 1024 && <div className="shadow" onClick={toggleSidebar}></div>}
        </div>
    </div>
  );
}
