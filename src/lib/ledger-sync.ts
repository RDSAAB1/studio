"use client";

import type { LedgerEntry } from "./definitions";
import {
  enqueueSyncTask,
  removeTasksByDedupeKey,
  registerSyncProcessor,
} from "./sync-queue";
import { updateLedgerEntriesBatch, deleteLedgerEntry } from "./firestore";

const LEDGER_UPSERT_TASK = "ledgerEntry:upsert";
const LEDGER_DELETE_TASK = "ledgerEntry:delete";

if (typeof window !== "undefined") {
  registerSyncProcessor<LedgerEntry>(LEDGER_UPSERT_TASK, async ({ payload }) => {
    if (!payload?.id) {
      throw new Error("Ledger upsert payload missing id");
    }
    await updateLedgerEntriesBatch([payload]);
  });

  registerSyncProcessor<{ id: string }>(
    LEDGER_DELETE_TASK,
    async ({ payload }) => {
      if (!payload?.id) {
        throw new Error("Ledger delete payload missing id");
      }
      await deleteLedgerEntry(payload.id);
    },
  );
}

export function generateLedgerEntryId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `ledger_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function queueLedgerEntryUpsert(entry: LedgerEntry) {
  if (!entry?.id) {
    throw new Error("Cannot queue ledger entry without id");
  }
  await enqueueSyncTask(LEDGER_UPSERT_TASK, entry, {
    dedupeKey: `ledgerEntry:${entry.id}`,
  });
}

export async function queueLedgerEntriesUpsert(entries: LedgerEntry[]) {
  for (const entry of entries) {
    await queueLedgerEntryUpsert(entry);
  }
}

export async function queueLedgerEntryDelete(entryId: string) {
  if (!entryId) return;
  const dedupeKey = `ledgerEntry:${entryId}`;
  await removeTasksByDedupeKey(dedupeKey);
  await enqueueSyncTask(LEDGER_DELETE_TASK, { id: entryId }, {
    dedupeKey,
  });
}

