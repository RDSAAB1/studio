
"use client";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import React, { useState, useEffect, useMemo } from "react";

export default function DynamicIslandToaster() {
  const { toasts } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This will only run on the client side, after the component has mounted
    setIsClient(true);
  }, []);
  
  // ✅ FIX: Move useMemo before early return to follow Rules of Hooks
  // ✅ IMPROVED: Better error detection - check variant, title, and description
  // Filter out success toasts - only show errors/warnings
  const filteredToasts = useMemo(() => {
    // Return empty array if not client yet (to avoid hydration issues)
    if (!isClient) {
      return [];
    }
    
    return toasts.filter((t) => {
      // Explicitly exclude success toasts
      if (t.variant === 'success') {
        return false;
      }
      
      // Show destructive (error) toasts
      if (t.variant === 'destructive') {
        return true;
      }
      
      // Check for error keywords in title or description
      const titleStr = t.title?.toString().toLowerCase() || '';
      const descStr = t.description?.toString().toLowerCase() || '';
      const errorKeywords = ['error', 'failed', 'failure', 'invalid', 'warning', 'alert', 'issue', 'problem'];
      
      const hasErrorKeyword = errorKeywords.some(keyword => 
        titleStr.includes(keyword) || descStr.includes(keyword)
      );
      
      return hasErrorKeyword;
    });
  }, [toasts, isClient]);
  
  // Early return after all hooks are called
  if (!isClient) {
    // On the server or during the initial client render, render nothing
    // to avoid the hydration mismatch.
    return null;
  }
  
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
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={hasToasts ? "Notification" : "No notifications"}
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
