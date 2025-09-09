
"use client";

import React, { useState, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { Loader2 } from 'lucide-react';
import CustomSidebar from './custom-sidebar';
import { Header } from "./header";
import { DynamicIslandToaster } from "@/components/ui/dynamic-island-toaster";
import LoginPage from "@/app/login/page";
import { cn } from "@/lib/utils";

// --- Auth Context and Provider ---
interface AuthContextType {
  user: User | null;
  authLoading: boolean;
  isAuthenticated: boolean;
  isBypassed: boolean;
  logout: () => Promise<void>;
}
const AuthContext = React.createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = React.useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isBypassed, setIsBypassed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const bypassState = typeof window !== 'undefined' ? sessionStorage.getItem('bypass') === 'true' : false;
    setIsBypassed(bypassState);
    
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const logout = async () => {
    const auth = getFirebaseAuth();
    await signOut(auth);
    if (typeof window !== 'undefined') {
        sessionStorage.removeItem('bypass');
    }
    router.push('/login'); 
  };

  const isAuthenticated = !!user || isBypassed;

  return (
    <AuthContext.Provider value={{ user, authLoading, isAuthenticated, isBypassed, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function LayoutController({ children }: { children: ReactNode }) {
    const { isAuthenticated, authLoading, logout } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading) {
            const isSetupPage = pathname.startsWith('/setup');
            if (!isAuthenticated && !isSetupPage && pathname !== '/login') {
                router.replace('/login');
            }
        }
    }, [isAuthenticated, authLoading, pathname, router]);

    if (authLoading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!isAuthenticated) {
        if (pathname.startsWith('/setup')) {
            return <>{children}</>;
        }
        return <LoginPage />;
    }

    if (pathname === '/login') {
        router.replace('/dashboard-overview');
        return ( 
             <div className="flex h-screen w-screen items-center justify-center bg-background">
                 <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
        );
    }

    return (
        <div className="flex min-h-screen">
           <CustomSidebar onSignOut={logout}>
                <main className="flex-1 p-4 sm:p-6 lg:p-8">
                    {children}
                </main>
           </CustomSidebar>
           <DynamicIslandToaster />
        </div>
    )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <LayoutController>
                {children}
            </LayoutController>
        </AuthProvider>
    );
}
