
"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getFirebaseAuth, onAuthStateChanged, getRedirectResult, type User } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { getRtgsSettings } from "@/lib/firestore";
import AppLayoutWrapper from '@/components/layout/app-layout';
import { initialDataSync } from '@/lib/database';


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


    if (!authChecked || (user && isSetupComplete === null)) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 <span className="ml-4 text-muted-foreground">Initializing...</span>
            </div>
        );
    }
    
    // If not authenticated and on a public page, children (which are null for this layout) can be returned,
    // and the public layout will handle rendering. If on an app page, the redirect above will have fired.
    if (!user) {
        return null;
    }

    // If authenticated but setup is not complete and not on the settings page, we're in a loading/redirect state.
    if (isSetupComplete === false && pathname !== '/settings') {
         return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-4 text-muted-foreground">Redirecting to settings...</span>
            </div>
        );
    }

    return (
        <AppLayoutWrapper>
            {children}
        </AppLayoutWrapper>
    );
};

export default function AppGroupLayout({ children }: { children: ReactNode }) {
    return (
        <AuthWrapper>
            {children}
        </AuthWrapper>
    );
}
