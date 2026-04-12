import { useState, useEffect, useMemo, useCallback } from "react";
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
} from "@/lib/firestore";
import { toTitleCase } from "@/lib/utils";
import {
  generateLedgerEntryId,
  queueLedgerEntriesUpsert,
  queueLedgerEntryDelete,
  queueLedgerEntryUpsert,
} from "@/lib/ledger-sync";
import { CASH_DENOMINATIONS, recalculateBalances, sortEntries, generateLinkGroupId } from "../utils";
import { fuzzyMatchProfiles } from "../../supplier-profile/utils/fuzzy-matching";
import { useGlobalData } from "@/contexts/global-data-context";

export function useLedgerPage() {
  const { toast } = useToast();
  const globalData = useGlobalData();
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [entriesMap, setEntriesMap] = useState<Record<string, LedgerEntry[]>>({});
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [cashAccounts, setCashAccounts] = useState<LedgerCashAccount[]>([]);
  const [activeCashAccountId, setActiveCashAccountId] = useState<string | null>(null);
  const [showCashAccountForm, setShowCashAccountForm] = useState(false);
  const [newCashAccountName, setNewCashAccountName] = useState("");
  const [cashSaving, setCashSaving] = useState(false);

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
  });

  const createEmptyNoteGroups = useCallback((): Record<string, number[]> =>
    CASH_DENOMINATIONS.reduce((acc, denomination) => {
      acc[denomination.toString()] = [0];
      return acc;
    }, {} as Record<string, number[]>), []);

  const normalizeNoteGroups = useCallback((noteGroups?: Record<string, number[]>) => {
    const base = createEmptyNoteGroups();
    CASH_DENOMINATIONS.forEach((denomination) => {
      const key = denomination.toString();
      if (noteGroups && Array.isArray(noteGroups[key]) && (noteGroups[key] as number[]).length) {
        base[key] = (noteGroups[key] as number[]).map((value) => Number(value) || 0);
      }
    });
    return base;
  }, [createEmptyNoteGroups]);

  // Real-time listeners for accounts and cash accounts
  useEffect(() => {
    const unsubscribeCash = getLedgerCashAccountsRealtime(
      (data) => {
        const normalized = data
          .map((account) => ({
            ...account,
            noteGroups: normalizeNoteGroups(account.noteGroups),
          }))
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

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

    const unsubscribeAccounts = getLedgerAccountsRealtime(
      (data) => {
        // --- FUZZY GROUPING LOGIC ---
        const groups: Array<LedgerAccount & { subAccountIds?: string[] }> = [];
        data.forEach(acc => {
          const profile = { name: acc.name, fatherName: '', address: acc.address || '' };
          
          let matchedGroup = groups.find(g => 
            fuzzyMatchProfiles(
              { name: g.name, fatherName: '', address: g.address || '' },
              profile
            ).isMatch
          );

          if (matchedGroup) {
            if (!matchedGroup.subAccountIds) matchedGroup.subAccountIds = [matchedGroup.id];
            matchedGroup.subAccountIds.push(acc.id);
            // Optionally merge details if one is more complete
            if (!matchedGroup.address && acc.address) matchedGroup.address = acc.address;
            if (!matchedGroup.contact && acc.contact) matchedGroup.contact = acc.contact;
          } else {
            groups.push({ ...acc, subAccountIds: [acc.id] });
          }
        });

        const sortedGroups = groups.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setAccounts(sortedGroups);
        
        if (!activeAccountId && sortedGroups.length > 0) {
          setActiveAccountId(sortedGroups[0].id);
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
      unsubscribeCash();
      unsubscribeAccounts();
    };
  }, [toast, normalizeNoteGroups]); // Removed activeAccountId from dependencies to avoid loop, it's set once

  // Real-time listener for entries
  useEffect(() => {
    const activeAcc = accounts.find(a => a.id === activeAccountId) as (LedgerAccount & { subAccountIds?: string[] }) | undefined;
    const accountIdsToFetch = activeAcc?.subAccountIds || (activeAccountId ? [activeAccountId] : []);

    if (accountIdsToFetch.length === 0) return;

    // Fetch entries for all linked sub-accounts in the fuzzy group
    const unsubscribes = accountIdsToFetch.map(id => 
      getLedgerEntriesRealtime(
        (data) => {
          setEntriesMap((prev) => ({ ...prev, [id]: data }));
        },
        (error) => {
          console.error(`Error fetching entries for account ${id}:`, error);
        },
        id
      )
    );

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [activeAccountId, toast]);

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === activeAccountId) || null,
    [accounts, activeAccountId]
  );

  const activeEntries = useMemo<LedgerEntry[]>(
    () => {
      if (!activeAccountId) return [];
      
      const activeAcc = accounts.find(a => a.id === activeAccountId) as (LedgerAccount & { subAccountIds?: string[] }) | undefined;
      const accountIds = activeAcc?.subAccountIds || [activeAccountId];
      
      // Combine entries from all sub-accounts in the group
      const base = accountIds.flatMap(id => entriesMap[id] || []);
      
      if (!activeAcc) return sortEntries(recalculateBalances(base));

      const adjustments: LedgerEntry[] = [];
      const accountNames = [(activeAcc.name || '').toLowerCase()]; 
      // If we want to be thorough, we could include names from all sub-accounts, 
      // but usually the fuzzy match implies the names are very similar anyway.

      globalData.incomes.forEach((inc) => {
        if (inc.isInternal && accountNames.includes((inc.payee || '').toLowerCase())) {
          adjustments.push({
            id: inc.id,
            accountId: activeAccountId,
            date: inc.date,
            particulars: `Adjustment (Income): ${inc.category}${inc.subCategory ? ` - ${inc.subCategory}` : ""}`,
            remarks: inc.description,
            debit: 0,
            credit: inc.amount,
            balance: 0,
            createdAt: inc.createdAt || new Date().toISOString(),
            updatedAt: inc.updatedAt || new Date().toISOString(),
          });
        }
      });

      globalData.expenses.forEach((exp) => {
        if (exp.isInternal && accountNames.includes((exp.payee || '').toLowerCase())) {
          adjustments.push({
            id: exp.id,
            accountId: activeAccountId,
            date: exp.date,
            particulars: `Adjustment (Expense): ${exp.category}${exp.subCategory ? ` - ${exp.subCategory}` : ""}`,
            remarks: exp.description,
            debit: exp.amount,
            credit: 0,
            balance: 0,
            createdAt: exp.createdAt || new Date().toISOString(),
            updatedAt: exp.updatedAt || new Date().toISOString(),
          });
        }
      });

      if (adjustments.length === 0) return base;

      const combined = [...base, ...adjustments];
      return sortEntries(recalculateBalances(combined));
    },
    [entriesMap, activeAccountId, activeAccount, globalData.incomes, globalData.expenses]
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
      if (a.date && b.date) {
        const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateCompare !== 0) return dateCompare;
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [activeEntries, dateFrom, dateTo]);

  const displayEntries = useMemo(() => {
    const sortedForCalculation = [...filteredEntries].sort((a, b) => {
      if (a.date && b.date) {
        const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateCompare !== 0) return dateCompare;
      }
      return a.createdAt.localeCompare(b.createdAt);
    });
    
    let running = 0;
    const withBalances = sortedForCalculation.map((entry) => {
      running = Math.round((running + entry.debit - entry.credit) * 100) / 100;
      return { ...entry, runningBalance: running };
    });
    
    const balanceMap = new Map(withBalances.map(e => [e.id, e.runningBalance]));
    
    return filteredEntries.map((entry) => ({
      ...entry,
      runningBalance: balanceMap.get(entry.id) ?? 0,
    }));
  }, [filteredEntries]);

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
        const updated = [...prev, createdAccount].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return updated;
      });
      setEntriesMap((prev) => ({ ...prev, [createdAccount.id]: [] }));
      setActiveAccountId(createdAccount.id);

      if (db) {
        await db.ledgerAccounts.put(createdAccount);
      }
      toast({ title: "Account created" });
      setShowAccountForm(false);
      setNewAccount({ name: "", address: "", contact: "" });
    } catch (error: any) {
      toast({ title: "Account creation failed", description: error?.message || "Please try again", variant: "destructive" });
    } finally {
      setSaving(false);
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
      createdAt: nowIso,
      updatedAt: nowIso,
      linkGroupId,
      linkStrategy: linkTargetId ? linkMode : undefined,
    };

    const currentEntries = activeEntries;
    const updatedEntries = recalculateBalances([...currentEntries, newEntryBase]);
    const savedEntry = updatedEntries[updatedEntries.length - 1];

    setSaving(true);
    try {
      setEntriesMap((prev) => ({
        ...prev,
        [activeAccountId]: updatedEntries,
      }));

      await persistEntriesToIndexedDb(activeAccountId, updatedEntries);

      // Simple sync for now (same as legacy page.tsx)
      const timestamp = new Date().toISOString();
      const entriesToSync: LedgerEntry[] = [];
      updatedEntries.forEach((entry, idx) => {
        const previousEntry = currentEntries[idx];
        if (!previousEntry || entry.balance !== previousEntry.balance || entry.id === savedEntry.id) {
          entriesToSync.push({ ...entry, updatedAt: timestamp });
        }
      });

      if (entriesToSync.length) {
        await queueLedgerEntriesUpsert(entriesToSync);
      }

      // Handle linked account if any
      if (linkTargetId) {
        const counterEntries = entriesMap[linkTargetId] || [];
        const counterDebit = linkMode === "mirror" ? sanitizedCredit : sanitizedDebit;
        const counterCredit = linkMode === "mirror" ? sanitizedDebit : sanitizedCredit;

        const counterEntryBase: LedgerEntry = {
          id: generateLedgerEntryId(),
          accountId: linkTargetId,
          date: entryForm.date,
          particulars: entryForm.particulars.trim() || "-",
          debit: counterDebit,
          credit: counterCredit,
          balance: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
          linkGroupId,
          linkStrategy: linkMode,
        };

        const counterUpdatedEntries = recalculateBalances([...counterEntries, counterEntryBase]);
        const savedCounterEntry = counterUpdatedEntries[counterUpdatedEntries.length - 1];

        setEntriesMap((prev) => ({ ...prev, [linkTargetId]: counterUpdatedEntries }));
        await persistEntriesToIndexedDb(linkTargetId, counterUpdatedEntries);

        const counterEntriesToSync: LedgerEntry[] = [];
        counterUpdatedEntries.forEach((entry, idx) => {
          const previousEntry = counterEntries[idx];
          if (!previousEntry || entry.balance !== previousEntry.balance || entry.id === savedCounterEntry.id) {
            counterEntriesToSync.push({ ...entry, updatedAt: timestamp });
          }
        });
        if (counterEntriesToSync.length) {
          await queueLedgerEntriesUpsert(counterEntriesToSync);
        }
      }

      toast({ title: "Entry added" });
      setEntryForm({
        date: new Date().toISOString().split("T")[0],
        particulars: "",
        debit: "",
        credit: "",
      });
      setLinkAccountId("");
      setLinkMode("mirror");
    } catch (error: any) {
      toast({ title: "Unable to add entry", description: error?.message || "Please try again", variant: "destructive" });
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
    });
  };

  const handleCancelEdit = () => {
    setEditingEntryId(null);
    setEditForm({ date: "", particulars: "", debit: "", credit: "" });
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
            }
          : entry
      );

      const recalculatedActive = recalculateBalances(updatedEntriesRaw);
      const timestamp = new Date().toISOString();
      const changedEntries: LedgerEntry[] = [];

      const finalActiveEntries = recalculatedActive.map((entry) => {
        const previous = currentEntries.find(e => e.id === entry.id);
        const hasChanged = !previous || entry.date !== previous.date || entry.particulars !== previous.particulars || 
                           entry.debit !== previous.debit || entry.credit !== previous.credit || entry.balance !== previous.balance;

        if (hasChanged) {
          const updatedEntry = { ...entry, updatedAt: timestamp };
          changedEntries.push(updatedEntry);
          return updatedEntry;
        }
        return entry;
      });

      // Handle linked entry update
      let counterpartAccountId: string | null = null;
      let counterpartUpdated: LedgerEntry[] | null = null;
      if (editedEntry.linkGroupId) {
        for (const [accId, entries] of Object.entries(entriesMap)) {
          if (accId === activeAccountId) continue;
          const match = entries.find((entry) => entry.linkGroupId === editedEntry.linkGroupId);
          if (match) {
            counterpartAccountId = accId;
            const strategy = editedEntry.linkStrategy || match.linkStrategy || "mirror";
            const counterpartUpdatedRaw = entries.map((entry) =>
              entry.linkGroupId === editedEntry.linkGroupId
                ? {
                    ...entry,
                    date: editForm.date,
                    particulars: editForm.particulars.trim() || "-",
                    debit: strategy === "same" ? Math.round(debitValue * 100) / 100 : Math.round(creditValue * 100) / 100,
                    credit: strategy === "same" ? Math.round(creditValue * 100) / 100 : Math.round(debitValue * 100) / 100,
                  }
                : entry
            );
            counterpartUpdated = recalculateBalances(counterpartUpdatedRaw).map(entry => {
                const previous = entries.find(e => e.id === entry.id);
                if (!previous || entry.balance !== previous.balance || entry.date !== previous.date) {
                    const updated = { ...entry, updatedAt: timestamp };
                    changedEntries.push(updated);
                    return updated;
                }
                return entry;
            });
            break;
          }
        }
      }

      setEntriesMap((prev) => ({
        ...prev,
        [activeAccountId]: finalActiveEntries,
        ...(counterpartAccountId && counterpartUpdated ? { [counterpartAccountId]: counterpartUpdated } : {}),
      }));

      await persistEntriesToIndexedDb(activeAccountId, finalActiveEntries);
      if (counterpartAccountId && counterpartUpdated) {
        await persistEntriesToIndexedDb(counterpartAccountId, counterpartUpdated);
      }

      if (changedEntries.length) {
        await queueLedgerEntriesUpsert(changedEntries);
      }

      toast({ title: "Entry updated" });
      handleCancelEdit();
    } catch (error: any) {
      toast({ title: "Unable to update entry", description: error?.message || "Please try again", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!activeAccountId || saving) return;
    const { confirm } = await import("@/lib/confirm-dialog");
    const confirmed = await confirm("Delete this ledger entry?", { title: "Confirm Delete", variant: "destructive", confirmText: "Delete" });
    if (!confirmed) return;

    const entryToDelete = activeEntries.find((entry) => entry.id === entryId);
    if (!entryToDelete) return;

    setSaving(true);
    try {
      await queueLedgerEntryDelete(entryId);
      
      const remaining = activeEntries.filter((entry) => entry.id !== entryId);
      const recalculated = recalculateBalances(remaining);
      const timestamp = new Date().toISOString();
      const changedEntries: LedgerEntry[] = [];

      const finalActiveEntries = recalculated.map((entry) => {
          const previous = remaining.find(e => e.id === entry.id);
          if (!previous || entry.balance !== previous.balance) {
              const updated = { ...entry, updatedAt: timestamp };
              changedEntries.push(updated);
              return updated;
          }
          return entry;
      });

      let counterpartAccountId: string | null = null;
      let counterpartUpdated: LedgerEntry[] | null = null;
      if (entryToDelete.linkGroupId) {
        for (const [accId, entries] of Object.entries(entriesMap)) {
            if (accId === activeAccountId) continue;
            const match = entries.find(e => e.linkGroupId === entryToDelete.linkGroupId);
            if (match) {
                counterpartAccountId = accId;
                await queueLedgerEntryDelete(match.id);
                const remainingCounter = entries.filter(e => e.id !== match.id);
                counterpartUpdated = recalculateBalances(remainingCounter).map(entry => {
                    const previous = remainingCounter.find(e => e.id === entry.id);
                    if (!previous || entry.balance !== previous.balance) {
                        const updated = { ...entry, updatedAt: timestamp };
                        changedEntries.push(updated);
                        return updated;
                    }
                    return entry;
                });
                break;
            }
        }
      }

      setEntriesMap((prev) => ({
        ...prev,
        [activeAccountId]: finalActiveEntries,
        ...(counterpartAccountId && counterpartUpdated ? { [counterpartAccountId]: counterpartUpdated } : {}),
      }));

      await persistEntriesToIndexedDb(activeAccountId, finalActiveEntries);
      if (counterpartAccountId && counterpartUpdated) {
          await persistEntriesToIndexedDb(counterpartAccountId, counterpartUpdated);
      }

      if (changedEntries.length) {
        await queueLedgerEntriesUpsert(changedEntries);
      }

      toast({ title: "Entry deleted" });
    } catch (error: any) {
      toast({ title: "Unable to delete entry", description: error?.message || "Please try again", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCashAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newCashAccountName.trim() || cashSaving) return;

    setCashSaving(true);
    try {
      const createdAccount = await createLedgerCashAccount({
        name: newCashAccountName.trim(),
        noteGroups: createEmptyNoteGroups(),
      });

      const normalized = {
        ...createdAccount,
        noteGroups: normalizeNoteGroups(createdAccount.noteGroups),
      };

      setCashAccounts((prev) => [...prev, normalized].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      setActiveCashAccountId(normalized.id);
      
      toast({ title: "Cash account created" });
      setShowCashAccountForm(false);
      setNewCashAccountName("");
    } catch (error: any) {
      toast({ title: "Unable to create cash account", description: error?.message || "Please try again", variant: "destructive" });
    } finally {
      setCashSaving(false);
    }
  };

  // Cash Management logic
  const updateCashAccount = useCallback((accountId: string, updater: (account: LedgerCashAccount) => LedgerCashAccount) => {
    let updatedAccount: LedgerCashAccount | null = null;
    setCashAccounts((prev) => {
      const next = prev.map((account) => {
        if (account.id !== accountId) return account;
        const updated = updater(account);
        const normalized = { ...updated, noteGroups: normalizeNoteGroups(updated.noteGroups) };
        updatedAccount = normalized;
        return normalized;
      });
      return next;
    });
    if (updatedAccount) {
      updateLedgerCashAccount((updatedAccount as any).id, {
        name: (updatedAccount as any).name,
        noteGroups: (updatedAccount as any).noteGroups,
      }).catch(() => {
        toast({ title: "Unable to save cash account", variant: "destructive" });
      });
    }
  }, [normalizeNoteGroups, toast]);

  const handleUpdateCashCount = (denomination: number, index: number, rawValue: string) => {
    if (!activeCashAccountId) return;
    const sanitized = Math.max(0, Math.floor(Number(rawValue) || 0));
    updateCashAccount(activeCashAccountId, (account) => {
      const key = denomination.toString();
      const counts = [...(account.noteGroups[key] || [0])];
      counts[index] = sanitized;
      return { ...account, noteGroups: { ...account.noteGroups, [key]: counts }, updatedAt: new Date().toISOString() };
    });
  };

  const handleAddCashCountRow = (denomination: number) => {
    if (!activeCashAccountId) return;
    updateCashAccount(activeCashAccountId, (account) => {
      const key = denomination.toString();
      const counts = [...(account.noteGroups[key] || [])];
      counts.push(0);
      return { ...account, noteGroups: { ...account.noteGroups, [key]: counts.length ? counts : [0] }, updatedAt: new Date().toISOString() };
    });
  };

  const handleRemoveCashCountRow = (denomination: number, index: number) => {
    if (!activeCashAccountId) return;
    updateCashAccount(activeCashAccountId, (account) => {
      const key = denomination.toString();
      const counts = [...(account.noteGroups[key] || [0])];
      if (counts.length === 1) counts[0] = 0; else counts.splice(index, 1);
      return { ...account, noteGroups: { ...account.noteGroups, [key]: counts.length ? counts : [0] }, updatedAt: new Date().toISOString() };
    });
  };

  const handleResetCashAccount = () => {
    if (!activeCashAccountId || cashSaving) return;
    updateCashAccount(activeCashAccountId, (account) => ({
      ...account, noteGroups: createEmptyNoteGroups(), updatedAt: new Date().toISOString(),
    }));
    toast({ title: "Cash account cleared" });
  };

  const handleDeleteCashAccount = async (accountId: string) => {
    if (cashSaving) return;
    const target = cashAccounts.find((account) => account.id === accountId);
    if (!target) return;
    const { confirm } = await import("@/lib/confirm-dialog");
    const confirmed = await confirm(`Delete cash account "${target.name}"?`, { title: "Confirm Delete", variant: "destructive", confirmText: "Delete" });
    if (!confirmed) return;

    setCashSaving(true);
    try {
      await deleteLedgerCashAccount(accountId);
      setCashAccounts((prev) => {
        const next = prev.filter((account) => account.id !== accountId);
        if (activeCashAccountId === accountId) setActiveCashAccountId(next[0]?.id ?? null);
        return next;
      });
      toast({ title: "Cash account deleted" });
    } catch (error: any) {
      toast({ title: "Unable to delete cash account", variant: "destructive" });
    } finally {
      setCashSaving(false);
    }
  };

  const activeCashAccount = useMemo(
    () => cashAccounts.find((account) => account.id === activeCashAccountId) || null,
    [cashAccounts, activeCashAccountId]
  );

  const cashSummary = useMemo(() => {
    if (!activeCashAccount) return { totalNotes: 0, totalAmount: 0, denominationTotals: {} };
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

  return {
    // State
    accounts,
    activeAccountId,
    setActiveAccountId,
    activeAccount,
    entriesMap,
    activeEntries,
    displayEntries,
    filteredEntries,
    showAccountForm,
    setShowAccountForm,
    saving,
    newAccount,
    setNewAccount,
    entryForm,
    setEntryForm,
    linkAccountId,
    setLinkAccountId,
    linkMode,
    setLinkMode,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    editingEntryId,
    editForm,
    setEditForm,
    
    // Cash state
    cashAccounts,
    activeCashAccountId,
    setActiveCashAccountId,
    activeCashAccount,
    showCashAccountForm,
    setShowCashAccountForm,
    newCashAccountName,
    setNewCashAccountName,
    cashSaving,
    cashSummary,

    // Actions
    handleCreateAccount,
    handleAddEntry,
    handleEditEntry,
    handleCancelEdit,
    handleSaveEdit,
    handleDeleteEntry,
    handleCreateCashAccount,
    handleUpdateCashCount,
    handleAddCashCountRow,
    handleRemoveCashCountRow,
    handleResetCashAccount,
    handleDeleteCashAccount,
  };
}
