import type { LedgerEntry } from "@/lib/definitions";
import { format } from "date-fns";

export const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const CASH_DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

export const recalculateBalances = (entries: LedgerEntry[]): LedgerEntry[] => {
  // Since entries are displayed newest first, we need to calculate balance from oldest to newest
  // First, sort by date (oldest first) for calculation
  const sortedForCalculation = [...entries].sort((a, b) => {
    if (a.date && b.date) {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
  
  // Calculate balance from oldest to newest
  let runningBalance = 0;
  const withBalances = sortedForCalculation.map((entry) => {
    runningBalance = runningBalance + entry.debit - entry.credit;
    return { ...entry, balance: Math.round(runningBalance * 100) / 100 };
  });
  
  // Create a map of balances by entry ID
  const balanceMap = new Map(withBalances.map(e => [e.id, e.balance]));
  
  // Return original order with correct balances
  return entries.map((entry) => ({
    ...entry,
    balance: balanceMap.get(entry.id) ?? entry.balance,
  }));
};

export const sortEntries = (entries: LedgerEntry[]): LedgerEntry[] => {
  // Sort by date (latest first), then by createdAt if dates are same
  return [...entries].sort((a, b) => {
    // First compare by date field if available
    if (a.date && b.date) {
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
    }
    // If dates are same or not available, sort by createdAt (latest first)
    return b.createdAt.localeCompare(a.createdAt);
  });
};

export const generateLinkGroupId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `link_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

export const parseAmount = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const formatStatementDate = (value: string) => {
  try {
    return format(new Date(`${value}T00:00:00`), "dd MMM yyyy");
  } catch {
    return value;
  }
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

