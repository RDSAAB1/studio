
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getFirebaseAuth, onAuthStateChanged } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in, redirect to the main dashboard.
        // The AuthWrapper in the layout will handle setup checks.
        router.replace('/dashboard-overview');
      } else {
        // No user is signed in, redirect to the login page.
        router.replace('/login');
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [router]);

  // Show a loading indicator while the auth state is being determined.
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
