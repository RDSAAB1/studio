"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/database";
import type { LedgerAccount, LedgerEntry, LedgerAccountInput, LedgerCashAccount } from "@/lib/definitions";
import {
  fetchLedgerAccounts,
  createLedgerAccount,
  fetchLedgerEntries,
  createLedgerEntry,
  updateLedgerEntriesBatch,
  deleteLedgerEntry,
  fetchLedgerCashAccounts,
  createLedgerCashAccount,
  updateLedgerCashAccount,
  deleteLedgerCashAccount,
} from "@/lib/firestore";
import { Switch } from "@/components/ui/switch";
import { toTitleCase } from "@/lib/utils";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const CASH_DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

const recalculateBalances = (entries: LedgerEntry[]): LedgerEntry[] => {
  let runningBalance = 0;
  return entries.map((entry) => {
    runningBalance = runningBalance + entry.debit - entry.credit;
    return { ...entry, balance: Math.round(runningBalance * 100) / 100 };
  });
};

const sortEntries = (entries: LedgerEntry[]): LedgerEntry[] => {
  return [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

const generateLinkGroupId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `link_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const LedgerPage: React.FC = () => {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [entriesMap, setEntriesMap] = useState<Record<string, LedgerEntry[]>>({});
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [saving, setSaving] = useState(false);

  const [cashAccounts, setCashAccounts] = useState<LedgerCashAccount[]>([]);
  const [activeCashAccountId, setActiveCashAccountId] = useState<string | null>(null);
  const [showCashAccountForm, setShowCashAccountForm] = useState(false);
  const [newCashAccountName, setNewCashAccountName] = useState("");
  const [loadingCashAccounts, setLoadingCashAccounts] = useState(true);
  const [cashSaving, setCashSaving] = useState(false);

  const createEmptyNoteGroups = (): Record<string, number[]> =>
    CASH_DENOMINATIONS.reduce((acc, denomination) => {
      acc[denomination.toString()] = [0];
      return acc;
    }, {} as Record<string, number[]>);

  const normalizeNoteGroups = (noteGroups?: Record<string, number[]>) => {
    const base = createEmptyNoteGroups();
    CASH_DENOMINATIONS.forEach((denomination) => {
      const key = denomination.toString();
      if (noteGroups && Array.isArray(noteGroups[key]) && (noteGroups[key] as number[]).length) {
        base[key] = (noteGroups[key] as number[]).map((value) => Number(value) || 0);
      }
    });
    return base;
  };

  const [newAccount, setNewAccount] = useState<LedgerAccountInput>({
    name: "",
    address: "",
    contact: "",
  });

  const [entryForm, setEntryForm] = useState({
    date: new Date().toISOString().split("T")[0],
    particulars: "",
    debit: "",
    credit: "",
    remarks: "",
  });

  const [linkAccountId, setLinkAccountId] = useState<string>("");
  const [linkMode, setLinkMode] = useState<"mirror" | "same">("mirror");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    date: "",
    particulars: "",
    debit: "",
    credit: "",
    remarks: "",
  });

  const ledgerRef = useRef<HTMLDivElement>(null);

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === activeAccountId) || null,
    [accounts, activeAccountId]
  );

  const activeEntries = useMemo<LedgerEntry[]>(
    () => (activeAccountId ? entriesMap[activeAccountId] || [] : []),
    [entriesMap, activeAccountId]
  );

  const filteredEntries = useMemo(() => {
    if (!activeEntries.length) return [];
    const filtered = activeEntries.filter((entry) => {
      const entryDate = entry.date || "";
      if (dateFrom && entryDate < dateFrom) return false;
      if (dateTo && entryDate > dateTo) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      if (a.date === b.date) {
        return a.createdAt.localeCompare(b.createdAt);
      }
      return a.date.localeCompare(b.date);
    });
  }, [activeEntries, dateFrom, dateTo]);

  const displayEntries = useMemo(() => {
    let running = 0;
    return filteredEntries.map((entry) => {
      running = Math.round((running + entry.debit - entry.credit) * 100) / 100;
      return { ...entry, runningBalance: running };
    });
  }, [filteredEntries]);

  const groupedEntries = useMemo(() => {
    const groups: { date: string; entries: LedgerEntry[] }[] = [];
    let currentGroup: { date: string; entries: LedgerEntry[] } | null = null;

    displayEntries.forEach((entry) => {
      if (!currentGroup || currentGroup.date !== entry.date) {
        currentGroup = { date: entry.date, entries: [] };
        groups.push(currentGroup);
      }
      currentGroup.entries.push(entry);
    });

    return groups;
  }, [displayEntries]);

  const accountDropdownOptions = useMemo(
    () =>
      accounts.map((account) => {
        const labelParts = [
          account.name ? toTitleCase(account.name) : "Unnamed Account",
          account.address ? toTitleCase(account.address) : null,
          account.contact && account.contact.trim().length > 0 ? account.contact : null,
        ].filter(Boolean);

        return {
          value: account.id,
          label: labelParts.join(" | "),
          data: account,
        };
      }),
    [accounts]
  );

  const activeCashAccount = useMemo(
    () => cashAccounts.find((account) => account.id === activeCashAccountId) || null,
    [cashAccounts, activeCashAccountId]
  );

  const cashAccountOptions = useMemo(
    () =>
      cashAccounts.map((account) => ({
        value: account.id,
        label: toTitleCase(account.name),
        data: account,
      })),
    [cashAccounts]
  );

  const cashSummary = useMemo(() => {
    if (!activeCashAccount) {
      return {
        totalNotes: 0,
        totalAmount: 0,
        denominationTotals: {} as Record<string, { totalNotes: number; amount: number }>,
      };
    }

    const denominationTotals = CASH_DENOMINATIONS.reduce((acc, denomination) => {
      const key = denomination.toString();
      const counts = activeCashAccount.noteGroups[key] || [];
      const totalNotes = counts.reduce((sum, value) => sum + (Number(value) || 0), 0);
      acc[key] = { totalNotes, amount: totalNotes * denomination };
      return acc;
    }, {} as Record<string, { totalNotes: number; amount: number }>);

    const totalNotes = Object.values(denominationTotals).reduce((sum, entry) => sum + entry.totalNotes, 0);
    const totalAmount = Object.values(denominationTotals).reduce((sum, entry) => sum + entry.amount, 0);

    return { totalNotes, totalAmount, denominationTotals };
  }, [activeCashAccount]);

  useEffect(() => {
    if (linkAccountId && linkAccountId === activeAccountId) {
      setLinkAccountId("");
    }
    if (!linkAccountId) {
      setLinkMode("mirror");
    }
  }, [linkAccountId, activeAccountId]);

  useEffect(() => {
    let cancelled = false;

    const loadCashAccounts = async () => {
      setLoadingCashAccounts(true);
      try {
        const remoteAccounts = await fetchLedgerCashAccounts();
        if (cancelled) return;

        const normalized = remoteAccounts
          .map((account) => ({
            ...account,
            noteGroups: normalizeNoteGroups(account.noteGroups),
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setCashAccounts(normalized);
        setActiveCashAccountId((previous) => {
          if (previous && normalized.some((account) => account.id === previous)) {
            return previous;
          }
          return normalized[0]?.id ?? null;
        });
      } catch (error) {
        console.error("Failed to load cash accounts", error);
        toast({
          title: "Unable to load cash accounts",
          description: "We could not fetch cash accounts. Please try again.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) {
          setLoadingCashAccounts(false);
        }
      }
    };

    loadCashAccounts();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  // Load accounts from IndexedDB first, then sync from Firestore (with caching)
  useEffect(() => {
    let cancelled = false;

    const loadAccounts = async () => {
      try {
        if (typeof window !== "undefined" && db) {
          const cachedAccounts = await db.ledgerAccounts.toArray();
          if (!cancelled && cachedAccounts.length) {
            setAccounts(cachedAccounts);
            if (!activeAccountId) {
              setActiveAccountId(cachedAccounts[0].id);
            }
          }
        }

        if (typeof window === "undefined") {
          setLoadingAccounts(false);
          return;
        }

        const lastSynced = window.localStorage.getItem("ledgerAccountsLastSynced");
        const shouldSync = !lastSynced || Date.now() - Number(lastSynced) > CACHE_TTL_MS;

        if (!shouldSync) {
          setLoadingAccounts(false);
          return;
        }

        const remoteAccounts = await fetchLedgerAccounts();
        if (!cancelled) {
          setAccounts(remoteAccounts);
          if (!activeAccountId && remoteAccounts.length) {
            setActiveAccountId(remoteAccounts[0].id);
          }
        }

        if (db) {
          await db.transaction("rw", db.ledgerAccounts, async () => {
            await db.ledgerAccounts.clear();
            if (remoteAccounts.length) {
              await db.ledgerAccounts.bulkPut(remoteAccounts);
            }
          });
        }

        window.localStorage.setItem("ledgerAccountsLastSynced", String(Date.now()));
      } catch (error) {
        console.error("Failed to load ledger accounts", error);
        toast({
          title: "Unable to load accounts",
          description: "We could not fetch ledger accounts. Please try again.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    };

    loadAccounts();
    return () => {
      cancelled = true;
    };
  }, [activeAccountId, toast]);

  // Load entries whenever account changes
  useEffect(() => {
    if (!activeAccountId) return;

    let cancelled = false;

    const loadEntries = async () => {
      setLoadingEntries(true);
      try {
        if (db) {
          const cachedEntries = await db.ledgerEntries
            .where("accountId")
            .equals(activeAccountId)
            .toArray();
          if (!cancelled) {
            setEntriesMap((prev) => ({ ...prev, [activeAccountId]: sortEntries(cachedEntries) }));
          }
        }

        if (typeof window === "undefined") {
          setLoadingEntries(false);
          return;
        }

        const lastSyncedKey = `ledgerEntriesLastSynced:${activeAccountId}`;
        const lastSynced = window.localStorage.getItem(lastSyncedKey);
        const shouldSync = !lastSynced || Date.now() - Number(lastSynced) > CACHE_TTL_MS;

        if (!shouldSync) {
          setLoadingEntries(false);
          return;
        }

        const remoteEntries = await fetchLedgerEntries(activeAccountId);
        const sortedRemote = sortEntries(recalculateBalances(remoteEntries));
        if (!cancelled) {
          setEntriesMap((prev) => ({ ...prev, [activeAccountId]: sortedRemote }));
        }

        if (db) {
          await db.transaction("rw", db.ledgerEntries, async () => {
            await db.ledgerEntries.where("accountId").equals(activeAccountId).delete();
            if (sortedRemote.length) {
              await db.ledgerEntries.bulkPut(sortedRemote);
            }
          });
        }

        window.localStorage.setItem(lastSyncedKey, String(Date.now()));
      } catch (error) {
        console.error("Failed to load ledger entries", error);
        toast({
          title: "Unable to load entries",
          description: "We could not fetch ledger entries. Please try again.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoadingEntries(false);
      }
    };

    loadEntries();
    return () => {
      cancelled = true;
    };
  }, [activeAccountId, toast]);

  const persistEntriesToIndexedDb = async (accountId: string, entries: LedgerEntry[]) => {
    if (!db) return;
    await db.transaction("rw", db.ledgerEntries, async () => {
      await db.ledgerEntries.where("accountId").equals(accountId).delete();
      if (entries.length) {
        await db.ledgerEntries.bulkPut(entries);
      }
    });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`ledgerEntriesLastSynced:${accountId}`, String(Date.now()));
    }
  };

  const handleCreateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newAccount.name.trim()) return;

    setSaving(true);
    try {
      const payload: LedgerAccountInput = {
        name: newAccount.name.trim(),
        address: newAccount.address?.trim() || "",
        contact: newAccount.contact?.trim() || "",
      };

      const createdAccount = await createLedgerAccount(payload);
      setAccounts((prev) => {
        const updated = [...prev, createdAccount].sort((a, b) => a.name.localeCompare(b.name));
        return updated;
      });
      setEntriesMap((prev) => ({ ...prev, [createdAccount.id]: [] }));
      setActiveAccountId(createdAccount.id);

      if (db) {
        await db.ledgerAccounts.put(createdAccount);
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem("ledgerAccountsLastSynced", String(Date.now()));
      }

      toast({ title: "Account created" });
      setShowAccountForm(false);
      setNewAccount({ name: "", address: "", contact: "" });
    } catch (error: any) {
      console.error("Failed to create ledger account", error);
      toast({
        title: "Account creation failed",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCashAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = newCashAccountName.trim();
    if (!trimmedName || cashSaving) return;

    setCashSaving(true);
    try {
      const created = await createLedgerCashAccount({
        name: toTitleCase(trimmedName),
        noteGroups: createEmptyNoteGroups(),
      });

      const normalized: LedgerCashAccount = {
        ...created,
        noteGroups: normalizeNoteGroups(created.noteGroups),
      };

      setCashAccounts((prev) => [...prev, normalized].sort((a, b) => a.name.localeCompare(b.name)));
      setActiveCashAccountId(normalized.id);
      setNewCashAccountName("");
      setShowCashAccountForm(false);
      toast({ title: "Cash account created" });
    } catch (error: any) {
      console.error("Failed to create cash account", error);
      toast({
        title: "Unable to create cash account",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCashSaving(false);
    }
  };

  const persistCashAccount = (account: LedgerCashAccount) => {
    void updateLedgerCashAccount(account.id, {
      name: account.name,
      noteGroups: account.noteGroups,
    }).catch((error) => {
      console.error("Failed to update cash account", error);
      toast({
        title: "Unable to save cash account",
        description: "Recent changes could not be saved. Please retry.",
        variant: "destructive",
      });
    });
  };

  const updateCashAccount = (accountId: string, updater: (account: LedgerCashAccount) => LedgerCashAccount) => {
    let updatedAccount: LedgerCashAccount | null = null;
    setCashAccounts((prev) =>
      prev.map((account) => {
        if (account.id !== accountId) {
          return account;
        }
        const updated = updater(account);
        const normalized: LedgerCashAccount = {
          ...updated,
          noteGroups: normalizeNoteGroups(updated.noteGroups),
        };
        updatedAccount = normalized;
        return normalized;
      })
    );
    if (updatedAccount) {
      persistCashAccount(updatedAccount);
    }
  };

  const handleUpdateCashCount = (denomination: number, index: number, rawValue: string) => {
    if (!activeCashAccountId) return;
    const sanitized = Math.max(0, Math.floor(Number(rawValue) || 0));
    updateCashAccount(activeCashAccountId, (account) => {
      const key = denomination.toString();
      const counts = [...(account.noteGroups[key] || [0])];
      counts[index] = sanitized;
      return {
        ...account,
        noteGroups: { ...account.noteGroups, [key]: counts },
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const handleAddCashCountRow = (denomination: number) => {
    if (!activeCashAccountId) return;
    updateCashAccount(activeCashAccountId, (account) => {
      const key = denomination.toString();
      const counts = [...(account.noteGroups[key] || [])];
      counts.push(0);
      return {
        ...account,
        noteGroups: { ...account.noteGroups, [key]: counts.length ? counts : [0] },
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const handleRemoveCashCountRow = (denomination: number, index: number) => {
    if (!activeCashAccountId) return;
    updateCashAccount(activeCashAccountId, (account) => {
      const key = denomination.toString();
      const counts = [...(account.noteGroups[key] || [0])];
      if (counts.length === 1) {
        counts[0] = 0;
      } else {
        counts.splice(index, 1);
      }
      return {
        ...account,
        noteGroups: { ...account.noteGroups, [key]: counts.length ? counts : [0] },
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const handleResetCashAccount = () => {
    if (!activeCashAccountId || cashSaving) return;
    updateCashAccount(activeCashAccountId, (account) => ({
      ...account,
      noteGroups: createEmptyNoteGroups(),
      updatedAt: new Date().toISOString(),
    }));
    toast({ title: "Cash account cleared" });
  };

  const handleDeleteCashAccount = async (accountId: string) => {
    if (cashSaving) return;
    const target = cashAccounts.find((account) => account.id === accountId);
    if (!target) return;
    if (typeof window === "undefined" || !window.confirm(`Delete cash account "${target.name}"?`)) return;

    setCashSaving(true);
    try {
      await deleteLedgerCashAccount(accountId);
      setCashAccounts((prev) => {
        const next = prev.filter((account) => account.id !== accountId);
        setActiveCashAccountId((previousActive) => {
          if (previousActive === accountId) {
            return next[0]?.id ?? null;
          }
          return previousActive;
        });
        return next;
      });
      toast({ title: "Cash account deleted" });
    } catch (error: any) {
      console.error("Failed to delete cash account", error);
      toast({
        title: "Unable to delete cash account",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCashSaving(false);
    }
  };

  const handleAddEntry = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeAccountId || saving) return;

    const debitValue = Number(entryForm.debit) || 0;
    const creditValue = Number(entryForm.credit) || 0;
    if (!debitValue && !creditValue) {
      toast({ title: "Enter debit or credit amount", variant: "destructive" });
      return;
    }

    const linkTargetId = linkAccountId && linkAccountId !== activeAccountId ? linkAccountId : "";
    if (linkTargetId && !accounts.find((acc) => acc.id === linkTargetId)) {
      toast({ title: "Invalid linked account", variant: "destructive" });
      return;
    }

    const sanitizedDebit = Math.round(debitValue * 100) / 100;
    const sanitizedCredit = Math.round(creditValue * 100) / 100;

    const currentEntries = activeEntries;
    const previousBalance = currentEntries.at(-1)?.balance || 0;
    const nextBalance = Math.round((previousBalance + sanitizedDebit - sanitizedCredit) * 100) / 100;

    const linkGroupId = linkTargetId ? generateLinkGroupId() : undefined;

    setSaving(true);
    try {
      const primaryEntry = await createLedgerEntry({
        accountId: activeAccountId,
        date: entryForm.date,
        particulars: entryForm.particulars.trim() || "-",
        debit: sanitizedDebit,
        credit: sanitizedCredit,
        remarks: entryForm.remarks.trim() || undefined,
        balance: nextBalance,
        linkGroupId,
        linkStrategy: linkTargetId ? linkMode : undefined,
      });

      let updatedEntries = recalculateBalances([...currentEntries, primaryEntry]);
      setEntriesMap((prev) => ({ ...prev, [activeAccountId]: updatedEntries }));
      await persistEntriesToIndexedDb(activeAccountId, updatedEntries);

      if (linkTargetId) {
        const counterEntries = entriesMap[linkTargetId] || [];
        const counterPrevBalance = counterEntries.at(-1)?.balance || 0;
        const counterDebit = linkMode === "mirror"
          ? sanitizedCredit
          : sanitizedDebit;
        const counterCredit = linkMode === "mirror"
          ? sanitizedDebit
          : sanitizedCredit;
        const counterNextBalance = Math.round((counterPrevBalance + counterDebit - counterCredit) * 100) / 100;

        const counterEntry = await createLedgerEntry({
          accountId: linkTargetId,
          date: entryForm.date,
          particulars: entryForm.particulars.trim() || "-",
          debit: counterDebit,
          credit: counterCredit,
          remarks: entryForm.remarks.trim() || undefined,
          balance: counterNextBalance,
          linkGroupId,
          linkStrategy: linkMode,
        });

        const updatedCounterEntries = recalculateBalances([...counterEntries, counterEntry]);
        setEntriesMap((prev) => ({
          ...prev,
          [activeAccountId]: updatedEntries,
          [linkTargetId]: updatedCounterEntries,
        }));
        await persistEntriesToIndexedDb(linkTargetId, updatedCounterEntries);
      }

      toast({ title: "Entry added" });
      setEntryForm({
        date: new Date().toISOString().split("T")[0],
        particulars: "",
        debit: "",
        credit: "",
        remarks: "",
      });
      setLinkAccountId("");
      setLinkMode("mirror");
    } catch (error: any) {
      console.error("Failed to add ledger entry", error);
      toast({
        title: "Unable to add entry",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditEntry = (entry: LedgerEntry) => {
    setEditingEntryId(entry.id);
    setEditForm({
      date: entry.date,
      particulars: entry.particulars,
      debit: entry.debit ? entry.debit.toString() : "",
      credit: entry.credit ? entry.credit.toString() : "",
      remarks: entry.remarks || "",
    });
  };

  const handleCancelEdit = () => {
    setEditingEntryId(null);
    setEditForm({ date: "", particulars: "", debit: "", credit: "", remarks: "" });
  };

  const handleSaveEdit = async (entryId: string) => {
    if (!activeAccountId || saving) return;
    const currentEntries = activeEntries;
    const editedEntry = currentEntries.find((entry) => entry.id === entryId);
    if (!editedEntry) return;

    const debitValue = Number(editForm.debit) || 0;
    const creditValue = Number(editForm.credit) || 0;

    setSaving(true);
    try {
      const updatedEntriesRaw = currentEntries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              date: editForm.date,
              particulars: editForm.particulars.trim() || "-",
              debit: Math.round(debitValue * 100) / 100,
              credit: Math.round(creditValue * 100) / 100,
              remarks: editForm.remarks.trim() || undefined,
            }
          : entry
      );

      const recalculatedActive = recalculateBalances(updatedEntriesRaw);
      const timestamp = new Date().toISOString();
      const changedEntries: LedgerEntry[] = [];

      const finalActiveEntries = recalculatedActive.map((entry, idx) => {
        const previous = currentEntries[idx];
        const hasChanged =
          !previous ||
          entry.date !== previous.date ||
          entry.particulars !== previous.particulars ||
          entry.debit !== previous.debit ||
          entry.credit !== previous.credit ||
          entry.remarks !== previous.remarks ||
          entry.balance !== previous.balance;

        if (hasChanged) {
          const updatedEntry = { ...entry, updatedAt: timestamp };
          changedEntries.push(updatedEntry);
          return updatedEntry;
        }
        return entry;
      });

      let counterpartAccountId: string | null = null;
      let counterpartEntries: LedgerEntry[] | null = null;
      let counterpartUpdated: LedgerEntry[] | null = null;
      let strategy: "mirror" | "same" | undefined = editedEntry.linkStrategy;

      if (editedEntry.linkGroupId) {
        for (const [accId, entries] of Object.entries(entriesMap)) {
          if (accId === activeAccountId) continue;
          const match = entries.find((entry) => entry.linkGroupId === editedEntry.linkGroupId);
          if (match) {
            counterpartAccountId = accId;
            counterpartEntries = entries;
            if (!strategy && match.linkStrategy) {
              strategy = match.linkStrategy;
            }
            break;
          }
        }

        if (counterpartAccountId && counterpartEntries) {
          const counterpartUpdatedRaw = counterpartEntries.map((entry) =>
            entry.linkGroupId === editedEntry.linkGroupId
              ? {
                  ...entry,
                  date: editForm.date,
                  debit:
                    strategy === "same"
                      ? Math.round((Number(editForm.debit) || 0) * 100) / 100
                      : Math.round((Number(editForm.credit) || 0) * 100) / 100,
                  credit:
                    strategy === "same"
                      ? Math.round((Number(editForm.credit) || 0) * 100) / 100
                      : Math.round((Number(editForm.debit) || 0) * 100) / 100,
                  remarks: editForm.remarks.trim() || entry.remarks,
                  linkStrategy: entry.linkStrategy || strategy || "mirror",
                }
              : entry
          );

          const recalculatedCounter = recalculateBalances(counterpartUpdatedRaw);
          counterpartUpdated = recalculatedCounter.map((entry, idx) => {
            const previous = counterpartEntries![idx];
            const hasChanged =
              !previous ||
              entry.date !== previous.date ||
              entry.particulars !== previous.particulars ||
              entry.debit !== previous.debit ||
              entry.credit !== previous.credit ||
              entry.remarks !== previous.remarks ||
              entry.balance !== previous.balance;

            if (hasChanged) {
              const updatedEntry = { ...entry, updatedAt: timestamp };
              changedEntries.push(updatedEntry);
              return updatedEntry;
            }
            return entry;
          });
        }
      }

      setEntriesMap((prev) => ({
        ...prev,
        [activeAccountId]: finalActiveEntries,
        ...(counterpartAccountId && counterpartUpdated
          ? { [counterpartAccountId]: counterpartUpdated }
          : {}),
      }));

      await persistEntriesToIndexedDb(activeAccountId, finalActiveEntries);
      if (counterpartAccountId && counterpartUpdated) {
        await persistEntriesToIndexedDb(counterpartAccountId, counterpartUpdated);
      }

      if (changedEntries.length) {
        await updateLedgerEntriesBatch(changedEntries);
      }

      toast({ title: "Entry updated" });
      handleCancelEdit();
    } catch (error: any) {
      console.error("Failed to update ledger entry", error);
      toast({
        title: "Unable to update entry",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!activeAccountId || saving) return;
    const confirmed = window.confirm("Delete this ledger entry?");
    if (!confirmed) return;

    const entryToDelete = activeEntries.find((entry) => entry.id === entryId);
    if (!entryToDelete) return;

    const remaining = activeEntries.filter((entry) => entry.id !== entryId);
    const remainingOriginal = remaining.map((entry) => ({ ...entry }));
    const recalculated = recalculateBalances(remainingOriginal);

    let counterpartAccountId: string | null = null;
    let counterpartEntryId: string | null = null;
    let counterpartUpdated: LedgerEntry[] | null = null;
    let strategy: "mirror" | "same" | undefined = entryToDelete.linkStrategy;

    if (entryToDelete.linkGroupId) {
      for (const [accId, entries] of Object.entries(entriesMap)) {
        if (accId === activeAccountId) continue;
        const match = entries.find((entry) => entry.linkGroupId === entryToDelete.linkGroupId);
        if (match) {
          counterpartAccountId = accId;
          counterpartEntryId = match.id;
          const filtered = entries.filter((entry) => entry.id !== match.id);
          counterpartUpdated = recalculateBalances(filtered.map((entry) => ({ ...entry })));
          if (!strategy && match.linkStrategy) {
            strategy = match.linkStrategy;
          }
          break;
        }
      }
    }

    setSaving(true);
    try {
      await deleteLedgerEntry(entryId);
      if (counterpartEntryId) {
        await deleteLedgerEntry(counterpartEntryId);
      }

      const timestamp = new Date().toISOString();
      const changedEntries: LedgerEntry[] = [];

      const finalEntries = recalculated.map((entry, idx) => {
        const previous = remaining[idx];
        const hasChanged =
          !previous ||
          entry.balance !== previous.balance ||
          entry.debit !== previous.debit ||
          entry.credit !== previous.credit ||
          entry.particulars !== previous.particulars ||
          entry.date !== previous.date ||
          entry.remarks !== previous.remarks;

        if (hasChanged) {
          const updatedEntry = { ...entry, updatedAt: timestamp };
          changedEntries.push(updatedEntry);
          return updatedEntry;
        }
        return entry;
      });

      setEntriesMap((prev) => ({
        ...prev,
        [activeAccountId]: finalEntries,
        ...(counterpartAccountId && counterpartUpdated
          ? { [counterpartAccountId]: counterpartUpdated }
          : {}),
      }));

      await persistEntriesToIndexedDb(activeAccountId, finalEntries);
      if (counterpartAccountId && counterpartUpdated) {
        await persistEntriesToIndexedDb(counterpartAccountId, counterpartUpdated);
        counterpartUpdated.forEach((entry) =>
          changedEntries.push({ ...entry, updatedAt: timestamp })
        );
      }

      if (changedEntries.length) {
        await updateLedgerEntriesBatch(changedEntries);
      }

      toast({ title: "Entry deleted" });
      if (editingEntryId === entryId) {
        handleCancelEdit();
      }
    } catch (error: any) {
      console.error("Failed to delete ledger entry", error);
      toast({
        title: "Unable to delete entry",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (!activeAccount) return;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    const rowsHtml = displayEntries
      .map((entry) => {
        const formattedDate = entry.date ? new Date(entry.date).toLocaleDateString("en-IN") : "-";
        return `
          <tr>
            <td>${formattedDate}</td>
            <td>${entry.particulars || "-"}${entry.remarks ? `<div class="remarks">${entry.remarks}</div>` : ""}</td>
            <td class="numeric debit">${entry.debit ? formatCurrency(entry.debit) : ""}</td>
            <td class="numeric credit">${entry.credit ? formatCurrency(entry.credit) : ""}</td>
            <td class="numeric balance">${formatCurrency((entry as any).runningBalance ?? entry.balance)}</td>
          </tr>
        `;
      })
      .join("");

    const dateRangeLabel = dateFrom || dateTo
      ? `${dateFrom ? new Date(dateFrom).toLocaleDateString("en-IN") : "--"} to ${dateTo ? new Date(dateTo).toLocaleDateString("en-IN") : "--"}`
      : "Full Ledger";

    const documentContent = `
      <html>
        <head>
          <title>Ledger Statement - ${activeAccount.name}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: "Segoe UI", Arial, sans-serif; margin: 24px; color: #111827; }
            header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
            .company-name { font-size: 22px; font-weight: 600; }
            .ledger-meta { text-align: right; font-size: 12px; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            thead th { background: #1f2937; color: #ffffff; padding: 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
            tbody td { border: 1px solid #d1d5db; padding: 10px; font-size: 12px; vertical-align: top; }
            tbody tr:nth-child(even) { background: #f9fafb; }
            .numeric { text-align: right; }
            .debit { color: #047857; }
            .credit { color: #b91c1c; }
            .balance { font-weight: 600; }
            .remarks { color: #6b7280; font-size: 11px; margin-top: 4px; }
            .summary { margin-top: 16px; display: flex; justify-content: flex-end; }
            .summary table { width: 320px; border: 1px solid #d1d5db; }
            .summary td { padding: 8px 10px; font-size: 12px; }
            .summary td:first-child { background: #f3f4f6; font-weight: 600; }
            footer { margin-top: 32px; font-size: 11px; color: #6b7280; text-align: center; }
            @media print {
              body { margin: 12mm 10mm; }
            }
          </style>
        </head>
        <body>
          <header>
            <div>
              <div class="company-name">${activeAccount.name}</div>
              <div>${activeAccount.address || "No address"}</div>
              <div>${activeAccount.contact || "No contact"}</div>
            </div>
            <div class="ledger-meta">
              <div><strong>Statement Date:</strong> ${new Date().toLocaleDateString("en-IN")}</div>
              <div><strong>Date Range:</strong> ${dateRangeLabel}</div>
              <div><strong>Total Entries:</strong> ${displayEntries.length}</div>
            </div>
          </header>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Particulars</th>
                <th>Debit (₹)</th>
                <th>Credit (₹)</th>
                <th>Balance (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="5" style="text-align:center; padding: 20px;">No entries available for printing.</td></tr>`}
            </tbody>
          </table>

          <div class="summary">
            <table>
              <tr>
                <td>Total Debit</td>
                <td style="text-align:right;">₹${formatCurrency(totals.debit)}</td>
              </tr>
              <tr>
                <td>Total Credit</td>
                <td style="text-align:right;">₹${formatCurrency(totals.credit)}</td>
              </tr>
              <tr>
                <td>Balance</td>
                <td style="text-align:right; font-weight:600;">₹${formatCurrency(totals.balance)}</td>
              </tr>
            </table>
          </div>

          <footer>
            Generated by BizSuite Ledger • ${new Date().toLocaleString("en-IN")} • Page 1 of 1
          </footer>
        </body>
      </html>
    `;

    printWindow.document.write(documentContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    displayEntries.forEach((entry) => {
      debit += entry.debit;
      credit += entry.credit;
    });
    const balance = displayEntries.at(-1)?.runningBalance || 0;
    return { debit, credit, balance };
  }, [displayEntries]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Ledger Accounting</h1>
          <p className="text-sm text-muted-foreground">
            Track balances, debit and credit entries for temporary accounts.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div
            className={`flex w-full md:w-80 flex-col gap-1 ${
              loadingAccounts ? "pointer-events-none opacity-60" : accounts.length === 0 ? "opacity-80" : ""
            }`}
          >
            <span className="text-xs font-medium text-muted-foreground">Select Account</span>
            <CustomDropdown
              options={accountDropdownOptions}
              value={activeAccountId}
              onChange={(value) => setActiveAccountId(value)}
              placeholder={loadingAccounts ? "Loading accounts…" : "Search account by name, address or contact"}
              noItemsPlaceholder={accounts.length === 0 ? "No accounts available. Create one to begin." : "No matching account found."}
            />
          </div>
          <Button
            variant={showAccountForm ? "secondary" : "default"}
            onClick={() => setShowAccountForm((prev) => !prev)}
            disabled={saving}
          >
            {showAccountForm ? "Close" : "Open New Account"}
          </Button>
          <Button onClick={handlePrint} disabled={!activeAccount || loadingEntries} className="disabled:opacity-60">
            Print Ledger
          </Button>
        </div>
      </div>

      {showAccountForm && (
        <form
          onSubmit={handleCreateAccount}
          className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card shadow-sm p-4 md:grid-cols-3"
        >
          <div className="space-y-1">
            <Label className="text-sm font-medium">Account Name</Label>
            <Input
              type="text"
              required
              value={newAccount.name}
              onChange={(event) =>
                setNewAccount((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="Enter account name"
              disabled={saving}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">Address</Label>
            <Input
              type="text"
              value={newAccount.address || ""}
              onChange={(event) =>
                setNewAccount((prev) => ({ ...prev, address: event.target.value }))
              }
              placeholder="Enter address"
              disabled={saving}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">Contact Number</Label>
            <Input
              type="text"
              value={newAccount.contact || ""}
              onChange={(event) =>
                setNewAccount((prev) => ({ ...prev, contact: event.target.value }))
              }
              placeholder="Enter contact number"
              disabled={saving}
            />
          </div>
          <div className="md:col-span-3 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setShowAccountForm(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>Create Account</Button>
          </div>
        </form>
      )}

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border py-3">
          <div>
            <CardTitle className="text-lg">
              {activeAccount ? activeAccount.name : loadingAccounts ? "Loading…" : "Select an account"}
            </CardTitle>
            {activeAccount && (
              <p className="text-xs text-muted-foreground">
                {(activeAccount.address && activeAccount.address.length > 0 ? activeAccount.address : "No address")}
                {" • "}
                {activeAccount.contact && activeAccount.contact.length > 0 ? activeAccount.contact : "No contact"}
              </p>
            )}
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold text-muted-foreground">Balance</p>
            <p className="text-lg font-semibold text-primary">
              ₹{formatCurrency(totals.balance)}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4">
          <form
            onSubmit={handleAddEntry}
            className="grid grid-cols-1 gap-3 md:grid-cols-6"
          >
            <div className="space-y-1">
              <Label className="text-[11px] font-medium">Date</Label>
              <Input
                type="date"
                value={entryForm.date}
                onChange={(event) =>
                  setEntryForm((prev) => ({ ...prev, date: event.target.value }))
                }
                required
                disabled={!activeAccount || saving}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label className="text-[11px] font-medium">Particulars</Label>
              <Input
                type="text"
                value={entryForm.particulars}
                onChange={(event) =>
                  setEntryForm((prev) => ({
                    ...prev,
                    particulars: event.target.value,
                  }))
                }
                placeholder="Narration"
                disabled={!activeAccount || saving}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium">Debit (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={entryForm.debit}
                onChange={(event) =>
                  setEntryForm((prev) => ({ ...prev, debit: event.target.value }))
                }
                disabled={!activeAccount || saving}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium">Credit (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={entryForm.credit}
                onChange={(event) =>
                  setEntryForm((prev) => ({ ...prev, credit: event.target.value }))
                }
                disabled={!activeAccount || saving}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label className="text-[11px] font-medium">Remarks</Label>
              <Textarea
                value={entryForm.remarks}
                onChange={(event) =>
                  setEntryForm((prev) => ({ ...prev, remarks: event.target.value }))
                }
                placeholder="Optional notes"
                className="h-8 min-h-[32px] text-sm leading-tight resize-none"
                disabled={!activeAccount || saving}
              />
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label className="text-[11px] font-medium">Linked Account (optional)</Label>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                <select
                  value={linkAccountId}
                  onChange={(event) => setLinkAccountId(event.target.value)}
                  disabled={!activeAccount || saving || accounts.length <= 1}
                  className="w-full md:w-56 rounded border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">None</option>
                  {accounts
                    .filter((account) => account.id !== activeAccountId)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                </select>

                {linkAccountId && (
                  <div className="flex flex-1 items-center justify-between rounded border border-border bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
                    <span>Opposite</span>
                    <Switch
                      checked={linkMode === "same"}
                      onCheckedChange={(checked) => setLinkMode(checked ? "same" : "mirror")}
                      className="h-4 w-8 data-[state=checked]:bg-primary"
                    />
                    <span>Same</span>
                  </div>
                )}
              </div>
            </div>
            <div className="md:col-span-6 flex justify-end">
              <Button type="submit" disabled={!activeAccount || saving || loadingEntries} className="h-8 px-4 text-sm disabled:opacity-60">
                Add Entry
              </Button>
            </div>
          </form>

          <div ref={ledgerRef} className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Account Statement</p>
                {activeAccount && (
                  <p className="text-xs text-muted-foreground">
                    Ledger Date: {new Date().toLocaleDateString("en-IN")}
                  </p>
                )}
              </div>
              <div className="text-sm text-right">
                <p className="text-muted-foreground">Total Debit: ₹{formatCurrency(totals.debit)}</p>
                <p className="text-muted-foreground">Total Credit: ₹{formatCurrency(totals.credit)}</p>
                <p className="font-semibold text-primary">Balance: ₹{formatCurrency(totals.balance)}</p>
              </div>
            </div>

            <div className="overflow-hidden border border-border rounded-lg">
              <div className="overflow-x-auto">
                <div className="max-h-[380px] overflow-y-auto">
                  <table className="min-w-full text-xs">
                    <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
                      <tr className="text-muted-foreground">
                        <th className="px-3 py-2 text-left font-semibold">Date</th>
                        <th className="px-3 py-2 text-left font-semibold">Particulars</th>
                        <th className="px-3 py-2 text-right font-semibold">Debit (₹)</th>
                        <th className="px-3 py-2 text-right font-semibold">Credit (₹)</th>
                        <th className="px-3 py-2 text-right font-semibold">Balance (₹)</th>
                        <th className="px-3 py-2 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingEntries ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                            Loading entries…
                          </td>
                        </tr>
                      ) : groupedEntries.length > 0 ? (
                        groupedEntries.flatMap((group) => {
                          const headerRow = (
                            <tr key={`group-${group.date}`} className="bg-muted/60 text-muted-foreground">
                              <td colSpan={6} className="px-3 py-1.5 text-xs font-semibold">
                                {group.date ? new Date(group.date).toLocaleDateString("en-IN") : "No Date"}
                              </td>
                            </tr>
                          );

                          const entryRows = group.entries.map((entry) => {
                            const isEditing = editingEntryId === entry.id;
                            return (
                              <tr key={entry.id} className="border-t border-border align-top">
                                <td className="px-3 py-1.5 whitespace-nowrap">
                                  {isEditing ? (
                                    <Input
                                      type="date"
                                      value={editForm.date}
                                      onChange={(event) =>
                                        setEditForm((prev) => ({ ...prev, date: event.target.value }))
                                      }
                                      disabled={saving}
                                      className="h-8"
                                    />
                                  ) : (
                                    new Date(entry.date).toLocaleDateString("en-IN")
                                  )}
                                </td>
                                <td className="px-3 py-1.5">
                                  {isEditing ? (
                                    <div className="space-y-1.5">
                                      <Input
                                        value={editForm.particulars}
                                        onChange={(event) =>
                                          setEditForm((prev) => ({
                                            ...prev,
                                            particulars: event.target.value,
                                          }))
                                        }
                                        disabled={saving}
                                        className="h-8"
                                      />
                                      <Textarea
                                        value={editForm.remarks}
                                        onChange={(event) =>
                                          setEditForm((prev) => ({
                                            ...prev,
                                            remarks: event.target.value,
                                          }))
                                        }
                                        placeholder="Remarks"
                                        className="min-h-[48px]"
                                        disabled={saving}
                                      />
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <p className="leading-tight">{entry.particulars}</p>
                                      {entry.remarks && (
                                        <p className="text-[11px] text-muted-foreground leading-tight">{entry.remarks}</p>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-1.5 text-right text-emerald-600">
                                  {isEditing ? (
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={editForm.debit}
                                      onChange={(event) =>
                                        setEditForm((prev) => ({ ...prev, debit: event.target.value }))
                                      }
                                      disabled={saving}
                                      className="h-8"
                                    />
                                  ) : (
                                    entry.debit ? formatCurrency(entry.debit) : "-"
                                  )}
                                </td>
                                <td className="px-3 py-1.5 text-right text-red-500">
                                  {isEditing ? (
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={editForm.credit}
                                      onChange={(event) =>
                                        setEditForm((prev) => ({ ...prev, credit: event.target.value }))
                                      }
                                      disabled={saving}
                                      className="h-8"
                                    />
                                  ) : (
                                    entry.credit ? formatCurrency(entry.credit) : "-"
                                  )}
                                </td>
                                <td className="px-3 py-1.5 text-right font-semibold">
                                  {formatCurrency((entry as any).runningBalance ?? entry.balance)}
                                </td>
                                <td className="px-3 py-1.5 text-right">
                                  {isEditing ? (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handleSaveEdit(entry.id)}
                                        disabled={saving}
                                        className="text-emerald-600 h-8 w-8"
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        onClick={handleCancelEdit}
                                        disabled={saving}
                                        className="text-red-500 h-8 w-8"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handleEditEntry(entry)}
                                        disabled={saving}
                                        className="text-blue-600 h-8 w-8"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handleDeleteEntry(entry.id)}
                                        disabled={saving}
                                        className="text-red-600 h-8 w-8"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          });

                          return [headerRow, ...entryRows];
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                            {activeAccount
                              ? dateFrom || dateTo
                                ? "No entries in this date range."
                                : "No entries yet. Add your first transaction."
                              : loadingAccounts
                              ? "Loading accounts…"
                              : "Select an account to view entries."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-border py-3">
          <div>
            <CardTitle className="text-lg">Cash Management</CardTitle>
            <p className="text-xs text-muted-foreground">
              Manage denomination-wise cash counts for quick totals.
            </p>
          </div>
          <div className="text-sm text-right space-y-1">
            <p className="text-muted-foreground">Total Notes: {cashSummary.totalNotes.toLocaleString()}</p>
            <p className="text-lg font-semibold text-primary">₹{formatCurrency(cashSummary.totalAmount)}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex w-full md:w-72 flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Cash Account</span>
              <CustomDropdown
                options={cashAccountOptions}
                value={activeCashAccountId}
                onChange={(value) => setActiveCashAccountId(value)}
                placeholder={
                  loadingCashAccounts
                    ? "Loading cash accounts..."
                    : cashAccounts.length
                    ? "Search cash account..."
                    : "No cash accounts yet"
                }
                noItemsPlaceholder={
                  loadingCashAccounts
                    ? "Loading cash accounts..."
                    : cashAccounts.length === 0
                    ? "No cash accounts yet. Create one below."
                    : "No matching cash account."
                }
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="h-8"
                disabled={loadingCashAccounts}
                onClick={() => {
                  setShowCashAccountForm((prev) => !prev);
                  if (showCashAccountForm) {
                    setNewCashAccountName("");
                  }
                }}
              >
                {showCashAccountForm ? "Cancel" : "Add Cash Account"}
              </Button>
              {activeCashAccount && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    disabled={cashSaving}
                    onClick={handleResetCashAccount}
                  >
                    Clear All
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="h-8"
                    disabled={cashSaving}
                    onClick={() => void handleDeleteCashAccount(activeCashAccount.id)}
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>

          {showCashAccountForm && (
            <form
              onSubmit={handleCreateCashAccount}
              className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-muted/30 p-3 md:grid-cols-4"
            >
              <div className="md:col-span-3 space-y-1">
                <Label className="text-[11px] font-medium">Cash Account Name</Label>
                <Input
                  value={newCashAccountName}
                  onChange={(event) => setNewCashAccountName(event.target.value)}
                  placeholder="e.g. Counter Cash, Safe, Petty Cash"
                  required
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex items-end gap-2">
                    <Button type="submit" className="h-8 px-4 text-sm" disabled={cashSaving}>
                  Create
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 px-4 text-sm"
                      disabled={cashSaving}
                  onClick={() => {
                    setShowCashAccountForm(false);
                    setNewCashAccountName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {activeCashAccount ? (
            <>
              <div className="overflow-x-auto border border-border rounded-lg">
                <div className="max-h-[320px] overflow-y-auto">
                  <table className="min-w-full text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-muted/70 text-muted-foreground">
                        <th className="px-3 py-2 text-left font-semibold">Denomination</th>
                        <th className="px-3 py-2 text-left font-semibold">Counts</th>
                        <th className="px-3 py-2 text-right font-semibold">Total Notes</th>
                        <th className="px-3 py-2 text-right font-semibold">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="bg-background text-foreground">
                      {CASH_DENOMINATIONS.map((denomination) => {
                        const key = denomination.toString();
                        const counts = activeCashAccount.noteGroups[key] || [0];
                        const summary = cashSummary.denominationTotals[key] || { totalNotes: 0, amount: 0 };
                        return (
                          <tr key={denomination} className="border-t border-border">
                            <td className="px-3 py-2 font-semibold text-foreground">₹{denomination}</td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {counts.map((count, index) => (
                                  <div key={`${denomination}-${index}`} className="flex items-center gap-1.5">
                                    <Input
                                      type="number"
                                      min="0"
                                      value={count.toString()}
                                      onChange={(event) =>
                                        handleUpdateCashCount(denomination, index, event.target.value)
                                      }
                                      className="h-8 w-20 text-sm"
                                    />
                                    {counts.length > 1 && (
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handleRemoveCashCountRow(denomination, index)}
                                        className="h-7 w-7 text-red-500"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  onClick={() => handleAddCashCountRow(denomination)}
                                  className="h-7 w-7"
                                >
                                  +
                                </Button>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-muted-foreground">
                              {summary.totalNotes.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-primary">
                              ₹{formatCurrency(summary.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Total Notes</p>
                  <p className="mt-1 text-xl font-bold text-foreground">
                    {cashSummary.totalNotes.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3 md:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">Total Cash</p>
                  <p className="mt-1 text-xl font-bold text-primary">
                    ₹{formatCurrency(cashSummary.totalAmount)}
                  </p>
                </div>
              </div>
            </>
          ) : cashAccounts.length === 0 && !showCashAccountForm ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Create a cash account to start tracking note counts.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default LedgerPage;