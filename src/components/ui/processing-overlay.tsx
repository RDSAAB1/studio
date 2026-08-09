"use client";

import React from "react";
import { Loader2, CheckCircle2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";

interface ProcessingOverlayProps {
  show: boolean;
  isDeleting?: boolean;
  isSuccess?: boolean;
  title?: string;
  description?: string;
  onClose?: () => void;
}

export function ProcessingOverlay({ 
    show, 
    isDeleting, 
    isSuccess,
    title,
    description,
    onClose
}: ProcessingOverlayProps) {
  const [, forceUpdate] = React.useState({});
  React.useEffect(() => {
    const handler = () => forceUpdate({});
    window.addEventListener('jrmd-theme-updated', handler);
    return () => window.removeEventListener('jrmd-theme-updated', handler);
  }, []);

  const themeHeaderBg = "var(--header-bg, var(--header-active-bg, var(--primary-bg-custom, hsl(var(--primary)))))";
  const subtitleColor = `color-mix(in srgb, ${themeHeaderBg} 45%, #0f172a 55%)`;

  if (!show) return null;

  const displayTitle = title || (isSuccess ? "Success!" : isDeleting ? "Deleting..." : "Processing...");
  const displayDescription = description || (isSuccess ? "Task completed successfully." : "Please wait while we finalize the records...");

  return (
    <Dialog open={show} onOpenChange={(open) => { if (!open && onClose) onClose(); }}>
      <DialogContent className="!bg-transparent !border-0 !shadow-none !p-0 !max-w-[380px] overflow-visible outline-none focus:ring-0 [&>button]:hidden !animate-none">
        {/* Radix Accessibility Requirements */}
        <DialogTitle className="sr-only">{displayTitle}</DialogTitle>
        <DialogDescription className="sr-only">{displayDescription}</DialogDescription>

        {/* Light 3D Neumorphic Card Window (Group 1 Theme Rules) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="relative overflow-hidden rounded-2xl p-7 text-center transition-all duration-200 select-none"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #ffffff 40%, #eef0f3 100%)',
            borderTop: '1px solid #ffffff',
            borderLeft: '1px solid #ffffff',
            borderRight: '1px solid #c8d0d9',
            borderBottom: '1px solid #b8c2cc',
            boxShadow: 'inset 1px 1px 0px #ffffff, inset -1px -1px 0px rgba(0,0,0,0.04), 6px 12px 28px -2px rgba(0,0,0,0.18), 2px 4px 10px rgba(0,0,0,0.08)'
          }}
        >
          {/* Top-Right Circular Close Button [X] (Following Group 1 Theme Color) */}
          <button
            onClick={() => onClose?.()}
            className="absolute right-3.5 top-3.5 z-20 h-7 w-7 rounded-full bg-slate-100/90 flex items-center justify-center border transition-all duration-200 hover:bg-slate-200/90 hover:scale-105 active:scale-95 cursor-pointer shadow-xs group"
            style={{ borderColor: `color-mix(in srgb, ${themeHeaderBg} 35%, #cbd5e1)` }}
            title="Close"
          >
            <X 
              className="h-3.5 w-3.5 transition-colors" 
              style={{ color: themeHeaderBg }}
            />
          </button>
          
          <div className="relative z-10 flex flex-col items-center space-y-4 pt-1">
            {/* Center Circular Light 3D Spinner Bubble */}
            <div className="relative flex items-center justify-center">
              <div 
                className="relative flex h-18 w-18 items-center justify-center rounded-full border transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
                  borderColor: `color-mix(in srgb, ${themeHeaderBg} 40%, #cbd5e1)`,
                  boxShadow: 'inset 0 1px 2px #ffffff, 0 4px 12px rgba(0,0,0,0.08)'
                }}
              >
                <AnimatePresence mode="wait">
                  {isSuccess ? (
                    <motion.div
                      key="success"
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <CheckCircle2 
                        className="h-9 w-9 stroke-[2.2]" 
                        style={{ color: themeHeaderBg }} 
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <Loader2 
                        className="h-9 w-9 animate-spin stroke-[2.2]" 
                        style={{ color: themeHeaderBg }} 
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-1.5 px-2">
              <h3 
                className="text-xl font-black tracking-tight leading-snug drop-shadow-2xs"
                style={{ color: themeHeaderBg }}
              >
                {displayTitle}
              </h3>
              <p 
                className="text-xs font-bold leading-relaxed"
                style={{ color: subtitleColor }}
              >
                {displayDescription}
              </p>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
