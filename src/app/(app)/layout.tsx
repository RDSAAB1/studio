
"use client";

import { useEffect, useState, type ReactNode } from 'react';
import AppLayoutWrapper from '@/components/layout/app-layout';
import { getFirebaseAuth, onAuthStateChanged, getRedirectResult, type User } from '@/lib/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { getRtgsSettings } from "@/lib/firestore";
import { initialDataSync } from '@/lib/database';
import { Loader2 } from 'lucide-react';

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
                if (pathname === '/login' || pathname === '/') {
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


    if (!authChecked || (user && isSetupComplete === null)) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-4 text-muted-foreground">Initializing...</span>
            </div>
        );
    }
    
    // If user is logged in, show the app layout and content
    if (user) {
        return <AppLayoutWrapper>{children}</AppLayoutWrapper>;
    }
    
    // If user is not logged in, we shouldn't be in this layout, but as a fallback, show a loader
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-4 text-muted-foreground">Redirecting to login...</span>
        </div>
    );
};


export default function AppGroupLayout({ children }: { children: ReactNode }) {
    return (
        <AuthWrapper>
            {children}
        </AuthWrapper>
    );
}
