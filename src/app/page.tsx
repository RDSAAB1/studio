
"use client";

import { Loader2 } from 'lucide-react';

export default function Home() {
  // The redirection logic is now handled entirely by the LayoutController in layout.tsx.
  // This page just shows a loading indicator while the auth state is being checked.
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
