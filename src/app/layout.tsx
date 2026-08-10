
"use client";

import React, { Suspense, useEffect, useState, useRef, type ReactNode } from 'react';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import CenteredToaster from "@/components/ui/centered-toaster";
import { GlobalConfirmDialog } from "@/components/ui/global-confirm-dialog";
import { ThemeInitializerProvider } from "@/components/theme-initializer-provider";
import { Inter, Space_Grotesk, Source_Code_Pro, Plus_Jakarta_Sans } from 'next/font/google';
import { useToast } from '@/hooks/use-toast';
import { StateProvider } from '@/lib/state-store';
import { GlobalDataProvider } from '@/contexts/global-data-context';
import { ErpSelectionProvider } from '@/contexts/erp-selection-context';
import { ScrollContainerProvider } from '@/contexts/scroll-container-context';
import AppLayoutWrapper from '@/components/layout/app-layout';
import { WindowControls } from '@/components/layout/window-controls';
import { AuthTransitionScreen } from '@/components/auth/auth-transition-screen';
import { getFirebaseAuth, onAuthStateChanged } from '@/lib/firebase';
import type { User } from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { getRtgsSettings, refreshTenantFirestoreBindings } from "@/lib/firestore";
import { ensureTenantForUser, getActiveTenant } from "@/lib/tenancy";
import { electronNavigate } from "@/lib/electron-navigate";
import { syncAllData } from '@/lib/database';
import { startAutoSync } from '@/lib/d1-sync';
import { useSyncQueue } from '@/hooks/use-sync-queue';
import { ErrorBoundary } from '@/components/error-boundary';
import { ElectronBaseTag } from '@/components/electron-base-tag';
import { ElectronParamSync } from '@/components/electron-param-sync';
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

