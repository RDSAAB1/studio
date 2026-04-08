"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { isValid } from "date-fns";

export type SortKey = "entry" | "date" | "original" | "extra" | "paid" | "cd" | "outstanding" | "advanceFreight";
export type SortDirection = "asc" | "desc";

interface UseTransactionManagementProps {
  suppliers: any[];
  externalActiveTab?: string;
  onTabChange?: (tab: string) => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  embed?: boolean;
  compact?: boolean;
  maxRows?: number;
}

export function useTransactionManagement({
  suppliers,
  externalActiveTab,
  onTabChange,
  selectedIds,
  onSelectionChange,
  embed,
  compact,
  maxRows
}: UseTransactionManagementProps) {
  const [internalActiveTab, setInternalActiveTab] = useState("outstanding");
  const activeTab = externalActiveTab ?? internalActiveTab;
  const setActiveTab = onTabChange ?? setInternalActiveTab;

  const shouldSkipInitialSort = Boolean(embed && compact && !maxRows && (suppliers?.length || 0) > 800);
  const userSortTouchedRef = useRef(false);

  const [sortKey, setSortKey] = useState<SortKey | null>(() => (shouldSkipInitialSort ? null : "entry"));
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    if (userSortTouchedRef.current) return;
    if (shouldSkipInitialSort) {
      if (sortKey !== null) setSortKey(null);
      return;
    }
    if (sortKey === null) setSortKey("entry");
  }, [shouldSkipInitialSort, sortKey]);

  const getSerialNumberForSort = (entry: any): number => {
    const srNo = entry.srNo || '';
    if (!srNo) return 0;
    const numericMatch = srNo.toString().match(/\d+/);
    return numericMatch ? parseInt(numericMatch[0], 10) : 0;
  };

  const transactionCounts = useMemo(() => {
    const counts = { all: 0, outstanding: 0, running: 0, profitable: 0, paid: 0 };
    if (!Array.isArray(suppliers) || suppliers.length === 0) return counts;

    counts.all = suppliers.length;
    for (const t of suppliers) {
      const totalPaid = t.totalPaidForEntry ?? t.totalPaid ?? 0;
      const original = t.originalNetAmount ?? 0;
      const outstanding = Number(t.outstandingForEntry ?? t.netAmount ?? 0);

      if (outstanding < 1) counts.paid += 1;
      else if (outstanding < 200) counts.profitable += 1;
      else if (outstanding >= 200 && totalPaid > 0) counts.running += 1;

      if (totalPaid === 0 && original > 0) counts.outstanding += 1;
    }
    return counts;
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    if (!Array.isArray(suppliers) || suppliers.length === 0) return [];
    if (!activeTab || activeTab === "all") return suppliers;

    return suppliers.filter((t: any) => {
      const totalPaid = t.totalPaidForEntry ?? t.totalPaid ?? 0;
      const original = t.originalNetAmount ?? 0;
      const outstanding = Number(t.outstandingForEntry ?? t.netAmount ?? 0);

      switch (activeTab) {
        case "outstanding":
          return totalPaid === 0 && original > 0;
        case "running":
          return outstanding >= 200 && totalPaid > 0;
        case "profitable":
          return outstanding >= 1 && outstanding < 200;
        case "paid":
          return outstanding < 1;
        default:
          return true;
      }
    });
  }, [activeTab, suppliers]);

  const sortedFilteredSuppliers = useMemo(() => {
    if (!sortKey) return filteredSuppliers;
    const items = [...filteredSuppliers];

    const compareNumber = (a: number, b: number) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    };

    const compareMaybeNumber = (a: number | null, b: number | null) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return compareNumber(a, b);
    };

    const getSortValue = (entry: any) => {
      switch (sortKey) {
        case "entry":
          return getSerialNumberForSort(entry);
        case "date": {
          const dateObj = entry?.date ? new Date(entry.date) : null;
          if (!dateObj || !isValid(dateObj)) return null;
          return dateObj.getTime();
        }
        case "original":
          return Number(entry.adjustedOriginal !== undefined ? entry.adjustedOriginal : entry.originalNetAmount || 0);
        case "extra":
          return Number(entry.totalExtraForEntry ?? entry.totalGovExtraForEntry ?? 0);
        case "paid":
          return Number(entry.totalPaidForEntry ?? entry.totalPaid ?? 0);
        case "cd":
          return Number(entry.totalCdForEntry ?? entry.totalCd ?? 0);
        case "outstanding":
          return Number(entry.outstandingForEntry ?? entry.netAmount ?? 0);
        case "advanceFreight":
          return Number(entry.advanceFreight || 0);
        default:
          return 0;
      }
    };

    const directionMultiplier = sortDirection === "asc" ? 1 : -1;

    items.sort((a, b) => {
      const valueA = getSortValue(a);
      const valueB = getSortValue(b);

      const raw = sortKey === "date"
        ? compareMaybeNumber(valueA as number | null, valueB as number | null)
        : compareNumber(Number(valueA), Number(valueB));

      if (raw !== 0) return raw * directionMultiplier;
      const srFallback = compareNumber(getSerialNumberForSort(a), getSerialNumberForSort(b));
      return srFallback === 0 ? 0 : srFallback * -1;
    });

    return items;
  }, [filteredSuppliers, sortDirection, sortKey]);

  const requestSort = (key: SortKey) => {
    userSortTouchedRef.current = true;
    setSortKey((currentKey) => {
      if (currentKey === key) {
        setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
        return currentKey;
      }
      setSortDirection(key === "outstanding" ? "desc" : "asc");
      return key;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    const allEntryIds = sortedFilteredSuppliers.map((c: any) => c.id);
    onSelectionChange(checked ? new Set(allEntryIds) : new Set());
  };

  const handleRowSelect = (id: string) => {
    const newSelectedIds = new Set(selectedIds);
    if (newSelectedIds.has(id)) {
      newSelectedIds.delete(id);
    } else {
      newSelectedIds.add(id);
    }
    onSelectionChange(newSelectedIds);
  };

  return {
    activeTab,
    setActiveTab,
    sortKey,
    sortDirection,
    transactionCounts,
    sortedFilteredSuppliers,
    requestSort,
    handleSelectAll,
    handleRowSelect
  };
}
