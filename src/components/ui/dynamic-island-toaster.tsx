
"use client";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import React from "react";

export function DynamicIslandToaster() {
  const { toasts } = useToast();
  const hasToasts = toasts.length > 0;
  const toast = toasts[0]; // Always work with the first toast

  const title = toast ? toast.title : null;
  const description = toast ? toast.description : null;

  return (
    <div
      key={toast?.id || 'empty-toast'}
      className={cn(
        "relative z-[100] transition-all duration-300 ease-in-out",
        "bg-background text-card-foreground border border-border/50 shadow-lg",
        "flex items-center justify-center rounded-full",
        "h-9 min-h-[2.25rem]", // 36px height
        hasToasts ? "w-auto min-w-[20rem] max-w-md px-4" : "w-48",
        hasToasts ? "animate-in scale-100" : "animate-out scale-95"
      )}
    >
        {hasToasts && (
          <div className="flex h-full w-full items-center justify-center gap-2">
            <div className="flex-grow text-center overflow-hidden">
              {title && <span className="font-semibold text-sm truncate block">{String(title)}</span>}
              {description && <span className="text-xs text-muted-foreground truncate block">{String(description)}</span>}
            </div>
            {toast.action}
          </div>
        )}
    </div>
  );
}
