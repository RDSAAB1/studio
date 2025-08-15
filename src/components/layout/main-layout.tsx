
"use client";

import React, { useState, useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import CustomSidebar from "./custom-sidebar";
import { Header } from "./header";
import type { PageMeta } from "@/app/types";
import { useTabs, allMenuItems } from "@/hooks/use-tabs";
import { Tab } from "./tab";
import { Menu } from "lucide-react";

// A simple 'cn' utility similar to shadcn/ui for conditional class merging
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

type MainLayoutProps = {
    children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const sidebarRef = useRef<HTMLElement>(null);
  const [isClient, setIsClient] = useState(false);
  
  const { tabs, activeTab, addTab, removeTab, setActiveTab } = useTabs();
  const [tabContent, setTabContent] = useState<Map<string, ReactNode>>(new Map());
  
  useEffect(() => {
    setIsClient(true);
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    
    const handleClickOutside = (event: MouseEvent) => {
      if (window.innerWidth < 1024 && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        // Add a check to not close if the menu button is clicked
        if ((event.target as HTMLElement).closest('[aria-label*="Sidebar"]')) {
          return;
        }
        setIsSidebarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
  
  return (
    <div className="relative flex min-h-screen bg-primary">
       <CustomSidebar
        isSidebarOpen={isClient ? isSidebarOpen : true}
        toggleSidebar={toggleSidebar}
        activePath={pathname}
        onLinkClick={handleLinkClick}
        setIsSidebarOpen={setIsSidebarOpen}
        sidebarRef={sidebarRef}
      />

      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300 ease-in-out",
        (isClient && isSidebarOpen) ? "lg:ml-64" : "lg:ml-20" 
      )}
      >
        <Header toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
        
        <main className="flex-1 bg-background relative rounded-tl-lg">
             {tabs.map(tab => (
                <div
                  key={tab.id}
                  style={{ display: activeTab === tab.path ? 'block' : 'none' }}
                  className="h-full w-full p-4 sm:p-6 lg:p-8"
                >
                  {tab.path === pathname ? children : tabContent.get(tab.path)}
                </div>
            ))}
        </main>
      </div>
    </div>
  );
}
