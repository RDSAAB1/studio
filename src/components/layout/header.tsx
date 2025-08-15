
"use client";

import * as React from "react";
import {
  Settings as SettingsIcon,
  UserCircle,
  Search
} from "lucide-react";
import { Tab } from "./tab";

interface HeaderProps {
  children: React.ReactNode;
}

export function Header({ children }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full bg-primary text-primary-foreground">
      <div className="flex h-[61px] items-center px-4 border-b border-primary-foreground/20">
        {children}

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
