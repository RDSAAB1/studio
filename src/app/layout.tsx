
"use client";

import React, { useState, useEffect, type ReactNode, createContext, useContext, useCallback } from "react";
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Inter, Space_Grotesk, Source_Code_Pro } from 'next/font/google';
import './globals.css';
import CustomSidebar from '@/components/layout/custom-sidebar';
import { Header } from "@/components/layout/header";
import TabBar from "@/components/layout/tab-bar";
import { cn } from "@/lib/utils";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import { allMenuItems, type MenuItem } from '@/hooks/use-tabs';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
});

const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-source-code-pro',
});

const UNPROTECTED_ROUTES = ['/login', '/setup/connect-gmail', '/setup/company-details'];

// --- Tab Context ---
interface TabContextType {
  openTabs: MenuItem[];
  activeTabId: string;
  openTab: (menuItem: MenuItem) => void;
  closeTab: (tabId: string) => void;
  setActiveTabId: (tabId: string) => void;
}

const TabContext = createContext<TabContextType | null>(null);

export const useTabs = () => {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('useTabs must be used within a TabProvider');
  }
  return context;
};

const TabProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [openTabs, setOpenTabs] = useState<MenuItem[]>([allMenuItems[0]]); // Start with dashboard
  const [activeTabId, setActiveTabId] = useState<string>(allMenuItems[0].id);
  const [pages, setPages] = useState<{ [key: string]: ReactNode }>({ [allMenuItems[0].id]: children });

  const openTab = useCallback((menuItem: MenuItem) => {
    setOpenTabs(prevTabs => {
      if (prevTabs.some(tab => tab.id === menuItem.id)) {
        return prevTabs;
      }
      return [...prevTabs, menuItem];
    });
    setActiveTabId(menuItem.id);
  }, []);

  const closeTab = useCallback((tabId: string) => {
    if (tabId === 'dashboard') return; // Cannot close dashboard

    setOpenTabs(prevTabs => {
      const tabIndex = prevTabs.findIndex(tab => tab.id === tabId);
      if (tabIndex === -1) return prevTabs;

      const newTabs = prevTabs.filter(tab => tab.id !== tabId);
      
      if (activeTabId === tabId) {
        const nextTab = newTabs[tabIndex] || newTabs[tabIndex - 1] || newTabs[0];
        if (nextTab && nextTab.href) {
            setActiveTabId(nextTab.id);
            router.push(nextTab.href);
        }
      }
      return newTabs;
    });
     setPages(prevPages => {
        const newPages = { ...prevPages };
        delete newPages[tabId];
        return newPages;
    });
  }, [activeTabId, router]);
  
  useEffect(() => {
    const currentItem = allMenuItems.flatMap(i => i.subMenus ? i.subMenus : i).find(i => i.href === pathname);
    if (currentItem) {
        if (!openTabs.some(tab => tab.id === currentItem.id)) {
          openTab(currentItem);
        }
        if (!pages[currentItem.id]) {
            setPages(prev => ({...prev, [currentItem.id]: children}));
        }
        setActiveTabId(currentItem.id);
    }
  }, [pathname, children, pages, openTab, openTabs]);


  const value = { openTabs, activeTabId, openTab, closeTab, setActiveTabId };

  return (
    <TabContext.Provider value={value}>
        {Object.keys(pages).map(pageId => (
            <div key={pageId} style={{ display: pageId === activeTabId ? 'block' : 'none' }} className="h-full">
                {pages[pageId]}
            </div>
        ))}
    </TabContext.Provider>
  );
};


// --- Root Layout ---
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
            if (UNPROTECTED_ROUTES.includes(pathname) || pathname === '/') {
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

  const toggleSidebar = () => {
    setIsSidebarActive(!isSidebarActive);
  };

  const handleSignOut = async () => {
    try {
      await signOut(getFirebaseAuth());
      router.replace('/login');
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  if (loading) {
      return (
        <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${sourceCodePro.variable}`}>
          <body className="font-body antialiased">
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </body>
        </html>
      );
  }
  
  if (!user && !UNPROTECTED_ROUTES.includes(pathname)) {
    return (
        <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${sourceCodePro.variable}`}>
          <body className="font-body antialiased">
             <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </body>
        </html>
    );
  }

  if (UNPROTECTED_ROUTES.includes(pathname)) {
    return (
       <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${sourceCodePro.variable}`}>
          <body className="font-body antialiased">{children}</body>
       </html>
    );
  }
  
  const TabManager = () => {
    const { openTabs, activeTabId, setActiveTabId, closeTab } = useTabs();
    const router = useRouter();

    return (
      <div className="main_container">
        <Header 
            toggleSidebar={toggleSidebar}
            user={user}
            onSignOut={handleSignOut}
        />
        <TabBar 
            openTabs={openTabs}
            activeTabId={activeTabId}
            onTabClick={(id) => {
                const tab = openTabs.find(t => t.id === id);
                if (tab && tab.href) {
                    setActiveTabId(id);
                    router.push(tab.href);
                }
            }}
            onCloseTab={(tabId, e) => {
                e.stopPropagation();
                e.preventDefault();
                closeTab(tabId);
            }}
          />
        <main className="content">
          {children}
        </main>
          {isSidebarActive && window.innerWidth < 1024 && <div className="shadow" onClick={toggleSidebar}></div>}
      </div>
    );
  };


  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${sourceCodePro.variable}`}>
      <body className="font-body antialiased">
        <TabProvider>
            <div className={cn("wrapper", isSidebarActive && "active")}>
                <CustomSidebar isSidebarActive={isSidebarActive} />
                <TabManager />
            </div>
        </TabProvider>
      </body>
    </html>
  );
}
