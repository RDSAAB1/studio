export const sumBy = <T>(items: T[], selector: (item: T) => number): number =>
  items.reduce((total, item) => total + selector(item), 0);

export const groupSumByKey = <T, K extends string | number | symbol>(
  items: T[],
  getKey: (item: T) => K,
  getValue: (item: T) => number
): Record<K, number> => {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    const value = getValue(item);
    acc[key] = (acc[key] ?? 0) + value;
    return acc;
  }, {} as Record<K, number>);
};

export const percentageOf = (value: number, total: number) =>
  total > 0 ? (value / total) * 100 : 0;

export const safeNumber = (value: unknown, fallback = 0) => {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : fallback;
};

