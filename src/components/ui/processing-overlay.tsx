import React from "react";
import { Loader2, CheckCircle2, X } from "lucide-react";
import { Dialog, DialogOverlay, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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

  const themeHeaderBg = "var(--header-bg, var(--header-active-bg, var(--primary-bg-custom, #F5A623)))";

  if (!show) return null;

  const displayTitle = title || (isSuccess ? "Success!" : isDeleting ? "Deleting..." : "Loading...");
  const displayDescription = description || (isSuccess ? "Task completed successfully." : "Please wait...");

  return (
    <Dialog open={show} onOpenChange={(open) => { if (!open && onClose) onClose(); }}>
      {/* Pure Clean White Overlay */}
      <DialogOverlay className="!bg-white/95 backdrop-blur-xs z-[999998]" />
      
      <DialogContent className="!bg-transparent !border-0 !shadow-none !p-0 !max-w-[360px] overflow-visible outline-none focus:ring-0 [&>button]:hidden !animate-none z-[999999]">
        {/* Radix Accessibility Requirements */}
        <DialogTitle className="sr-only">{displayTitle}</DialogTitle>
        <DialogDescription className="sr-only">{displayDescription}</DialogDescription>

        {/* Clean White Card Container with Group 1 Header Color Theme Spinner */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="relative overflow-hidden rounded-2xl p-6 text-center shadow-xl border border-slate-200/80 bg-white select-none"
        >
          {onClose && (
            <button
              onClick={() => onClose()}
              className="absolute right-3.5 top-3.5 z-20 h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 transition-all hover:bg-slate-200 cursor-pointer shadow-2xs"
              title="Close"
            >
              <X 
                className="h-3.5 w-3.5 text-slate-700" 
              />
            </button>
          )}
          
          <div className="relative z-10 flex flex-col items-center space-y-3.5 pt-1">
            {/* Center Loading Spinner Bubble with Top Navigation Bar Color */}
            <div className="relative flex items-center justify-center">
              <div 
                className="relative flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white shadow-xs"
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
                        className="h-8 w-8 stroke-[2.5]" 
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
                        className="h-8 w-8 animate-spin stroke-[2.5]" 
                        style={{ color: themeHeaderBg }} 
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-1 px-2">
              <h3 
                className="text-base font-black tracking-tight text-slate-900"
              >
                {displayTitle}
              </h3>
              <p 
                className="text-xs font-semibold text-slate-500"
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
