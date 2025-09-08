
"use client";

import React, { useState, useEffect, type ReactNode, useCallback } from "react";
import { usePathname, useRouter } from 'next/navigation';
import CustomSidebar from "./custom-sidebar";
import { cn } from "@/lib/utils";
import { type MenuItem } from '@/hooks/use-tabs';
import { Header } from "./header";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { getCompanySettings, getRtgsSettings } from "@/lib/firestore";
import { Loader2 } from "lucide-react";

type MainLayoutProps = {
    children: ReactNode;
}

const UNPROTECTED_ROUTES = ['/login', '/setup/connect-gmail', '/setup/company-details'];

export default function MainLayout({ children }: MainLayoutProps) {
  const [isSidebarActive, setIsSidebarActive] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setLoading(true);
        if (currentUser) {
            setUser(currentUser);
            const companySettings = await getCompanySettings(currentUser.uid);
            const rtgsSettings = await getRtgsSettings();

            if (!companySettings || !companySettings.appPassword) {
                if (pathname !== '/setup/connect-gmail') router.replace('/setup/connect-gmail');
            } else if (!rtgsSettings) {
                if (pathname !== '/setup/company-details') router.replace('/setup/company-details');
            } else if (UNPROTECTED_ROUTES.includes(pathname) || pathname === '/') {
                 router.replace('/dashboard-overview');
            }
        } else {
            setUser(null);
            if (!UNPROTECTED_ROUTES.includes(pathname)) {
                router.replace('/login');
            }
        }
        setLoading(false);
    });
    return () => unsubscribe();
  }, [pathname, router]);

  const handleMenuItemClick = useCallback((item: MenuItem) => {
    if (!item.href) return;
    if (window.innerWidth < 1024) {
        setIsSidebarActive(false);
    }
  }, []);

  const toggleSidebar = () => setIsSidebarActive(!isSidebarActive);

  const handleSignOut = async () => {
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
      router.replace('/login');
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  if (loading) {
      return (
          <div className="flex h-screen w-screen items-center justify-center bg-background">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      );
  }
  
  if (!user && !UNPROTECTED_ROUTES.includes(pathname)) {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  if (UNPROTECTED_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }
  
  return (
    <div className={cn("wrapper", isSidebarActive && "active")}>
        <div onMouseEnter={() => setIsSidebarActive(true)} onMouseLeave={() => setIsSidebarActive(false)}>
            <CustomSidebar 
                isSidebarActive={isSidebarActive}
                onMenuItemClick={handleMenuItemClick}
            />
        </div>
        <div 
            className="main_container"
        >
            <Header 
              toggleSidebar={toggleSidebar}
              user={user}
              onSignOut={handleSignOut}
            />
            <main className="content">
                 {children}
            </main>
            {isSidebarActive && window.innerWidth < 1024 && <div className="shadow" onClick={toggleSidebar}></div>}
        </div>
    </div>
  );
}
