
"use client";

import React, { useState, useEffect, type ReactNode } from "react";
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

const PROTECTED_ROUTES = ['/login', '/connect-gmail', '/setup/company-details'];

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
        if (!companySettings?.appPassword && pathname !== '/connect-gmail') {
          router.replace('/connect-gmail');
        } else if (companySettings?.appPassword) {
          const rtgsSettings = await getRtgsSettings();
          if (!rtgsSettings && pathname !== '/setup/company-details' && pathname !== '/connect-gmail') {
             router.replace('/setup/company-details');
          } else if (rtgsSettings && (pathname === '/setup/company-details' || pathname === '/connect-gmail')) {
             router.replace('/sales/dashboard-overview');
          }
        }
      } else {
        setUser(null);
        if (!PROTECTED_ROUTES.includes(pathname) && pathname !== '/login') {
          router.replace('/login');
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [pathname, router]);

  useEffect(() => {
    if (loading || !user || PROTECTED_ROUTES.includes(pathname)) return;

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
        if (!openTabs.some(tab => tab.id === initialTab!.id)) {
            setOpenTabs(prev => [...prev, initialTab!]);
        }
        setActiveTabId(initialTab.id);
    } else if (openTabs.length === 0) {
        const dashboard = allMenuItems.find(item => item.id === 'dashboard');
        if (dashboard) {
            setOpenTabs([dashboard]);
            setActiveTabId(dashboard.id);
             if (pathname === '/') {
                router.replace(dashboard.href || '/');
            }
        }
    }
}, [user, loading, pathname, router, openTabs]);


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

  const handleSignOut = async () => {
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
      setOpenTabs([]); // Clear tabs on sign out
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
  
  if (!user || PROTECTED_ROUTES.includes(pathname)) {
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
              user={user}
              onSignOut={handleSignOut}
            />
            <div className="content">
                {children}
            </div>
            {isSidebarActive && <div className="shadow" onClick={toggleSidebar}></div>}
        </div>
    </div>
  );
}
