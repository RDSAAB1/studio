
"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import CustomSidebar from './custom-sidebar';
import { Header } from "./header";
import { DynamicIslandToaster } from "@/components/ui/dynamic-island-toaster";
import { useAuth } from "@/app/layout";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarActive, setIsSidebarActive] = useState(false);
    const { logout } = useAuth();

    const toggleSidebar = () => {
        setIsSidebarActive(prev => !prev);
    };
    
    return (
        <div className={cn("wrapper", isSidebarActive && "active")}>
            <CustomSidebar isSidebarActive={isSidebarActive} toggleSidebar={toggleSidebar} />
            <div className="main_container">
                <Header toggleSidebar={toggleSidebar} onSignOut={logout} />
                <main className="content">{children}</main>
            </div>
            {isSidebarActive && typeof window !== 'undefined' && window.innerWidth < 1024 && (
                <div className="shadow" onClick={toggleSidebar}></div>
            )}
            <DynamicIslandToaster />
        </div>
    )
}
