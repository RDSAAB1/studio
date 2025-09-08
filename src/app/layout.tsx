
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
import { getCompanySettings, getRtgsSettings } from "@/lib/firestore";
import { Loader2 } from "lucide-react";
import { allMenuItems, type MenuItem } from '@/hooks/use-tabs';

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


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isSidebarActive, setIsSidebarActive] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const pathname = usePathname();
  const router = useRouter();
  
  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setLoading(true);
        if (currentUser) {
            setUser(currentUser);
            const companySettings = await getCompanySettings(currentUser.uid);
            const rtgsSettings = await getRtgsSettings();

            if (!companySettings || !companySettings.appPassword) {
                if (pathname !== '/setup/connect-gmail') router.replace('/setup/connect-gmail');
            } else if (!rtgsSettings) {
                if (pathname !== '/setup/company-details') router.replace('/setup/company-details');
            } else if (UNPROTECTED_ROUTES.includes(pathname) || pathname === '/') {
                 router.replace('/dashboard-overview');
            }
        } else {
            setUser(null);
            if (!UNPROTECTED_ROUTES.includes(pathname)) {
                router.replace('/login');
            }
        }
        setLoading(false);
    });
    return () => unsubscribe();
  }, [pathname, router]);

  const toggleSidebar = () => setIsSidebarActive(!isSidebarActive);

  const handleSignOut = async () => {
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
      router.replace('/login');
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  if (loading) {
      return (
        <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${sourceCodePro.variable}`}>
          <body className="font-body antialiased">
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </body>
        </html>
      );
  }
  
  if (!user && !UNPROTECTED_ROUTES.includes(pathname)) {
    return (
        <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${sourceCodePro.variable}`}>
          <body className="font-body antialiased">
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </body>
        </html>
    );
  }

  if (UNPROTECTED_ROUTES.includes(pathname)) {
    return (
       <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${sourceCodePro.variable}`}>
          <body className="font-body antialiased">{children}</body>
       </html>
    );
  }

  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${sourceCodePro.variable}`}>
      <body className="font-body antialiased">
        <div className={cn("wrapper", isSidebarActive && "active")}>
            <div onMouseEnter={() => setIsSidebarActive(true)} onMouseLeave={() => setIsSidebarActive(false)}>
                <CustomSidebar isSidebarActive={isSidebarActive} />
            </div>
            <div className="main_container">
                <Header 
                  toggleSidebar={toggleSidebar}
                  user={user}
                  onSignOut={handleSignOut}
                />
                <main className="content">
                    {children}
                </main>
                {isSidebarActive && window.innerWidth < 1024 && <div className="shadow" onClick={toggleSidebar}></div>}
            </div>
        </div>
      </body>
    </html>
  );
}
