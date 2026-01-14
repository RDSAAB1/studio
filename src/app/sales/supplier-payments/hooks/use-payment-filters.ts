import { useState, useMemo, useCallback } from 'react';
import { toTitleCase } from '@/lib/utils';
import type { Customer } from "@/lib/definitions";
import type { CustomDropdownOption } from "@/components/ui/custom-dropdown";

interface UsePaymentFiltersProps {
  type: 'supplier' | 'customer' | 'outsider';
  filteredSupplierOptions: CustomDropdownOption[];
  supplierSummaryMap: Map<string, any>;
}

export function usePaymentFilters({
  type,
  filteredSupplierOptions,
  supplierSummaryMap,
  filterStartDate: externalFilterStartDate,
  setFilterStartDate: externalSetFilterStartDate,
  filterEndDate: externalFilterEndDate,
  setFilterEndDate: externalSetFilterEndDate,
  filterVariety: externalFilterVariety,
  setFilterVariety: externalSetFilterVariety,
}: UsePaymentFiltersProps & {
  filterStartDate?: Date | undefined;
  setFilterStartDate?: (date: Date | undefined) => void;
  filterEndDate?: Date | undefined;
  setFilterEndDate?: (date: Date | undefined) => void;
  filterVariety?: string;
  setFilterVariety?: (value: string) => void;
}) {
  const [internalFilterStartDate, setInternalFilterStartDate] = useState<Date | undefined>(undefined);
  const [internalFilterEndDate, setInternalFilterEndDate] = useState<Date | undefined>(undefined);
  const [internalFilterVariety, setInternalFilterVariety] = useState<string>("all");

  const filterStartDate = externalFilterStartDate ?? internalFilterStartDate;
  const setFilterStartDate = externalSetFilterStartDate ?? setInternalFilterStartDate;
  const filterEndDate = externalFilterEndDate ?? internalFilterEndDate;
  const setFilterEndDate = externalSetFilterEndDate ?? setInternalFilterEndDate;
  const filterVariety = externalFilterVariety ?? internalFilterVariety;
  const setFilterVariety = externalSetFilterVariety ?? setInternalFilterVariety;

  const isWithinDateRange = useCallback(
    (dateString?: string | Date) => {
      if (!filterStartDate && !filterEndDate) return true;
      if (!dateString) return false;
      const date =
        typeof dateString === "string" ? new Date(dateString) : dateString;
      if (Number.isNaN(date.getTime())) return false;
      if (filterStartDate && date < filterStartDate) return false;
      if (filterEndDate && date > filterEndDate) return false;
      return true;
    },
    [filterStartDate, filterEndDate]
  );

  const varietyFilteredSupplierOptions = useMemo(() => {
    if (type === 'outsider') return [];
    if (!filterVariety || filterVariety === "all") {
      return filteredSupplierOptions;
    }
    return filteredSupplierOptions.filter((option) => {
      const transactions = option.data?.allTransactions || [];
      return transactions.some(
        (transaction: Customer) =>
          toTitleCase(transaction?.variety || "") === filterVariety
      );
    });
  }, [type, filteredSupplierOptions, filterVariety]);

  const varietyOptions = useMemo(() => {
    if (type === 'outsider') return [];
    const varieties = new Set<string>();
    supplierSummaryMap.forEach((summary) => {
      summary?.allTransactions?.forEach((transaction: Customer) => {
        if (transaction?.variety) {
          varieties.add(toTitleCase(transaction.variety));
        }
      });
    });
    return Array.from(varieties).sort();
  }, [type, supplierSummaryMap]);

  const hasActiveFilters = Boolean(
    filterStartDate ||
    filterEndDate ||
    filterVariety !== "all"
  );

  const handleClearFilters = () => {
    setFilterStartDate(undefined);
    setFilterEndDate(undefined);
    setFilterVariety("all");
  };

  return {
    filterStartDate,
    setFilterStartDate,
    filterEndDate,
    setFilterEndDate,
    filterVariety,
    setFilterVariety,
    isWithinDateRange,
    varietyFilteredSupplierOptions,
    varietyOptions,
    hasActiveFilters,
    handleClearFilters,
  };
}

