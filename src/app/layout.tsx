
"use client";

import { useEffect, useState, useRef, type ReactNode } from 'react';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { GlobalConfirmDialog } from "@/components/ui/global-confirm-dialog";
import { Inter, Space_Grotesk, Source_Code_Pro } from 'next/font/google';
import { useToast } from '@/hooks/use-toast';
import { StateProvider } from '@/lib/state-store.tsx';
import { GlobalDataProvider } from '@/contexts/global-data-context';
import { Loader2 } from 'lucide-react';
import AppLayoutWrapper from '@/components/layout/app-layout';
import { getFirebaseAuth, onAuthStateChanged, type User } from '@/lib/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { getRtgsSettings, getSuppliersRealtime, getPaymentsRealtime } from "@/lib/firestore";
import { db, syncAllData } from '@/lib/database';
import { useSyncQueue } from '@/hooks/use-sync-queue';
import '@/lib/sync-processors'; // register sync processors early


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

const AuthWrapper = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [isSetupComplete, setIsSetupComplete] = useState<boolean | undefined>(undefined);
    const router = useRouter();
    const pathname = usePathname();
    const redirectHandledRef = useRef(false);

    useEffect(() => {
        const auth = getFirebaseAuth();
		const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
			setAuthChecked(true);
			if (currentUser) {
				// Fetch settings in background (non-blocking)
				getRtgsSettings()
					.then((companySettings) => {
						setIsSetupComplete(!!companySettings?.companyName);
					})
					.catch(() => {
						setIsSetupComplete(false);
					});

				// Initial data sync on login (defer to idle)
				if (typeof window !== 'undefined') {
					const schedule = (cb: () => void) => {
						if ('requestIdleCallback' in window) {
							(window as any).requestIdleCallback(cb, { timeout: 1500 });
						} else {
							setTimeout(cb, 0);
						}
					};
					// Initialize local-first sync (async IIFE to handle await)
					(async () => {
						try {
							const { initLocalFirstSync } = await import('@/lib/local-first-sync');
							initLocalFirstSync();
							schedule(() => { try { syncAllData(); } catch {} });
						} catch (error) {

							// Retry after a delay
							setTimeout(async () => {
								try {
									const { initLocalFirstSync } = await import('@/lib/local-first-sync');
									initLocalFirstSync();
									schedule(() => { try { syncAllData(); } catch {} });
								} catch (retryError) {

								}
							}, 1000);
						}
					})();
				}
			} else {
				setIsSetupComplete(undefined);
			}
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!authChecked) return;

        const isPublicPage = ['/login', '/signup', '/forgot-password'].includes(pathname);
        const isSettingsPage = pathname === '/settings';
        
        if (user) { // User is logged in
            if (isSetupComplete === undefined) {
                return; // Still loading setup status, show loader
            }

            // Only redirect if necessary and not already handled
            if (!isSetupComplete && !isSettingsPage) {
                if (!redirectHandledRef.current) {
                router.replace('/settings');
                    redirectHandledRef.current = true;
                }
            } else if (isSetupComplete && isPublicPage) {
                if (!redirectHandledRef.current) {
                    router.replace('/');
                    redirectHandledRef.current = true;
                }
            } else {
                // User is on a valid protected page - mark as handled
                redirectHandledRef.current = true;
            }
        } else { // User is not logged in
             if (!isPublicPage) {
                if (!redirectHandledRef.current) {
                router.replace('/login');
                    redirectHandledRef.current = true;
                }
            } else {
                redirectHandledRef.current = true;
            }
        }
    }, [user, authChecked, isSetupComplete, pathname, router]);

	if (!authChecked) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-4 text-muted-foreground">Initializing...</span>
            </div>
        );
    }
    
    const showAppLayout = user && isSetupComplete;

    if (showAppLayout) {
        return <AppLayoutWrapper>{children}</AppLayoutWrapper>;
    }
    
    return <>{children}</>;
};

export default function RootLayout({ children }: { children: ReactNode }) {
    const { toast } = useToast();
    useSyncQueue();

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then(registration => {

            }).catch(err => {

            });
        }
    }, []);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            const handleServiceWorkerMessage = (event: MessageEvent) => {
                if (event.data && event.data.type === 'SW_ACTIVATED') {
                    toast({
                        title: "Application is ready for offline use.",
                        variant: 'success',
                    });
                }
            };
            
            navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
            
            return () => {
                navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
            };
        }
        // Removed toast from dependencies - it's stable from useToast hook
        // Service worker registration doesn't need toast as dependency
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <html lang="en" suppressHydrationWarning className="dark">
            <head>
                <link rel="manifest" href="/manifest.json" />
                <meta name="theme-color" content="#000000" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <meta name="apple-mobile-web-app-title" content="JRMD Studio" />
                <meta name="mobile-web-app-capable" content="yes" />
            </head>
            <body className={`${inter.variable} ${spaceGrotesk.variable} ${sourceCodePro.variable} font-body antialiased`}>
                <StateProvider>
                    <GlobalDataProvider>
                        <AuthWrapper>
                            {children}
                        </AuthWrapper>
                    </GlobalDataProvider>
                </StateProvider>
                {/* Toaster hidden - using DynamicIslandToaster in header instead */}
                {/* <Toaster /> */}
                <GlobalConfirmDialog />
            </body>
        </html>
    );
}
