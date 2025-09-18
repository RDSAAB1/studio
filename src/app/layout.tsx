
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
import { cn } from '@/lib/utils';


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
        initialDataSync(); // This will run once when AuthWrapper mounts
    }, []);

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
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then(
                (registration) => console.log('Service Worker registration successful. ✅'),
                (error) => console.error('Service Worker registration failed. ❌', error),
            );
        }
    }, []);

    if (!authChecked || isSetupComplete === null) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        // Allow access to forgot-password page even when not logged in
        if (pathname === '/forgot-password') {
            return <>{children}</>;
        }
        return <LoginPage />;
    }

    if (user && !isSetupComplete && pathname !== '/settings') {
        router.replace('/settings');
        return (
            <div className="flex h-screen w-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (user && isSetupComplete && (pathname === '/login' || pathname === '/')) {
        router.replace('/dashboard-overview');
         return (
            <div className="flex h-screen w-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return <AppLayoutWrapper>{children}</AppLayoutWrapper>;
};


export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <link rel="manifest" href="/manifest.json" crossOrigin="use-credentials"/>
                <meta name="theme-color" content="#4F46E5" />
            </head>
            <body className={cn(inter.variable, spaceGrotesk.variable, sourceCodePro.variable)}>
                <StateProvider>
                    <AuthWrapper>
                        {children}
                    </AuthWrapper>
                    <Toaster />
                </StateProvider>
            </body>
        </html>
    );
}
