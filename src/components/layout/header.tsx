
"use client";

import * as React from "react";
import {
  Settings as SettingsIcon,
  UserCircle,
  Search
} from "lucide-react";
import { Tab } from "./tab";
import { useTabs } from "@/hooks/use-tabs";
import { Button } from "../ui/button";
import { Menu } from "lucide-react";

interface HeaderProps {
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export function Header({ toggleSidebar, isSidebarOpen }: HeaderProps) {
    const { tabs, activeTab, removeTab, setActiveTab } = useTabs();
  return (
    <header className="sticky top-0 z-20 w-full bg-primary text-primary-foreground">
      <div className="flex h-[61px] items-center px-4 border-b border-primary-foreground/20">
         <button
            onClick={toggleSidebar}
            className="p-2 rounded-full text-primary-foreground hover:bg-primary-foreground/10 focus:outline-none focus:ring-2 focus:ring-primary-foreground transition-colors mr-2 flex-shrink-0"
            aria-label={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            <Menu className="h-5 w-5" />
          </button>
        <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide">
            <div className="flex items-end h-full">
                {tabs.map((tab, index) => {
                    const isNextTabActive = tabs[index + 1] ? tabs[index + 1].path === activeTab : false;
                    return (
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
                            isNextTabActive={isNextTabActive}
                        />
                    );
                })}
            </div>
        </div>

        {/* Right section: Search, Profile Icon, Settings Icon */}
        <div className="flex items-center space-x-2 pl-4 flex-shrink-0">
            <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search..."
                    className="bg-background border border-border text-foreground placeholder:text-muted-foreground rounded-full h-8 w-48 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
            </div>
          <button
            className="p-2 rounded-full hover:bg-primary-foreground/10 focus:outline-none focus:ring-2 focus:ring-primary-foreground transition-colors"
            aria-label="User Profile"
          >
            <UserCircle className="h-5 w-5" />
          </button>
          <button
            className="p-2 rounded-full hover:bg-primary-foreground/10 focus:outline-none focus:ring-2 focus:ring-primary-foreground transition-colors"
            aria-label="Settings"
          >
            <SettingsIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
