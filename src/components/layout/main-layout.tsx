"use client";

import React, { useState, useEffect, useRef } from "react";
import { Header } from "./header";
import type { PageLayoutProps } from "@/app/types";
import { usePathname } from "next/navigation";
import CustomSidebar from "./custom-sidebar"; // Import the new custom sidebar

// A simple 'cn' utility similar to shadcn/ui for conditional class merging
function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function MainLayout({ children, pageMeta }: PageLayoutProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const sidebarRef = useRef<HTMLElement>(null);

  // Handle initial sidebar state based on screen size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) { // Tailwind's 'md' breakpoint
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Set initial state
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Handle clicks outside the sidebar to close it on all screen sizes
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isSidebarOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen]);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Custom Sidebar Component */}
      <CustomSidebar
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
        activePath={pathname}
        onLinkClick={(path) => { /* Next.js Link handles navigation */ }}
        setIsSidebarOpen={setIsSidebarOpen}
        sidebarRef={sidebarRef}
      />

      {/* Main content area */}
      <main className={cn(
        "flex-1 transition-all duration-300 ease-in-out p-4 pt-16", // Added pt-16 for header clearance
        isSidebarOpen ? "ml-64" : "ml-20" // Adjust margin based on sidebar state
      )}
      style={{marginTop: 0}}>
        {/* Header will now receive toggleSidebar to show menu button on mobile */}
        <Header pageMeta={pageMeta} toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}