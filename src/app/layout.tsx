
"use client";

import { useEffect, useState, type ReactNode, Suspense } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Inter, Space_Grotesk, Source_Code_Pro } from 'next/font/google';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { StateProvider } from '@/lib/state-store.tsx';
import { getFirebaseAuth, onAuthStateChanged, getRedirectResult, type User } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import CustomSidebar from '@/components/layout/custom-sidebar';
import { Header } from "@/components/layout/header";
import { allMenuItems, type MenuItem } from "@/hooks/use-tabs";
import TabBar from '@/components/layout/tab-bar';
import { cn } from "@/lib/utils";
import LoginPage from "@/app/login/page";
import { getCompanySettings, getRtgsSettings } from "@/lib/firestore";


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

function AppContent({ children }: { children: ReactNode }) {
  const [openTabs, setOpenTabs] = useState<MenuItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('dashboard-overview');
  const [isSidebarActive, setIsSidebarActive] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const dashboardTab = allMenuItems.find(item => item.id === 'dashboard-overview');
    if (dashboardTab && openTabs.length === 0) {
      setOpenTabs([dashboardTab]);
      if (pathname === '/') {
        router.push('/dashboard-overview');
      }
    }
  }, [openTabs.length, pathname, router]);

  useEffect(() => {
    const currentPathId = pathname.substring(1);
    if (currentPathId && currentPathId !== activeTabId) {
      const menuItem = allMenuItems.flatMap(i => i.subMenus ? i.subMenus : i).find(item => item.id === currentPathId);
      if (menuItem) {
        if (!openTabs.some(tab => tab.id === currentPathId)) {
          setOpenTabs(prev => [...prev, menuItem]);
        }
        setActiveTabId(currentPathId);
      }
    }
  }, [pathname, activeTabId, openTabs]);

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
    if (!openTabs.some(tab => tab.id === menuItem.id)) {
      setOpenTabs(prev => [...prev, menuItem]);
    }
    setActiveTabId(menuItem.id);
    router.push(`/${menuItem.id}`);
  };

  const toggleSidebar = () => setIsSidebarActive(prev => !prev);
  const pageId = pathname.substring(1);

  return (
    <CustomSidebar onTabSelect={handleOpenTab} isSidebarActive={isSidebarActive} toggleSidebar={toggleSidebar}>
      <div className="flex flex-col flex-grow min-h-0 h-screen overflow-hidden">
        <Suspense>
          <div className="sticky top-0 z-30 flex-shrink-0">
            <TabBar openTabs={openTabs} activeTabId={activeTabId} setActiveTabId={handleTabSelect} closeTab={handleTabClose} />
            <Header toggleSidebar={toggleSidebar} />
          </div>
        </Suspense>
        <div className="flex-grow relative overflow-y-auto">
          {openTabs.map(tab => {
            const isTabActive = tab.id === pageId;
            return (
              <div key={tab.id} className={cn("absolute inset-0", isTabActive ? "z-10" : "z-0 invisible")}>
                {isTabActive && (
                  <main className="p-4 sm:p-6">
                    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
                      {children}
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
}


function AuthWrapper({ children }: { children: ReactNode }) {
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
                const companySettings = await getRtgsSettings();
                setIsSetupComplete(!!companySettings?.companyName);
            } else {
                setIsSetupComplete(null);
            }
            setAuthChecked(true);
        });

        return () => unsubscribe();
    }, []);
    
    useEffect(() => {
        if (!authChecked) return;

        const publicRoutes = ['/login', '/forgot-password'];
        const isPublicPage = publicRoutes.includes(pathname);
        const isSettingsPage = pathname === '/settings';

        if (!user && !isPublicPage) {
            router.replace('/login');
        } else if (user) {
            if (isSetupComplete === false && !isSettingsPage) {
                router.replace('/settings');
            } else if (isSetupComplete === true && isPublicPage) {
                router.replace('/dashboard-overview');
            }
        }
    }, [user, authChecked, isSetupComplete, pathname, router]);


    if (!authChecked || (user && isSetupComplete === null)) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!user) {
        return <LoginPage />;
    }
    
    if (isSetupComplete === false) {
       // Still render the layout for the settings page
       return <AppContent>{children}</AppContent>;
    }
    
    return <AppContent>{children}</AppContent>;
}


export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
    const { toast } = useToast();

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            const registerServiceWorker = () => {
                navigator.serviceWorker.register('/sw.js').then(registration => {
                    console.log('SW registered: ', registration);
                    
                    registration.onupdatefound = () => {
                        const installingWorker = registration.installing;
                        if (installingWorker) {
                            installingWorker.onstatechange = () => {
                                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    toast({
                                        title: 'Update Available',
                                        description: 'A new version of the app is ready.',
                                        action: (
                                            <Button onClick={() => installingWorker.postMessage({ type: 'SKIP_WAITING' })} size="sm">
                                                Reload
                                            </Button>
                                        ),
                                        duration: Infinity
                                    });
                                }
                            };
                        }
                    };
                }).catch(err => {
                    console.error('Service Worker registration failed:', err);
                });
            };
            
            window.addEventListener('load', registerServiceWorker);
            
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            });
        
            return () => {
                window.removeEventListener('load', registerServiceWorker);
            };
        }
    }, [toast]);
 
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#4F46E5" />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${sourceCodePro.variable} font-body antialiased`}>
          <StateProvider>
            <AuthWrapper>
                {children}
            </AuthWrapper>
          </StateProvider>
        <Toaster />
      </body>
    </html>
  );
}