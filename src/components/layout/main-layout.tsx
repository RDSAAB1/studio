
"use client";

import React, { useState, useEffect, type ReactNode } from "react";
import { usePathname } from 'next/navigation';
import CustomSidebar from "./custom-sidebar";
import { cn } from "@/lib/utils";

type MainLayoutProps = {
    children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [isSidebarActive, setIsSidebarActive] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarActive(!isSidebarActive);
  };
  
  return (
    <div className={cn("wrapper", isSidebarActive && "active")}>
        <CustomSidebar toggleSidebar={toggleSidebar} />
        <div className="main_container">
            {children}
        </div>
    </div>
  );
}
