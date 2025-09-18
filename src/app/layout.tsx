
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
import { getRtgsSettings } from "@/lib/firestore";
import AppLayoutWrapper from '@/components/layout/app-layout';
import LoginPage from './login/page';
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

// A separate component to handle all authentication and data loading logic
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
                // Await the initial data sync before proceeding
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

        const publicRoutes = ['/login', '/forgot-password', '/'];
        const isPublicPage = publicRoutes.includes(pathname);
        const isSettingsPage = pathname === '/settings';

        if (!user) {
            if (!isPublicPage) {
                router.replace('/login');
            }
        } else if (user) {
            if (isSetupComplete === false && !isSettingsPage) {
                router.replace('/settings');
            } else if (isSetupComplete === true && isPublicPage) {
                router.replace('/dashboard-overview');
            }
        }
    }, [user, authChecked, isSetupComplete, pathname, router]);

    // Show a loading screen while auth is being checked or initial setup/sync is in progress
    if (!authChecked || (user && isSetupComplete === null)) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 <span className="ml-4 text-muted-foreground">Initializing...</span>
            </div>
        );
    }
    
    // If not authenticated, render the login page.
    if (!user) {
        return <LoginPage />;
    }

    // If authenticated, render the main app content.
    return (
        <AppLayoutWrapper>
            {children}
        </AppLayoutWrapper>
    );
};


export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
    const { toast } = useToast();

    // The Service Worker registration is now simplified
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
