
"use client";

import React, { useState, useEffect, useRef } from "react";
import type { PageLayoutProps } from "@/app/types";
import { usePathname } from "next/navigation";
import CustomSidebar from "./custom-sidebar";

// A simple 'cn' utility similar to shadcn/ui for conditional class merging
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

export default function MainLayout({ children, pageMeta, pathname, isSidebarOpen, toggleSidebar, setIsSidebarOpen, sidebarRef }: any) {
  
  return (
    <div className="relative flex min-h-screen">
      {/* Custom Sidebar Component */}
      <CustomSidebar
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
        activePath={pathname}
        onLinkClick={() => { /* Next.js Link handles navigation */ }}
        setIsSidebarOpen={setIsSidebarOpen}
        sidebarRef={sidebarRef}
      />

      {/* Main content area */}
      <div className={cn(
        "flex-1 transition-all duration-300 ease-in-out",
        isSidebarOpen ? "lg:ml-64" : "lg:ml-20" // Adjust margin based on desktop sidebar state
      )}
      >
        {children}
      </div>
    </div>
  );
}
