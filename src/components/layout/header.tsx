
"use client";

import * as React from "react";
import {
  Settings as SettingsIcon,
  UserCircle,
} from "lucide-react";

interface HeaderProps {
  isSidebarOpen: boolean;
  children: React.ReactNode;
}

export function Header({ isSidebarOpen, children }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full bg-primary text-primary-foreground">
      <div className="flex h-[40px] items-center px-2">
        {/* The tabs will be rendered here as children */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex items-center">
                {children}
            </div>
        </div>

        {/* Right section: Profile Icon, Settings Icon */}
        <div className="flex items-center space-x-1 pl-2">
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
