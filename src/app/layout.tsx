
"use client";

import { useEffect, useState, useRef, type ReactNode } from 'react';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Inter, Space_Grotesk, Source_Code_Pro } from 'next/font/google';
import { useToast } from '@/hooks/use-toast';
import { StateProvider } from '@/lib/state-store.tsx';
import { Loader2 } from 'lucide-react';
import AppLayoutWrapper from '@/components/layout/app-layout';
import { getFirebaseAuth, onAuthStateChanged, type User } from '@/lib/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { getRtgsSettings, getSuppliersRealtime, getPaymentsRealtime } from "@/lib/firestore";
import { db, syncAllData } from '@/lib/database';
import { useSyncQueue } from '@/hooks/use-sync-queue';


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
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const companySettings = await getRtgsSettings();
                setIsSetupComplete(!!companySettings?.companyName);
                // Initial data sync on login
                syncAllData();
            } else {
                setIsSetupComplete(undefined);
            }
            setAuthChecked(true);
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

    if (!authChecked || (user && isSetupComplete === undefined)) {
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
