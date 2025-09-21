
"use client";

import { useEffect, useState, type ReactNode } from 'react';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Inter, Space_Grotesk, Source_Code_Pro } from 'next/font/google';
import { useToast } from '@/hooks/use-toast';
import { StateProvider } from '@/lib/state-store.tsx';
import { getFirebaseAuth, onAuthStateChanged, getRedirectResult, type User } from '@/lib/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { getRtgsSettings } from "@/lib/firestore";
import { initialDataSync } from '@/lib/database';
import { Loader2 } from 'lucide-react';

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

        const isAppPage = !['/login', '/forgot-password', '/'].includes(pathname);

        if (!user && isAppPage) {
            router.replace('/login');
        } else if (user) {
            if (isSetupComplete === false) {
                if (pathname !== '/settings') {
                    router.replace('/settings');
                }
            } else if (isSetupComplete === true) {
                if (pathname === '/login' || pathname === '/') {
                    router.replace('/dashboard-overview');
                }
            }
        }
    }, [user, authChecked, isSetupComplete, pathname, router]);

    const isPublicPage = ['/login', '/forgot-password', '/'].includes(pathname);

    if (!authChecked || (user && isSetupComplete === null && !isPublicPage)) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-4 text-muted-foreground">Initializing...</span>
            </div>
        );
    }
    
    if (user) {
         // If setup is not complete, redirect to settings, unless already there.
        if (isSetupComplete === false && pathname !== '/settings') {
             return (
                <div className="flex h-screen w-screen items-center justify-center bg-background">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-4 text-muted-foreground">Redirecting to settings...</span>
                </div>
            );
        }
        // If user is logged in and setup is complete, but they are on a public page, redirect them.
        if (isSetupComplete === true && isPublicPage) {
             return (
                <div className="flex h-screen w-screen items-center justify-center bg-background">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-4 text-muted-foreground">Redirecting to dashboard...</span>
                </div>
            );
        }
        // Otherwise, show the app content
        return <>{children}</>;
    }

    // If not logged in, only show public pages
    if (!user && !isPublicPage) {
        return (
             <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-4 text-muted-foreground">Redirecting to login...</span>
            </div>
        )
    }

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
