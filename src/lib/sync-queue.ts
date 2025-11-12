"use client";

import type { SyncTask, SyncTaskStatus } from "./definitions";
import { db } from "./database";

type SyncProcessor<T = unknown> = (task: SyncTask<T>) => Promise<void>;

const processors = new Map<string, SyncProcessor<any>>();

type SyncQueueListener = (stats: SyncQueueStats) => void;
const listeners = new Set<SyncQueueListener>();

let activeProcessPromise: Promise<number> | null = null;
let lastStats: SyncQueueStats = { pending: 0, failed: 0, processing: 0 };

const MAX_ATTEMPTS = 10;
const DEFAULT_BACKOFF_MS = 15_000;
const MAX_BACKOFF_MS = 5 * 60_000;

export type EnqueueOptions = {
  dedupeKey?: string;
  attemptImmediate?: boolean;
};

export type SyncQueueStats = {
  pending: number;
  failed: number;
  processing: number;
};

const isClient = typeof window !== "undefined";

function getBackoffDelay(attempts: number) {
  const delay = DEFAULT_BACKOFF_MS * Math.max(1, attempts);
  return Math.min(delay, MAX_BACKOFF_MS);
}

export function registerSyncProcessor<T = unknown>(
  type: string,
  processor: SyncProcessor<T>,
) {
  processors.set(type, processor as SyncProcessor<any>);
}

export function unregisterSyncProcessor(type: string) {
  processors.delete(type);
}

export function subscribeSyncQueue(listener: SyncQueueListener) {
  listeners.add(listener);
  listener(lastStats);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(stats: SyncQueueStats) {
  lastStats = stats;
  listeners.forEach((listener) => {
    try {
      listener(stats);
    } catch (error) {
      console.warn("Sync queue listener error:", error);
    }
  });
}

async function refreshStats() {
  if (!db) return;
  const [pending, failed, processing] = await Promise.all([
    db.syncQueue.where("status").equals("pending").count(),
    db.syncQueue.where("status").equals("failed").count(),
    db.syncQueue.where("status").equals("processing").count(),
  ]);
  notifyListeners({ pending, failed, processing });
}

export async function removeTasksByDedupeKey(dedupeKey: string) {
  if (!db || !dedupeKey) return;
  const tasks = await db.syncQueue.where("dedupeKey").equals(dedupeKey).toArray();
  const ids = tasks.map((task) => task.id).filter((id): id is number => typeof id === "number");
  if (ids.length) {
    await db.syncQueue.bulkDelete(ids);
    void refreshStats();
  }
}

export async function enqueueSyncTask<TPayload = unknown>(
  type: string,
  payload: TPayload,
  options: EnqueueOptions = {},
) {
  if (!db) return;
  const now = Date.now();
  const { dedupeKey, attemptImmediate = true } = options;

  if (dedupeKey) {
    const existing = await db.syncQueue.where("dedupeKey").equals(dedupeKey).first();
    if (existing?.id !== undefined) {
      await db.syncQueue.update(existing.id, {
        payload,
        status: "pending" satisfies SyncTaskStatus,
        nextRetryAt: now,
        lastError: undefined,
      });
      if (attemptImmediate && isClient) {
        void processSyncQueue();
      }
      void refreshStats();
      return;
    }
  }

  const task: SyncTask<TPayload> = {
    type,
    payload,
    attempts: 0,
    status: "pending",
    createdAt: new Date(now).toISOString(),
    dedupeKey,
    nextRetryAt: now,
  };

  await db.syncQueue.add(task);
  void refreshStats();

  if (attemptImmediate && isClient) {
    void processSyncQueue();
  }
}

async function getEligibleTasks(limit: number): Promise<SyncTask[]> {
  if (!db) return [];
  const now = Date.now();
  const tasks = await db.syncQueue
    .filter((task) => {
      if (!task) return false;
      const eligibleStatus =
        task.status === "pending" || task.status === "failed";
      if (!eligibleStatus) return false;
      if (!task.nextRetryAt) return true;
      return task.nextRetryAt <= now;
    })
    .toArray();

  tasks.sort((a, b) => {
    const aTime = a.nextRetryAt ?? 0;
    const bTime = b.nextRetryAt ?? 0;
    if (aTime === bTime) {
      return a.createdAt.localeCompare(b.createdAt);
    }
    return aTime - bTime;
  });

  return tasks.slice(0, limit);
}

export async function processSyncQueue(limit = 10): Promise<number> {
  if (!db || !isClient) return 0;
  if (activeProcessPromise) {
    return activeProcessPromise;
  }

  activeProcessPromise = (async () => {
    const tasks = await getEligibleTasks(limit);
    if (!tasks.length) {
      await refreshStats();
      return 0;
    }

    let processed = 0;

    for (const task of tasks) {
      if (task.id === undefined) continue;
      const processor = processors.get(task.type);
      if (!processor) {
        console.warn(`No sync processor registered for task type "${task.type}". Removing task.`);
        await db.syncQueue.delete(task.id);
        processed++;
        continue;
      }

      const attempts = task.attempts + 1;
      const lastTriedAt = new Date().toISOString();

      await db.syncQueue.update(task.id, {
        status: "processing" satisfies SyncTaskStatus,
        attempts,
        lastTriedAt,
      });
      void refreshStats();

      try {
        await processor(task);
        await db.syncQueue.delete(task.id);
        processed++;
      } catch (error: any) {
        const message = error?.message ?? String(error ?? "Unknown error");
        const nextRetry = Date.now() + getBackoffDelay(attempts);
        const status: SyncTaskStatus =
          attempts >= MAX_ATTEMPTS ? "failed" : "pending";

        await db.syncQueue.update(task.id, {
          status,
          lastError: message,
          nextRetryAt: nextRetry,
          attempts,
        });
        console.warn(
          `Sync task "${task.type}" failed (attempt ${attempts}):`,
          message,
        );
      } finally {
        void refreshStats();
      }
    }

    return processed;
  })().finally(() => {
    activeProcessPromise = null;
  });

  return activeProcessPromise;
}

export async function drainSyncQueue() {
  while ((await processSyncQueue()) > 0) {
    // Continue draining until queue is empty or processors stop making progress.
  }
}

export async function getSyncQueueSnapshot() {
  if (!db) return [];
  return db.syncQueue.toArray();
}

