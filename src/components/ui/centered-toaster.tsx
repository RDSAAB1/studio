"use client";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import React, { useState, useEffect, useMemo } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

/**
 * Centered Toaster — shows a large, bold notification dead-center of the window.
 * Strictly follows Theme Settings Group 1 rules for Title, Icon, Close Button, Subtitle, and Action Button.
 */
function CenteredToasterInner() {
  const { toasts, dismiss } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [, forceUpdate] = useState({});

  useEffect(() => {
    setIsClient(true);
    const handler = () => forceUpdate({});
    window.addEventListener('jrmd-theme-updated', handler);
    return () => window.removeEventListener('jrmd-theme-updated', handler);
  }, []);

  const themeHeaderBg = "var(--header-bg, var(--header-active-bg, var(--primary-bg-custom, hsl(var(--primary)))))";
  const subtitleColor = `color-mix(in srgb, ${themeHeaderBg} 45%, #0f172a 55%)`;

  // Show the most recent non-dismissed toast if it's open
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

  if (!hasToast || !activeToast) return null;

  const isDestructive = activeToast.variant === "destructive";
  const isSuccess = activeToast.variant === "success";

  return (
    <div 
        ref={backdropRef}
        className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center p-6 bg-black/40 backdrop-blur-[3px] animate-in fade-in duration-200"
        style={{ pointerEvents: 'auto' }}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onPointerUp={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onMouseUp={(e) => { e.stopPropagation(); e.preventDefault(); }}
    >
      {/* Light 3D Neumorphic Container (Following Group 1 Rules) */}
      <div
        className="relative max-w-[380px] w-full p-7 rounded-2xl flex flex-col items-center text-center transition-all duration-200 select-none"
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #ffffff 40%, #eef0f3 100%)',
          borderTop: '1px solid #ffffff',
          borderLeft: '1px solid #ffffff',
          borderRight: '1px solid #c8d0d9',
          borderBottom: '1px solid #b8c2cc',
          boxShadow: 'inset 1px 1px 0px #ffffff, inset -1px -1px 0px rgba(0,0,0,0.04), 6px 12px 28px -2px rgba(0,0,0,0.18), 2px 4px 10px rgba(0,0,0,0.08)'
        }}
      >
        {/* Top-Right Circular Close Button [X] */}
        <button
            data-dismiss-btn="true"
            onClick={() => dismiss(activeToast.id)}
            className="absolute top-3.5 right-3.5 z-20 h-7 w-7 rounded-full bg-slate-100/90 flex items-center justify-center border transition-all duration-200 hover:bg-slate-200/90 hover:scale-105 active:scale-95 cursor-pointer shadow-xs group"
            style={{ borderColor: isDestructive ? '#fca5a5' : `color-mix(in srgb, ${themeHeaderBg} 35%, #cbd5e1)` }}
            aria-label="Close"
         >
            <X 
              className="h-3.5 w-3.5 transition-colors pointer-events-none"
              style={{ color: isDestructive ? "#dc2626" : themeHeaderBg }}
            />
         </button>

        {/* Top Centered Light 3D Icon Bubble */}
        <div 
          className="mb-3.5 flex h-16 w-16 items-center justify-center rounded-full border transition-all duration-300"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
            borderColor: isDestructive ? '#fca5a5' : `color-mix(in srgb, ${themeHeaderBg} 40%, #cbd5e1)`,
            boxShadow: 'inset 0 1px 2px #ffffff, 0 4px 12px rgba(0,0,0,0.08)'
          }}
        >
          {isDestructive ? (
            <AlertCircle className="h-8 w-8 text-red-500 stroke-[2.2]" />
          ) : isSuccess ? (
            <CheckCircle2 
              className="h-8 w-8 stroke-[2.2]" 
              style={{ color: themeHeaderBg }} 
            />
          ) : (
            <Info 
              className="h-8 w-8 stroke-[2.2]" 
              style={{ color: themeHeaderBg }} 
            />
          )}
        </div>
        
        {/* Title */}
        {activeToast.title && (
          <h3 
            className="text-xl font-black mb-1.5 tracking-tight leading-tight drop-shadow-2xs"
            style={{ color: isDestructive ? "#dc2626" : themeHeaderBg }}
          >
            {activeToast.title}
          </h3>
        )}
        
        {/* Subtitle Description */}
        {activeToast.description && (
          <p 
            className="text-xs font-bold leading-relaxed px-2 mb-1"
            style={{ color: isDestructive ? "#b91c1c" : subtitleColor }}
          >
            {activeToast.description}
          </p>
        )}

        {/* Light 3D Action Button */}
        <button 
            data-dismiss-btn="true"
            onClick={() => dismiss(activeToast.id)}
            className="mt-5 px-10 py-2.5 min-w-[150px] font-extrabold rounded-xl text-xs tracking-wider uppercase transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 border border-slate-300/80 shadow-md"
            style={{
              background: isDestructive 
                ? 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)' 
                : `linear-gradient(180deg, color-mix(in srgb, ${themeHeaderBg} 85%, white 15%) 0%, ${themeHeaderBg} 100%)`,
              boxShadow: isDestructive 
                ? 'inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 12px rgba(220,38,38,0.35)' 
                : `inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 14px color-mix(in srgb, ${themeHeaderBg} 40%, transparent 60%)`,
              color: 'var(--header-text-color, #ffffff)'
            }}
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
