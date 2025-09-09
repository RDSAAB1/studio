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
    // The redirect will now be handled by the LayoutController component
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
    const [isSidebarActive, setIsSidebarActive] = useState(false);

    const toggleSidebar = () => {
        setIsSidebarActive(prev => !prev);
    };

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
        // Allow access to setup pages even if not authenticated
        if (pathname.startsWith('/setup')) {
            return <>{children}</>;
        }
        return <LoginPage />;
    }

    if (pathname === '/login') {
        // If user is authenticated but on login page, redirect to dashboard
        router.replace('/dashboard-overview');
        return ( // Return loader while redirecting
             <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // If authenticated, render the main app layout.
    return (
        <div className={cn("wrapper", isSidebarActive && "active")}>
            <CustomSidebar isSidebarActive={isSidebarActive} toggleSidebar={toggleSidebar} />
            <div className="main_container">
                <Header toggleSidebar={toggleSidebar} onSignOut={logout} />
                <main className="content">{children}</main>
            </div>
            {isSidebarActive && typeof window !== 'undefined' && window.innerWidth < 1024 && (
                <div className="shadow" onClick={toggleSidebar}></div>
            )}
            <DynamicIslandToaster />
        </div>
    )
}

// --- Main AppLayout Component ---
export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <LayoutController>
                {children}
            </LayoutController>
        </AuthProvider>
    );
}
