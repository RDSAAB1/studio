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
        <div className="relative overflow-hidden rounded-2xl bg-slate-900/90 p-8 text-center backdrop-blur-xl border border-white/10 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]">
          {/* Animated background glows */}
          <div className="absolute -top-24 -left-24 h-48 w-48 bg-blue-500/10 blur-[60px]" />
          <div className="absolute -bottom-24 -right-24 h-48 w-48 bg-emerald-500/10 blur-[60px]" />
          
          <div className="relative z-10 space-y-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)]">
              <AnimatePresence mode="wait">
                {isSuccess ? (
                  <motion.div
                    key="success"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="processing"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                  >
                    <Loader2 className="h-10 w-10 text-blue-400 animate-spin will-change-transform" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <motion.div 
              className="space-y-2"
              animate={{ opacity: 1 }}
              initial={{ opacity: 0 }}
              key={isSuccess ? "success-text" : "processing-text"}
            >
              <DialogTitle className="text-xl font-bold tracking-tight text-white leading-tight">
                {title || (isSuccess 
                  ? "Success!" 
                  : (isDeleting ? "Deleting..." : "Processing..."))}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-400">
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
