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
        "bg-background text-card-foreground border border-border/50 shadow-lg",
        "flex items-center justify-center rounded-full",
        "h-9 min-h-[2.25rem]", // 36px height
        "w-32", // Collapsed width
        { "w-auto min-w-80 max-w-md px-4": hasToasts } // Expanded width
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
          <div className="flex h-full w-full items-center justify-start gap-3">
            <div className="flex-shrink-0">{icon}</div>
            {title && (
              <p className="flex-grow text-left text-sm font-semibold truncate">
                {String(title)}
              </p>
            )}
            {toast.action}
          </div>
        )}
      </div>
    </div>
  );
}
