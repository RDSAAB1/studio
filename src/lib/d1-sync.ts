/**
 * Cloudflare D1 Sync Engine
 * Handles bi-directional synchronization between Local SQLite and D1 Cloud.
 * Updated: 2026-04-12 - Optimized Global Sync & Instant Signaling
 */

import { SQLITE_TABLES } from './sqlite-storage';
import { db, notifyChange, logSyncChange } from './database';
import { loadStoredErpSelection } from '@/contexts/erp-selection-context';
import { rtdb, ref, onValue, set, push, serverTimestamp } from '@/lib/firebase';

// Types for sync payloads
interface SyncChange {
    id: string;
    collection: string;
    docId: string;
    operation: 'upsert' | 'delete';
    data: any;
    timestamp: number;
}

interface SyncConfig {
    accountId: string;
    databaseId: string;
    apiToken: string;
    syncToken: string;
    workerUrl: string;
    enabled?: boolean;
}

export const DEFAULT_WORKER_URL = "https://jrmd-sync-worker.traderramanduggal.workers.dev";
export const DEFAULT_SYNC_TOKEN = "jrmd2026";

const SEASONAL_TABLES = new Set([
    'payments', 'customerPayments', 'governmentFinalizedPayments', 'ledgerEntries', 
    'ledgerCashAccounts', 'incomes', 'expenses', 'transactions', 'fundTransactions',
    'mandiReports', 'inventoryAddEntries', 'kantaParchi', 
    'customerDocuments', 'manufacturingCosting', 'suppliers', 'customers'
]);

function isSeasonalTable(collection: string) {
    return SEASONAL_TABLES.has(collection);
}

export function getSyncConfig(): SyncConfig | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('bizsuite:d1SyncConfig');
    const saved = raw ? JSON.parse(raw) : {};
    
    return {
        accountId: saved.accountId || "",
        databaseId: saved.databaseId || "",
        apiToken: saved.apiToken || "",
        syncToken: saved.syncToken || DEFAULT_SYNC_TOKEN,
        workerUrl: saved.workerUrl || DEFAULT_WORKER_URL,
        enabled: saved.enabled !== false
    };
}


export function saveSyncConfig(config: SyncConfig) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('bizsuite:d1SyncConfig', JSON.stringify(config));
}