const plusJakartaSans = Plus_Jakarta_Sans({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-plus-jakarta-sans',
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
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let unsubscribe: (() => void) | undefined;

        try {
            const auth = getFirebaseAuth();
            timeoutId = setTimeout(() => {
                setAuthChecked(true);
            }, 8000);

            unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
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
                    try {
                        await ensureTenantForUser(currentUser);
                        refreshTenantFirestoreBindings();
                    } catch {
                    }

                    // ✅ FIX: Only initialize once - skip if already initialized for this user
                    if (initializedRef.current && wasLoggedIn) {
                        // User was already logged in, just update setup status if needed
                        // Don't re-initialize sync or fetch settings again
                        if (isSetupComplete === undefined) {
                            // Only fetch settings if we don't have the status yet
                            getRtgsSettings()
                                .then((companySettings) => {
                                    if (typeof window !== 'undefined') {
                                        const active = getActiveTenant();
                                        const cacheKey = active ? `rtgsSettingsCache:${active.storageMode}:${active.id}` : 'rtgsSettingsCache';
                                        localStorage.setItem(cacheKey, JSON.stringify({
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
                    const cachedSettings = (() => {
                        if (typeof window === 'undefined') return null;
                        const active = getActiveTenant();
                        const cacheKey = active ? `rtgsSettingsCache:${active.storageMode}:${active.id}` : 'rtgsSettingsCache';
                        return localStorage.getItem(cacheKey);
                    })();

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
                                            const active = getActiveTenant();
                                            const cacheKey = active ? `rtgsSettingsCache:${active.storageMode}:${active.id}` : 'rtgsSettingsCache';
                                            localStorage.setItem(cacheKey, JSON.stringify({
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
                                const active = getActiveTenant();
                                const cacheKey = active ? `rtgsSettingsCache:${active.storageMode}:${active.id}` : 'rtgsSettingsCache';
                                localStorage.setItem(cacheKey, JSON.stringify({
                                    data: companySettings,
                                    timestamp: Date.now()
                                }));
                            }
                            const isErpActive = typeof window !== "undefined" && (localStorage.getItem("erpMode") === "true" || !!localStorage.getItem("erpSelection"));
                            setIsSetupComplete(isErpActive || !!companySettings?.companyName || true);
                            // ✅ FIX: Mark initialization as complete after settings are loaded
                            setInitializationComplete(true);
                        })
                        .catch(() => {
                            const isErpActive = typeof window !== "undefined" && (localStorage.getItem("erpMode") === "true" || !!localStorage.getItem("erpSelection"));
                            setIsSetupComplete(isErpActive || true);
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
                                        } catch { }
                                    });
                                };

                                // Local folder mode: sync from folder immediately so data is ready (no Firestore)
                                const { isLocalFolderMode, initFolderWatcher } = await import('@/lib/local-folder-storage');
                                if (isLocalFolderMode()) {
                                    syncScheduled = true;
                                    syncAllData().catch(() => { });
                                    initFolderWatcher();
                                }

                                // Wait for first user interaction before syncing (Firestore mode)
                                const events = ['click', 'keydown', 'touchstart'] as const;
                                const onUserInteraction = () => {
                                    events.forEach(e => {
                                        document.removeEventListener(e, onUserInteraction);
                                    });
                                    scheduleSync();
                                };

                                events.forEach(e => {
                                    document.addEventListener(e, onUserInteraction);
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
        } catch (e) {
            setUser(null);
            setAuthChecked(true);
        }

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            unsubscribe?.();
        };
    }, [user, isSetupComplete]);

    useEffect(() => {
        redirectHandledRef.current = false;
    }, [pathname, user?.uid]);

    useEffect(() => {
        if (!authChecked) return;

        // ✅ FIX: Normalize pathname to handle trailing slashes
        const normalizedPathname = pathname.replace(/\/$/, '') || '/';
        const isIntroPage = normalizedPathname === '/intro' || normalizedPathname.startsWith('/intro/');
        const isPracticePage = normalizedPathname === '/practice' || normalizedPathname.startsWith('/practice/');
        const isAuthPublicPage = ['/login', '/signup', '/forgot-password', '/create-company'].some(page =>
            normalizedPathname === page || normalizedPathname.startsWith(page + '/')
        );
        const isPublicPage = isAuthPublicPage || isIntroPage || isPracticePage;
        const isSettingsPage = normalizedPathname === '/settings' || normalizedPathname.startsWith('/settings/');
        const isCompanySetupPage = normalizedPathname === '/company-setup' || normalizedPathname.startsWith('/company-setup/');

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
            if (!isSetupComplete && !isSettingsPage && !isCompanySetupPage) {
                // No company yet - redirect to ERP Migration so user can create company (skip if already on company-setup)
                if (!redirectHandledRef.current) {
                    electronNavigate('/settings/erp-migration', router);
                    redirectHandledRef.current = true;
                }
            } else if (isSetupComplete && (isAuthPublicPage || isIntroPage)) {
                // ✅ FIX: Setup complete and on login/intro page - redirect to dashboard (/)
                if (normalizedPathname !== '/') {
                    if (typeof window !== 'undefined') {
                        electronNavigate('/', router);
                    }
                    redirectHandledRef.current = true;
                } else {
                    redirectHandledRef.current = true;
                }
            } else if (isSetupComplete && normalizedPathname === '/') {
                // User is on dashboard - mark as handled
                redirectHandledRef.current = true;
            } else if (isCompanySetupPage) {
                // User is on company-setup - allow them to stay, don't redirect
                redirectHandledRef.current = true;
            } else {
                // User is on a valid protected page - mark as handled
                redirectHandledRef.current = true;
            }
        } else { // User is not logged in
            if (!isPublicPage) {
                if (!redirectHandledRef.current) {
                    electronNavigate('/intro', router);
                    redirectHandledRef.current = true;
                }
            } else {
                redirectHandledRef.current = true;
            }
        }
    }, [user, authChecked, isSetupComplete, initializationComplete, pathname, router]);

    if (!authChecked) {
        return <AuthTransitionScreen />;
    }

    // When user is logged in but still on a public auth page (login/signup/forgot),
    // show transition screen until redirect completes. Never show top bar + login page together.
    const normalizedPathname = pathname.replace(/\/$/, '') || '/';
    const isIntroPage = normalizedPathname === '/intro' || normalizedPathname.startsWith('/intro/');
    const isPracticePage = normalizedPathname === '/practice' || normalizedPathname.startsWith('/practice/');
    const isAuthPublicPage = ['/login', '/signup', '/forgot-password', '/create-company'].some(
        (p) => normalizedPathname === p || normalizedPathname.startsWith(p + '/')
    );
    const showAppLayout = !!user && !isAuthPublicPage && !isIntroPage && !isPracticePage;

    // ✅ FIX: Always mount GlobalDataProvider to prevent "useGlobalData must be used within a GlobalDataProvider" errors
    if (showAppLayout) {
        return (
            <ScrollContainerProvider>
                <ErpSelectionProvider>
                    <GlobalDataProvider>
                        <AppLayoutWrapper>{children}</AppLayoutWrapper>
                    </GlobalDataProvider>
                </ErpSelectionProvider>
            </ScrollContainerProvider>
        );
    }
    // User logged in and on intro/login page - show transition screen until auto-redirect to dashboard completes
    if (user && (isIntroPage || isAuthPublicPage)) {
        return (
            <GlobalDataProvider>
                <AuthTransitionScreen />
            </GlobalDataProvider>
        );
    }
    // No user - show login/intro page
    return (
        <GlobalDataProvider>
            {children}
        </GlobalDataProvider>
    );
};

type LayoutProps = {
    children: ReactNode;
    params?: Promise<Record<string, string>>;
};
export default function RootLayout({ children, params }: LayoutProps) {
    if (params) React.use(params);
    const { toast } = useToast();
    const [isElectron, setIsElectron] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && (window as any).electron) {
            setIsElectron(true);
        }
    }, []);

    useSyncQueue();

    // Initialize Cloudflare D1 Auto-Sync
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const cleanup = startAutoSync();
            return () => {
                if (typeof cleanup === 'function') cleanup();
            };
        }
    }, []);

    // Electron: if we're on app://, force redirect to http (works even when preload didn't run)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (window.location.protocol === 'app:') {
            const path = window.location.pathname || '/';
            const search = window.location.search || '';
            const base = (window as any).electron?.appUrl ?? 'http://localhost:3000';
            window.location.replace(base.replace(/\/$/, '') + path + search);
        }
    }, []);

    // Handle Webpack/Next.js stale chunk error - auto-reload when detected
    useEffect(() => {
        const handleUnhandled = (e: ErrorEvent | PromiseRejectionEvent) => {
            const msg = (e instanceof PromiseRejectionEvent ? (e.reason?.message ?? String(e.reason)) : e.message) || '';
            const errorName = (e instanceof PromiseRejectionEvent ? (e.reason?.name ?? '') : (e.error?.name ?? ''));

            const isChunkError =
                msg.includes("reading 'call'") ||
                msg.includes('reading "call"') ||
                msg.includes("ChunkLoadError") ||
                msg.includes("Loading chunk") ||
                errorName === "ChunkLoadError";

            if (isChunkError) {
                if (typeof window !== 'undefined') {
                    console.warn('[RootLayout] ChunkLoadError detected, reloading...', msg);
                    window.location.reload();
                }
            }
        };
        window.addEventListener('error', handleUnhandled);
        window.addEventListener('unhandledrejection', handleUnhandled);
        return () => {
            window.removeEventListener('error', handleUnhandled);
            window.removeEventListener('unhandledrejection', handleUnhandled);
        };
    }, []);

    // Local folder: Excel file open - notify user, retry will save when closed
    useEffect(() => {
        let lastToast = 0;
        const handler = () => {
            if (Date.now() - lastToast < 10000) return;
            lastToast = Date.now();
            toast({ title: "Excel file open", description: "Data save hoga jab Excel band karenge. Retry ho raha hai.", variant: "default" });
        };
        window.addEventListener('folder:write-failed', handler);
        return () => window.removeEventListener('folder:write-failed', handler);
    }, [toast]);

    // Web Auto-Fullscreen logic (first interaction)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        // Skip for Electron - it has its own window management
        if ((window as any).electron || (window as any).__ELECTRON__) return;

        const handleFirstInteraction = () => {
            if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
            // Remove listeners immediately after first interaction
            document.removeEventListener('click', handleFirstInteraction);
            document.removeEventListener('keydown', handleFirstInteraction);
            document.removeEventListener('touchstart', handleFirstInteraction);
        };
        
        document.addEventListener('click', handleFirstInteraction, { once: true, capture: true });
        document.addEventListener('keydown', handleFirstInteraction, { once: true, capture: true });
        document.addEventListener('touchstart', handleFirstInteraction, { once: true, capture: true });

        return () => {
            document.removeEventListener('click', handleFirstInteraction, { capture: true });
            document.removeEventListener('keydown', handleFirstInteraction, { capture: true });
            document.removeEventListener('touchstart', handleFirstInteraction, { capture: true });
        };
    }, []);

    // ✅ OPTIMIZED: Combined service worker registration and message handling
    useEffect(() => {
        const safeGetRegistrations = () => {
            try {
                if (!('serviceWorker' in navigator)) return Promise.resolve([]);
                return navigator.serviceWorker.getRegistrations();
            } catch {
                return Promise.resolve([]);
            }
        };

        if (process.env.NODE_ENV !== 'production') {
            safeGetRegistrations().then(registrations => {
                registrations.forEach(registration => registration.unregister());
            }).catch(() => { });
            return;
        }

        // Disable service worker in Electron - it causes blank pages / wrong cache for other routes
        if (typeof window !== 'undefined' && ((window as any).electron || (window as any).__ELECTRON__)) {
            safeGetRegistrations().then(registrations => {
                registrations.forEach(registration => registration.unregister());
            }).catch(() => { });
            return;
        }

        if (!('serviceWorker' in navigator)) return;

        try {
            navigator.serviceWorker.register('/sw.js').then(() => { }).catch(() => { });
        } catch {
            // Document may be in invalid state (e.g. Electron navigation)
        }

        const handleServiceWorkerMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'SW_ACTIVATED') {
                toast({
                    title: "Application is ready for offline use.",
                    variant: 'success',
                });
            }
        };

        try {
            navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
        } catch {
            // Ignore if document invalid state
        }

        return () => {
            try {
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
                }
            } catch { }
        };
        // Removed toast from dependencies - it's stable from useToast hook
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <html lang="en" suppressHydrationWarning className="dark">
            <head>
                <title>JRMD Studio</title>
                <ElectronBaseTag />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function() {
                                try {
                                    var userId = localStorage.getItem('companyUser_username') || localStorage.getItem('lastUserId') || 'guest';
                                    if (userId) userId = userId.replace(/[^a-zA-Z0-9]/g, '_');
                                    var userColorsKey = 'jrmd_current_colors_' + userId;
                                    var savedColors = localStorage.getItem(userColorsKey) || localStorage.getItem('jrmd_current_colors');
                                    if (savedColors) {
                                        var colors = JSON.parse(savedColors);
                                        var root = document.documentElement;
                                        function hexToHSL(hex) {
                                            if (!hex) return '';
                                            var c = hex.replace('#', '');
                                            if (c.length === 3) c = c.split('').map(function(x){ return x + x; }).join('');
                                            var r = parseInt(c.substring(0, 2), 16) / 255;
                                            var g = parseInt(c.substring(2, 4), 16) / 255;
                                            var b = parseInt(c.substring(4, 6), 16) / 255;
                                            var max = Math.max(r, g, b), min = Math.min(r, g, b);
                                            var h = 0, s = 0, l = (max + min) / 2;
                                            if (max !== min) {
                                                var d = max - min;
                                                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                                                switch (max) {
                                                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                                                    case g: h = (b - r) / d + 2; break;
                                                    case b: h = (r - g) / d + 4; break;
                                                }
                                                h /= 6;
                                            }
                                            return Math.round(h * 360) + ' ' + Math.round(s * 100) + '% ' + Math.round(l * 100) + '%';
                                        }
                                        if (colors.headerBg) {
                                            root.style.setProperty('--header-bg', colors.headerBg);
                                            root.style.setProperty('--primary-bg-custom', colors.headerBg);
                                            var headerHsl = hexToHSL(colors.headerBg);
                                            root.style.setProperty('--primary', headerHsl);
                                            root.style.setProperty('--ring', headerHsl);
                                        }
                                        if (colors.headerMenuText) root.style.setProperty('--header-text-color', colors.headerMenuText);
                                        if (colors.headerHoverBg) root.style.setProperty('--header-hover-bg', colors.headerHoverBg);
                                        if (colors.headerActiveBg) root.style.setProperty('--header-active-bg', colors.headerActiveBg);
                                        if (colors.profileAvatarBg) root.style.setProperty('--profile-avatar-bg', colors.profileAvatarBg);
                                        if (colors.submenuBg) root.style.setProperty('--submenu-bg', colors.submenuBg);
                                        if (colors.submenuText) root.style.setProperty('--submenu-text', colors.submenuText);
                                        if (colors.submenuIcon) root.style.setProperty('--submenu-icon', colors.submenuIcon);
                                        if (colors.submenuHoverBg) root.style.setProperty('--submenu-hover-bg', colors.submenuHoverBg);
                                        if (colors.submenuHoverText) root.style.setProperty('--submenu-hover-text', colors.submenuHoverText);
                                        if (colors.submenuActiveBg) root.style.setProperty('--submenu-active-bg', colors.submenuActiveBg);
                                        if (colors.submenuActiveText) root.style.setProperty('--submenu-active-text', colors.submenuActiveText);
                                        if (colors.settingsSubnavBg) root.style.setProperty('--settings-subnav-bg', colors.settingsSubnavBg);
                                        if (colors.settingsSubnavText) root.style.setProperty('--settings-subnav-text', colors.settingsSubnavText);
                                        if (colors.settingsSubnavHoverBg) root.style.setProperty('--settings-subnav-hover-bg', colors.settingsSubnavHoverBg);
                                        if (colors.settingsSubnavActiveBg) root.style.setProperty('--settings-subnav-active-bg', colors.settingsSubnavActiveBg);
                                        if (colors.settingsSubnavActiveText) root.style.setProperty('--settings-subnav-active-text', colors.settingsSubnavActiveText);
                                        if ((colors as any).settingsSubnavBorder) root.style.setProperty('--settings-subnav-border', (colors as any).settingsSubnavBorder);

                                        if ((colors as any).tabBarBg) root.style.setProperty('--tab-bar-bg', (colors as any).tabBarBg);
                                        if ((colors as any).tabBarText) root.style.setProperty('--tab-bar-text', (colors as any).tabBarText);
                                        if ((colors as any).tabBarHoverBg) root.style.setProperty('--tab-bar-hover-bg', (colors as any).tabBarHoverBg);
                                        if ((colors as any).tabBarHoverText) root.style.setProperty('--tab-bar-hover-text', (colors as any).tabBarHoverText);
                                        if ((colors as any).tabBarActiveBg) root.style.setProperty('--tab-bar-active-bg', (colors as any).tabBarActiveBg);
                                        if ((colors as any).tabBarActiveText) root.style.setProperty('--tab-bar-active-text', (colors as any).tabBarActiveText);
                                        if ((colors as any).tabBarBorder) root.style.setProperty('--tab-bar-border', (colors as any).tabBarBorder);
                                        if (colors.btnClearBg) root.style.setProperty('--btn-clear-bg', colors.btnClearBg);
                                        if (colors.btnClearText) root.style.setProperty('--btn-clear-text', colors.btnClearText);
                                        if (colors.btnSaveBg) root.style.setProperty('--btn-save-bg', colors.btnSaveBg);
                                        if (colors.btnSaveText) root.style.setProperty('--btn-save-text', colors.btnSaveText);
                                        if (colors.btnImportBg) root.style.setProperty('--btn-import-bg', colors.btnImportBg);
                                        if (colors.btnImportText) root.style.setProperty('--btn-import-text', colors.btnImportText);
                                        if (colors.btnExportBg) root.style.setProperty('--btn-export-bg', colors.btnExportBg);
                                        if (colors.btnExportText) root.style.setProperty('--btn-export-text', colors.btnExportText);
                                        if (colors.btnDeleteBg) root.style.setProperty('--btn-delete-bg', colors.btnDeleteBg);
                                        if (colors.btnDeleteText) root.style.setProperty('--btn-delete-text', colors.btnDeleteText);
                                        if (colors.btnPrintBg) root.style.setProperty('--btn-print-bg', colors.btnPrintBg);
                                        if (colors.btnPrintText) root.style.setProperty('--btn-print-text', colors.btnPrintText);
                                        if (colors.btnPrimaryBg) root.style.setProperty('--btn-primary-bg', colors.btnPrimaryBg);
                                        if (colors.btnPrimaryText) root.style.setProperty('--btn-primary-text', colors.btnPrimaryText);
                                        if (colors.btnEditBg) root.style.setProperty('--btn-edit-bg', colors.btnEditBg);
                                        if (colors.btnEditText) root.style.setProperty('--btn-edit-text', colors.btnEditText);
                                        if (colors.btnDangerBg) root.style.setProperty('--btn-danger-bg', colors.btnDangerBg);
                                        if (colors.btnDangerText) root.style.setProperty('--btn-danger-text', colors.btnDangerText);
                                        if (colors.background) root.style.setProperty('--background', hexToHSL(colors.background));
                                        if (colors.cardBg) root.style.setProperty('--card', hexToHSL(colors.cardBg));
                                    }
                                } catch (e) {}
                            })();
                        `
                    }}
                />
            </head>
            <body className={`${inter.variable} ${spaceGrotesk.variable} ${sourceCodePro.variable} ${plusJakartaSans.variable} font-body antialiased ${isElectron ? 'electron-content' : ''}`}>
                <ThemeInitializerProvider />
                <WindowControls />
                <Suspense fallback={null}>
                    <ElectronParamSync />
                </Suspense>
                <Suspense fallback={<div className="min-h-screen bg-background" />}>
                    <ErrorBoundary>
                        <StateProvider>
                            <AuthWrapper>
                                {children}
                            </AuthWrapper>
                        </StateProvider>
                    </ErrorBoundary>
                </Suspense>
                <Toaster />
                <CenteredToaster />
                <GlobalConfirmDialog />
            </body>
        </html>
    );
}
