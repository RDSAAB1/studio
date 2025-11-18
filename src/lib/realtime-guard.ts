// Simple circuit breaker for Firestore realtime and writes.
// Uses localStorage flags to back off when quota or resource limits are hit.

const LS_KEYS = {
	disableUntil: 'fs.disableUntilTs',
} as const;

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export function isFirestoreTemporarilyDisabled(): boolean {
	if (typeof window === 'undefined') return false;
	const ts = Number(window.localStorage.getItem(LS_KEYS.disableUntil) || '0');
	return ts > Date.now();
}

export function markFirestoreDisabled(withMs: number = COOLDOWN_MS) {
	if (typeof window === 'undefined') return;
	const until = Date.now() + withMs;
	window.localStorage.setItem(LS_KEYS.disableUntil, String(until));
}

export function clearFirestoreDisabled() {
	if (typeof window === 'undefined') return;
	window.localStorage.removeItem(LS_KEYS.disableUntil);
}

export function isQuotaError(err: unknown): boolean {
	const message = (err as any)?.message || '';
	const code = (err as any)?.code || '';
	return (
		String(code).includes('resource-exhausted') ||
		String(code).includes('quota-exceeded') ||
		String(message).toLowerCase().includes('quota') ||
		String(message).toLowerCase().includes('exhaust')
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


