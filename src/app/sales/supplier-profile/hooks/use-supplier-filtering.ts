import { useMemo, useEffect } from 'react';
import type { CustomerSummary } from "@/lib/definitions";
import { toTitleCase } from "@/lib/utils";

export const useSupplierFiltering = (
  supplierSummaryMap: Map<string, CustomerSummary>,
  selectedSupplierKey: string | null,
  setSelectedSupplierKey: (key: string | null) => void,
  startDate?: Date,
  endDate?: Date,
  MILL_OVERVIEW_KEY?: string
) => {
  const filteredSupplierOptions = useMemo(() => {
    const allOptions = Array.from(supplierSummaryMap.entries()).map(([key, data]) => ({ 
      value: key, 
      label: `${toTitleCase(data.name)} ${data.contact ? `(${data.contact})` : ''}`.trim(),
      data 
    }));

    // If no date range, show all
    if (!startDate && !endDate) {
      return allOptions;
    }

    // Filter suppliers who have transactions in the date range
    return allOptions.filter(({ value, data }) => {
      // Always include Mill Overview
      if (value === MILL_OVERVIEW_KEY) return true;

      const hasTransactionsInRange = data.allTransactions?.some(t => {
        if (!t.date) return false;
        const transactionDate = new Date(t.date);
        
        if (startDate && endDate) {
          return transactionDate >= startDate && transactionDate <= endDate;
        } else if (startDate) {
          return transactionDate >= startDate;
        } else if (endDate) {
          return transactionDate <= endDate;
        }
        return true;
      });

      return hasTransactionsInRange;
    });
  }, [supplierSummaryMap, startDate, endDate, MILL_OVERVIEW_KEY]);

  // Auto-switch to Mill Overview if selected supplier is not in filtered list
  useEffect(() => {
    if (selectedSupplierKey && !filteredSupplierOptions.some(opt => opt.value === selectedSupplierKey)) {
      setSelectedSupplierKey(MILL_OVERVIEW_KEY || null);
    }
  }, [filteredSupplierOptions, selectedSupplierKey, setSelectedSupplierKey, MILL_OVERVIEW_KEY]);

  return { filteredSupplierOptions };
};
