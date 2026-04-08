import { doc, getDoc, getDocs, query, where, orderBy, writeBatch, addDoc, Timestamp } from "firebase/firestore";
import { firestoreDB } from "../firebase";
import { db } from "../database";
import { isSqliteMode } from "../sqlite-storage";
import { getTenantCollectionPath } from "../tenancy";
import { withCreateMetadata, withEditMetadata, logActivity, moveToRecycleBin } from "../audit";
import { 
  ledgerAccountsCollection, 
  ledgerCashAccountsCollection, 
  ledgerEntriesCollection,
  createLocalSubscription,
  stripUndefined,
  isFirestoreTemporarilyDisabled,
  markFirestoreDisabled,
  isQuotaError
} from "./core";
import { LedgerAccount, LedgerCashAccount, LedgerEntry, LedgerAccountInput, LedgerCashAccountInput, LedgerEntryInput } from "@/lib/definitions";

// --- Ledger Accounting Functions ---

export async function fetchLedgerAccounts(): Promise<LedgerAccount[]> {
    if (db) {
        try {
            const localAccounts = await db.ledgerAccounts.toArray();
            if (localAccounts.length > 0) return localAccounts;
        } catch (error) {}
    }

    try {
        if (isFirestoreTemporarilyDisabled()) throw new Error('quota-exceeded');
        
        const getLastSyncTime = (): number | undefined => {
            if (typeof window === 'undefined') return undefined;
            const stored = localStorage.getItem('lastSync:ledgerAccounts');
            return stored ? parseInt(stored, 10) : undefined;
        };

        const lastSyncTime = getLastSyncTime();
        let q;
        
        if (lastSyncTime) {
            const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
            q = query(ledgerAccountsCollection, where('updatedAt', '>', lastSyncTimestamp), orderBy('updatedAt'));
        } else {
            q = query(ledgerAccountsCollection, orderBy('name'));
        }

        const snapshot = await getDocs(q);
        const accounts = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Record<string, any>;
            return {
                id: docSnap.id,
                name: data.name || '',
                address: data.address || '',
                contact: data.contact || '',
                createdAt: data.createdAt || '',
                updatedAt: data.updatedAt || data.createdAt || '',
            } as LedgerAccount;
        });

        if (db && accounts.length > 0) {
            await db.ledgerAccounts.bulkPut(accounts);
            if (typeof window !== 'undefined') localStorage.setItem('lastSync:ledgerAccounts', String(Date.now()));
        }

        return accounts;
    } catch (e) {
        if (isQuotaError(e)) {
            markFirestoreDisabled();
            return db ? await db.ledgerAccounts.toArray() : [];
        }
        throw e;
    }
}

export async function createLedgerAccount(account: LedgerAccountInput): Promise<LedgerAccount> {
    const timestamp = new Date().toISOString();
    const docRef = doc(ledgerAccountsCollection);
    const base = { name: account.name, address: account.address || '', contact: account.contact || '', createdAt: timestamp, updatedAt: timestamp };
    const newAccount = withCreateMetadata(base as Record<string, unknown>);
    const batch = writeBatch(firestoreDB);
    batch.set(docRef, newAccount);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('ledgerAccounts', { batch });
    await batch.commit();
    logActivity({ type: "create", collection: "ledgerAccounts", docId: docRef.id, docPath: getTenantCollectionPath("ledgerAccounts").join("/"), summary: `Created ledger account ${account.name}`, afterData: newAccount }).catch(() => {});
    return { id: docRef.id, ...newAccount } as LedgerAccount;
}

