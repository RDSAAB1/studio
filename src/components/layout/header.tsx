
"use client";

import * as React from "react";
import { Settings, UserCircle, Search, Menu } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import TabBar from './tab-bar';
import { MenuItem } from "@/hooks/use-tabs";
import { DynamicIslandToaster } from "../ui/dynamic-island-toaster";

interface HeaderProps {
  openTabs: MenuItem[];
  activeTabId: string;
  onTabClick: (id: string) => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
}

export function Header({ openTabs, activeTabId, onTabClick, onCloseTab }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card px-4 sm:px-6">
        <TabBar 
            openTabs={openTabs}
            activeTabId={activeTabId}
            onTabClick={onTabClick}
            onCloseTab={onCloseTab}
        />

        <div className="absolute left-1/2 -translate-x-1/2">
          <DynamicIslandToaster />
        </div>

        <div className="flex items-center gap-2 ml-auto">
            <div className="relative flex-1 md:grow-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Search..."
                    className="h-9 w-full rounded-full bg-background pl-8 md:w-[180px] lg:w-[250px]"
                />
            </div>
            <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
                <span className="sr-only">Settings</span>
            </Button>
            <Button variant="ghost" size="icon">
                <UserCircle className="h-5 w-5" />
                <span className="sr-only">Profile</span>
            </Button>
        </div>
    </header>
  );
}
