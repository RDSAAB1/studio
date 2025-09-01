
"use client";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CheckCircle, Info, XCircle } from "lucide-react";
import React from "react";

const ICONS = {
  default: <Info className="h-5 w-5 text-blue-500" />,
  destructive: <XCircle className="h-5 w-5 text-red-500" />,
  success: <CheckCircle className="h-5 w-5 text-green-500" />,
};

export function DynamicIslandToaster() {
  const { toasts } = useToast();
  const hasToasts = toasts.length > 0;
  const toast = toasts[0]; // Always work with the first toast

  const icon = toast ? (ICONS[toast.variant as keyof typeof ICONS] || ICONS.default) : null;
  const title = toast ? toast.title : null;

  return (
    <div
      className={cn(
        "relative z-[100] transition-all duration-500 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]",
        "bg-card text-card-foreground border border-border/50 shadow-lg",
        "flex items-center justify-center rounded-full",
        "h-10",
        // Base state (collapsed pill)
        "w-32",
        // Expanded state
        { "w-96": hasToasts } // Expanded width
      )}
    >
      <div
        key={toast?.id || 'empty'}
        className={cn(
          "w-full h-full flex items-center justify-center transition-opacity duration-300",
          { "opacity-100 animate-in fade-in": hasToasts, "opacity-0": !hasToasts }
        )}
      >
        {hasToasts && (
          <div className="flex items-center justify-center gap-3 px-4">
            <div className="flex-shrink-0">{icon}</div>
            <div className="flex-grow text-left overflow-hidden">
              {title && <p className="font-semibold text-sm leading-none truncate">{String(title)}</p>}
            </div>
            {toast.action}
          </div>
        )}
      </div>
    </div>
  );
}
