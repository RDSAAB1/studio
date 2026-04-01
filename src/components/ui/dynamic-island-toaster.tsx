
"use client";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import React, { useState, useEffect, useMemo } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

/**
 * Dynamic Island style toaster — sits in the header bar.
 * Shows ALL toast variants as a compact single-line pill.
 * Replaces the large bottom-of-screen Toaster entirely.
 */
function DynamicIslandToasterInner() {
  const { toasts, dismiss } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Show the most recent non-dismissed toast
  const activeToast = useMemo(() => {
    if (!isClient) return null;
    return toasts.find((t) => t.open !== false) ?? null;
  }, [toasts, isClient]);

  if (!isClient) return null;

  const hasToast = !!activeToast;

  // Pick icon + color based on variant
  const getStyle = (variant?: string) => {
    switch (variant) {
      case "destructive":
        return { icon: <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />, text: "text-red-200" };
      case "success":
        return { icon: <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-400" />, text: "text-green-200" };
      default:
        return { icon: <Info className="h-3.5 w-3.5 shrink-0 text-blue-300" />, text: "text-white/90" };
    }
  };

  const style = activeToast ? getStyle(activeToast.variant as string) : { icon: null, text: "" };

  // Combine title + description into a single short line
  const message = activeToast
    ? [activeToast.title, activeToast.description]
        .filter(Boolean)
        .map(String)
        .join(" · ")
    : "";

  return (
    <div
      className={cn(
        "relative z-[100] transition-all duration-300 ease-in-out",
        "bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg",
        "flex items-center rounded-full h-7",
        hasToast ? "w-auto max-w-[360px] min-w-[120px] px-3 gap-2 opacity-100" : "w-7 opacity-60"
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {hasToast ? (
        <>
          {style.icon}
          <span
            className={cn("text-xs font-medium truncate flex-1", style.text)}
            title={message}
          >
            {message}
          </span>
          <button
            onClick={() => activeToast && dismiss(activeToast.id)}
            className="shrink-0 ml-1 text-white/50 hover:text-white/90 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        </>
      ) : (
        // Idle: tiny dot indicator
        <span className="h-1.5 w-1.5 rounded-full bg-white/30 mx-auto" />
      )}
    </div>
  );
}

/**
 * Wrapper with ErrorBoundary to prevent toaster crashes from breaking the app.
 */
export default function DynamicIslandToaster() {
  return (
    <ErrorBoundary>
      <DynamicIslandToasterInner />
    </ErrorBoundary>
  );
}
