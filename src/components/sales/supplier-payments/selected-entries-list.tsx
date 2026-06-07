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
  return null;
});

SelectedEntriesList.displayName = "SelectedEntriesList";
