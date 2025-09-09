
"use client";

import React, { useState, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from 'next/navigation';
import { Inter, Space_Grotesk, Source_Code_Pro } from 'next/font/google';
import './globals.css';
import CustomSidebar from '@/components/layout/custom-sidebar';
import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

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

const UNPROTECTED_ROUTES = ['/login', '/setup/connect-gmail', '/setup/company-details'];

// --- Auth Context and Provider ---
const AuthContext = React.createContext<{ user: User | null; authLoading: boolean }>({
  user: null,
  authLoading: true,
});

export const useAuth = () => React.useContext(AuthContext);

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- Auth Gate (Handles redirection) ---
function AuthGate({ children }: { children: ReactNode }) {
    const { user, authLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const isProtected = !UNPROTECTED_ROUTES.includes(pathname);

    useEffect(() => {
        if (!authLoading) {
            if (!user && isProtected) {
                router.replace('/login');
            }
            if (user && !isProtected) {
                router.replace('/dashboard-overview');
            }
        }
    }, [user, authLoading, isProtected, router, pathname]);

    if (authLoading) {
         return (
             <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!user && isProtected) {
        // Render nothing, redirection is in progress
        return null;
    }
    
    if (user && !isProtected) {
        // Render nothing, redirection is in progress
        return null;
    }

    return <>{children}</>;
}


// --- Root Layout ---
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
    const pathname = usePathname();
    const isProtected = !UNPROTECTED_ROUTES.includes(pathname);
    const [isSidebarActive, setIsSidebarActive] = useState(false);

    const toggleSidebar = () => {
        setIsSidebarActive(prev => !prev);
    };

    const handleSignOut = async () => {
        try {
            await signOut(getFirebaseAuth());
            // AuthProvider will handle state change and AuthGate will redirect
        } catch (error) {
            console.error("Error signing out: ", error);
        }
    };
    
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${sourceCodePro.variable}`}>
      <body className="font-body antialiased">
        <AuthProvider>
            <AuthGate>
                {isProtected ? (
                     <div className={cn("wrapper", isSidebarActive && "active")}>
                        <CustomSidebar isSidebarActive={isSidebarActive} />
                        <div className="main_container">
                            <Header
                                toggleSidebar={toggleSidebar}
                                onSignOut={handleSignOut}
                            />
                            <main className="content">
                                {children}
                            </main>
                            {isSidebarActive && typeof window !== 'undefined' && window.innerWidth < 1024 && <div className="shadow" onClick={toggleSidebar}></div>}
                        </div>
                    </div>
                ) : (
                    children
                )}
            </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
