
"use client";

import React, { useState, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from 'next/navigation';
import { Inter, Space_Grotesk, Source_Code_Pro } from 'next/font/google';
import './globals.css';
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { Loader2 } from 'lucide-react';
import AppLayout from "@/components/layout/app-layout";
import LoginPage from "./login/page";

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

  useEffect(() => {
    const bypassState = sessionStorage.getItem('bypass') === 'true';
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
    sessionStorage.removeItem('bypass');
    // The redirect will be handled by the LayoutController
  };

  const isAuthenticated = !!user || isBypassed;

  return (
    <AuthContext.Provider value={{ user, authLoading, isAuthenticated, isBypassed, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function LayoutController({ children }: { children: ReactNode }) {
    const { isAuthenticated, authLoading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading) {
            if (!isAuthenticated && pathname !== '/login') {
                router.replace('/login');
            } else if (isAuthenticated && pathname === '/login') {
                router.replace('/dashboard-overview');
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
        // Only render LoginPage if not authenticated.
        // This prevents AppLayout from ever rendering on the login page.
        return <LoginPage />;
    }

    // If authenticated, render the main app layout.
    return <AppLayout>{children}</AppLayout>;
}


// --- Root Layout ---
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${sourceCodePro.variable}`}>
        <body className="font-body antialiased">
            <AuthProvider>
                <LayoutController>
                    {children}
                </LayoutController>
            </AuthProvider>
        </body>
    </html>
  );
}
