
"use client";

import * as React from "react";
import { Settings, UserCircle, Search, Menu } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import TabBar from './tab-bar';
import { MenuItem } from "@/hooks/use-tabs";

interface HeaderProps {
  openTabs: MenuItem[];
  activeTabId: string;
  onTabClick: (id: string) => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
}

export function Header({ openTabs, activeTabId, onTabClick, onCloseTab }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-auto flex-col border-b bg-card">
        <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
            <div className="relative flex-1 md:grow-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                type="search"
                placeholder="Search..."
                className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
                />
            </div>
            <div className="flex items-center gap-2 ml-auto">
                <Button variant="ghost" size="icon">
                    <Settings className="h-5 w-5" />
                    <span className="sr-only">Settings</span>
                </Button>
                <Button variant="ghost" size="icon">
                    <UserCircle className="h-5 w-5" />
                    <span className="sr-only">Profile</span>
                </Button>
            </div>
        </div>
        <TabBar 
            openTabs={openTabs}
            activeTabId={activeTabId}
            onTabClick={onTabClick}
            onCloseTab={onCloseTab}
        />
    </header>
  );
}
