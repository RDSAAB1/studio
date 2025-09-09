
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
import { DynamicIslandToaster } from "@/components/ui/dynamic-island-toaster";

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
const AuthContext = React.createContext<{ user: User | null; authLoading: boolean; isBypassed: boolean; }>({
  user: null,
  authLoading: true,
  isBypassed: false,
});

export const useAuth = () => React.useContext(AuthContext);

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isBypassed, setIsBypassed] = useState(false);
  const [isClient, setIsClient] = useState(false); 

  useEffect(() => {
    setIsClient(true); 
    const bypassState = sessionStorage.getItem('bypass') === 'true';
    setIsBypassed(bypassState);
    
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, authLoading, isBypassed }}>
      {children}
    </AuthContext.Provider>
  );
}


// --- Root Layout ---
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
    const pathname = usePathname();
    const [isSidebarActive, setIsSidebarActive] = useState(false);

    const toggleSidebar = () => {
        setIsSidebarActive(prev => !prev);
    };

    const handleSignOut = async () => {
        try {
            await signOut(getFirebaseAuth());
            sessionStorage.removeItem('bypass'); // Clear the bypass session on sign out
            window.location.href = '/login'; // Force a full redirect to clear all state
        } catch (error) {
            console.error("Error signing out: ", error);
        }
    };
    
    const showLayout = !UNPROTECTED_ROUTES.includes(pathname);

  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${sourceCodePro.variable}`}>
      <body className="font-body antialiased">
        <AuthProvider>
          {showLayout ? (
            <div className={cn("wrapper", isSidebarActive && "active")}>
              <CustomSidebar isSidebarActive={isSidebarActive} />
              <div className="main_container">
                <Header toggleSidebar={toggleSidebar} onSignOut={handleSignOut} />
                <main className="content">{children}</main>
                {isSidebarActive && typeof window !== 'undefined' && window.innerWidth < 1024 && (
                  <div className="shadow" onClick={toggleSidebar}></div>
                )}
              </div>
               <DynamicIslandToaster />
            </div>
          ) : (
            children
          )}
        </AuthProvider>
      </body>
    </html>
  );
}
