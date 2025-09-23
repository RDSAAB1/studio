
"use client";

import { useEffect, useState, type ReactNode } from 'react';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Inter, Space_Grotesk, Source_Code_Pro } from 'next/font/google';
import { useToast } from '@/hooks/use-toast';
import { StateProvider } from '@/lib/state-store.tsx';
import { Loader2 } from 'lucide-react';
import AppLayoutWrapper from '@/components/layout/app-layout';
import { getFirebaseAuth, onAuthStateChanged, getRedirectResult, type User, getAdditionalUserInfo } from '@/lib/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { getRtgsSettings, initialDataSync } from "@/lib/firestore";


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
    const [isNewUser, setIsNewUser] = useState(false);
    const [authChecked, setAuthChecked] = useState(false);
    const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const auth = getFirebaseAuth();
        
        getRedirectResult(auth)
            .then((result) => {
                if(result) {
                    const isNew = getAdditionalUserInfo(result)?.isNewUser;
                    setIsNewUser(!!isNew);
                }
            })
            .catch(console.error);

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

        const isPublicPage = ['/login', '/forgot-password'].includes(pathname);
        const isRootPage = pathname === '/';

        if (user) {
            // User is logged in
            if (isNewUser || isSetupComplete === false) {
                // If it's a new user OR setup is not complete, redirect to settings
                if (pathname !== '/settings') {
                    router.replace('/settings');
                }
            } else if (isSetupComplete === true) {
                // Setup is complete, redirect from public pages to dashboard
                if (isPublicPage || isRootPage) {
                   router.replace('/');
                }
            }
        } else {
            // User is not logged in, redirect to login if not on a public page
            if (!isPublicPage && !isRootPage) {
                router.replace('/login');
            }
        }
    }, [user, authChecked, isSetupComplete, isNewUser, pathname, router]);

    if (!authChecked || (user && isSetupComplete === null && !['/login', '/forgot-password', '/'].includes(pathname))) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-4 text-muted-foreground">Initializing...</span>
            </div>
        );
    }
    
    const showAppLayout = user && !['/login', '/forgot-password'].includes(pathname);

    if (showAppLayout) {
        return <AppLayoutWrapper>{children}</AppLayoutWrapper>;
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
