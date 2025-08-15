
"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { PageMeta } from "@/app/types";
import {
  Settings as SettingsIcon,
  UserCircle,
} from "lucide-react";
import { allMenuItems } from "@/hooks/use-tabs";

interface HeaderProps {
  isSidebarOpen: boolean;
}

export function Header({ isSidebarOpen }: HeaderProps) {
  const pathname = usePathname();

  // Determine current page details based on pathname from the consolidated menuItems
  const currentPage =
    allMenuItems.flatMap(m => m.subMenus || [m]).find(s => pathname.startsWith(s.href || '###')) ||
    allMenuItems.find(m => pathname.startsWith(m.href || '###'));

  return (
    <header className="sticky top-0 z-30 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-4">
        {/* Left section is now empty to make space for tabs */}
        <div className="flex items-center space-x-4">
        </div>

        {/* Right section: Profile Icon, Settings Icon */}
        <div className="flex items-center space-x-2">
          {/* Profile Icon */}
          <button
            className="p-2 rounded-full hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            aria-label="User Profile"
          >
            <UserCircle className="h-6 w-6" />
          </button>

          {/* Settings Icon */}
          <button
            className="p-2 rounded-full hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            aria-label="Settings"
          >
            <SettingsIcon className="h-6 w-6" />
          </button>
        </div>
      </div>
    </header>
  );
}
