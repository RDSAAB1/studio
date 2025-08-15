
"use client";

import React, { useState, useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import CustomSidebar from "./custom-sidebar";
import { Header } from "./header";
import type { PageMeta } from "@/app/types";
import { useTabs, allMenuItems } from "@/hooks/use-tabs";
import { Tab } from "./tab";

// A simple 'cn' utility similar to shadcn/ui for conditional class merging
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

type MainLayoutProps = {
    children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  
  const { tabs, activeTab, addTab, removeTab, setActiveTab } = useTabs();
  const [tabContent, setTabContent] = useState<Map<string, ReactNode>>(new Map());

  // This effect runs only on the client
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    handleResize(); // Set initial state
    window.addEventListener('resize', handleResize);
    
    const handleClickOutside = (event: MouseEvent) => {
      if (window.innerWidth < 1024 && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setIsSidebarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Effect to add a new tab when the path changes, if it's not already open.
  useEffect(() => {
    if (pathname) {
      addTab(pathname);
    }
  }, [pathname, addTab]);

  useEffect(() => {
    if (pathname && children) {
      setTabContent(prev => new Map(prev).set(pathname, children));
    }
  }, [pathname, children]);


  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleLinkClick = (path: string) => {
    addTab(path);
    setActiveTab(path);
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const activeTabContent = tabContent.get(activeTab);
  
  return (
    <div className="relative flex min-h-screen">
      {/* Custom Sidebar Component */}
      <CustomSidebar
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
        activePath={pathname}
        onLinkClick={handleLinkClick}
        setIsSidebarOpen={setIsSidebarOpen}
        sidebarRef={sidebarRef}
      />

      {/* Main content area */}
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300 ease-in-out",
        isSidebarOpen ? "lg:ml-64" : "lg:ml-20" 
      )}
      >
        <Header isSidebarOpen={isSidebarOpen} />
        <div className="flex-1 flex flex-col">
            <div className="flex">
                {tabs.map(tab => (
                    <Tab 
                        key={tab.id}
                        icon={tab.icon}
                        title={tab.title}
                        path={tab.path}
                        isActive={activeTab === tab.path}
                        onClick={() => setActiveTab(tab.path)}
                        onClose={(e) => {
                            e.stopPropagation();
                            removeTab(tab.path);
                        }}
                    />
                ))}
            </div>
            <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-muted/30 relative">
                 {tabs.map(tab => (
                    <div
                      key={tab.id}
                      style={{ display: activeTab === tab.path ? 'block' : 'none' }}
                      className="h-full w-full"
                    >
                      {tab.path === activeTab ? children : tabContent.get(tab.path)}
                    </div>
                ))}
            </main>
        </div>
      </div>
    </div>
  );
}
