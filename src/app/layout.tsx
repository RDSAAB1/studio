
"use client";

import type { Metadata } from 'next';
import { Inter, Space_Grotesk, Source_Code_Pro } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import MainLayout from '@/components/layout/main-layout';
import type { PageMeta } from '@/app/types';
import { HeartHandshake, Briefcase } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/layout/header';

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

// export const metadata: Metadata = {
//   title: 'BizSuite DataFlow',
//   description: 'Data entry and management software',
// };

// Default metadata for layout
export const pageMeta: PageMeta = {
  title: 'Dashboard',
  icon: <HeartHandshake />,
  description: 'Welcome to BizSuite DataFlow'
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default to open to avoid hydration mismatch
  const sidebarRef = useRef(null);

  // Handle initial sidebar state based on screen size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        // On large screens, set to collapsed by default on client-side
        setIsSidebarOpen(false); 
      }
    };
    handleResize(); // Set initial state on client mount
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Handle clicks outside the sidebar to close it on small screens
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isSidebarOpen && window.innerWidth < 1024 && sidebarRef.current && !(sidebarRef.current as any).contains(event.target)) {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen]);

  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${sourceCodePro.variable}`}>
      <body className="font-body antialiased">
        <MainLayout 
          pageMeta={pageMeta} 
          pathname={pathname}
          isSidebarOpen={isSidebarOpen}
          toggleSidebar={toggleSidebar}
          setIsSidebarOpen={setIsSidebarOpen}
          sidebarRef={sidebarRef}
        >
          <Header pageMeta={pageMeta} toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </MainLayout>
        <Toaster />
      </body>
    </html>
  );
}
