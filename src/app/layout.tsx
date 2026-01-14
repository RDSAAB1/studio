
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
import { getRtgsSettings } from "@/lib/firestore";
import { syncAllData } from '@/lib/database';
import { useSyncQueue } from '@/hooks/use-sync-queue';
import { ErrorBoundary } from '@/components/error-boundary';
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
    const [initializationComplete, setInitializationComplete] = useState(false); // ✅ FIX: Use state to trigger re-render
    const router = useRouter();
    const pathname = usePathname();
    const redirectHandledRef = useRef(false);
    const initializedRef = useRef(false); // ✅ FIX: Track if initialization has been done
    
    useEffect(() => {
        const auth = getFirebaseAuth();
		const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            const wasLoggedIn = !!user;
            const isNowLoggedIn = !!currentUser;
            
            setUser(currentUser);
			setAuthChecked(true);
            
            // ✅ FIX: Only reset flags if user state actually changed (login/logout)
            if (wasLoggedIn !== isNowLoggedIn) {
                redirectHandledRef.current = false;
                setInitializationComplete(false);
            }
            
			if (currentUser) {
                // ✅ FIX: Only initialize once - skip if already initialized for this user
                if (initializedRef.current && wasLoggedIn) {
                    // User was already logged in, just update setup status if needed
                    // Don't re-initialize sync or fetch settings again
                    if (isSetupComplete === undefined) {
                        // Only fetch settings if we don't have the status yet
                        getRtgsSettings()
                            .then((companySettings) => {
                                if (typeof window !== 'undefined') {
                                    localStorage.setItem('rtgsSettingsCache', JSON.stringify({
                                        data: companySettings,
                                        timestamp: Date.now()
                                    }));
                                }
                                setIsSetupComplete(!!companySettings?.companyName);
                                setInitializationComplete(true); // Mark as ready
                            })
                            .catch(() => {
                                setIsSetupComplete(false);
                                setInitializationComplete(true); // Mark as ready even on error
                            });
                    } else {
                        setInitializationComplete(true); // Already have setup status
                    }
                    return;
                }
                
                // Mark as initialized for this user
                initializedRef.current = true;
				// ✅ OPTIMIZED: Check cache first to avoid blocking initialization
				const cachedSettings = typeof window !== 'undefined' 
					? localStorage.getItem('rtgsSettingsCache')
					: null;
				
				if (cachedSettings) {
					try {
						const parsed = JSON.parse(cachedSettings);
						// Check if cache is less than 5 minutes old
						if (parsed.timestamp && Date.now() - parsed.timestamp < 5 * 60 * 1000) {
							setIsSetupComplete(!!parsed.data?.companyName);
							// ✅ FIX: Mark initialization as complete immediately when using cache
							setInitializationComplete(true);
							// Still fetch fresh data in background
							getRtgsSettings()
								.then((companySettings) => {
									if (typeof window !== 'undefined') {
										localStorage.setItem('rtgsSettingsCache', JSON.stringify({
											data: companySettings,
											timestamp: Date.now()
										}));
									}
									setIsSetupComplete(!!companySettings?.companyName);
								})
								.catch(() => {
									// Keep cached value on error
								});
							return;
						}
					} catch (e) {
						// Invalid cache, fetch fresh
					}
				}
				
				// ✅ FIX: Initialize local-first sync first (synchronous, quick)
				if (typeof window !== 'undefined') {
					(async () => {
						try {
							const { initLocalFirstSync } = await import('@/lib/local-first-sync');
							initLocalFirstSync();
						} catch (error) {
							// Silent fail
						}
					})();
				}
				
				// ✅ FIX: Fetch settings and mark initialization complete after settings are loaded
				getRtgsSettings()
					.then((companySettings) => {
						if (typeof window !== 'undefined') {
							localStorage.setItem('rtgsSettingsCache', JSON.stringify({
								data: companySettings,
								timestamp: Date.now()
							}));
						}
						setIsSetupComplete(!!companySettings?.companyName);
						// ✅ FIX: Mark initialization as complete after settings are loaded
						setInitializationComplete(true);
					})
					.catch(() => {
						setIsSetupComplete(false);
						// ✅ FIX: Mark as complete even on error so redirect can happen
						setInitializationComplete(true);
					});

				// ✅ OPTIMIZED: Defer data sync until user interaction (non-blocking)
				if (typeof window !== 'undefined') {
					// Schedule sync (async IIFE to handle await)
					(async () => {
						try {
							// ✅ Defer syncAllData until first user interaction
							let syncScheduled = false;
							const scheduleSync = () => {
								if (syncScheduled) return;
								syncScheduled = true;
								
								const schedule = (cb: () => void) => {
									if ('requestIdleCallback' in window) {
										(window as any).requestIdleCallback(cb, { timeout: 2000 });
									} else {
										setTimeout(cb, 100);
									}
								};
								
								schedule(() => { 
									try { 
										syncAllData(); 
									} catch {} 
								});
							};
							
							// Wait for first user interaction before syncing
							const events = ['click', 'keydown', 'touchstart'];
							const onUserInteraction = () => {
								events.forEach(e => {
									document.removeEventListener(e, onUserInteraction, { passive: true });
								});
								scheduleSync();
							};
							
							events.forEach(e => {
								document.addEventListener(e, onUserInteraction, { passive: true, once: true });
							});
							
							// Fallback: sync after 3 seconds if no interaction
							setTimeout(() => {
								if (!syncScheduled) {
									scheduleSync();
								}
							}, 3000);
						} catch (error) {
							// Silent fail - sync will retry later
						}
					})();
				}
			} else {
				setIsSetupComplete(undefined);
				// ✅ FIX: Reset initialization flags when user logs out
				initializedRef.current = false;
				setInitializationComplete(false);
			}
        });

        return () => unsubscribe();
    }, [user, isSetupComplete]); // Add dependencies to track user state changes

    useEffect(() => {
        if (!authChecked) return;

        // ✅ FIX: Normalize pathname to handle trailing slashes
        const normalizedPathname = pathname.replace(/\/$/, '') || '/';
        const isPublicPage = ['/login', '/signup', '/forgot-password'].some(page => 
            normalizedPathname === page || normalizedPathname.startsWith(page + '/')
        );
        const isSettingsPage = normalizedPathname === '/settings';
        
        if (user) { // User is logged in
            // ✅ FIX: Wait for initialization to complete before redirecting
            if (!initializationComplete) {
                // Initialization still in progress - wait, don't redirect yet
                if (!isPublicPage) {
                    // On a protected page - allow them to stay while initialization happens
                    redirectHandledRef.current = true;
                }
                // If on public page, wait for initialization to complete
                return;
            }
            
            // ✅ FIX: Handle redirect properly when setup status is determined
            if (isSetupComplete === undefined) {
                // Setup status still loading
                if (isPublicPage) {
                    // On login page - wait for setup to complete, then redirect will happen
                    // Don't mark as handled yet, allow redirect once setup completes
                    return;
                } else {
                    // On a protected page - allow them to stay while setup loads
                    redirectHandledRef.current = true;
                    return;
                }
            }

            // Setup status is determined (true or false) - proceed with redirect logic
            if (!isSetupComplete && !isSettingsPage) {
                // Setup not complete - redirect to settings
                if (!redirectHandledRef.current) {
                    router.replace('/settings');
                    redirectHandledRef.current = true;
                }
            } else if (isSetupComplete && isPublicPage) {
                // ✅ FIX: Setup complete and on login page - redirect to dashboard (/)
                // Force redirect immediately - always redirect if on public page
                if (normalizedPathname !== '/') {
                    // Use window.location as fallback if router.replace doesn't work
                    if (typeof window !== 'undefined') {
                        router.replace('/');
                        // Force URL update if router doesn't work
                        setTimeout(() => {
                            if (window.location.pathname !== '/') {
                                window.location.href = '/';
                            }
                        }, 100);
                    }
                    redirectHandledRef.current = true;
                } else {
                    redirectHandledRef.current = true;
                }
            } else if (isSetupComplete && normalizedPathname === '/') {
                // User is on dashboard - mark as handled
                redirectHandledRef.current = true;
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
        }, [user, authChecked, isSetupComplete, initializationComplete, pathname, router]);

	if (!authChecked) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-4 text-muted-foreground">Initializing...</span>
            </div>
        );
    }
    
    const showAppLayout = user && isSetupComplete;
    const isDashboardPage = pathname === '/';

    // ✅ FIX: Always mount GlobalDataProvider to prevent "useGlobalData must be used within a GlobalDataProvider" errors
    // The provider will only set up listeners when user is logged in (handled internally)
    // This ensures components can safely use useGlobalData even during SSR or before auth is determined
    if (showAppLayout) {
        // Setup complete - show full app layout
        return (
            <GlobalDataProvider>
                <AppLayoutWrapper>{children}</AppLayoutWrapper>
            </GlobalDataProvider>
        );
    } else if (user && isDashboardPage) {
        // ✅ FIX: User logged in and on dashboard - show app layout even if setup is still loading
        // This ensures dashboard is visible immediately after login redirect
        return (
            <GlobalDataProvider>
                <AppLayoutWrapper>{children}</AppLayoutWrapper>
            </GlobalDataProvider>
        );
    } else if (user) {
        // User logged in but setup not complete and not on dashboard - mount provider but show loading
        // This allows components to use useGlobalData without errors
        return (
            <GlobalDataProvider>
                {children}
            </GlobalDataProvider>
        );
    } else {
        // No user yet - still mount provider (it won't set up listeners until user is logged in)
        // This prevents errors when components try to use useGlobalData during SSR or initial render
        return (
            <GlobalDataProvider>
                {children}
            </GlobalDataProvider>
        );
    }
};

export default function RootLayout({ children }: { children: ReactNode }) {
    const { toast } = useToast();
    useSyncQueue();

    // ✅ OPTIMIZED: Combined service worker registration and message handling
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            // Register service worker
            navigator.serviceWorker.register('/sw.js').then(registration => {
                // Service worker registered successfully
            }).catch(err => {
                // Service worker registration failed (silent fail)
            });
            
            // Handle service worker messages
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
                <ErrorBoundary>
                    <StateProvider>
                        <AuthWrapper>
                            {children}
                        </AuthWrapper>
                    </StateProvider>
                </ErrorBoundary>
                {/* Toaster hidden - using DynamicIslandToaster in header instead */}
                {/* <Toaster /> */}
                <GlobalConfirmDialog />
            </body>
        </html>
    );
}
