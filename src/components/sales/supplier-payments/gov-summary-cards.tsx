"use client";

import React from "react";
import { DollarSign, TrendingUp, Wallet, Coins } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface GovSummaryCardsProps {
  availableCount: number;
  govRequiredAmount: number;
  calculatedBaseAmount: number;
  calculatedExtraAmount: number;
  extraAmountBaseType: 'receipt' | 'target';
}

export const GovSummaryCards = React.memo(({
  availableCount,
  govRequiredAmount,
  calculatedBaseAmount,
  calculatedExtraAmount,
  extraAmountBaseType
}: GovSummaryCardsProps) => {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      <div className="flex flex-col rounded-[10px] border border-border/70 bg-muted/30 px-2 py-1.5 shadow-[0_2px_8px_rgba(15,23,42,0.12)]">
        <span className="text-[8px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-0.5">
          <DollarSign className="h-2.5 w-2.5" /> Available
        </span>
        <span className="mt-0.5 text-[11px] font-bold tabular-nums text-foreground">{availableCount}</span>
      </div>
      <div className="flex flex-col rounded-[10px] border border-border/70 bg-muted/30 px-2 py-1.5 shadow-[0_2px_8px_rgba(15,23,42,0.12)]">
        <span className="text-[8px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-0.5">
          <TrendingUp className="h-2.5 w-2.5" /> {extraAmountBaseType === 'target' ? 'Required GOV' : 'Total GOV'}
        </span>
        <span className="mt-0.5 text-[11px] font-bold tabular-nums text-primary">{formatCurrency(govRequiredAmount)}</span>
      </div>
      <div className="flex flex-col rounded-[10px] border border-border/70 bg-muted/30 px-2 py-1.5 shadow-[0_2px_8px_rgba(15,23,42,0.12)]">
        <span className="text-[8px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-0.5">
          <Wallet className="h-2.5 w-2.5" /> Normal
        </span>
        <span className="mt-0.5 text-[11px] font-bold tabular-nums text-foreground">{formatCurrency(calculatedBaseAmount)}</span>
      </div>
      <div className="flex flex-col rounded-[10px] border border-border/70 bg-muted/30 px-2 py-1.5 shadow-[0_2px_8px_rgba(15,23,42,0.12)]">
        <span className="text-[8px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-0.5">
          <Coins className="h-2.5 w-2.5" /> Gov Extra
        </span>
        <span className="mt-0.5 text-[11px] font-bold tabular-nums text-primary">{formatCurrency(calculatedExtraAmount)}</span>
      </div>
    </div>
  );
});

GovSummaryCards.displayName = "GovSummaryCards";
