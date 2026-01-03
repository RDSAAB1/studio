
"use client";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import React, { useState, useEffect } from "react";

export default function DynamicIslandToaster() {
  const { toasts } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This will only run on the client side, after the component has mounted
    setIsClient(true);
  }, []);
  
  if (!isClient) {
    // On the server or during the initial client render, render nothing
    // to avoid the hydration mismatch.
    return null;
  }

  // Filter out success toasts - only show errors/warnings
  const filteredToasts = toasts.filter(t => t.variant === 'destructive' || (!t.variant && t.title?.toString().toLowerCase().includes('error')));
  const hasToasts = filteredToasts.length > 0;
  const toast = filteredToasts[0]; // Always work with the first toast

  const title = toast ? toast.title : null;
  const description = toast ? toast.description : null;

  return (
    <div
      className={cn(
        "relative z-[100] transition-all duration-300 ease-in-out pointer-events-none",
        "bg-background text-primary border border-border/50 shadow-lg",
        "flex items-center justify-center rounded-full",
        "h-8",
        {
          "w-8": !hasToasts, // Punch-hole size when no toasts
          "w-auto min-w-48 max-w-sm px-4": hasToasts, // Expands with content
        }
      )}
      style={{
        // Ensure it doesn't block interactions
        pointerEvents: 'none',
      }}
    >
      <div
        key={toast?.id || 'empty'}
        className={cn(
          "w-full h-full flex items-center justify-center transition-opacity duration-300 pointer-events-none",
          { "opacity-100": hasToasts, "opacity-0": !hasToasts }
        )}
      >
        {hasToasts && (
          <div className="flex-grow text-center overflow-hidden pointer-events-none">
            {title && <span className="font-semibold text-sm truncate block">{String(title)}</span>}
            {description && <span className="text-xs text-muted-foreground truncate block">{String(description)}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