export async function updateLedgerAccount(id: string, updates: Partial<LedgerAccountInput>): Promise<void> {
    const docRef = doc(ledgerAccountsCollection, id);
    const data = withEditMetadata({ ...updates, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    const batch = writeBatch(firestoreDB);
    batch.update(docRef, data);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('ledgerAccounts', { batch });
    await batch.commit();
    logActivity({ type: "edit", collection: "ledgerAccounts", docId: id, docPath: getTenantCollectionPath("ledgerAccounts").join("/"), summary: `Updated ledger account ${id}`, afterData: data }).catch(() => {});
}

export function getLedgerAccountsRealtime(callback: (data: LedgerAccount[]) => void, onError: (error: Error) => void): () => void {
    return createLocalSubscription<LedgerAccount>("ledgerAccounts", callback);
}

export async function deleteLedgerAccount(id: string): Promise<void> {
    const docRef = doc(ledgerAccountsCollection, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "ledgerAccounts", docId: id, docPath: getTenantCollectionPath("ledgerAccounts").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted ledger account ${id}` });
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const entriesSnapshot = await getDocs(query(ledgerEntriesCollection, where('accountId', '==', id)));
    entriesSnapshot.forEach((entryDoc) => batch.delete(entryDoc.ref));
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('ledgerAccounts', { batch });
    if (entriesSnapshot.size > 0) await notifySyncRegistry('ledgerEntries', { batch });
    await batch.commit();
}

export async function fetchLedgerCashAccounts(): Promise<LedgerCashAccount[]> {
    try {
        if (isFirestoreTemporarilyDisabled()) throw new Error('quota-exceeded');
        
        const getLastSyncTime = (): number | undefined => {
            if (typeof window === 'undefined') return undefined;
            const stored = localStorage.getItem('lastSync:ledgerCashAccounts');
            return stored ? parseInt(stored, 10) : undefined;
        };

        const lastSyncTime = getLastSyncTime();
        let q;
        let useIncremental = false;
        
        if (lastSyncTime) {
            const cached = typeof window !== 'undefined' ? localStorage.getItem('ledgerCashAccountsCache') : null;
            if (cached) {
                useIncremental = true;
                const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
                q = query(ledgerCashAccountsCollection, where('updatedAt', '>', lastSyncTimestamp), orderBy('updatedAt'));
            } else {
                q = query(ledgerCashAccountsCollection, orderBy('name'));
            }
        } else {
            q = query(ledgerCashAccountsCollection, orderBy('name'));
        }

        const snapshot = await getDocs(q);
        const newAccounts = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Record<string, any>;
            const rawNoteGroups = (data.noteGroups && typeof data.noteGroups === 'object') ? data.noteGroups : {};
            const normalizedNoteGroups = Object.entries(rawNoteGroups).reduce<Record<string, number[]>>((acc, [key, value]) => {
                acc[key] = Array.isArray(value) ? value.map((entry) => Number(entry) || 0) : [];
                return acc;
            }, {});

            return {
                id: docSnap.id,
                name: data.name || '',
                noteGroups: normalizedNoteGroups,
                createdAt: data.createdAt || '',
                updatedAt: data.updatedAt || data.createdAt || '',
            } as LedgerCashAccount;
        });

        let accounts: LedgerCashAccount[];
        if (useIncremental && typeof window !== 'undefined') {
            const cached = localStorage.getItem('ledgerCashAccountsCache');
            if (cached) {
                try {
                    const cachedAccounts = JSON.parse(cached) as LedgerCashAccount[];
                    const accountMap = new Map<string, LedgerCashAccount>();
                    cachedAccounts.forEach(acc => accountMap.set(acc.id, acc));
                    newAccounts.forEach(acc => accountMap.set(acc.id, acc));
                    accounts = Array.from(accountMap.values());
                } catch { accounts = newAccounts; }
            } else { accounts = newAccounts; }
        } else { accounts = newAccounts; }

        if (typeof window !== 'undefined') {
            localStorage.setItem('ledgerCashAccountsCache', JSON.stringify(accounts));
            localStorage.setItem('lastSync:ledgerCashAccounts', String(Date.now()));
        }
        
        return accounts;
    } catch (error) {
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem('ledgerCashAccountsCache');
            if (cached) {
                try { return JSON.parse(cached) as LedgerCashAccount[]; } catch {}
            }
        }
        throw error;
    }
}

export async function createLedgerCashAccount(account: LedgerCashAccountInput): Promise<LedgerCashAccount> {
    const timestamp = new Date().toISOString();
    const payload = { name: account.name, noteGroups: account.noteGroups, createdAt: timestamp, updatedAt: timestamp };
    const docRef = doc(ledgerCashAccountsCollection);
    try {
        const batch = writeBatch(firestoreDB);
        batch.set(docRef, payload);
        const { notifySyncRegistry } = await import('../sync-registry');
        await notifySyncRegistry('ledgerCashAccounts', { batch });
        await batch.commit();
    } catch {}
    const saved = { id: docRef.id, ...payload };
    if (typeof window !== 'undefined' && db?.ledgerCashAccounts) {
        try { await db.ledgerCashAccounts.put(saved); } catch {}
    }
    return saved;
}

export async function updateLedgerCashAccount(id: string, updates: Partial<LedgerCashAccountInput>): Promise<void> {
    const docRef = doc(ledgerCashAccountsCollection, id);
    const payload = stripUndefined({ ...updates, updatedAt: new Date().toISOString() });
    try {
        const batch = writeBatch(firestoreDB);
        batch.update(docRef, payload);
        const { notifySyncRegistry } = await import('../sync-registry');
        await notifySyncRegistry('ledgerCashAccounts', { batch });
        await batch.commit();
    } catch {}
    if (typeof window !== 'undefined' && db?.ledgerCashAccounts) {
        try {
            const existing = await db.ledgerCashAccounts.get(id);
            if (existing) await db.ledgerCashAccounts.put({ ...existing, ...payload });
        } catch {}
    }
}

export async function bulkUpsertLedgerCashAccounts(accounts: LedgerCashAccount[]): Promise<void> {
    if (!accounts.length) return;
    const batch = writeBatch(firestoreDB);
    const timestamp = new Date().toISOString();
    
    accounts.forEach(acc => {
        const docRef = doc(ledgerCashAccountsCollection, acc.id);
        batch.set(docRef, { ...acc, updatedAt: timestamp }, { merge: true });
    });

    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('ledgerCashAccounts', { batch });
    await batch.commit();

    if (db && db.ledgerCashAccounts) {
        await db.ledgerCashAccounts.bulkPut(accounts.map(acc => ({ ...acc, updatedAt: timestamp })));
    }
}

export async function deleteLedgerCashAccount(id: string): Promise<void> {
    try {
        const docRef = doc(ledgerCashAccountsCollection, id);
        const batch = writeBatch(firestoreDB);
        batch.delete(docRef);
        const { notifySyncRegistry } = await import('../sync-registry');
        await notifySyncRegistry('ledgerCashAccounts', { batch });
        await batch.commit();
    } catch {}
    if (typeof window !== 'undefined' && db?.ledgerCashAccounts) {
        try { await db.ledgerCashAccounts.delete(id); } catch {}
    }
}

export function getLedgerCashAccountsRealtime(callback: (data: LedgerCashAccount[]) => void, onError: (error: Error) => void): () => void {
    return createLocalSubscription<LedgerCashAccount>("ledgerCashAccounts", callback);
}

export async function fetchLedgerEntries(accountId: string): Promise<LedgerEntry[]> {
    if (!db) return [];
    return await db.ledgerEntries.where('accountId').equals(accountId).toArray();
}

export async function fetchAllLedgerEntries(): Promise<LedgerEntry[]> {
    if (!db) return [];
    return await db.ledgerEntries.toArray();
}

export function getLedgerEntriesRealtime(callback: (data: LedgerEntry[]) => void, onError: (error: Error) => void, accountId?: string): () => void {
    return createLocalSubscription<LedgerEntry>("ledgerEntries", callback, accountId ? (entries) => entries.filter((e: any) => e.accountId === accountId) : undefined);
}

export async function createLedgerEntry(entry: LedgerEntryInput & { accountId: string; balance: number }): Promise<LedgerEntry> {
    const timestamp = new Date().toISOString();
    const normalizedRemarks = typeof entry.remarks === 'string' ? entry.remarks : '';
    const docRef = await addDoc(ledgerEntriesCollection, { accountId: entry.accountId, date: entry.date, particulars: entry.particulars, debit: entry.debit, credit: entry.credit, balance: entry.balance, remarks: normalizedRemarks, linkGroupId: entry.linkGroupId || null, linkStrategy: entry.linkStrategy || null, createdAt: timestamp, updatedAt: timestamp });
    return { id: docRef.id, accountId: entry.accountId, date: entry.date, particulars: entry.particulars, debit: entry.debit, credit: entry.credit, balance: entry.balance, remarks: normalizedRemarks || undefined, createdAt: timestamp, updatedAt: timestamp, linkGroupId: entry.linkGroupId, linkStrategy: entry.linkStrategy || undefined };
}

export async function updateLedgerEntriesBatch(entries: LedgerEntry[]): Promise<void> {
    if (!entries.length) return;
    const batch = writeBatch(firestoreDB);
    const timestamp = new Date().toISOString();
    entries.forEach((entry) => {
        const entryRef = doc(ledgerEntriesCollection, entry.id);
        batch.set(entryRef, { ...entry, updatedAt: timestamp, linkGroupId: entry.linkGroupId || null, linkStrategy: entry.linkStrategy || null, remarks: typeof entry.remarks === 'string' ? entry.remarks : '' }, { merge: true });
    });
    await batch.commit();
}

export async function deleteLedgerEntry(id: string): Promise<void> {
    const entryRef = doc(ledgerEntriesCollection, id);
    const batch = writeBatch(firestoreDB);
    batch.delete(entryRef);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('ledgerEntries', { batch });
    await batch.commit();
}
