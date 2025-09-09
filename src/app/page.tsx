
"use client";
import AppLayout from '@/components/layout/app-layout';

export default function Home() {
  // This component now only renders the layout, which handles everything.
  return (
    <AppLayout>
        {/* Children are now handled inside AppLayout with Routes */}
    </AppLayout>
  );
}
