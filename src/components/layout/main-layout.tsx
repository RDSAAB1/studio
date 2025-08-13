
"use client";

import React, { useState, useEffect, useRef } from "react";
import type { PageLayoutProps } from "@/app/types";
import { usePathname } from "next/navigation";
import CustomSidebar from "./custom-sidebar";
import { Header } from "./header";

// A simple 'cn' utility similar to shadcn/ui for conditional class merging
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

export default function MainLayout({ children, pageMeta }: PageLayoutProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default to open to avoid hydration mismatch
  const sidebarRef = useRef(null);

  // Handle initial sidebar state based on screen size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(false);
      }
    };
    handleResize(); // Set initial state on client mount
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Handle clicks outside the sidebar to close it on small screens
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isSidebarOpen && window.innerWidth < 1024 && sidebarRef.current && !(sidebarRef.current as any).contains(event.target)) {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen]);
  
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
        "flex-1 flex flex-col transition-all duration-300 ease-in-out",
        isSidebarOpen ? "lg:ml-64" : "lg:ml-20" // Adjust margin based on desktop sidebar state
      )}
      >
        <Header pageMeta={pageMeta} toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
            {children}
        </main>
      </div>
    </div>
  );
}
