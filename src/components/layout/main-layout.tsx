
"use client";

import React, { useState, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from 'next/navigation';
import CustomSidebar from "./custom-sidebar";
import { cn } from "@/lib/utils";
import { allMenuItems, type MenuItem } from '@/hooks/use-tabs';
import { Header } from "./header";

type MainLayoutProps = {
    children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [isSidebarActive, setIsSidebarActive] = useState(false); // Default to collapsed

  const getInitialDashboardTab = (): MenuItem[] => {
    const dashboard = allMenuItems.find(item => item.id === 'dashboard');
    return dashboard ? [dashboard] : [];
  };

  const [openTabs, setOpenTabs] = useState<MenuItem[]>(getInitialDashboardTab);
  const [activeTabId, setActiveTabId] = useState<string>('dashboard');

  const pathname = usePathname();
  const router = useRouter();


  useEffect(() => {
    // Find the initial active tab based on the current path
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

    if (initialTab && !openTabs.some(tab => tab.id === initialTab!.id)) {
        setOpenTabs(prev => [...prev, initialTab!]);
    }
    
    if (initialTab) {
        setActiveTabId(initialTab.id);
    } else {
        const dashboard = allMenuItems.find(item => item.id === 'dashboard');
        if (dashboard) {
            setActiveTabId(dashboard.id);
            if(pathname !== dashboard.href) {
                router.push(dashboard.href || '/');
            }
        }
    }
  }, []);


  const handleTabClick = (tabId: string) => {
    setActiveTabId(tabId);
    const tab = openTabs.find(t => t.id === tabId);
    if(tab?.href) {
        router.push(tab.href);
    }
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Prevent closing the dashboard tab
    if (tabId === 'dashboard') {
        return;
    }

    const tabIndex = openTabs.findIndex(tab => tab.id === tabId);
    let newActiveTabId = activeTabId;
    let newPath = '';
    
    if(activeTabId === tabId) {
        if(tabIndex > 0) {
            newActiveTabId = openTabs[tabIndex - 1].id;
            newPath = openTabs[tabIndex - 1].href || '/';
        } else if (openTabs.length > 1) {
            // This case should not be hit if dashboard is first and non-closable
            newActiveTabId = openTabs[tabIndex + 1].id;
            newPath = openTabs[tabIndex + 1].href || '/';
        } else {
            // Fallback to dashboard
            const dashboard = allMenuItems.find(item => item.id === 'dashboard');
            if (dashboard) {
                newActiveTabId = dashboard.id;
                newPath = dashboard.href || '/';
            }
        }
    } else {
        const currentActiveTab = openTabs.find(tab => tab.id === activeTabId);
        if (currentActiveTab) {
            newPath = currentActiveTab.href || '/';
        }
    }
    
    const newOpenTabs = openTabs.filter(tab => tab.id !== tabId);
    setOpenTabs(newOpenTabs);
    setActiveTabId(newActiveTabId);
    if (newPath) {
        router.push(newPath);
    }
  };

  const handleSidebarItemClick = (item: MenuItem) => {
    if (item.href) {
      if (!openTabs.some(tab => tab.id === item.id)) {
        setOpenTabs([...openTabs, item]);
      }
      setActiveTabId(item.id);
      // Optional: auto-collapse sidebar on item click
      // setIsSidebarActive(false); 
    }
  };
  
  const toggleSidebar = () => {
    setIsSidebarActive(!isSidebarActive);
  };
  
  return (
    <div 
        className={cn("wrapper", isSidebarActive && "active")}
    >
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
            />
            <div className="content">
                {children}
            </div>
        </div>
    </div>
  );
}
