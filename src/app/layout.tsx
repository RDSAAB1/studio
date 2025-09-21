
"use client";

import { useEffect, useState, type ReactNode } from 'react';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Inter, Space_Grotesk, Source_Code_Pro } from 'next/font/google';
import { useToast } from '@/hooks/use-toast';
import { StateProvider } from '@/lib/state-store.tsx';
import { Loader2 } from 'lucide-react';
import AppLayoutWrapper from '@/components/layout/app-layout';
import { getFirebaseAuth, onAuthStateChanged, getRedirectResult, type User } from '@/lib/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { getRtgsSettings } from "@/lib/firestore";
import { initialDataSync } from '@/lib/database';

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
    const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const auth = getFirebaseAuth();
        getRedirectResult(auth).catch(console.error);

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                await initialDataSync();
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

        const isPublicPage = ['/login', '/forgot-password', '/'].includes(pathname);

        if (user) {
            // User is logged in
            if (isSetupComplete === false) {
                // Setup is not complete, must redirect to settings
                if (pathname !== '/settings') {
                    router.replace('/settings');
                }
            } else if (isSetupComplete === true) {
                // Setup is complete, redirect from public pages to dashboard
                if (isPublicPage) {
                   router.replace('/dashboard-overview');
                }
            }
        } else {
            // User is not logged in, redirect to login if not on a public page
            if (!isPublicPage) {
                router.replace('/login');
            }
        }
    }, [user, authChecked, isSetupComplete, pathname, router]);

    if (!authChecked || (user && isSetupComplete === null && pathname !== '/login' && pathname !== '/forgot-password' && pathname !== '/')) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-4 text-muted-foreground">Initializing...</span>
            </div>
        );
    }
    
    // Determine if we should show the full app layout
    const showAppLayout = user && !['/login', '/forgot-password', '/'].includes(pathname);

    if (showAppLayout) {
        return <AppLayoutWrapper>{children}</AppLayoutWrapper>;
    }
    
    // For public pages or during initial load for public routes
    return <>{children}</>;
};

export default function RootLayout({ children }: { children: ReactNode }) {
    const { toast } = useToast();

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then(registration => {
                console.log('Service Worker registered successfully. ✅');
            }).catch(err => {
                console.error('Service Worker registration failed. ❌', err);
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
    }, [toast]);

    return (
        <html lang="en" suppressHydrationWarning>
            <head>
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
