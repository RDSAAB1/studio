
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
  const [activeTabId, setActiveTabId] = useState<string>('dashboard');
  const [openTabs, setOpenTabs] = useState<MenuItem[]>([]);
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
        setActiveTabId(initialTab!.id);
    } else if (openTabs.length === 0) {
        // Fallback to dashboard if no other tab is active
        const dashboard = allMenuItems.find(item => item.id === 'dashboard');
        if (dashboard) {
            setOpenTabs([dashboard]);
            setActiveTabId('dashboard');
            if (pathname !== dashboard.href) {
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
    
    const tabIndex = openTabs.findIndex(tab => tab.id === tabId);
    let newActiveTabId = activeTabId;
    let newPath = '';
    
    if(activeTabId === tabId) {
        if(tabIndex > 0) {
            newActiveTabId = openTabs[tabIndex - 1].id;
            newPath = openTabs[tabIndex - 1].href || '/';
        } else if (openTabs.length > 1) {
            newActiveTabId = openTabs[tabIndex + 1].id;
            newPath = openTabs[tabIndex + 1].href || '/';
        } else {
            // If it's the last tab, navigate to the dashboard or a default page
            const dashboard = allMenuItems.find(item => item.id === 'dashboard');
            if (dashboard) {
                newActiveTabId = dashboard.id;
                newPath = dashboard.href || '/';
                if (!openTabs.some(tab => tab.id === dashboard.id)) {
                  setOpenTabs([dashboard]);
                }
            } else {
               newActiveTabId = ''; 
               newPath = '/';
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

    if (newOpenTabs.length === 0) {
      const dashboard = allMenuItems.find(item => item.id === 'dashboard');
      if (dashboard) {
          setOpenTabs([dashboard]);
          setActiveTabId(dashboard.id);
          router.push(dashboard.href || '/');
      }
    } else {
      setActiveTabId(newActiveTabId);
      if (newPath) {
        router.push(newPath);
      }
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
