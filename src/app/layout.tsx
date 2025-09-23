
"use client";

import { useEffect, useState, type ReactNode } from 'react';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Inter, Space_Grotesk, Source_Code_Pro } from 'next/font/google';
import { useToast } from '@/hooks/use-toast';
import { StateProvider } from '@/lib/state-store.tsx';
import { Loader2 } from 'lucide-react';
import AppLayoutWrapper from '@/components/layout/app-layout';
import { getFirebaseAuth, onAuthStateChanged, type User } from '@/lib/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { getRtgsSettings } from "@/lib/firestore";


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

    useEffect(() => {
        const auth = getFirebaseAuth();
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const companySettings = await getRtgsSettings();
                setIsSetupComplete(!!companySettings?.companyName);
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
        const isRootPage = pathname === '/';
        const isSettingsPage = pathname === '/settings';

        if (user) { // User is logged in
            if (isSetupComplete === undefined) {
                // Still waiting for setup status, show loading (covered by the global loader)
                return;
            }

            if (!isSetupComplete && !isSettingsPage) {
                // Setup is incomplete, force redirect to settings page
                router.replace('/settings');
            } else if (isSetupComplete && pathname === '/login') {
                 // If setup is complete and user is on login page, redirect to dashboard.
                 router.replace('/');
            }
        } else { // User is not logged in
             if (!isPublicPage && pathname !== '/') { 
                router.replace('/login');
            }
        }
    }, [user, authChecked, isSetupComplete, pathname, router]);

    // Show a global loader while checking auth state or setup status.
    if (!authChecked || (user && isSetupComplete === undefined)) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-4 text-muted-foreground">Initializing...</span>
            </div>
        );
    }
    
    // Determine whether to show the main app layout or the public page layout
    const showAppLayout = user && isSetupComplete;

    if (showAppLayout) {
        return <AppLayoutWrapper>{children}</AppLayoutWrapper>;
    }
    
    // For logged-out users or users in the setup process, show children without the main layout.
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
