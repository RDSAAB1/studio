
"use client";

import { useEffect } from 'react';
import AppLayoutWrapper from '@/components/layout/app-layout';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Inter, Space_Grotesk, Source_Code_Pro } from 'next/font/google';
import { useToast } from '@/hooks/use-toast';


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


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
    const { toast } = useToast();

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            const handleServiceWorkerMessage = (event: MessageEvent) => {
                if (event.data && event.data.type === 'SW_ACTIVATED') {
                    toast({
                        title: "Application is ready for offline use.",
                        variant: 'success',
                    });
                }
            };

            navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then(registration => {
                    console.log('SW registered: ', registration);
                }).catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                });
            });

             // Cleanup
            return () => {
                navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
            };
        }
    }, [toast]);
  
  return (
    <html lang="en">
        <head>
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#4F46E5" />
        </head>
       <body className={`${inter.variable} ${spaceGrotesk.variable} ${sourceCodePro.variable} font-body antialiased`}>
        <AppLayoutWrapper>
          {children}
        </AppLayoutWrapper>
        <Toaster />
      </body>
    </html>
  );
}
