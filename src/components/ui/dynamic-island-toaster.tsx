
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

  const hasToasts = toasts.length > 0;

  return (
    <div
      className={cn(
        "relative z-[100] transition-all duration-500 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]",
        "bg-background text-card-foreground border border-border/50 shadow-lg",
        "flex items-center justify-center rounded-full",
        "h-12 min-h-[3rem]", // Fixed height
        // Base state (collapsed pill)
        "w-32",
        // Expanded state
        { "w-96": hasToasts } // Expands width, not height
      )}
    >
      {toasts.map(function ({ id, title, description, variant, action }) {
        const icon = ICONS[variant as keyof typeof ICONS] || ICONS.default;
        return (
          <div
            key={id}
            className={cn(
              "w-full h-full flex items-center gap-3 transition-opacity duration-300 px-4",
              "animate-in fade-in"
            )}
          >
            <div className="flex-shrink-0">{icon}</div>
            <div className="flex-grow grid gap-0.5 text-left">
              {title && <p className="font-semibold text-sm leading-none">{title}</p>}
              {description && (
                <p className="text-xs opacity-80 leading-tight">
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
