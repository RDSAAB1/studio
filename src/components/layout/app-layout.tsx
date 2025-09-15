
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
import ConnectGmailPage from "@/app/setup/connect-gmail/page";
import CompanyDetailsPage from "@/app/setup/company-details/page";
import { getCompanySettings, getRtgsSettings } from "@/lib/firestore";

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
    }, [router, pathname, openTabs]);

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
    }, [pathname, openTabs, activeTabId]);
    
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

    return (
       <CustomSidebar onTabSelect={handleOpenTab} isSidebarActive={isSidebarActive} toggleSidebar={toggleSidebar}>
          <div className="flex flex-col flex-grow min-h-0">
              <div className="sticky top-0 z-30 flex-shrink-0">
                <TabBar openTabs={openTabs} activeTabId={activeTabId} setActiveTabId={handleTabSelect} closeTab={handleTabClose} />
                <Header toggleSidebar={toggleSidebar} />
              </div>
              <ScrollArea className="flex-grow">
                <main className="p-4 sm:p-6">
                    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
                        {children}
                    </Suspense>
                </main>
              </ScrollArea>
          </div>
       </CustomSidebar>
    );
};

const AuthWrapper = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [setupState, setSetupState] = useState<'loading' | 'gmail' | 'company' | 'complete'>('loading');
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const auth = getFirebaseAuth();
        getRedirectResult(auth).catch(console.error);

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                try {
                    const gmailSettings = await getCompanySettings(currentUser.uid);
                    if (!gmailSettings?.appPassword) {
                        setSetupState('gmail');
                    } else {
                        const companySettings = await getRtgsSettings();
                        if (!companySettings?.companyName || !companySettings.bankName) {
                            setSetupState('company');
                        } else {
                            setSetupState('complete');
                        }
                    }
                } catch (error) {
                    console.error("Error checking setup status:", error);
                    setSetupState('complete'); // Fallback to complete to avoid setup loop on error
                }
            } else {
                setSetupState('loading'); // No user, so no setup state to check
            }
            setAuthChecked(true); // Mark auth check as complete
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!authChecked) return;

        const isLoginPage = pathname === '/login';
        const isSetupPage = pathname.startsWith('/setup');

        if (!user) {
            if (!isLoginPage) {
                router.replace('/login');
            }
        } else {
            if (setupState === 'gmail' && pathname !== '/setup/connect-gmail') {
                router.replace('/setup/connect-gmail');
            } else if (setupState === 'company' && pathname !== '/setup/company-details') {
                router.replace('/setup/company-details');
            } else if (setupState === 'complete' && (isLoginPage || isSetupPage)) {
                 router.replace('/dashboard-overview');
            }
        }
    }, [user, authChecked, setupState, pathname, router]);

    if (!authChecked || (user && setupState === 'loading')) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!user) {
        return <LoginPage />;
    }

    if (setupState === 'gmail') {
        return <ConnectGmailPage />;
    }

    if (setupState === 'company') {
        return <CompanyDetailsPage />;
    }

    if (setupState === 'complete') {
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
    const isSpecialPage = pathname === '/login' || pathname.startsWith('/setup');
    
    if (isSpecialPage) {
        return <AuthWrapper>{children}</AuthWrapper>;
    }
    
    return (
        <AuthWrapper>
            {children}
        </AuthWrapper>
    );
}
