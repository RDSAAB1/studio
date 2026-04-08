"use client";

import { Loader2 } from "lucide-react";

interface ProcessingOverlayProps {
  show: boolean;
  isDeleting: boolean;
}

export function ProcessingOverlay({ show, isDeleting }: ProcessingOverlayProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="flex items-center gap-3 rounded-lg bg-background px-6 py-4 shadow-lg">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {isDeleting ? "Deleting payment..." : "Processing payment..."}
          </span>
          <span className="text-xs text-muted-foreground">
            Please wait, background tasks are completing.
          </span>
        </div>
      </div>
    </div>
  );
}