async function fetchWithTenancy(url: string, collection?: string, options: any = {}, forceSeason?: string) {
    const erp = loadStoredErpSelection();
    const auth = typeof window !== 'undefined' ? (window as any).firebaseAuth : null;
    const userId = (auth?.currentUser?.uid) || 'test-user-123';

    const forcedSeasonal = ['payments', 'customerPayments', 'governmentFinalizedPayments', 'suppliers', 'customers'];
    const isShared = collection && collection !== 'all' && !isSeasonalTable(collection);
    
    let yearKey = forceSeason; // If recovery mode passes 'COMMON', it will use it.
    
    if (!yearKey) {
        if (collection === 'all') {
            // Global Pull uses current season to get both Common and Seasonal logs
            yearKey = erp?.seasonKey || 'default';
        } else if (collection && forcedSeasonal.includes(collection)) {
            yearKey = erp?.seasonKey || 'default';
        } else {
            yearKey = isShared ? 'COMMON' : (erp?.seasonKey || 'default');
        }
    }

    const headers = {
        ...(options.headers || {}),
        'X-Company-Id': erp?.companyId || 'root',
        'X-Sub-Company-Id': erp?.subCompanyId || 'main',
        'X-Year': yearKey,
        'X-User-Id': userId,
        'Content-Type': 'application/json'
    };

    console.log(`[D1 Sync] Request: ${collection || 'global'} | Company: ${headers['X-Company-Id']} | Year: ${headers['X-Year']}`);

    try {
        const response = await fetch('/api/d1-proxy/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url,
                method: options.method || 'GET',
                headers: headers,
                body: options.body ? JSON.parse(options.body) : undefined
            })
        });
        
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Proxy returned error: ${response.status}`);
        }
        
        return response;
    } catch (error: any) {
        console.error('[D1 Sync] Proxy Fetch Error:', error);
        throw error;
    }
}

const SESSION_ID = Math.random().toString(36).substring(2, 15);

/**
 * EMIT SIGNAL: Notify other devices via Firebase RTDB
 */
async function emitSyncSignal(collections: Set<string> | string[]) {
    try {
        const erp = loadStoredErpSelection();
        if (!erp?.companyId) return;
        
        const path = `sync_signals/${erp.companyId}`;
        const signalRef = ref(rtdb, path);
        const colList = Array.from(collections);
        
        if (colList.length === 0) return;

        // Use push() to ensure every signal is unique and doesn't overwrite others
        const newSignalRef = push(signalRef);
        await set(newSignalRef, {
            timestamp: serverTimestamp(),
            collections: colList,
            sender: SESSION_ID
        });
    } catch (e) {
        console.warn('[D1 Sync] Failed to emit sync signal:', e);
    }
}

/**
 * PUSH: Send local changes to Cloudflare D1
 */
export async function pushLocalChanges(): Promise<{ success: boolean; pushed?: number; error?: string }> {
    const config = getSyncConfig();
    if (!config || !config.syncToken) return { success: false, error: 'Cloud sync not configured' };

    try {
        if (!db) return { success: false, error: 'Local database not available' };

        let totalPushedAcrossBatches = 0;
        let hasMore = true;
        let batchCount = 0;
        const MAX_BATCHES = 10; 
        const updatedCollections = new Set<string>();

        while (hasMore && batchCount < MAX_BATCHES) {
            batchCount++;
            
            const pendingChanges = await db._sync_log.limit(100).orderBy('timestamp').toArray();
            if (!pendingChanges || pendingChanges.length === 0) {
                hasMore = false;
                break;
            }

            const collectionGroups: Record<string, SyncChange[]> = {};
            pendingChanges.forEach((change: any) => {
                const col = change.collection || 'unknown';
                if (!collectionGroups[col]) collectionGroups[col] = [];
                collectionGroups[col].push(change);
                updatedCollections.add(col);
            });

            for (const [collection, changes] of Object.entries(collectionGroups)) {
                if (!collection || collection === 'unknown' || !changes || changes.length === 0) continue;

                const rawUrl = config.workerUrl || '';
                let baseUrl = rawUrl.trim();
                if (!baseUrl) continue;
                if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
                if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
                
                const workerUrl = baseUrl.endsWith('/sync') ? baseUrl : `${baseUrl}/sync`;
                
                try {
                    const response = await fetchWithTenancy(workerUrl, collection, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${config.syncToken}` },
                        body: JSON.stringify({
                            collection,
                            changes: changes.map(c => ({
                                id: c.docId, 
                                data: c.data,
                                operation: c.operation || 'upsert',
                                updated_at: c.timestamp
                            }))
                        })
                    });

                    if (response.ok) {
                        const idsToClear = changes.map(c => c.id);
                        await db._sync_log.bulkDelete(idsToClear);
                        totalPushedAcrossBatches += changes.length;
                    } else {
                        const err = await response.json().catch(() => ({}));
                        console.error(`[D1 Sync] Push FAILED for ${collection}:`, err);
                    }
                } catch (batchErr: any) {
                    console.error(`[D1 Sync] Batch push error for ${collection}:`, batchErr);
                }
            }
            
            if (pendingChanges.length < 100) hasMore = false;
            // Yield to main thread between batches to prevent UI lag
            await new Promise(r => setTimeout(r, 0));
        }

        if (totalPushedAcrossBatches > 0) {
            await emitSyncSignal(updatedCollections);
        }

        return { success: true, pushed: totalPushedAcrossBatches };
    } catch (error: any) {
        console.error('[D1 Sync] Push Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * PULL: Optimized Global Pull from Centralized _sync_log (Notice Board)
 */
export async function pullRemoteChanges(targetCollection?: string): Promise<{ success: boolean; pulled?: number; error?: string }> {
    const config = getSyncConfig();
    if (!config || !config.syncToken) return { success: false, error: 'Cloud sync not configured' };

    try {
        if (!db) return { success: false, error: 'Local database not available' };

        const erp = loadStoredErpSelection();
        const bizId = erp?.companyId || 'root';
        const subBizId = erp?.subCompanyId || 'main';
        const year = erp?.seasonKey || 'default';

        const isGlobal = !targetCollection || targetCollection === 'all' || targetCollection === 'FORCE_ALL';
        let totalPulled = 0;

        if (isGlobal) {
            console.log(`[D1 Sync] Pulling Global Changes (Notice Board)...`);
            
            const globalMetaId = `GLOBAL_SYNC:${bizId}:${subBizId}:${year}`;
            const meta = await db._sync_meta.get(globalMetaId);
            let currentSince = (targetCollection === 'FORCE_ALL') ? 0 : (meta?.last_sync_timestamp || 0);
            
            let hasMore = true;
            let safety = 0;

            while (hasMore && safety < 100) {
                safety++;
                const rawUrl = config.workerUrl || '';
                let baseUrl = rawUrl.trim();
                if (!baseUrl) break;
                if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
                if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
                
                const workerUrl = `${baseUrl.endsWith('/sync') ? baseUrl : `${baseUrl}/sync`}?since=${currentSince}`;
                
                const response = await fetchWithTenancy(workerUrl, 'all', {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${config.syncToken}` }
                });

                if (!response.ok) break;
                const { results } = await response.json();

                if (!results || results.length === 0) {
                    hasMore = false;
                    break;
                }

                const collectionChangesMap: Record<string, { puts: any[], deletes: string[] }> = {};
                let maxTs = currentSince;

                for (const r of results) {
                    const col = r.collection;
                    const docId = String(r.id);
                    const ts = Number(r.updated_at);
                    if (ts > maxTs) maxTs = ts;

                    if (!collectionChangesMap[col]) collectionChangesMap[col] = { puts: [], deletes: [] };

                    const isDirty = await db._sync_log.where('[collection+docId]')
                        .equals([col, docId])
                        .first();
                    if (isDirty) continue;

                    if (r.operation === 'delete') {
                        collectionChangesMap[col].deletes.push(docId);
                    } else {
                        try {
                            const parsed = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
                            collectionChangesMap[col].puts.push({ 
                                ...parsed, 
                                id: docId, 
                                updated_at: ts,
                                _company_id: r._company_id,
                                _sub_company_id: r._sub_company_id,
                                _year: r._year
                            });
                        } catch (e) {
                            console.warn(`[D1 Sync] JSON Parse error for ${col}:${docId}`);
                        }
                    }
                }

                for (const [col, ops] of Object.entries(collectionChangesMap)) {
                    if (!(db as any)[col]) continue;
                    if (ops.puts.length > 0) await (db as any)[col].bulkPut(ops.puts, 'sync');
                    if (ops.deletes.length > 0) await (db as any)[col].bulkDelete(ops.deletes, 'sync');
                    totalPulled += (ops.puts.length + ops.deletes.length);
                    notifyChange(col, 'sync');
                }

                if (maxTs > currentSince) {
                    await db._sync_meta.put({ id: globalMetaId, last_sync_timestamp: maxTs });
                    currentSince = maxTs;
                }

                if (results.length < 500) hasMore = false;
                // Yield to main thread between batches to prevent UI lag
                await new Promise(r => setTimeout(r, 0));
            }

            return { success: true, pulled: totalPulled };
        } else {
            return { success: true, pulled: 0 }; 
        }
    } catch (err: any) {
        console.error('[D1 Sync] Global Pull error:', err);
        return { success: false, error: err.message };
    }
}

let isSyncingGlobal = false;
let lastSyncTime = 0;
const SYNC_COOLDOWN_MS = 10000;

export async function performFullSync(target: 'all' | string = 'all', force = false): Promise<{ pushed: number, pulled: number, total: number } | null> {
    if (isSyncingGlobal) return null;
    
    const now = Date.now();
    // Bypass Cooldown if forced
    if (!force && (now - lastSyncTime < SYNC_COOLDOWN_MS)) return null;
    
    isSyncingGlobal = true;
    lastSyncTime = now;
    
    try {
        const effectiveTarget = force ? 'FORCE_ALL' : target;
        console.log(`[D1 Sync] Starting Sync Cycle (${effectiveTarget})...`);
        
        // 1. Push local changes first
        const pushRes = await pushLocalChanges();

        // 2. Pull remote changes
        const pullRes = await pullRemoteChanges(effectiveTarget);

        const summary = {
            pushed: pushRes.pushed || 0,
            pulled: pullRes.pulled || 0,
            total: (pushRes.pushed || 0) + (pullRes.pulled || 0)
        };

        if (summary.total > 0) {
            console.log(`[D1 Sync] Sync complete: ${summary.pushed} push, ${summary.pulled} pull.`);
        }

        return summary;
    } catch (e) {
        console.error('[D1 Sync] Full Sync Cycle Failed:', e);
        return null;
    } finally {
        isSyncingGlobal = false;
    }
}

let syncSignalUnsubscribe: any = null;

export function startAutoSync() {
    if (syncSignalUnsubscribe) {
        try { syncSignalUnsubscribe(); } catch {}
        syncSignalUnsubscribe = null;
    }
    
    const erp = loadStoredErpSelection();
    if (!erp?.companyId) return;

    const path = `sync_signals/${erp.companyId}`;
    const signalRef = ref(rtdb, path);
    console.log(`[D1 Sync] Event-Driven Signaling Active: ${path}`);

    performFullSync('all', true).catch(() => {});

    syncSignalUnsubscribe = onValue(signalRef, (snapshot) => {
        const val = snapshot.val();
        if (!val) return;

        const signals = Object.entries(val)
            .filter(([_, data]: [string, any]) => data.sender !== SESSION_ID)
            .sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));

        if (signals.length === 0) return;

        const latest: any = signals[0][1];
        const lastProcessed = parseInt(localStorage.getItem('d1_last_signal_ts') || '0');
        
        if (latest.timestamp > lastProcessed) {
            console.log(`[D1 Sync] Remote Change Signal received. Instant pulse...`);
            localStorage.setItem('d1_last_signal_ts', String(latest.timestamp || Date.now()));
            performFullSync('all', true).catch(() => {});
        }
    });
}

/**
 * EXPORT: Push ALL local data to the cloud (Initial Migration)
 */
export async function exportAllLocalData(onProgress?: (percent: number, table: string) => void): Promise<{ success: boolean; total: number; error?: string }> {
    const config = getSyncConfig();
    if (!config || !config.syncToken) return { success: false, total: 0, error: 'Sync not configured' };
    if (!db) return { success: false, total: 0, error: 'Database not available' };

    try {
        let totalRecords = 0;
        const tables = SQLITE_TABLES.filter(t => !['_sync_log', '_sync_meta'].includes(t));
        
        for (let i = 0; i < tables.length; i++) {
            const table = tables[i];
            if (onProgress) onProgress(Math.round((i / tables.length) * 100), table);
            
            const records = await (db as any)[table].toArray();
            if (records.length > 0) {
                const erp = loadStoredErpSelection();
                // Queue for sync by adding to _sync_log (Match SQLite Schema Order)
                const syncLogEntries = records.map((r: any) => ({
                    docId: String(r.id),
                    collection: table,
                    operation: 'upsert',
                    data: typeof r === 'string' ? r : JSON.stringify(r),
                    updated_at: Date.now(),
                    _company_id: erp?.companyId || 'root',
                    _sub_company_id: erp?.subCompanyId || 'main',
                    _year: r._year || erp?.seasonKey || 'default'
                }));
                
                await db._sync_log.bulkPut(syncLogEntries);
                totalRecords += records.length;
            }
        }
        
        if (onProgress) onProgress(100, 'Pushing to cloud...');
        await pushLocalChanges();
        
        return { success: true, total: totalRecords };
    } catch (e: any) {
        console.error('[D1 Sync] Export Error:', e);
        return { success: false, total: 0, error: e.message };
    }
}

/**
 * Legacy Support & Recovery handlers below
 */
export async function recoverMasterDataFromLegacySeason(): Promise<{ success: boolean; pulled?: number; error?: string }> {
    return { success: true, pulled: 0 }; 
}

export async function migrateCommonToCurrentSeason(): Promise<{ success: boolean; pulled?: number; error?: string }> {
    return { success: true, pulled: 0 };
}

if (typeof window !== 'undefined') {
    setTimeout(() => {
        const currentConfig = getSyncConfig();
        if (currentConfig && currentConfig.enabled) {
            startAutoSync();
        }
    }, 1000);

    const syncRequestTimers: Record<string, any> = {};
    
    window.addEventListener('sqlite-change' as any, (e: CustomEvent) => {
        const detail = e.detail;
        const tables = Array.isArray(detail?.tables) ? detail.tables : [typeof detail === 'string' ? detail : detail?.table];
        const source = detail?.source || 'internal';
        
        if (source === 'external' || source === 'sync') return;
        
        for (const table of tables) {
            if (table && table !== 'all' && !['_sync_log', '_sync_meta'].includes(table)) {
                if (syncRequestTimers[table]) clearTimeout(syncRequestTimers[table]);
                syncRequestTimers[table] = setTimeout(() => {
                    performFullSync(table).catch(() => {});
                }, 5000);
            }
        }
    });
}
