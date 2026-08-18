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
    'mandiReports', 'kantaParchi', 
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

async function fetchWithTenancy(
    url: string, 
    collection?: string, 
    options: any = {}, 
    forceSeason?: string,
    forceCompany?: string,
    forceSubCompany?: string
) {
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
        'X-Company-Id': forceCompany || erp?.companyId || 'root',
        'X-Sub-Company-Id': forceSubCompany || erp?.subCompanyId || 'main',
        'X-Year': yearKey,
        'X-User-Id': userId,
        'Content-Type': 'application/json'
    };

    console.log(`[D1 Sync] Request: ${collection || 'global'} | Company: ${headers['X-Company-Id']} | Year: ${headers['X-Year']}`);

    try {
        const response = await fetch('/api/d1-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url,
                method: options.method || 'GET',
                headers: headers,
                body: options.body ? JSON.parse(options.body) : undefined
            }),
            signal: AbortSignal.timeout(15000) // Client-side safety timeout (15s)
        });
        
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            // Soft failures - don't crash the app, just log and return null
            if (response.status === 502 || response.status === 504 || err.code === 'FETCH_ERROR' || err.code === 'TIMEOUT') {
                console.warn(`[D1 Sync] Background Sync Paused: ${err.error || 'Network Unreachable'}`);
                return null;
            }
            // 404: Worker route not found - log once and skip (don't throw)
            if (response.status === 404) {
                console.warn(`[D1 Sync] Worker returned 404 for URL: ${url} — Check Worker deployment or workerUrl config.`);
                return null;
            }
            throw new Error(err.error || `Proxy returned error: ${response.status}`);
        }
        
        return response;
    } catch (error: any) {
        const msg = String(error?.message || error || '');
        if (
            msg.includes('Failed to fetch') ||
            msg.includes('fetch failed') ||
            msg.includes('NetworkError') ||
            msg.includes('Load failed') ||
            error?.name === 'TypeError'
        ) {
            console.warn('[D1 Sync] System is offline or Proxy unreachable. Sync pending.');
            return null; // Return null so callers know it failed but don't crash
        }
        console.warn('[D1 Sync] Sync request failed:', msg);
        return null;
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

            // Identify staged local-only changes and delete them immediately (awaited)
            const stagedIds = pendingChanges
                .filter((change: any) => change.collection === 'staged_suppliers' || change.collection === 'staged_customers')
                .map((change: any) => change.id);
            
            console.log(`[D1 Sync] pushLocalChanges batch #${batchCount} | pending: ${pendingChanges.length} | staged to delete: ${stagedIds.length}`);

            if (stagedIds.length > 0) {
                await db._sync_log.bulkDelete(stagedIds).catch((err) => {
                    console.error('[D1 Sync] Failed to delete staged ids:', err);
                });
            }

            const validChanges = pendingChanges.filter((change: any) => change.collection !== 'staged_suppliers' && change.collection !== 'staged_customers');
            if (validChanges.length === 0) {
                const remaining = await db._sync_log.count();
                console.log(`[D1 Sync] Batch had only staged changes. Remaining sync_log count: ${remaining}`);
                if (remaining === 0) {
                    hasMore = false;
                }
                await new Promise(r => setTimeout(r, 50));
                continue;
            }

            // Group changes by collection AND their respective company/sub-company/season to prevent cross-tenancy data leakage
            const groups: Record<string, { 
                collection: string; 
                companyId: string; 
                subCompanyId: string; 
                seasonKey: string; 
                changes: any[] 
            }> = {};

            validChanges.forEach((change: any) => {
                const col = change.collection || 'unknown';
                
                // Extract tenancy values for this specific change entry
                let companyId = change._company_id || change.companyId;
                let subCompanyId = change._sub_company_id || change.subCompanyId;
                let seasonKey = change._year || change.year || change.seasonKey;

                if (change.data) {
                    let parsedData = change.data;
                    if (typeof parsedData === 'string') {
                        try { parsedData = JSON.parse(parsedData); } catch {}
                    }
                    if (parsedData && typeof parsedData === 'object') {
                        if (!companyId) companyId = parsedData._company_id;
                        if (!subCompanyId) subCompanyId = parsedData._sub_company_id;
                        if (!seasonKey) seasonKey = parsedData._year;
                    }
                }

                // Fallback to active selection if not found on the change record
                const erp = loadStoredErpSelection();
                if (!companyId) companyId = erp?.companyId || 'root';
                if (!subCompanyId) subCompanyId = erp?.subCompanyId || 'main';
                if (!seasonKey) seasonKey = erp?.seasonKey || 'default';

                const groupKey = `${col}:${companyId}:${subCompanyId}:${seasonKey}`;
                if (!groups[groupKey]) {
                    groups[groupKey] = {
                        collection: col,
                        companyId,
                        subCompanyId,
                        seasonKey,
                        changes: []
                    };
                }
                groups[groupKey].changes.push(change);
                updatedCollections.add(col);
            });

            for (const group of Object.values(groups)) {
                const { collection, companyId, subCompanyId, seasonKey, changes } = group;
                if (!collection || collection === 'unknown' || !changes || changes.length === 0) continue;

                const rawUrl = config.workerUrl || '';
                let baseUrl = rawUrl.trim();
                if (!baseUrl) continue;
                if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
                if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
                
                const workerUrl = baseUrl.endsWith('/sync') ? baseUrl : `${baseUrl}/sync`;
                console.log(`[D1 Sync] Pushing: worker=${workerUrl} | col=${collection} | company=${companyId} | year=${seasonKey}`);
                
                try {
                    const response = await fetchWithTenancy(
                        workerUrl, 
                        collection, 
                        {
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
                        },
                        seasonKey,
                        companyId,
                        subCompanyId
                    );

                    if (response && response.ok) {
                        const idsToClear = changes.map(c => c.id);
                        await db._sync_log.bulkDelete(idsToClear);
                        totalPushedAcrossBatches += changes.length;
                    } else if (response === null) {
                        // Offline/Timeout case - stop batching for now but don't error
                        hasMore = false;
                        break;
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
        console.warn('[D1 Sync] Push Error (Handled):', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * PULL: Optimized Global Pull from Centralized _sync_log (Notice Board)
 */
export async function pullRemoteChanges(targetCollection?: string): Promise<{ success: boolean; pulled?: number; seasonalPulled?: number; breakdown?: Record<string, number>; error?: string }> {
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

        const isBusinessTable = (c: string) => [
            'suppliers', 'customers', 'payments', 'customerPayments', 'governmentFinalizedPayments',
            'fundTransactions', 'transactions', 'ledgerEntries', 'loans',
            'mandiReports', 'kantaParchi', 'customerDocuments', 'manufacturingCosting'
        ].includes(c);

        if (targetCollection === 'FORCE_ALL') {
            console.log(`[D1 Sync] FORCE_ALL Pull: Fetching all tables in parallel directly from D1...`);
            const collections = [
                'suppliers', 'customers', 'payments', 'customerPayments', 'governmentFinalizedPayments',
                'banks', 'bankBranches', 'bankAccounts', 'supplierBankAccounts', 
                'fundTransactions', 'transactions', 'ledgerEntries', 'ledgerAccounts', 'ledgerCashAccounts',
                'incomeCategories', 'expenseCategories', 'expenseTemplates', 'settings', 'options', 'loans',
                'mandiReports', 'kantaParchi', 'customerDocuments', 'manufacturingCosting',
                'incomes', 'expenses'
            ];
            
            const isSeasonal = (c: string) => {
                const SEASONAL_LIST = [
                    'payments', 'customerPayments', 'governmentFinalizedPayments', 'ledgerEntries', 
                    'ledgerCashAccounts', 'incomes', 'expenses', 'transactions', 'fundTransactions',
                    'mandiReports', 'kantaParchi', 
                    'customerDocuments', 'manufacturingCosting', 'suppliers', 'customers'
                ];
                return SEASONAL_LIST.includes(c);
            };

            const isElectron = typeof window !== 'undefined' && (window as any).electron !== undefined;

            // 1. Fetch all collections in parallel from D1 with pagination
            const fetchPromises = collections.map(async (col) => {
                if (!(db as any)[col]) return null;
                
                const rawUrl = config.workerUrl || '';
                let baseUrl = rawUrl.trim();
                if (!baseUrl) return null;
                if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
                if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
                
                const allResults: any[] = [];
                let currentSince = 0;
                let hasMore = true;
                let safety = 0;

                while (hasMore && safety < 100) {
                    safety++;
                    const workerUrl = `${baseUrl.endsWith('/sync') ? baseUrl : `${baseUrl}/sync`}?collection=${col}&since=${currentSince}&limit=500`;
                    
                    try {
                        const response = await fetchWithTenancy(workerUrl, col, {
                            method: 'GET',
                            headers: { 'Authorization': `Bearer ${config.syncToken}` }
                        }, isSeasonal(col) ? undefined : 'COMMON');

                        if (!response || !response.ok) {
                            hasMore = false;
                            break;
                        }
                        const { results } = await response.json();
                        if (!results || results.length === 0) {
                            hasMore = false;
                            break;
                        }
                        allResults.push(...results);

                        let maxBatchTs = currentSince;
                        for (const r of results) {
                            const ts = Number(r.updated_at);
                            if (ts > maxBatchTs) maxBatchTs = ts;
                        }
                        currentSince = maxBatchTs + 1;

                        if (results.length < 500) {
                            hasMore = false;
                        }
                    } catch (e) {
                        console.warn(`[D1 Sync] Fetch failed for collection ${col} (since=${currentSince}):`, e);
                        hasMore = false;
                        break;
                    }
                }
                
                return { col, results: allResults };
            });

            const allFetchResults = await Promise.all(fetchPromises);

            // 2. Process and prepare data for bulk writes
            const tablesToWrite: { col: string; puts: any[]; maxTs: number }[] = [];
            for (const item of allFetchResults) {
                if (!item) continue;
                const { col, results } = item;
                if (results.length === 0) continue;
                
                const puts: any[] = [];
                let maxTs = 0;
                for (const r of results) {
                    const docId = String(r.id);
                    const ts = Number(r.updated_at);
                    if (ts > maxTs) maxTs = ts;
                    
                    const parsed = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
                    puts.push({
                        ...parsed,
                        id: docId,
                        updated_at: ts,
                        _company_id: bizId,
                        _sub_company_id: subBizId,
                        _year: isSeasonal(col) ? year : 'COMMON'
                    });
                }
                
                tablesToWrite.push({ col, puts, maxTs });
            }

            // 3. Write data to tables in parallel
            let forceTotalPulled = 0;
            let forceSeasonalPulled = 0;
            const breakdown: Record<string, number> = {};
            await Promise.all(tablesToWrite.map(async ({ col, puts, maxTs }) => {
                if (puts.length === 0) return;
                
                // Clear Dexie table first in Web mode (SQLite is already cleared on context switch)
                if (!isElectron) {
                    await (db as any)[col].clear();
                }
                
                await (db as any)[col].bulkPut(puts, 'sync');
                forceTotalPulled += puts.length;
                if (isBusinessTable(col)) {
                    forceSeasonalPulled += puts.length;
                }
                breakdown[col] = puts.length;
                
                // Update sync metadata for this collection
                const metaId = `GLOBAL_SYNC:${bizId}:${subBizId}:${isSeasonal(col) ? year : 'COMMON'}`;
                await db._sync_meta.put({ id: metaId, last_sync_timestamp: maxTs + 1 });

                // Notify UI of table change
                notifyChange(col, 'sync');
            }));
            
            return { success: true, pulled: forceSeasonalPulled, seasonalPulled: forceSeasonalPulled, breakdown };
        }

        if (isGlobal) {
            console.log(`[D1 Sync] Pulling Global & Common Changes in Parallel...`);

            const fetchPullBatch = async (forceSeasonParam?: string) => {
                const isCommon = forceSeasonParam === 'COMMON';
                const metaId = `GLOBAL_SYNC:${bizId}:${subBizId}:${isCommon ? 'COMMON' : year}`;
                const meta = await db._sync_meta.get(metaId);
                const isForce = targetCollection === 'FORCE_ALL';
                const rawSince = isForce ? 0 : (meta?.last_sync_timestamp || 0);
                let currentSince = isForce ? 0 : (rawSince > 2000 ? rawSince - 2000 : 0);
                
                let localTotal = 0;
                let seasonalTotal = 0;
                const breakdown: Record<string, number> = {};
                let hasMore = true;
                let safety = 0;

                // Pre-fetch dirty logs ONCE outside the loop to eliminate DB I/O overhead on every batch
                const dirtyLogs = await db._sync_log.toArray();
                const dirtySet = new Set(dirtyLogs.map((l: any) => `${l.collection}:${l.docId}`));

                while (hasMore && safety < 10000) {
                    safety++;
                    const rawUrl = config.workerUrl || '';
                    let baseUrl = rawUrl.trim();
                    if (!baseUrl) break;
                    if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
                    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
                    
                    // Standard 500 batch limit matching Cloudflare D1 Worker max response capacity
                    const workerUrl = `${baseUrl.endsWith('/sync') ? baseUrl : `${baseUrl}/sync`}?since=${currentSince}&limit=500`;
                    
                    const response = await fetchWithTenancy(workerUrl, 'all', {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${config.syncToken}` }
                    }, forceSeasonParam);

                    if (!response || !response.ok) break;
                    const { results } = await response.json();
                    if (!results || results.length === 0) break;

                    const collectionChangesMap: Record<string, { puts: any[], deletes: string[] }> = {};
                    let maxTsInBatch = currentSince;
                    for (const r of results) {
                        const col = r.collection;
                        const docId = String(r.id);
                        const ts = Number(r.updated_at);
                        if (ts > maxTsInBatch) maxTsInBatch = ts;

                        if (dirtySet.has(`${col}:${docId}`)) continue;

                        if (!collectionChangesMap[col]) collectionChangesMap[col] = { puts: [], deletes: [] };

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
                            } catch (e) {}
                        }
                    }

                    const updatedCols: string[] = [];
                    await db.transaction('rw', Object.keys(collectionChangesMap).map(c => (db as any)[c]).filter(Boolean), async () => {
                        for (const [col, ops] of Object.entries(collectionChangesMap)) {
                            if (!(db as any)[col]) continue;
                            if (ops.puts.length > 0) await (db as any)[col].bulkPut(ops.puts, 'sync');
                            if (ops.deletes.length > 0) await (db as any)[col].bulkDelete(ops.deletes, 'sync');
                            
                            const opsCount = ops.puts.length + ops.deletes.length;
                            localTotal += opsCount;
                            if (isBusinessTable(col)) {
                                seasonalTotal += opsCount;
                            }
                            breakdown[col] = (breakdown[col] || 0) + opsCount;
                            updatedCols.push(col);
                        }
                    });

                    updatedCols.forEach(col => notifyChange(col, 'sync'));

                    // Always advance pointer by 1ms past the max timestamp in the batch to avoid infinite loops,
                    // as the Cloudflare worker API uses `>=` (greater than or equal to) comparison.
                    const nextSince = maxTsInBatch + 1;
                    await db._sync_meta.put({ id: metaId, last_sync_timestamp: nextSince });
                    currentSince = nextSince;

                    if (results.length < 500) hasMore = false;
                    await new Promise(r => setTimeout(r, 0));
                }
                return { total: localTotal, seasonal: seasonalTotal, breakdown };
            };

            // Run Seasonal pull and Common Master pull simultaneously
            const [seasonalRes, commonRes] = await Promise.all([
                fetchPullBatch(),
                fetchPullBatch('COMMON')
            ]);

            const finalSeasonal = (seasonalRes?.seasonal || 0) + (commonRes?.seasonal || 0);
            const finalBreakdown: Record<string, number> = {};
            const keys = new Set([...Object.keys(seasonalRes?.breakdown || {}), ...Object.keys(commonRes?.breakdown || {})]);
            for (const k of keys) {
                finalBreakdown[k] = (seasonalRes?.breakdown?.[k] || 0) + (commonRes?.breakdown?.[k] || 0);
            }

            return { 
                success: true, 
                pulled: finalSeasonal,
                seasonalPulled: finalSeasonal,
                breakdown: finalBreakdown
            };
        } else {
            return { success: true, pulled: 0, seasonalPulled: 0, breakdown: {} };
        }
    } catch (err: any) {
        console.warn('[D1 Sync] Global Pull error (Handled):', err.message);
        return { success: false, error: err.message };
    }
}

let isSyncingGlobal = false;
let lastSyncTime = 0;
const SYNC_COOLDOWN_MS = 10000;
let activeSyncPromise: Promise<{ pushed: number, pulled: number, seasonalPulled?: number, total: number } | null> | null = null;
let activeSyncTarget: string | null = null;

export async function performFullSync(target: 'all' | string = 'all', force = false): Promise<{ pushed: number, pulled: number, seasonalPulled?: number, total: number } | null> {
    const isRequestGlobal = target === 'all' || force;

    if (isSyncingGlobal) {
        if (activeSyncPromise) {
            console.log('[D1 Sync] Sync already in progress, awaiting existing sync promise...');
            return activeSyncPromise;
        }
        return null;
    }
    
    const now = Date.now();
    // Bypass Cooldown if forced
    if (!force && (now - lastSyncTime < SYNC_COOLDOWN_MS)) return null;
    
    isSyncingGlobal = true;
    lastSyncTime = now;
    const effectiveTarget = force ? 'FORCE_ALL' : target;
    activeSyncTarget = effectiveTarget;
    
    activeSyncPromise = (async () => {
        try {
            console.log(`[D1 Sync] Starting Sync Cycle (${effectiveTarget})...`);
            
            // 1. Push local changes first
            const pushRes = await pushLocalChanges();
     
            // 2. Pull remote changes
            const pullRes = await pullRemoteChanges(effectiveTarget);
     
            const summary = {
                pushed: pushRes.pushed || 0,
                pulled: pullRes.pulled || 0,
                seasonalPulled: pullRes.seasonalPulled || 0,
                breakdown: pullRes.breakdown,
                total: (pushRes.pushed || 0) + (pullRes.pulled || 0)
            };
     
            if (summary.total > 0) {
                console.log(`[D1 Sync] Sync complete: ${summary.pushed} push, ${summary.pulled} pull.`);
            }
     
            return summary;
        } catch (e: any) {
            console.warn('[D1 Sync] Full Sync Cycle Failed (Handled):', e.message);
            return null;
        } finally {
            isSyncingGlobal = false;
            activeSyncPromise = null;
            activeSyncTarget = null;
        }
    })();

    return activeSyncPromise;
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

    performFullSync('all', false).catch(() => {});

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
            if (table && table !== 'all' && !['_sync_log', '_sync_meta', 'staged_suppliers', 'staged_customers'].includes(table)) {
                if (syncRequestTimers[table]) clearTimeout(syncRequestTimers[table]);
                // mandiReports & kantaParchi: push near-instantly (500ms) to prevent "one step behind" on other systems
                const debounceMs = (table === 'mandiReports' || table === 'kantaParchi') ? 500 : 5000;
                syncRequestTimers[table] = setTimeout(() => {
                    performFullSync(table).catch(() => {});
                }, debounceMs);
            }
        }
    });
}
