
"use client";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import React, { useState, useEffect, useMemo } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { CheckCircle, CheckCircle2, AlertCircle, Info, X } from "lucide-react";

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

  const backdropRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stopGlobalCapture = (e: MouseEvent | TouchEvent | PointerEvent) => {
      const el = backdropRef.current;
      if (el && e.target instanceof Node && el.contains(e.target)) {
        if (activeToast) {
          const targetEl = e.target as HTMLElement;
          const isDismissBtn = targetEl.closest('[data-dismiss-btn="true"]');
          if (isDismissBtn && (e.type === 'click' || e.type === 'pointerup')) {
            dismiss(activeToast.id);
          }
        }
        e.stopPropagation();
      }
    };

    const events = ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup'];
    events.forEach(evt => window.addEventListener(evt, stopGlobalCapture as any, { capture: true }));

    return () => {
      events.forEach(evt => window.removeEventListener(evt, stopGlobalCapture as any, { capture: true }));
    };
  }, [activeToast, dismiss]);

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
          icon: <CheckCircle2 className="h-10 w-10 text-amber-400 mb-2" />, 
          bg: "bg-gradient-to-b from-[#241b12] to-[#140e0a] border-amber-500/40",
          text: "text-amber-200/90",
          title: "text-white"
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
        ref={backdropRef}
        className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center p-6 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300"
        style={{ pointerEvents: 'auto' }} // Ensure overlay catches clicks so user can dismiss it by clicking the 'X' or outside
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onPointerUp={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onMouseUp={(e) => { e.stopPropagation(); e.preventDefault(); }}
    >
      <div
        className={cn(
          "relative max-w-[420px] w-full p-8 rounded-3xl border shadow-[0_32px_64px_rgba(0,0,0,0.5)] flex flex-col items-center text-center scale-up-center animate-in zoom-in duration-300",
          style.bg
        )}
      >
        <button
            data-dismiss-btn="true"
            onClick={() => dismiss(activeToast.id)}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-amber-500/20 transition-colors"
            aria-label="Close"
         >
            <X className="h-5 w-5 text-amber-400/80 hover:text-amber-200 pointer-events-none" />
         </button>

        <div className="mb-2">
            {style.icon}
        </div>
        
        {activeToast.title && (
          <h3 className={cn("text-2xl font-bold mb-2 tracking-tight", style.title)}>
            {activeToast.title}
          </h3>
        )}
        
        {activeToast.description && (
          <p className={cn("text-base font-medium leading-relaxed", style.text)}>
            {activeToast.description}
          </p>
        )}

        <button 
            data-dismiss-btn="true"
            onClick={() => dismiss(activeToast.id)}
            className="mt-6 px-8 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-full text-sm font-bold text-amber-300 hover:text-amber-100 transition-all shadow-sm"
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
