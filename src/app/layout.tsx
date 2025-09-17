
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

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
    const { toast } = useToast();
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
 
    let content: ReactNode;

    if (!authChecked || (user && isSetupComplete === null)) {
        content = (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    } else if (!user) {
        content = <LoginPage />;
    } else {
        content = (
            <AppLayoutWrapper>
                {children}
            </AppLayoutWrapper>
        );
    }

    return (
        <html lang="en" suppressHydrationWarning>
          <head>
            <link rel="manifest" href="/manifest.json" />
            <meta name="theme-color" content="#4F46E5" />
          </head>
          <body className={`${inter.variable} ${spaceGrotesk.variable} ${sourceCodePro.variable} font-body antialiased`}>
              <StateProvider>
                  {content}
              </StateProvider>
            <Toaster />
          </body>
        </html>
    );
}
