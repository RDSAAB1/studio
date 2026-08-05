"use client";

import React from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";

interface ProcessingOverlayProps {
  show: boolean;
  isDeleting?: boolean;
  isSuccess?: boolean;
  title?: string;
  description?: string;
}

export function ProcessingOverlay({ 
    show, 
    isDeleting, 
    isSuccess,
    title,
    description 
}: ProcessingOverlayProps) {
  return (
    <Dialog open={show}>
      <DialogContent className="max-w-xs p-0 overflow-hidden border-0 bg-transparent shadow-none outline-none focus:ring-0">
        <div className="relative overflow-hidden rounded-2xl bg-zinc-950/95 p-8 text-center backdrop-blur-xl border border-amber-500/40 shadow-[0_0_50px_-10px_rgba(245,158,11,0.4)]">
          {/* Dark Yellow Ambient Background Glows */}
          <div className="absolute -top-24 -left-24 h-48 w-48 bg-amber-500/25 blur-[60px]" />
          <div className="absolute -bottom-24 -right-24 h-48 w-48 bg-amber-600/20 blur-[60px]" />
          
          <div className="relative z-10 space-y-5">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.3)]">
              <AnimatePresence mode="wait">
                {isSuccess ? (
                  <motion.div
                    key="success"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <CheckCircle2 className="h-10 w-10 text-amber-400 stroke-[2.2]" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="processing"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                  >
                    <Loader2 className="h-10 w-10 text-amber-500 animate-spin will-change-transform stroke-[2.2]" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <motion.div 
              className="space-y-1.5"
              animate={{ opacity: 1 }}
              initial={{ opacity: 0 }}
              key={isSuccess ? "success-text" : "processing-text"}
            >
              <DialogTitle className="text-xl font-bold tracking-tight text-white leading-tight">
                {title || (isSuccess 
                  ? "Success!" 
                  : (isDeleting ? "Deleting..." : "Processing..."))}
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-amber-200/80">
                {description || (isSuccess 
                  ? "Task completed successfully." 
                  : "Please wait while we finalize the records.")}
              </DialogDescription>
            </motion.div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
