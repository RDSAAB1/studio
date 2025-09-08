
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // The auth check in RootLayout will handle the redirect.
    // This page can be a fallback or loading indicator if needed.
    router.replace('/dashboard-overview');
  }, [router]);

  return null; // or a loading spinner
}
