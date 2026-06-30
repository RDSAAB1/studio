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
    <div
      id={id}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative flex items-center rounded-full p-[2px] cursor-pointer transition-all duration-300 ease-in-out select-none bg-muted/80 border border-border/60",
        className
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCheckedChange(!checked);
        }
      }}
    >
      {/* Sliding background pill */}
      <div
        className={cn(
          "absolute top-[2px] bottom-[2px] rounded-full bg-primary transition-all duration-300 ease-in-out shadow-[0_1px_3px_rgba(0,0,0,0.15)]",
          checked
            ? "left-[calc(50%+1px)] right-[2px]"
            : "left-[2px] right-[calc(50%+1px)]"
        )}
      />

      {/* Left Label */}
      <div
        className={cn(
          "flex-1 text-center font-medium transition-colors duration-200 z-10 flex items-center justify-center h-full select-none",
          !checked ? "text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {displayLeft}
      </div>

      {/* Right Label */}
      <div
        className={cn(
          "flex-1 text-center font-medium transition-colors duration-200 z-10 flex items-center justify-center h-full select-none",
          checked ? "text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {displayRight}
      </div>
    </div>
  );
};

