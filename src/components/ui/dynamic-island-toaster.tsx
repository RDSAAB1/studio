
"use client";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CheckCircle, Info, XCircle } from "lucide-react";
import React from "react";

const ICONS = {
  default: <Info className="h-5 w-5 text-blue-400" />,
  destructive: <XCircle className="h-5 w-5 text-red-400" />,
  success: <CheckCircle className="h-5 w-5 text-green-400" />,
};

export function DynamicIslandToaster() {
  const { toasts } = useToast();

  return (
    <div
      className={cn(
        "relative z-[100] transition-all duration-500 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]",
        "bg-background text-card-foreground border border-border/50 shadow-lg",
        "flex items-center justify-center rounded-full",
        // Base state (collapsed)
        "w-8 min-h-[3rem]",
        // Expanded state
        { "w-full max-w-sm min-h-[3rem] p-3 rounded-2xl": toasts.length > 0 }
      )}
    >
      {toasts.map(function ({ id, title, description, variant, action }) {
        const icon = ICONS[variant as keyof typeof ICONS] || ICONS.default;
        return (
          <div
            key={id}
            className={cn(
              "w-full h-full flex items-center gap-3 transition-opacity duration-300",
              "animate-in fade-in"
            )}
          >
            <div className="flex-shrink-0">{icon}</div>
            <div className="flex-grow grid gap-1 text-left">
              {title && <p className="font-semibold text-sm leading-none">{title}</p>}
              {description && (
                <p className="text-xs opacity-80 leading-snug">
                  {description as string}
                </p>
              )}
            </div>
            {action}
          </div>
        );
      })}
    </div>
  );
}
