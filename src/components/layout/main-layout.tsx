
"use client";

import React, { useState, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from 'next/navigation';
import CustomSidebar from "./custom-sidebar";
import { cn } from "@/lib/utils";
import { allMenuItems, type MenuItem } from '@/hooks/use-tabs';
import { Header } from "./header";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { getCompanySettings } from "@/lib/firestore";
import { Loader2 } from "lucide-react";

type MainLayoutProps = {
    children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [isSidebarActive, setIsSidebarActive] = useState(false);
  const [openTabs, setOpenTabs] = useState<MenuItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Start with loading true

  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    if (user) {
        // We are on a page that doesn't require auth check (e.g., connect-gmail)
        if (pathname === '/login') {
            router.replace('/sales/dashboard-overview'); // Default redirect
            return;
        }

        const checkSettingsAndRedirect = async () => {
             // If we are on the root or login page, we need to decide where to go.
            if (pathname === '/' || pathname === '/login') {
                const settings = await getCompanySettings(user.uid);
                if (!settings?.appPassword) {
                    router.replace('/connect-gmail');
                } else {
                    router.replace('/sales/dashboard-overview');
                }
            }
        };

        checkSettingsAndRedirect();
        
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
        } else if (openTabs.length === 0 && pathname !== '/connect-gmail') {
            // Default to dashboard if no specific tab is matched
            const dashboard = allMenuItems.find(item => item.id === 'dashboard');
            if (dashboard) {
                setOpenTabs([dashboard]);
                setActiveTabId(dashboard.id);
            }
        }
    } else {
      // If not logged in, redirect to login page if not already there.
      if (pathname !== '/login') {
        router.replace('/login');
      }
    }
}, [user, loading, pathname, router]);


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
  
  if (!user && pathname !== '/login') {
    return null; // Don't render layout if not logged in and not on login page
  }
  
  if (pathname === '/login' || pathname === '/connect-gmail') {
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
