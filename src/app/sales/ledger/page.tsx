"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { Pencil, Trash2, Check, X, Download, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/database";
import type { LedgerAccount, LedgerEntry, LedgerAccountInput, LedgerCashAccount } from "@/lib/definitions";
import {
  getLedgerAccountsRealtime,
  createLedgerAccount,
  getLedgerEntriesRealtime,
  getLedgerCashAccountsRealtime,
  createLedgerCashAccount,
  updateLedgerCashAccount,
  deleteLedgerCashAccount,
  getAllPayments,
  getAllIncomes,
  getAllExpenses,
} from "@/lib/firestore";
import { Switch } from "@/components/ui/switch";
import { toTitleCase } from "@/lib/utils";
import {
  generateLedgerEntryId,
  queueLedgerEntriesUpsert,
  queueLedgerEntryDelete,
  queueLedgerEntryUpsert,
} from "@/lib/ledger-sync";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from "xlsx";
import { LedgerHeader } from "./components/ledger-header";
import { AccountForm } from "./components/account-form";
import { EntryForm } from "./components/entry-form";
import { CACHE_TTL_MS, CASH_DENOMINATIONS, recalculateBalances, sortEntries, generateLinkGroupId, parseAmount, formatStatementDate, formatCurrency } from "./utils";
import { STATEMENT_PRINT_ID, STATEMENT_PRINT_STYLES, type StatementRow } from "./constants";


