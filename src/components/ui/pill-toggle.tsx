"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PillToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  leftLabel?: string;
  rightLabel?: string;
  id?: string;
  className?: string;
  containerClassName?: string;
}

export const PillToggle: React.FC<PillToggleProps> = ({
  checked,
  onCheckedChange,
  label,
  leftLabel = "Off",
  rightLabel = "On",
  id,
  className,
  containerClassName,
}) => {
  return (
    <div 
      className={cn("flex items-center space-x-2 px-2.5 h-8 rounded-md select-none", containerClassName)}
      style={{
        backgroundColor: "var(--toggle-container-bg, #1e293b)",
      }}
    >
      <button
        type="button"
        id={id}
        onClick={() => onCheckedChange(!checked)}
        className={cn("flex items-center h-6 rounded-full p-0.5 shadow-inner gap-0 cursor-pointer shrink-0 border-0", className)}
        style={{
          backgroundColor: "var(--toggle-inactive-bg, #cbd5e1)",
        }}
        title={label ? `Toggle ${label}` : "Toggle"}
      >
        <span
          className={cn(
            "px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider transition-all duration-200",
            !checked ? "font-bold shadow-sm" : "font-semibold hover:opacity-80"
          )}
          style={{
            backgroundColor: !checked ? "var(--toggle-active-bg, #d97706)" : "transparent",
            color: !checked ? "var(--toggle-active-text, #ffffff)" : "var(--toggle-inactive-text, #cbd5e1)",
          }}
        >
          {leftLabel}
        </span>
        <span
          className={cn(
            "px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider transition-all duration-200",
            checked ? "font-bold shadow-sm" : "font-semibold hover:opacity-80"
          )}
          style={{
            backgroundColor: checked ? "var(--toggle-active-bg, #d97706)" : "transparent",
            color: checked ? "var(--toggle-active-text, #ffffff)" : "var(--toggle-inactive-text, #cbd5e1)",
          }}
        >
          {rightLabel}
        </span>
      </button>
      {label && (
        <span
          onClick={() => onCheckedChange(!checked)}
          className="text-[10px] font-bold uppercase cursor-pointer tracking-wider select-none whitespace-nowrap"
          style={{
            color: "var(--toggle-label-text, #cbd5e1)",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
};
