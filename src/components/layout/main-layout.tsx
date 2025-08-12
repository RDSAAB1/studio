"use client";

import React, { useState, useEffect, useRef } from "react";
import { Header } from "./header";
import type { PageLayoutProps } from "@/app/types";
import { usePathname } from "next/navigation";
import CustomSidebar from "./custom-sidebar";

// A simple 'cn' utility similar to shadcn/ui for conditional class merging
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

export default function MainLayout({ children, pageMeta, pathname, isSidebarOpen, toggleSidebar, setIsSidebarOpen, sidebarRef }: any) {
  
  return (
    <div className="relative flex min-h-screen bg-gray-100">
      {/* Custom Sidebar Component */}
      <CustomSidebar
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
        activePath={pathname}
        onLinkClick={() => { /* Next.js Link handles navigation */ }}
        setIsSidebarOpen={setIsSidebarOpen}
        sidebarRef={sidebarRef}
      />

      {/* Header fixed at the top */}
      <header
        className={cn(
          "fixed top-0 right-0 z-30 h-14 flex items-center shadow-md",
          "bg-[--sidebar-bg] text-[--sidebar-text]",
          "transition-all duration-300 ease-in-out"
        )}
        style={{ width: isSidebarOpen ? 'calc(100% - 256px)' : 'calc(100% - 80px)' }}
      >
        <Header pageMeta={pageMeta} toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      </header>

      {/* Main content area */}
      <div className={cn(
        "flex-1 transition-all duration-300 ease-in-out",
        "mt-14", // Margin top equal to header height (h-14)
        isSidebarOpen ? "ml-[256px]" : "ml-[80px]" // Margin left based on sidebar width
      )}
      >
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}