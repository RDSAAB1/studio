
"use client";

import React, { useState, useEffect, type ReactNode, Suspense } from "react";
import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getFirebaseAuth, onAuthStateChanged, getRedirectResult, type User } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import CustomSidebar from './custom-sidebar';
import { Header } from "./header";
import { allMenuItems, type MenuItem } from "@/hooks/use-tabs";
import TabBar from './tab-bar';
import { ScrollArea } from "../ui/scroll-area";
import LoginPage from "@/app/login/page";
import { getCompanySettings, getRtgsSettings } from "@/lib/firestore";
import { cn } from "@/lib/utils";

const AppContent = ({ children }: { children: ReactNode }) => {
    const [openTabs, setOpenTabs] = useState<MenuItem[]>([]);
    const [activeTabId, setActiveTabId] = useState<string>('dashboard-overview');
    const [isSidebarActive, setIsSidebarActive] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

     useEffect(() => {
        const dashboardTab = allMenuItems.find(item => item.id === 'dashboard-overview');
        if (dashboardTab && openTabs.length === 0) {
            setOpenTabs([dashboardTab]);
            if(pathname === '/'){
               router.push('/dashboard-overview');
            }
        }
    }, []);

    useEffect(() => {
        const currentPathId = pathname.substring(1);
        if (currentPathId && currentPathId !== activeTabId) {
            const menuItem = allMenuItems.flatMap(i => i.subMenus ? i.subMenus : i).find(item => item.id === currentPathId);
            if(menuItem) {
                 if (!openTabs.some(tab => tab.id === currentPathId)) {
                     setOpenTabs(prev => [...prev, menuItem]);
                 }
                 setActiveTabId(currentPathId);
            }
        }
    }, [pathname]);
    
    const handleTabSelect = (tabId: string) => {
        setActiveTabId(tabId);
        router.push(`/${tabId}`);
    };

    const handleTabClose = (tabIdToClose: string) => {
        if (tabIdToClose === 'dashboard-overview') return;

        const tabIndex = openTabs.findIndex(tab => tab.id === tabIdToClose);
        const newTabs = openTabs.filter(tab => tab.id !== tabIdToClose);
        
        setOpenTabs(newTabs);

        if (activeTabId === tabIdToClose) {
            const newActiveTab = newTabs[tabIndex - 1] || newTabs[0];
            if (newActiveTab) {
                setActiveTabId(newActiveTab.id);
                router.push(`/${newActiveTab.id}`);
            } else {
                const dashboardTab = allMenuItems.find(item => item.id === 'dashboard-overview');
                if (dashboardTab) {
                    setOpenTabs([dashboardTab]);
                    setActiveTabId(dashboardTab.id);
                    router.push(`/${dashboardTab.id}`);
                }
            }
        }
    };
    
    const handleOpenTab = (menuItem: MenuItem) => {
        const isAlreadyOpen = openTabs.some(tab => tab.id === menuItem.id);
        if (!isAlreadyOpen) {
            setOpenTabs(prev => [...prev, menuItem]);
        }
        setActiveTabId(menuItem.id);
        router.push(`/${menuItem.id}`);
    };

    const toggleSidebar = () => {
        setIsSidebarActive(prev => !prev);
    };
    
    const pageId = pathname.substring(1);
    const ActivePageComponent = children;

    return (
       <CustomSidebar onTabSelect={handleOpenTab} isSidebarActive={isSidebarActive} toggleSidebar={toggleSidebar}>
          <div className="flex flex-col flex-grow min-h-0">
            <Suspense>
              <div className="sticky top-0 z-30 flex-shrink-0">
                <TabBar openTabs={openTabs} activeTabId={activeTabId} setActiveTabId={handleTabSelect} closeTab={handleTabClose} />
                <Header toggleSidebar={toggleSidebar} />
              </div>
            </Suspense>
              <div className="flex-grow relative">
                {openTabs.map(tab => {
                  const isTabActive = tab.id === pageId;
                  return (
                    <div
                      key={tab.id}
                      className={cn("absolute inset-0 overflow-y-auto", isTabActive ? "z-10" : "z-0 invisible")}
                    >
                      {isTabActive && (
                        <main className="p-4 sm:p-6">
                            <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
                                {ActivePageComponent}
                            </Suspense>
                        </main>
                      )}
                    </div>
                  );
                })}
              </div>
          </div>
       </CustomSidebar>
    );
};

const AuthWrapper = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const auth = getFirebaseAuth();
        getRedirectResult(auth).catch(console.error);

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // Check global setup status, not per-user
                const companySettings = await getRtgsSettings();
                if (!companySettings?.companyName) {
                    setIsSetupComplete(false);
                } else {
                    setIsSetupComplete(true);
                }
            } else {
                setIsSetupComplete(null); // No user, no setup status
            }
            setAuthChecked(true); // Mark auth check as complete
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!authChecked) return;

        const isLoginPage = pathname === '/login';
        const isSettingsPage = pathname === '/settings';

        if (!user) {
            // If no user is logged in, redirect to the login page
            if (!isLoginPage) {
                router.replace('/login');
            }
        } else {
            // If user is logged in
            if (isSetupComplete === false) {
                 // If setup is not complete, force redirect to settings page
                if (!isSettingsPage) {
                    router.replace('/settings');
                }
            } else if (isSetupComplete === true) {
                // If setup is complete and user is on login page, redirect to dashboard
                if (isLoginPage) {
                    router.replace('/dashboard-overview');
                }
            }
            // If setup status is still loading, do nothing and wait.
        }
    }, [user, authChecked, isSetupComplete, pathname, router]);

    // Show a global loader while auth state or setup state is being determined
    if (!authChecked || (user && isSetupComplete === null)) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    // If not logged in, render the login page
    if (!user) {
        return <LoginPage />;
    }

    // If setup is incomplete, render the settings page for the initial admin to fill it out
    if (isSetupComplete === false) {
        return <AppContent>{children}</AppContent>; // Allow rendering settings page
    }

    // If setup is complete, render the full app
    if (isSetupComplete === true) {
        return <AppContent>{children}</AppContent>;
    }

    // Fallback loading state
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
};


export default function AppLayoutWrapper({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const isLoginPage = pathname === '/login' || pathname === '/forgot-password';
    
    if (isLoginPage) {
        return <AuthWrapper>{children}</AuthWrapper>;
    }
    
    return (
        <AuthWrapper>
            {children}
        </AuthWrapper>
    );
}
