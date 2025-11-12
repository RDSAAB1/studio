"use client";

import { useEffect, useState } from "react";
import {
  processSyncQueue,
  subscribeSyncQueue,
  type SyncQueueStats,
} from "@/lib/sync-queue";

const SYNC_INTERVAL_MS = 15_000;

export function useSyncQueue(autoStart = true) {
  const [stats, setStats] = useState<SyncQueueStats>({
    pending: 0,
    failed: 0,
    processing: 0,
  });

  useEffect(() => {
    if (!autoStart) return;
    if (typeof window === "undefined") return;

    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      void processSyncQueue();
    };

    run();
    const interval = window.setInterval(run, SYNC_INTERVAL_MS);
    const unsubscribe = subscribeSyncQueue(setStats);

    const handleOnline = () => {
      if (cancelled) return;
      run();
    };

    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      unsubscribe();
    };
  }, [autoStart]);

  return stats;
}

