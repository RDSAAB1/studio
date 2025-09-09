
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from './layout';

export default function Home() {
  const router = useRouter();
  const { user, authLoading, isBypassed } = useAuth();

  useEffect(() => {
    if (!authLoading) {
      if (user || isBypassed) {
        router.replace('/dashboard-overview');
      } else {
        router.replace('/login');
      }
    }
  }, [user, authLoading, isBypassed, router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
