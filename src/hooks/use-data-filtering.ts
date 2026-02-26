"use client";

import { useMemo } from "react";
import type { DependencyList } from "react";

export const useDataFiltering = <T>(
  data: T[],
  predicate: (item: T) => boolean,
  deps: DependencyList
) => {
  return useMemo(() => data.filter(predicate), [data, predicate, ...deps]);
};
