
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/sales/supplier-entry');
  }, [router]);

  // Render nothing or a loading spinner while redirecting
  return null;
}
