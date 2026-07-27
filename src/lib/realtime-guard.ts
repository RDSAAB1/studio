// Simple circuit breaker for Firestore realtime and writes.
// Uses localStorage flags to back off when quota or resource limits are hit.

const LS_KEYS = {
	disableUntil: 'fs.disableUntilTs',
} as const;

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export function isFirestoreTemporarilyDisabled(): boolean {
	if (typeof window === 'undefined') return false;
	
	// If Cloud D1 Sync is configured and enabled, disable Firestore reads/sync
	const d1Config = localStorage.getItem('bizsuite:d1SyncConfig');
	if (d1Config) {
		try {
			const parsed = JSON.parse(d1Config);
			if (parsed && parsed.enabled !== false && (parsed.databaseId || parsed.syncToken || parsed.workerUrl)) {
				return true; // Cloud D1 is active database, disable Firestore to prevent quota exhaustion
			}
		} catch {}
	}

	const ts1 = Number(window.localStorage.getItem(LS_KEYS.disableUntil) || '0');
	const ts2 = Number(window.localStorage.getItem('firestore_disabled_until') || '0');
	return ts1 > Date.now() || ts2 > Date.now();
}

export function markFirestoreDisabled(withMs: number = 24 * 60 * 60 * 1000) {
	if (typeof window === 'undefined') return;
	const until = Date.now() + withMs;
	window.localStorage.setItem(LS_KEYS.disableUntil, String(until));
	window.localStorage.setItem('firestore_disabled_until', String(until));
}

export function clearFirestoreDisabled() {
	if (typeof window === 'undefined') return;
	window.localStorage.removeItem(LS_KEYS.disableUntil);
	window.localStorage.removeItem('firestore_disabled_until');
}

export function isQuotaError(err: unknown): boolean {
	if (!err) return false;
	const message = String((err as any)?.message || err);
	const code = String((err as any)?.code || '');
	return (
		code.includes('resource-exhausted') ||
		code.includes('quota-exceeded') ||
		message.toLowerCase().includes('quota') ||
		message.toLowerCase().includes('exhaust') ||
		message.toLowerCase().includes('limit exceeded')
	);
}

export function withQuotaGuard<T>(fn: () => Promise<T>): Promise<T> {
	return fn().catch((err) => {
		if (isQuotaError(err)) {
			markFirestoreDisabled();
		}
		throw err;
	});
}

export type Unsubscribe = () => void;

// Utility to implement a polling fallback with an initial invoke and interval.
// Polling interval increased to 30 seconds to reduce read operations when Firestore is disabled
export function createPollingFallback<T>(
	initial: () => Promise<T>,
	onData: (data: T) => void,
	intervalMs: number = 30_000, // Increased from 10s to 30s to reduce reads
): Unsubscribe {
	let cancelled = false;
	let timer: number | undefined;

	const run = async () => {
		try {
			const data = await initial();
			if (!cancelled) onData(data);
		} catch {
			// ignore polling errors
		}
	};

	void run();

	if (typeof window !== 'undefined') {
		timer = window.setInterval(run, intervalMs);
	}

	return () => {
		cancelled = true;
		if (typeof window !== 'undefined' && timer) {
			window.clearInterval(timer);
		}
	};
}


