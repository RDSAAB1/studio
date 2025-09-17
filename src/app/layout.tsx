
"use client";

import { useEffect, type ReactNode } from 'react';
import AppLayoutWrapper from '@/components/layout/app-layout';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Inter, Space_Grotesk, Source_Code_Pro } from 'next/font/google';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { StateProvider } from '@/lib/state-store.tsx';


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
  children: ReactNode;
}) {
    const { toast } = useToast();

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            // Register the service worker immediately
            navigator.serviceWorker.register('/sw.js').then(registration => {
                console.log('SW registered: ', registration);
                
                registration.onupdatefound = () => {
                    const installingWorker = registration.installing;
                    if (installingWorker) {
                        installingWorker.onstatechange = () => {
                            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                toast({
                                    title: 'Update Available',
                                    description: 'A new version of the app is ready.',
                                    action: (
                                        <Button onClick={() => installingWorker.postMessage({ type: 'SKIP_WAITING' })} size="sm">
                                            Reload
                                        </Button>
                                    ),
                                    duration: Infinity
                                });
                            }
                        };
                    }
                };
            }).catch(err => {
                console.error('Service Worker registration failed:', err);
            });
            
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            });
        }
    }, [toast]);
  
  return (
    <html lang="en">
      <head>
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#4F46E5" />
        </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${sourceCodePro.variable} font-body antialiased`}>
        <StateProvider>
          <AppLayoutWrapper>
            {children}
          </AppLayoutWrapper>
        </StateProvider>
        <Toaster />
      </body>
    </html>
  );
}
