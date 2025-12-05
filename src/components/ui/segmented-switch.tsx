"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SegmentedSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  leftLabel?: string;
  rightLabel?: string;
  leftValue?: string;
  rightValue?: string;
  className?: string;
  id?: string;
}

export const SegmentedSwitch: React.FC<SegmentedSwitchProps> = ({
  checked,
  onCheckedChange,
  leftLabel = "Off",
  rightLabel = "On",
  leftValue,
  rightValue,
  className,
  id,
}) => {
  const displayLeft = leftValue || leftLabel;
  const displayRight = rightValue || rightLabel;

  return (
    <button
      type="button"
      id={id}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative w-40 h-7 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 ease-in-out bg-muted/60 border border-border overflow-hidden",
        className
      )}
    >
      {/* Background labels - always visible */}
      <span className={cn(
        "absolute left-4 text-[10px] font-semibold transition-colors z-0",
        !checked ? "text-muted-foreground/70" : "text-foreground"
      )}>
        {displayLeft}
      </span>
      <span className={cn(
        "absolute right-4 text-[10px] font-semibold transition-colors z-0",
        checked ? "text-muted-foreground/70" : "text-foreground"
      )}>
        {displayRight}
      </span>
      
      {/* Sliding indicator */}
      <div
        className={cn(
          "absolute w-[calc(50%-4px)] h-[calc(100%-8px)] top-1 rounded-full shadow-md flex items-center justify-center transition-transform duration-300 ease-in-out bg-primary z-10",
          checked ? "left-[calc(50%+2px)]" : "left-[2px]"
        )}
        style={{
          transform: checked ? 'translateX(0)' : 'translateX(0)',
        }}
      >
        <span className="text-[10px] font-bold text-primary-foreground">
          {checked ? displayRight : displayLeft}
        </span>
      </div>
    </button>
  );
};

