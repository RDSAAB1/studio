
import type { Metadata } from 'next';
import { Inter, Space_Grotesk, Source_Code_Pro } from 'next/font/google';
import './globals.css';
import MainLayout from '@/components/layout/main-layout';
import { HeartHandshake } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';

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

// Note: `pageMeta` is now defined in main-layout as it depends on client-side navigation.
// This metadata is for the overall app.
export const metadata: Metadata = {
  title: 'BizSuite DataFlow',
  description: 'Welcome to BizSuite DataFlow',
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${sourceCodePro.variable}`}>
      <body className="font-body antialiased">
        <MainLayout>
          {children}
        </MainLayout>
      </body>
    </html>
  );
}
