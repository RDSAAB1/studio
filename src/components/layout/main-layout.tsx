
"use client";

import React, { useState, useEffect, type ReactNode } from "react";
import { usePathname } from 'next/navigation';
import CustomSidebar from "./custom-sidebar";
import { cn } from "@/lib/utils";
import { allMenuItems, type MenuItem } from '@/hooks/use-tabs';
import { Header } from "./header";

type MainLayoutProps = {
    children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [isSidebarActive, setIsSidebarActive] = useState(true);
  const [activeTabId, setActiveTabId] = useState<string>('dashboard');
  const [openTabs, setOpenTabs] = useState<MenuItem[]>([]);
  const pathname = usePathname();

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
        }
    }
  }, []);


  const handleTabClick = (tabId: string) => {
    setActiveTabId(tabId);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const tabIndex = openTabs.findIndex(tab => tab.id === tabId);
    let newActiveTabId = activeTabId;
    
    if(activeTabId === tabId) {
        if(tabIndex > 0) {
            newActiveTabId = openTabs[tabIndex - 1].id;
        } else if (openTabs.length > 1) {
            newActiveTabId = openTabs[tabIndex + 1].id;
        } else {
            // No tabs left, maybe default to dashboard or clear content
            newActiveTabId = ''; 
        }
    }
    
    setOpenTabs(openTabs.filter(tab => tab.id !== tabId));
    setActiveTabId(newActiveTabId);
  };

  const handleSidebarItemClick = (item: MenuItem) => {
    if (!openTabs.some(tab => tab.id === item.id)) {
      setOpenTabs([...openTabs, item]);
    }
    setActiveTabId(item.id);
  };

  const toggleSidebar = () => {
    setIsSidebarActive(!isSidebarActive);
  };

  const activeComponent = openTabs.find(tab => tab.id === activeTabId)?.href === pathname ? children : null;
  
  return (
    <div className={cn("wrapper", isSidebarActive && "active")}>
        <CustomSidebar 
            toggleSidebar={toggleSidebar} 
            onMenuItemClick={handleSidebarItemClick}
        />
        <div className="main_container">
            <Header 
              openTabs={openTabs}
              activeTabId={activeTabId}
              onTabClick={handleTabClick}
              onCloseTab={handleCloseTab}
            />
            {children}
        </div>
    </div>
  );
}
