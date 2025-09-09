
"use client";
import ClientLayoutWrapper from '@/components/client-layout-wrapper';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { DynamicIslandToaster } from '@/components/ui/dynamic-island-toaster';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ClientLayoutWrapper>
          {children}
        </ClientLayoutWrapper>
      </body>
    </html>
  );
}
