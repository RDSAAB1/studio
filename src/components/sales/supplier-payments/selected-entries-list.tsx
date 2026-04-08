"use client";

import React from "react";
import { formatCurrency } from "@/lib/utils";
import type { ReceiptGovCalculation } from "./hooks/use-gov-receipt-logic";

interface SelectedEntriesListProps {
  selectedReceiptCalculations: ReceiptGovCalculation[];
}

export const SelectedEntriesList = React.memo(({
  selectedReceiptCalculations
}: SelectedEntriesListProps) => {
  if (selectedReceiptCalculations.length === 0) return null;

  return (
    <div className="text-[9px] text-muted-foreground border border-dashed border-border/60 rounded-md px-2 py-1 bg-muted/20">
      <span className="font-semibold">Entries: </span>
      {selectedReceiptCalculations.map((calc, i) => (
        <span key={calc.srNo || i}>
          {i > 0 && ", "}
          <span className="font-mono">{calc.srNo}</span>
          <span className="text-muted-foreground/80"> (Norm: {formatCurrency(calc.normalAmount)}, Extra: {formatCurrency(calc.extraAmount)})</span>
        </span>
      ))}
    </div>
  );
});

SelectedEntriesList.displayName = "SelectedEntriesList";
