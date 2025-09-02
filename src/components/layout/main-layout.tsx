
"use client";

import React, { useState, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from 'next/navigation';
import CustomSidebar from "./custom-sidebar";
import { cn } from "@/lib/utils";
import { allMenuItems, type MenuItem } from '@/hooks/use-tabs';
import { Header } from "./header";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

type MainLayoutProps = {
    children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [isSidebarActive, setIsSidebarActive] = useState(false);
  const [openTabs, setOpenTabs] = useState<MenuItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        if (pathname === '/login' || pathname === '/') {
          router.replace('/sales/dashboard-overview');
        }
      } else {
        router.replace('/login');
      }
    });
    return () => unsubscribe();
  }, [router, pathname]);
  
  useEffect(() => {
    if (loading) return;
    
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
    } else if (user) {
        const dashboard = allMenuItems.find(item => item.id === 'dashboard');
        if (dashboard) {
            setActiveTabId(dashboard.id);
        }
    }
  }, [pathname, user, loading, openTabs]);

  useEffect(() => {
    if (user && openTabs.length === 0) {
        const dashboard = allMenuItems.find(item => item.id === 'dashboard');
        if (dashboard) {
            setOpenTabs([dashboard]);
            setActiveTabId(dashboard.id); // Set initial active tab
        }
    }
  }, [user, openTabs]);

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
      await signOut(auth);
      // The onAuthStateChanged listener will handle the redirect to /login
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
      return (
          <div className="flex h-screen w-screen items-center justify-center bg-background">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      );
  }

  if (!user && pathname === '/login') {
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
