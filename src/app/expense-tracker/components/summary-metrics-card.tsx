"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SummaryMetricsCardProps {
  metrics: Array<{ label: string; value: string; tone?: string; subtext?: string }>;
}

export const SummaryMetricsCard = ({ metrics }: SummaryMetricsCardProps) => (
  <Card>
    <CardContent className="p-2 sm:p-3">
      <div className="flex flex-wrap items-stretch gap-2 sm:gap-3">
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className={cn(
              "flex-1 min-w-[140px] sm:pl-0",
              index !== 0 && "sm:border-l sm:border-border/40 sm:pl-4"
            )}
          >
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              {metric.label}
            </div>
            <div className={cn("mt-0.5 text-base font-semibold text-foreground", metric.tone)}>
              {metric.value}
            </div>
            {metric.subtext && (
              <div className="text-[11px] text-muted-foreground mt-0.5">{metric.subtext}</div>
            )}
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

