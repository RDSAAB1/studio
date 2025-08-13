
"use client";

import type { Metadata } from 'next';
import { Inter, Space_Grotesk, Source_Code_Pro } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import MainLayout from '@/components/layout/main-layout';
import type { PageMeta } from '@/app/types';
import { HeartHandshake } from 'lucide-react';

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
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${sourceCodePro.variable}`}>
      <body className="font-body antialiased">
        <MainLayout pageMeta={pageMeta}>
          {children}
        </MainLayout>
        <Toaster />
      </body>
    </html>
  );
}
