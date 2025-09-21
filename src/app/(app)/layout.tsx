
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
            if (isSetupComplete === false && pathname !== '/settings') {
                 router.replace('/settings');
            } else if (isSetupComplete === true && (pathname === '/login' || pathname === '/')) {
                router.replace('/dashboard-overview');
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
    
    if (!user) {
        return null;
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
