"use client";

import { useMemo } from "react";
import { sumBy } from "@/lib/calculation-helpers";

type ChartPoint = {
  name: string;
  value: number;
};

export const usePieChartData = <T>(
  items: T[],
  getName: (item: T) => string,
  getValue: (item: T) => number
): ChartPoint[] => {
  return useMemo(() => {
    const grouped = new Map<string, number>();
    items.forEach((item) => {
      const name = getName(item) || "Uncategorized";
      const value = getValue(item);
      const current = grouped.get(name) ?? 0;
      grouped.set(name, current + value);
    });
    return Array.from(grouped.entries()).map(([name, value]) => ({ name, value }));
  }, [items, getName, getValue]);
};

export const useTotalValue = <T>(
  items: T[],
  selector: (item: T) => number
): number => {
  return useMemo(() => sumBy(items, selector), [items, selector]);
};

