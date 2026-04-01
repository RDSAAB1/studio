"use client";

import { useEffect, useState } from 'react';

/**
 * SQLite-compatible shim for Dexie's 'useLiveQuery'.
 * Re-runs the query whenever 'sqlite-change' is emitted by the main IPC process.
 */
export function useLiveQuery<T>(querier: () => Promise<T>, deps: any[] = []): T | undefined {
  const [data, setData] = useState<T>();

  useEffect(() => {
    let active = true;
    const load = async () => {
        try {
            const res = await querier();
            if (active) setData(res);
        } catch (e) {
            console.error('[useLiveQuery] Error:', e);
        }
    };

    load();

    const handleGlobalChange = () => load();
    if (typeof window !== 'undefined') {
      window.addEventListener('sqlite-change', handleGlobalChange);
    }
    
    return () => {
      active = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('sqlite-change', handleGlobalChange);
      }
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return data;
}
