
"use client";

import * as React from "react";
import { Settings, UserCircle, Search, Menu, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import TabBar from './tab-bar';
import { MenuItem } from "@/hooks/use-tabs";
import { cn } from "@/lib/utils";
import { DynamicIslandToaster } from "../ui/dynamic-island-toaster";
import { useToast } from "@/hooks/use-toast";

interface HeaderProps {
  openTabs: MenuItem[];
  activeTabId: string;
  onTabClick: (id: string) => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
  toggleSidebar: () => void;
}

export function Header({ openTabs, activeTabId, onTabClick, onCloseTab, toggleSidebar }: HeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const { toasts } = useToast();
  const hasToasts = toasts.length > 0;

  return (
    <header className="sticky top-0 z-30 flex flex-col bg-card">
      {/* Top bar for tabs */}
      <div className="flex h-10 items-center px-4 sm:px-6 border-b border-border">
        <TabBar 
          openTabs={openTabs}
          activeTabId={activeTabId}
          onTabClick={onTabClick}
          onCloseTab={onCloseTab}
        />
      </div>

      {/* Bottom bar for actions and search */}
      <div className="flex h-10 items-center justify-between gap-4 bg-background px-4 sm:px-6">
        <div className="flex items-center gap-2">
            <div className="flex-shrink-0 md:hidden">
            <Button variant="ghost" size="icon" onClick={toggleSidebar}>
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
            </Button>
            </div>
            {isSearchOpen && (
                 <div className="relative md:hidden w-full">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search..."
                        className="h-8 w-full rounded-full bg-muted pl-8"
                        autoFocus
                    />
                     <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setIsSearchOpen(false)}>
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close search</span>
                    </Button>
                </div>
            )}
        </div>

        <div className="absolute left-1/2 top-[calc(2.5rem+0.25rem)] -translate-x-1/2">
             <DynamicIslandToaster />
        </div>
        
        <div className={cn("flex flex-1 items-center justify-end gap-2", isSearchOpen && "hidden")}>
            <div className={cn(
              "relative hidden flex-1 md:flex md:grow-0 max-w-xs transition-opacity",
              hasToasts && "opacity-0 pointer-events-none"
            )}>
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Search..."
                    className="h-8 w-full rounded-full bg-muted pl-8 md:w-[180px] lg:w-[250px]"
                />
            </div>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsSearchOpen(true)}>
              <Search className="h-5 w-5" />
              <span className="sr-only">Search</span>
            </Button>
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
    </header>
  );
}
