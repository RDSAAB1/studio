
"use client";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import React, { useState, useEffect, useMemo } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

/**
 * Centered Toaster — shows a large, bold notification dead-center of the window.
 * This is triggered for important notifications (Success/Failure) to ensure visibility.
 * USES STANDARD CSS INSTEAD OF FRAMER-MOTION TO PREVENT BUILD ERRORS.
 */
function CenteredToasterInner() {
  const { toasts, dismiss } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Show the most recent non-dismissed toast if it's important (success/destructive)
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
        return { 
          icon: <AlertCircle className="h-10 w-10 text-red-500 mb-2" />, 
          bg: "bg-red-950/95 border-red-500/50",
          text: "text-red-50",
          title: "text-red-200"
        };
      case "success":
        return { 
          icon: <CheckCircle className="h-10 w-10 text-emerald-500 mb-2" />, 
          bg: "bg-emerald-950/95 border-emerald-500/50",
          text: "text-emerald-50",
          title: "text-emerald-200"
        };
      default:
        return { 
          icon: <Info className="h-10 w-10 text-blue-500 mb-2" />, 
          bg: "bg-slate-900/95 border-slate-700/50",
          text: "text-slate-50",
          title: "text-slate-300"
        };
    }
  };

  const style = activeToast ? getStyle(activeToast.variant as string) : { icon: null, bg: "", text: "", title: "" };

  if (!hasToast || !activeToast) return null;

  return (
    <div 
        className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center p-6 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300"
        style={{ pointerEvents: 'auto' }} // Ensure overlay catches clicks so user can dismiss it by clicking the 'X' or outside (if added)
    >
      <div
        className={cn(
          "relative max-w-[420px] w-full p-8 rounded-3xl border shadow-[0_32px_64px_rgba(0,0,0,0.5)] flex flex-col items-center text-center scale-up-center animate-in zoom-in duration-300",
          style.bg
        )}
      >
        <button
           onClick={() => dismiss(activeToast.id)}
           className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
           aria-label="Close"
        >
           <X className="h-5 w-5 text-white/40 hover:text-white/80" />
        </button>

        <div className="mb-2">
            {style.icon}
        </div>
        
        {activeToast.title && (
          <h3 className={cn("text-2xl font-bold mb-3", style.title)}>
            {activeToast.title}
          </h3>
        )}
        
        {activeToast.description && (
          <p className={cn("text-base leading-relaxed opacity-90", style.text)}>
            {activeToast.description}
          </p>
        )}

        <button 
            onClick={() => dismiss(activeToast.id)}
            className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-sm font-medium transition-colors"
        >
            Dismiss
        </button>
      </div>
    </div>
  );
}

export default function CenteredToaster() {
  return (
    <ErrorBoundary>
      <CenteredToasterInner />
    </ErrorBoundary>
  );
}