const LedgerPage: React.FC = () => {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [entriesMap, setEntriesMap] = useState<Record<string, LedgerEntry[]>>({});
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [showAccountForm, setShowAccountForm] = useState(false);
  // NO LOADING STATES - Data loads initially, then only CRUD updates
  const [saving, setSaving] = useState(false);

  const [cashAccounts, setCashAccounts] = useState<LedgerCashAccount[]>([]);
  const [activeCashAccountId, setActiveCashAccountId] = useState<string | null>(null);
  const [showCashAccountForm, setShowCashAccountForm] = useState(false);
  const [newCashAccountName, setNewCashAccountName] = useState("");
  // NO LOADING STATES - Data loads initially, then only CRUD updates
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
  const statementPrintRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<"ledger" | "statement">("ledger");
  const [statementStart, setStatementStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [statementEnd, setStatementEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementData, setStatementData] = useState<StatementRow[]>([]);
  const [statementError, setStatementError] = useState<string | null>(null);
  const [statementGeneratedAt, setStatementGeneratedAt] = useState<string>("");

  const statementRangeLabel = useMemo(() => {
    if (statementStart && statementEnd) {
      const start = formatStatementDate(statementStart);
      const end = formatStatementDate(statementEnd);
      return start === end ? `for ${start}` : `from ${start} to ${end}`;
    }

    if (statementStart) {
      return `from ${formatStatementDate(statementStart)}`;
    }

    if (statementEnd) {
      return `up to ${formatStatementDate(statementEnd)}`;
    }

    return "for all available dates";
  }, [statementStart, statementEnd]);

  const statementGeneratedLabel = useMemo(() => {
    if (!statementGeneratedAt) return "";
    try {
      return format(new Date(statementGeneratedAt), "dd MMM yyyy, hh:mm a");
    } catch {
      return statementGeneratedAt;
    }
  }, [statementGeneratedAt]);

  const statementPreparedText = useMemo(() => {
    if (statementGeneratedLabel) return statementGeneratedLabel;
    return format(new Date(), "dd MMM yyyy, hh:mm a");
  }, [statementGeneratedLabel]);

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

    // Sort by date (latest first), then by createdAt if dates are same
    return filtered.sort((a, b) => {
      // First compare by date field (latest first)
      if (a.date && b.date) {
        const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateCompare !== 0) return dateCompare;
      }
      // If dates are same or not available, sort by createdAt (latest first)
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [activeEntries, dateFrom, dateTo]);

  const displayEntries = useMemo(() => {
    // Since entries are displayed newest first, calculate balance from oldest to newest
    // First, sort by date (oldest first) for calculation
    const sortedForCalculation = [...filteredEntries].sort((a, b) => {
      if (a.date && b.date) {
        const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateCompare !== 0) return dateCompare;
      }
      return a.createdAt.localeCompare(b.createdAt);
    });
    
    // Calculate balance from oldest to newest
    let running = 0;
    const withBalances = sortedForCalculation.map((entry) => {
      running = Math.round((running + entry.debit - entry.credit) * 100) / 100;
      return { ...entry, runningBalance: running };
    });
    
    // Create a map of balances by entry ID
    const balanceMap = new Map(withBalances.map(e => [e.id, e.runningBalance]));
    
    // Return original order (newest first) with correct balances
    return filteredEntries.map((entry) => ({
      ...entry,
      runningBalance: balanceMap.get(entry.id) ?? 0,
    }));
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

  const accountDropdownOptions = useMemo(() => {
    const options = accounts.map((account) => {
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
    });
    return options;
  }, [accounts]);

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
    const unsubscribe = getLedgerCashAccountsRealtime(
      (data) => {
        const normalized = data
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
      },
      (error) => {
        toast({
          title: "Unable to load cash accounts",
          description: "We could not fetch cash accounts. Please try again.",
          variant: "destructive",
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [toast, activeCashAccountId]);

  // Load accounts using realtime listener
  useEffect(() => {
    const unsubscribe = getLedgerAccountsRealtime(
      (data) => {
        setAccounts(data);
        if (!activeAccountId && data.length > 0) {
          setActiveAccountId(data[0].id);
        }
      },
      (error) => {
        toast({
          title: "Unable to load accounts",
          description: "We could not fetch ledger accounts. Please try again.",
          variant: "destructive",
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [activeAccountId, toast]);

  // Load entries using realtime listener whenever account changes
  useEffect(() => {
    if (!activeAccountId) return;

    const unsubscribe = getLedgerEntriesRealtime(
      (data) => {
        const sortedEntries = sortEntries(recalculateBalances(data));
        setEntriesMap((prev) => ({ ...prev, [activeAccountId]: sortedEntries }));
      },
      (error) => {
        toast({
          title: "Unable to load entries",
          description: "We could not fetch ledger entries. Please try again.",
          variant: "destructive",
        });
      },
      activeAccountId
    );

    return () => {
      unsubscribe();
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

      const updatedAccounts = [...cashAccounts, normalized].sort((a, b) => a.name.localeCompare(b.name));
      setCashAccounts(updatedAccounts);
      setActiveCashAccountId(normalized.id);
      setNewCashAccountName("");
      setShowCashAccountForm(false);
      
      // Γ£à Update cache
      if (typeof window !== "undefined") {
        localStorage.setItem("ledgerCashAccountsCache", JSON.stringify(updatedAccounts));
        window.localStorage.setItem("ledgerCashAccountsLastSynced", String(Date.now()));
      }
      
      toast({ title: "Cash account created" });
    } catch (error: any) {
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
      toast({
        title: "Unable to save cash account",
        description: "Recent changes could not be saved. Please retry.",
        variant: "destructive",
      });
    });
  };

  const updateCashAccount = (accountId: string, updater: (account: LedgerCashAccount) => LedgerCashAccount) => {
    let updatedAccount: LedgerCashAccount | null = null;
    setCashAccounts((prev) => {
      const next = prev.map((account) => {
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
      });
      
      // Γ£à Update cache
      if (typeof window !== "undefined") {
        localStorage.setItem("ledgerCashAccountsCache", JSON.stringify(next));
        window.localStorage.setItem("ledgerCashAccountsLastSynced", String(Date.now()));
      }
      
      return next;
    });
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
    const { confirm } = await import("@/lib/confirm-dialog");
    const confirmed = await confirm(`Delete cash account "${target.name}"?`, {
      title: "Confirm Delete",
      variant: "destructive",
      confirmText: "Delete",
    });
    if (!confirmed) return;

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
        
        // Γ£à Update cache
        if (typeof window !== "undefined") {
          localStorage.setItem("ledgerCashAccountsCache", JSON.stringify(next));
          window.localStorage.setItem("ledgerCashAccountsLastSynced", String(Date.now()));
        }
        
        return next;
      });
      toast({ title: "Cash account deleted" });
    } catch (error: any) {
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

    const linkTargetId =
      linkAccountId && linkAccountId !== activeAccountId ? linkAccountId : "";
    if (
      linkTargetId &&
      !accounts.find((account) => account.id === linkTargetId)
    ) {
      toast({ title: "Invalid linked account", variant: "destructive" });
      return;
    }

    const sanitizedDebit = Math.round(debitValue * 100) / 100;
    const sanitizedCredit = Math.round(creditValue * 100) / 100;
    const linkGroupId = linkTargetId ? generateLinkGroupId() : undefined;
    const nowIso = new Date().toISOString();

    const newEntryBase: LedgerEntry = {
      id: generateLedgerEntryId(),
        accountId: activeAccountId,
        date: entryForm.date,
        particulars: entryForm.particulars.trim() || "-",
        debit: sanitizedDebit,
        credit: sanitizedCredit,
      balance: 0,
        remarks: entryForm.remarks.trim() || undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
        linkGroupId,
        linkStrategy: linkTargetId ? linkMode : undefined,
    };

    const currentEntries = activeEntries;
    const updatedEntries = recalculateBalances([
      ...currentEntries,
      newEntryBase,
    ]);
    const savedEntry = updatedEntries[updatedEntries.length - 1];

    let counterUpdatedEntries: LedgerEntry[] | null = null;
    let savedCounterEntry: LedgerEntry | null = null;

      if (linkTargetId) {
        const counterEntries = entriesMap[linkTargetId] || [];
      const counterDebit =
        linkMode === "mirror" ? sanitizedCredit : sanitizedDebit;
      const counterCredit =
        linkMode === "mirror" ? sanitizedDebit : sanitizedCredit;

      const counterEntryBase: LedgerEntry = {
        id: generateLedgerEntryId(),
          accountId: linkTargetId,
          date: entryForm.date,
          particulars: entryForm.particulars.trim() || "-",
          debit: counterDebit,
          credit: counterCredit,
        balance: 0,
          remarks: entryForm.remarks.trim() || undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
          linkGroupId,
          linkStrategy: linkMode,
      };

      counterUpdatedEntries = recalculateBalances([
        ...counterEntries,
        counterEntryBase,
      ]);
      savedCounterEntry =
        counterUpdatedEntries[counterUpdatedEntries.length - 1];
    }

    setSaving(true);
    try {
        setEntriesMap((prev) => ({
          ...prev,
          [activeAccountId]: updatedEntries,
        ...(linkTargetId && counterUpdatedEntries
          ? { [linkTargetId]: counterUpdatedEntries }
          : {}),
        }));

      await persistEntriesToIndexedDb(activeAccountId, updatedEntries);
      if (linkTargetId && counterUpdatedEntries) {
        await persistEntriesToIndexedDb(linkTargetId, counterUpdatedEntries);
      }

      // Sync all entries that had balance recalculated, not just the new entry
      const timestamp = new Date().toISOString();
      const entriesToSync: LedgerEntry[] = [];
      
      // Find all entries whose balance changed due to the new entry
      updatedEntries.forEach((entry, idx) => {
        const previousEntry = currentEntries[idx];
        if (!previousEntry || entry.balance !== previousEntry.balance || entry.id === savedEntry.id) {
          entriesToSync.push({ ...entry, updatedAt: timestamp });
        }
      });

      if (entriesToSync.length) {
        await queueLedgerEntriesUpsert(entriesToSync);
      } else {
        // Fallback: at least sync the new entry
        await queueLedgerEntryUpsert(savedEntry);
      }

      // Sync counterpart entries if linked
      if (linkTargetId && counterUpdatedEntries) {
        const counterpartCurrentEntries = entriesMap[linkTargetId] || [];
        const counterpartEntriesToSync: LedgerEntry[] = [];
        
        counterUpdatedEntries.forEach((entry, idx) => {
          const previousEntry = counterpartCurrentEntries[idx];
          if (!previousEntry || entry.balance !== previousEntry.balance || entry.id === savedCounterEntry?.id) {
            counterpartEntriesToSync.push({ ...entry, updatedAt: timestamp });
          }
        });

        if (counterpartEntriesToSync.length) {
          await queueLedgerEntriesUpsert(counterpartEntriesToSync);
        } else if (savedCounterEntry) {
          await queueLedgerEntryUpsert(savedCounterEntry);
        }
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

      // Create a map of previous entries by ID for accurate comparison
      const previousEntriesMap = new Map(currentEntries.map(e => [e.id, e]));

      const finalActiveEntries = recalculatedActive.map((entry) => {
        const previous = previousEntriesMap.get(entry.id);
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
        // Find the linked account entry
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
                  particulars: editForm.particulars.trim() || "-",
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
          // Create a map of previous counterpart entries by ID for accurate comparison
          const previousCounterpartMap = new Map(counterpartEntries!.map(e => [e.id, e]));
          
          counterpartUpdated = recalculatedCounter.map((entry) => {
            const previous = previousCounterpartMap.get(entry.id);
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
        } else {
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
        // Invalidate cache for linked account so it reloads fresh data
        if (typeof window !== "undefined") {
          const lastSyncedKey = `ledgerEntriesLastSynced:${counterpartAccountId}`;
          window.localStorage.removeItem(lastSyncedKey);
        }
      }

      if (changedEntries.length) {
        await queueLedgerEntriesUpsert(changedEntries);
      }

      toast({ 
        title: "Entry updated",
        description: counterpartAccountId ? `Updated in both accounts` : undefined
      });
      handleCancelEdit();
    } catch (error: any) {
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
    const { confirm } = await import("@/lib/confirm-dialog");
    const confirmed = await confirm("Delete this ledger entry?", {
      title: "Confirm Delete",
      variant: "destructive",
      confirmText: "Delete",
    });
    if (!confirmed) return;

    const entryToDelete = activeEntries.find((entry) => entry.id === entryId);
    if (!entryToDelete) return;

    const remaining = activeEntries.filter((entry) => entry.id !== entryId);
    const remainingOriginal = remaining.map((entry) => ({ ...entry }));
    const recalculated = recalculateBalances(remainingOriginal);

    let counterpartAccountId: string | null = null;
    let counterpartEntryId: string | null = null;
    let counterpartUpdated: LedgerEntry[] | null = null;
    let counterpartEntries: LedgerEntry[] | null = null;
    let strategy: "mirror" | "same" | undefined = entryToDelete.linkStrategy;

    if (entryToDelete.linkGroupId) {
      for (const [accId, entries] of Object.entries(entriesMap)) {
        if (accId === activeAccountId) continue;
        const match = entries.find((entry) => entry.linkGroupId === entryToDelete.linkGroupId);
        if (match) {
          counterpartAccountId = accId;
          counterpartEntryId = match.id;
          counterpartEntries = entries; // Store original entries for comparison
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
      await queueLedgerEntryDelete(entryId);
      if (counterpartEntryId) {
        await queueLedgerEntryDelete(counterpartEntryId);
      }

      const timestamp = new Date().toISOString();
      const changedEntries: LedgerEntry[] = [];

      // Create a map of previous entries by ID for accurate comparison
      const previousEntriesMap = new Map(remaining.map(e => [e.id, e]));

      const finalEntries = recalculated.map((entry) => {
        const previous = previousEntriesMap.get(entry.id);
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
      if (counterpartAccountId && counterpartUpdated && counterpartEntries) {
        await persistEntriesToIndexedDb(counterpartAccountId, counterpartUpdated);
        
        // Only sync counterpart entries that actually changed
        const previousCounterpartMap = new Map(counterpartEntries.map((e: LedgerEntry) => [e.id, e]));
        counterpartUpdated.forEach((entry) => {
          const previous = previousCounterpartMap.get(entry.id);
          const hasChanged =
            !previous ||
            entry.balance !== previous.balance ||
            entry.debit !== previous.debit ||
            entry.credit !== previous.credit ||
            entry.particulars !== previous.particulars ||
            entry.date !== previous.date ||
            entry.remarks !== previous.remarks;
          
          if (hasChanged) {
            changedEntries.push({ ...entry, updatedAt: timestamp });
          }
        });
      }

      if (changedEntries.length) {
        await queueLedgerEntriesUpsert(changedEntries);
      }

      toast({ title: "Entry deleted" });
      if (editingEntryId === entryId) {
        handleCancelEdit();
      }
    } catch (error: any) {
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
    // Since displayEntries is sorted newest first, the first entry (index 0) has the final balance
    // This is the balance after all transactions (newest transaction's balance)
    const balance = displayEntries.length > 0 ? (displayEntries[0]?.runningBalance || 0) : 0;
    return { debit, credit, balance };
  }, [displayEntries]);

  const statementTotals = useMemo(() => {
    return statementData.reduce(
      (acc, row) => {
        acc.supplierCash += row.supplierCash;
        acc.supplierRtgs += row.supplierRtgs;
        acc.govDistribution += row.govDistribution;
        acc.supplierPayments += row.supplierPayments;
        acc.expenses += row.expenses;
        acc.incomes += row.incomes;
      acc.seCash += row.seCash;
      acc.netTotal += row.netTotal;
        return acc;
      },
    {
      supplierCash: 0,
      supplierRtgs: 0,
      govDistribution: 0,
      supplierPayments: 0,
      expenses: 0,
      incomes: 0,
      seCash: 0,
      netTotal: 0,
    }
    );
  }, [statementData]);

  const handleGenerateStatement = async () => {
    if (!statementStart || !statementEnd) {
      toast({
        title: "Select date range",
        description: "Please choose both start and end dates.",
        variant: "destructive",
      });
      return;
    }

    if (statementStart > statementEnd) {
      toast({
        title: "Invalid range",
        description: "Start date cannot be after end date.",
        variant: "destructive",
      });
      return;
    }

    setStatementLoading(true);
    setStatementError(null);
    try {
      const [payments, incomes, expenses] = await Promise.all([
        getAllPayments(),
        getAllIncomes(),
        getAllExpenses(),
      ]);

      const startDate = new Date(`${statementStart}T00:00:00`);
      const endDate = new Date(`${statementEnd}T23:59:59`);

      const normalizeDateKey = (raw: string | undefined | null) => {
        if (!raw) return null;
        const candidate = raw.includes("T") ? new Date(raw) : new Date(`${raw}T00:00:00`);
        if (Number.isNaN(candidate.getTime())) return null;
        if (candidate < startDate || candidate > endDate) return null;
        return format(candidate, "yyyy-MM-dd");
      };

      const map = new Map<string, { supplierCash: number; supplierRtgs: number; govDistribution: number; supplierPayments: number; incomes: number; expenses: number }>();
      const ensureRecord = (key: string) => {
        if (!map.has(key)) {
          map.set(key, { supplierCash: 0, supplierRtgs: 0, govDistribution: 0, supplierPayments: 0, incomes: 0, expenses: 0 });
        }
        return map.get(key)!;
      };

      payments.forEach((payment) => {
        const key = normalizeDateKey(payment.date);
        if (!key) return;
        const record = ensureRecord(key);

        const totalAmount = parseAmount(payment.amount);
        const rtgsAmount = parseAmount((payment as any).rtgsAmount);
        const receiptType = (payment.receiptType || (payment as any).type || "").toLowerCase();
        const channelHints = (payment as any).paymentMethod?.toLowerCase?.() || "";

        // Check if this is a Gov payment
        const isGovPayment = receiptType === 'gov.' || receiptType === 'gov' || receiptType.startsWith('gov');

        // If it's a Gov payment, add to govDistribution instead of supplierCash
        if (isGovPayment) {
          record.govDistribution += totalAmount;
          record.supplierPayments += totalAmount;
          return; // Skip the normal cash/RTGS logic for Gov payments
        }

        const addCash = (amount: number) => {
          if (amount > 0) record.supplierCash += amount;
        };

        const addRtgs = (amount: number) => {
          if (amount > 0) record.supplierRtgs += amount;
        };

        const registerMixed = (rtgsPortion: number) => {
          const sanitizedRtgs = Math.min(rtgsPortion, totalAmount);
          addRtgs(sanitizedRtgs);
          const cashPortion = Math.max(totalAmount - sanitizedRtgs, 0);
          addCash(cashPortion);
        };

        const channelString = `${receiptType} ${channelHints}`.trim();
        if (channelString.includes("cash")) {
          addCash(totalAmount);
        } else if (
          channelString.includes("rtgs") ||
          channelString.includes("neft") ||
          channelString.includes("imps") ||
          channelString.includes("online") ||
          channelString.includes("bank") ||
          channelString.includes("upi")
        ) {
          if (rtgsAmount > 0) {
            registerMixed(rtgsAmount);
          } else {
            addRtgs(totalAmount);
          }
        } else if (rtgsAmount > 0) {
          registerMixed(rtgsAmount);
        } else {
          addCash(totalAmount);
        }

        record.supplierPayments += totalAmount;
      });

      incomes.forEach((income) => {
        const key = normalizeDateKey(income.date);
        if (!key) return;
        const record = ensureRecord(key);
        record.incomes += Number(income.amount) || 0;
      });

      expenses.forEach((expense) => {
        const key = normalizeDateKey(expense.date);
        if (!key) return;
        const record = ensureRecord(key);
        record.expenses += Number(expense.amount) || 0;
      });

      const rows: StatementRow[] = Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, values]) => ({
          date,
          supplierCash: Math.round(values.supplierCash * 100) / 100,
          supplierRtgs: Math.round(values.supplierRtgs * 100) / 100,
          govDistribution: Math.round(values.govDistribution * 100) / 100,
          supplierPayments: Math.round(values.supplierPayments * 100) / 100,
          incomes: Math.round(values.incomes * 100) / 100,
          expenses: Math.round(values.expenses * 100) / 100,
          seCash: Math.round((values.supplierCash + values.expenses) * 100) / 100,
          netTotal: Math.round(
            (values.supplierPayments + values.expenses - values.incomes) * 100
          ) / 100,
        }));

      setStatementData(rows);
      setStatementGeneratedAt(new Date().toISOString());
    } catch (error: any) {
      const message = error?.message || "Unable to generate statement right now.";
      setStatementError(message);
      toast({
        title: "Statement generation failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setStatementLoading(false);
    }
  };

  const handleExportStatement = () => {
    if (!statementData.length) {
      toast({
        title: "Nothing to export",
        description: "Generate the daily statement before exporting to Excel.",
      });
      return;
    }

    const header = [
      "Date",
      "Supplier Cash (₹)",
      "Supplier RTGS (₹)",
      "Gov Distribution (₹)",
      "Supplier Payments (₹)",
      "Expenses (₹)",
      "Income (₹)",
      "S/E Cash (₹)",
      "Net Total (₹)",
    ];

    const rows = statementData.map((row) => [
      formatStatementDate(row.date),
      Number(row.supplierCash.toFixed(2)),
      Number(row.supplierRtgs.toFixed(2)),
      Number(row.govDistribution.toFixed(2)),
      Number(row.supplierPayments.toFixed(2)),
      Number(row.expenses.toFixed(2)),
      Number(row.incomes.toFixed(2)),
      Number(row.seCash.toFixed(2)),
      Number(row.netTotal.toFixed(2)),
    ]);

    const totalsRow = [
      "Totals",
      Number(statementTotals.supplierCash.toFixed(2)),
      Number(statementTotals.supplierRtgs.toFixed(2)),
      Number(statementTotals.govDistribution.toFixed(2)),
      Number(statementTotals.supplierPayments.toFixed(2)),
      Number(statementTotals.expenses.toFixed(2)),
      Number(statementTotals.incomes.toFixed(2)),
      Number(statementTotals.seCash.toFixed(2)),
      Number(statementTotals.netTotal.toFixed(2)),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows, totalsRow]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Statement");

    const safeStart = statementStart || "start";
    const safeEnd = statementEnd || "end";
    const fileName = `daily-statement-${safeStart}-to-${safeEnd}.xlsx`.replace(/[^a-zA-Z0-9-_\\.]/g, "_");
    XLSX.writeFile(workbook, fileName);
  };

  const handlePrintStatement = () => {
    if (!statementData.length) {
      toast({
        title: "Nothing to print",
        description: "Generate the daily statement before printing.",
      });
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    const rowsHtml = statementData
      .map((row) => {
        return `
          <tr>
            <td>${formatStatementDate(row.date)}</td>
            <td class="numeric text-primary">${formatCurrency(row.supplierCash)}</td>
            <td class="numeric text-primary">${formatCurrency(row.supplierRtgs)}</td>
            <td class="numeric text-primary">${formatCurrency(row.govDistribution)}</td>
            <td class="numeric text-primary">${formatCurrency(row.supplierPayments)}</td>
            <td class="numeric text-expense">${formatCurrency(row.expenses)}</td>
            <td class="numeric text-income">${formatCurrency(row.incomes)}</td>
            <td class="numeric text-total">${formatCurrency(row.seCash)}</td>
            <td class="numeric text-total">${formatCurrency(row.netTotal)}</td>
          </tr>
        `;
      })
      .join("");

    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Daily Distribution Statement</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 24px;
              font-family: "Segoe UI", Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
            }
            header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 24px;
              padding-bottom: 16px;
              border-bottom: 2px solid #1e3a8a;
            }
            .brand-title {
              font-size: 20px;
              font-weight: 700;
              letter-spacing: 0.04em;
              text-transform: uppercase;
              color: #1e3a8a;
            }
            .brand-subtitle {
              font-size: 13px;
              color: #475569;
            }
            .meta {
              font-size: 12px;
              text-align: right;
              color: #475569;
              line-height: 1.5;
            }
            h2 {
              margin: 0;
              font-size: 18px;
              font-weight: 600;
              color: #111827;
            }
            .range-line {
              margin: 4px 0 0 0;
              font-size: 13px;
              color: #475569;
            }
            .prepared-line {
              font-size: 12px;
              color: #64748b;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
              gap: 12px;
              margin: 0 0 20px 0;
            }
            .summary-card {
              border: 1px solid #d1d5db;
              border-radius: 12px;
              padding: 12px 14px;
              background: #f8fafc;
            }
            .summary-card h4 {
              margin: 0;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #475569;
            }
            .summary-card p {
              margin: 6px 0 0 0;
              font-size: 15px;
              font-weight: 600;
              color: #0f172a;
            }
            .summary-card.net {
              background: linear-gradient(120deg, #2563eb10, #1d4ed810);
              border-color: #2563eb60;
            }
            table.statement {
              width: 100%;
              border-collapse: collapse;
              margin-top: 12px;
            }
            table.statement thead th {
              background: #1f2937;
              color: #ffffff;
              padding: 10px;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            table.statement tbody td {
              border: 1px solid #d1d5db;
              padding: 10px;
              font-size: 12px;
            }
            table.statement tbody tr:nth-child(even) {
              background: #f9fafb;
            }
            .numeric { text-align: right; }
            .text-primary { color: #1d4ed8; }
            .text-expense { color: #b91c1c; }
            .text-income { color: #047857; }
            .text-total { color: #0f172a; font-weight: 600; }
            footer {
              margin-top: 28px;
              font-size: 11px;
              color: #64748b;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .signature {
              border-top: 1px solid #94a3b8;
              padding-top: 6px;
              width: 200px;
              text-align: center;
              font-weight: 600;
              color: #0f172a;
            }
            @media print {
              body { margin: 14mm 16mm; }
            }
          </style>
        </head>
        <body>
          <header>
            <div>
              <div class="brand-title">BizSuite Reports</div>
              <div class="brand-subtitle">Daily Financial Distribution Statement</div>
            </div>
            <div class="meta">
              <div><strong>Prepared:</strong> ${statementPreparedText}</div>
              <div><strong>Range:</strong> ${statementRangeLabel}</div>
              <div><strong>Total Days:</strong> ${statementData.length}</div>
            </div>
          </header>

          <section>
            <h2>Summary Overview</h2>
            <p class="range-line">Statement ${statementRangeLabel}</p>
            <p class="prepared-line">Generated via BizSuite Ledger</p>
            <div class="summary-grid">
              <div class="summary-card">
                <h4>Supplier Cash Payments</h4>
                <p>₹${formatCurrency(statementTotals.supplierCash)}</p>
              </div>
              <div class="summary-card">
                <h4>Supplier RTGS Payments</h4>
                <p>₹${formatCurrency(statementTotals.supplierRtgs)}</p>
              </div>
              <div class="summary-card">
                <h4>Gov Distribution</h4>
                <p>₹${formatCurrency(statementTotals.govDistribution)}</p>
              </div>
              <div class="summary-card">
                <h4>Total Supplier Payments</h4>
                <p>₹${formatCurrency(statementTotals.supplierPayments)}</p>
              </div>
              <div class="summary-card">
                <h4>Total Expenses</h4>
                <p>₹${formatCurrency(statementTotals.expenses)}</p>
              </div>
              <div class="summary-card">
                <h4>Total Incomes</h4>
                <p>₹${formatCurrency(statementTotals.incomes)}</p>
              </div>
              <div class="summary-card net">
                <h4>S/E Cash (Supplier Cash + Expenses)</h4>
                <p>₹${formatCurrency(statementTotals.seCash)}</p>
              </div>
              <div class="summary-card net">
                <h4>Net Total (Supplier Payments + Expenses - Income)</h4>
                <p>₹${formatCurrency(statementTotals.netTotal)}</p>
              </div>
            </div>
          </section>

          <section>
            <h2>Daily Breakdown</h2>
            <table class="statement">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier Cash (₹)</th>
                  <th>Supplier RTGS (₹)</th>
                  <th>Gov Distribution (₹)</th>
                  <th>Total Supplier Payments (₹)</th>
                  <th>Expenses (₹)</th>
                  <th>Income (₹)</th>
                  <th>S/E Cash (₹)</th>
                  <th>Net Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${
                  rowsHtml ||
                  `<tr><td colspan="9" style="text-align:center; padding: 18px;">No entries available for this period.</td></tr>`
                }
              </tbody>
            </table>
          </section>

          <footer>
            <div>
              BizSuite Ledger • Printed on ${format(new Date(), "dd MMM yyyy, hh:mm a")}
            </div>
            <div class="signature">Authorised Signatory</div>
          </footer>
        </body>
      </html>
    `;

    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  return (
    <div className="p-6 space-y-6">
      <style dangerouslySetInnerHTML={{ __html: STATEMENT_PRINT_STYLES }} />
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "ledger" | "statement")}
        className="space-y-6"
      >
        {/* Header Section - All elements in a card */}
        <Card className="p-3">
        <div className="flex items-center gap-3 flex-nowrap w-full overflow-x-auto">
            <TabsList className="flex-shrink-0 h-10">
              <TabsTrigger value="ledger" className="h-9">Ledger</TabsTrigger>
              <TabsTrigger value="statement" className="h-9">Generate Statement</TabsTrigger>
          </TabsList>
            {activeTab === "ledger" ? (
          <LedgerHeader
            accountDropdownOptions={accountDropdownOptions}
            activeAccountId={activeAccountId}
            onAccountChange={(value) => setActiveAccountId(value)}
            accountsLength={accounts.length}
            showAccountForm={showAccountForm}
            onToggleAccountForm={() => setShowAccountForm((prev) => !prev)}
            saving={saving}
            onPrintLedger={handlePrint}
            activeAccount={activeAccount}
          />
            ) : (
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <SmartDatePicker
                  value={statementStart}
                  onChange={(next) => setStatementStart(typeof next === 'string' ? next : next ? format(next, 'yyyy-MM-dd') : "")}
                  inputClassName="h-10 text-sm min-w-[150px]"
                  buttonClassName="h-10 w-10"
                />
                <SmartDatePicker
                  value={statementEnd}
                  onChange={(next) => setStatementEnd(typeof next === 'string' ? next : next ? format(next, 'yyyy-MM-dd') : "")}
                  inputClassName="h-10 text-sm min-w-[150px]"
                  buttonClassName="h-10 w-10"
                />
                <Button 
                  onClick={handleGenerateStatement} 
                  disabled={statementLoading} 
                  className="h-10 whitespace-nowrap ml-auto flex-shrink-0"
                >
                  {statementLoading ? "Generating..." : "Generate Statement"}
                </Button>
        </div>
            )}
          </div>
        </Card>
        <TabsContent value="ledger" className="space-y-6">
      {showAccountForm && (
        <AccountForm
          newAccount={newAccount}
          onAccountChange={setNewAccount}
          onSubmit={handleCreateAccount}
          onCancel={() => setShowAccountForm(false)}
          saving={saving}
        />
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-sm md:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border py-3">
          <div>
            <CardTitle className="text-lg">
              {activeAccount ? activeAccount.name : "Select an account"}
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
          <EntryForm
            entryForm={entryForm}
            onEntryFormChange={setEntryForm}
            onSubmit={handleAddEntry}
            activeAccount={activeAccount}
            saving={saving}
            accounts={accounts}
            activeAccountId={activeAccountId}
            linkAccountId={linkAccountId}
            onLinkAccountChange={setLinkAccountId}
            linkMode={linkMode}
            onLinkModeChange={setLinkMode}
          />
        </CardContent>
        </Card>

        <Card className="shadow-sm md:col-span-2">
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
                  cashAccounts.length
                    ? "Search cash account..."
                    : "No cash accounts yet"
                }
                noItemsPlaceholder={
                  cashAccounts.length === 0
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
                <Label htmlFor="newCashAccountName" className="text-[11px] font-medium">Cash Account Name</Label>
                <Input
                  id="newCashAccountName"
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

      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border py-3">
          <div>
            <CardTitle className="text-lg">Ledger Entries</CardTitle>
            <p className="text-xs text-muted-foreground">
              {activeAccount ? `Recent transactions for ${activeAccount.name}.` : "Select an account to view entries."}
            </p>
              </div>
              <div className="text-sm text-right">
                <p className="text-muted-foreground">Total Debit: ₹{formatCurrency(totals.debit)}</p>
                <p className="text-muted-foreground">Total Credit: ₹{formatCurrency(totals.credit)}</p>
                <p className="font-semibold text-primary">Balance: ₹{formatCurrency(totals.balance)}</p>
              </div>
        </CardHeader>
        <CardContent className="p-4">
          <div ref={ledgerRef} className="space-y-3">
            <div className="overflow-hidden border border-border rounded-lg">
              <div className="overflow-x-auto">
                <div className="max-h-[420px] overflow-y-auto">
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
                      {groupedEntries.length > 0 ? (
                        groupedEntries.flatMap((group) => {
                          // Removed date header row - entries will be displayed without date grouping headers

                          const entryRows = group.entries.map((entry) => {
                            const isEditing = editingEntryId === entry.id;
                            return (
                              <tr key={entry.id} className="border-t border-border align-top">
                                <td className="px-3 py-1.5 whitespace-nowrap">
                                  {isEditing ? (
                                    <SmartDatePicker
                                      value={editForm.date}
                                      onChange={(next) =>
                                        setEditForm((prev) => ({ ...prev, date: typeof next === 'string' ? next : next ? format(next, 'yyyy-MM-dd') : "" }))
                                      }
                                      disabled={saving}
                                      inputClassName="h-8 text-xs"
                                      buttonClassName="h-8 w-8"
                                      className="w-[190px]"
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

                          return entryRows;
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                            {activeAccount
                              ? dateFrom || dateTo
                                ? "No entries in this date range."
                                : "No entries yet. Add your first transaction."
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
        </TabsContent>

        <TabsContent value="statement" className="space-y-6">
              {statementError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{statementError}</p>
            </div>
              )}

          <Card
            ref={statementPrintRef}
            id={STATEMENT_PRINT_ID}
            className="shadow-sm print-card"
            >
            <CardHeader className="space-y-4">
          <div className="print-header print-only">
            <div>
              <h1>Daily Distribution Statement</h1>
              <p className="print-meta-line">Statement {statementRangeLabel}</p>
              </div>
            <div className="print-meta">
              <p>{statementPreparedText}</p>
              <p>Generated via BizSuite Ledger</p>
              </div>
          </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Per-Day Distribution</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Totals include supplier payments, expenses, and incomes recorded {statementRangeLabel}.
                  </p>
                  {statementGeneratedLabel && (
                    <p className="text-xs text-muted-foreground">
                      Prepared on {statementGeneratedLabel}.
                    </p>
                                    )}
                                  </div>
                <div className="flex flex-wrap gap-2 print-hidden">
                                <Button
                                  variant="outline"
                    onClick={handlePrintStatement}
                    className="h-9"
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Print Report
                  </Button>
                  <Button onClick={handleExportStatement} className="h-9">
                    <Download className="mr-2 h-4 w-4" />
                    Download Excel
                                </Button>
                              </div>
              </div>
              <div className="print-hidden grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-7">
                <div className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Supplier Cash Payments
                  </p>
                  <p className="mt-1 text-lg font-semibold text-primary">
                    ₹{formatCurrency(statementTotals.supplierCash)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Supplier RTGS Payments
                  </p>
                  <p className="mt-1 text-lg font-semibold text-primary">
                    ₹{formatCurrency(statementTotals.supplierRtgs)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Gov Distribution
                  </p>
                  <p className="mt-1 text-lg font-semibold text-primary">
                    ₹{formatCurrency(statementTotals.govDistribution)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Total Supplier Payments
                  </p>
                  <p className="mt-1 text-lg font-semibold text-primary">
                    ₹{formatCurrency(statementTotals.supplierPayments)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Total Expenses
                  </p>
                  <p className="mt-1 text-lg font-semibold text-rose-600">
                    ₹{formatCurrency(statementTotals.expenses)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Total Incomes
                  </p>
                  <p className="mt-1 text-lg font-semibold text-emerald-600">
                    ₹{formatCurrency(statementTotals.incomes)}
                  </p>
                </div>
                <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    S/E Cash (Supplier Cash + Expenses)
                  </p>
                  <p className="mt-1 text-lg font-semibold text-primary">
                    ₹{formatCurrency(statementTotals.seCash)}
                  </p>
                </div>
                <div className="rounded-xl border border-primary/60 bg-gradient-to-r from-secondary/10 via-primary/5 to-secondary/5 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    Net Total (Supplier Payments + Expenses - Income)
                  </p>
                  <p className="mt-1 text-lg font-semibold text-primary">
                    ₹{formatCurrency(statementTotals.netTotal)}
                  </p>
                </div>
              </div>
              <div className="print-only">
                <table className="print-summary-table">
                  <tbody>
                    <tr>
                      <th scope="row">Supplier Cash Payments</th>
                      <td className="amount-cell">₹{formatCurrency(statementTotals.supplierCash)}</td>
                    </tr>
                    <tr>
                      <th scope="row">Supplier RTGS Payments</th>
                      <td className="amount-cell">₹{formatCurrency(statementTotals.supplierRtgs)}</td>
                    </tr>
                    <tr>
                      <th scope="row">Gov Distribution</th>
                      <td className="amount-cell">₹{formatCurrency(statementTotals.govDistribution)}</td>
                    </tr>
                    <tr>
                      <th scope="row">Total Supplier Payments</th>
                      <td className="amount-cell">₹{formatCurrency(statementTotals.supplierPayments)}</td>
                    </tr>
                    <tr>
                      <th scope="row">Total Expenses</th>
                      <td className="amount-cell">₹{formatCurrency(statementTotals.expenses)}</td>
                    </tr>
                    <tr>
                      <th scope="row">Total Incomes</th>
                      <td className="amount-cell">₹{formatCurrency(statementTotals.incomes)}</td>
                    </tr>
                    <tr>
                      <th scope="row">S/E Cash (Supplier Cash + Expenses)</th>
                      <td className="amount-cell">₹{formatCurrency(statementTotals.seCash)}</td>
                    </tr>
                    <tr className="total-row">
                      <th scope="row">Net Total (Supplier Payments + Expenses - Income)</th>
                      <td className="amount-cell">₹{formatCurrency(statementTotals.netTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/70 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Date</th>
                      <th className="px-4 py-2 text-right font-semibold">Supplier Cash (₹)</th>
                      <th className="px-4 py-2 text-right font-semibold">Supplier RTGS (₹)</th>
                      <th className="px-4 py-2 text-right font-semibold">Gov Distribution (₹)</th>
                      <th className="px-4 py-2 text-right font-semibold">Supplier Payments (₹)</th>
                      <th className="px-4 py-2 text-right font-semibold">Expenses (₹)</th>
                      <th className="px-4 py-2 text-right font-semibold">Income (₹)</th>
                      <th className="px-4 py-2 text-right font-semibold">S/E Cash (₹)</th>
                      <th className="px-4 py-2 text-right font-semibold">Net Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementLoading ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
                          Generating statement…
                            </td>
                      </tr>
                    ) : statementData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
                          No data found for the selected range.
                            </td>
                          </tr>
                    ) : (
                      statementData.map((row) => (
                        <tr key={row.date} className="border-t border-border">
                          <td className="px-4 py-2">{formatStatementDate(row.date)}</td>
                          <td className="px-4 py-2 text-right text-primary">{formatCurrency(row.supplierCash)}</td>
                          <td className="px-4 py-2 text-right text-primary">{formatCurrency(row.supplierRtgs)}</td>
                          <td className="px-4 py-2 text-right text-primary">{formatCurrency(row.govDistribution)}</td>
                          <td className="px-4 py-2 text-right text-primary">{formatCurrency(row.supplierPayments)}</td>
                          <td className="px-4 py-2 text-right text-red-500">{formatCurrency(row.expenses)}</td>
                          <td className="px-4 py-2 text-right text-emerald-600">{formatCurrency(row.incomes)}</td>
                          <td className="px-4 py-2 text-right font-semibold text-primary">{formatCurrency(row.seCash)}</td>
                          <td className="px-4 py-2 text-right font-semibold">{formatCurrency(row.netTotal)}</td>
                        </tr>
                      ))
                    )}
                    </tbody>
                  </table>
                </div>
              <div className="px-4 pb-8 print-only">
                <div className="print-footer">
                  <div>
                    <p>Generated via BizSuite Ledger</p>
                    <p>Prepared on {statementPreparedText}</p>
              </div>
                  <div className="print-signature">Authorised Signatory</div>
                </div>
                </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LedgerPage;
