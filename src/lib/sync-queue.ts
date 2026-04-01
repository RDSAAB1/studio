"use client";

import type { SyncTask } from "./definitions";

// All sync queue functions are no-ops in the SQLite-only architecture.
// Data is written directly to SQLite, bypassing any local-first Dexie queues.

export type EnqueueOptions = { dedupeKey?: string; attemptImmediate?: boolean; };
export type SyncQueueStats = { pending: number; failed: number; processing: number; };
type SyncProcessor<T = unknown> = (task: SyncTask<T>) => Promise<void>;
type SyncQueueListener = (stats: SyncQueueStats) => void;

export function registerSyncProcessor<T = unknown>(type: string, processor: SyncProcessor<T>) {}
export function unregisterSyncProcessor(type: string) {}
export function subscribeSyncQueue(listener: SyncQueueListener) { return () => {}; }
export async function removeTasksByDedupeKey(dedupeKey: string) {}
export async function enqueueSyncTask<TPayload = unknown>(type: string, payload: TPayload, options: EnqueueOptions = {}) {}
export async function processSyncQueue(limit = 10): Promise<number> { return 0; }
export async function drainSyncQueue() {}
export async function getSyncQueueSnapshot() { return []; }
