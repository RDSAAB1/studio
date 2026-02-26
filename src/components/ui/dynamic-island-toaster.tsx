
"use client";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import React, { useState, useEffect, useMemo } from "react";
import { ErrorBoundary } from "@/components/error-boundary";

/**
 * A Dynamic Island style toaster component.
 * It displays error and warning toasts in a pill-shaped container.
 * Success toasts are ignored (as per requirement).
 */
function DynamicIslandToasterInner() {
  const { toasts } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const filteredToasts = useMemo(() => {
    if (!isClient) {
      return [];
    }
    
    return toasts.filter((t) => {
      if (t.variant === 'success') {
        return false;
      }
      
      if (t.variant === 'destructive') {
        return true;
      }
      
      const titleStr = t.title?.toString().toLowerCase() || '';
      const descStr = t.description?.toString().toLowerCase() || '';
      const errorKeywords = ['error', 'failed', 'failure', 'invalid', 'warning', 'alert', 'issue', 'problem'];
      
      const hasErrorKeyword = errorKeywords.some(keyword => 
        titleStr.includes(keyword) || descStr.includes(keyword)
      );
      
      return hasErrorKeyword;
    });
  }, [toasts, isClient]);
  
  if (!isClient) {
    return null;
  }
  
  const hasToasts = filteredToasts.length > 0;
  const toast = filteredToasts[0];

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
          "w-8": !hasToasts,
          "w-auto min-w-48 max-w-sm px-4": hasToasts,
        }
      )}
      style={{
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

/**
 * Wrapper for DynamicIslandToasterInner with ErrorBoundary.
 * Ensures that toaster crashes don't break the entire app.
 */
export default function DynamicIslandToaster() {
  return (
    <ErrorBoundary>
      <DynamicIslandToasterInner />
    </ErrorBoundary>
  );
}
