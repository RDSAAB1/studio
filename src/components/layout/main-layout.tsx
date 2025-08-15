
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
        <Header>
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-full text-primary-foreground hover:bg-primary-foreground/10 focus:outline-none focus:ring-2 focus:ring-primary-foreground transition-colors mr-2 flex-shrink-0"
              aria-label={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide">
                <div className="flex items-center h-full">
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
            </div>
        </Header>
        
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
