"use client";

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const DashboardClient = dynamic(() => import('./dashboard-client'), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  ),
});

// This is now the main dashboard page, rendered at the root '/'.
export default function DashboardPage() {
  return <DashboardClient />;
}
