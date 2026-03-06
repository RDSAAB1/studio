/**
 * ERP Migration: COPY-ONLY (no deletion)
 *
 * Structure: companies → companyId → subCompanyId → seasonKey → [suppliers, customers, ...]
 * Example: companies/jrmd/jrm/2026a/suppliers
 *
 * - companies (collection)
 * - companies/{companyId} (document)
 * - companies/{companyId}/{subCompanyId} (subcollection)
 * - companies/{companyId}/{subCompanyId}/{seasonKey} (document)
 * - companies/{companyId}/{subCompanyId}/{seasonKey}/{collectionName} (suppliers, customers, etc.)
 *
 * Root-level only (no tenant). Migration page has no tenant selector.
 * Original data stays where it is. Copy is pasted in new structure.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { firestoreDB, getFirebaseAuth } from "./firebase";
import { getTenantCollectionPath } from "./tenancy";
import { firestorePatchDocument } from "@/erp/infrastructure/firestore-rest";

type FirestorePath = [string, ...string[]];

/** All collections to migrate - each becomes a subcollection under season */
const ALL_COLLECTIONS = [
  "suppliers",
  "customers",
  "payments",
  "customer_payments",
  "governmentFinalizedPayments",
  "incomes",
  "customerDocuments",
  "expenses",
  "expenseTemplates",
  "loans",
  "fund_transactions",
  "inventoryItems",
  "kantaParchi",
  "manufacturingCosting",
  "employees",
  "attendance",
  "payroll",
  "projects",
  "tasks",
  "mandiReports",
  "ledgerAccounts",
  "ledgerEntries",
  "ledgerCashAccounts",
  "accounts",
  "banks",
  "bankBranches",
  "bankAccounts",
  "supplierBankAccounts",
  "settings",
  "options",
  "incomeCategories",
  "expenseCategories",
  "holidays",
];

/** Human-readable labels for collection selection UI */
export const MIGRATABLE_COLLECTIONS = ALL_COLLECTIONS.map((id) => ({
  id,
  label: id
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (s) => s.toUpperCase())
    .trim(),
}));

/** Use name as Firestore ID - company/sub/season ka jo bhi naam ho wohi use hota hai */
function nameToId(raw: string, fallback: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/\//g, "_");
}

export interface MigrationOptions {
  companyName: string;
  subCompanyName: string;
  seasonName: string;
}

export interface CollectionMigrationResult {
  migrated: number;
  skipped: number;
}

export interface MigrationResult {
  companyId: string;
  subCompanyId: string;
  seasonKey: string;
  perCollection: Record<string, CollectionMigrationResult>;
  totalMigrated: number;
}

/** companies/{companyId}/{subCompanyId} — subcompany subcollection */
function subCompanyPath(companyId: string, subCompanyId: string): FirestorePath {
  return ["companies", companyId, subCompanyId];
}

/** companies/{companyId}/{subCompanyId}/{seasonKey} — season document */
function seasonPath(
  companyId: string,
  subCompanyId: string,
  seasonKey: string,
): FirestorePath {
  return ["companies", companyId, subCompanyId, seasonKey];
}

/** companies/{companyId}/{subCompanyId}/{seasonKey}/{collectionName} */
function collectionUnderSeasonPath(
  companyId: string,
  subCompanyId: string,
  seasonKey: string,
  collectionName: string,
): FirestorePath {
  return ["companies", companyId, subCompanyId, seasonKey, collectionName];
}

/** Check if company structure already exists in Firestore. */
export async function checkCompanyStructureExists(
  options: MigrationOptions,
): Promise<CompanySetupResult | null> {
  if (typeof window === "undefined") return null;
  const companyId = nameToId(options.companyName, "default_company");
  const subCompanyId = nameToId(options.subCompanyName, "default");
  const seasonKey = nameToId(options.seasonName, "default_season");
  const seasonRef = doc(firestoreDB, ...seasonPath(companyId, subCompanyId, seasonKey));
  const seasonSnap = await getDoc(seasonRef);
  if (seasonSnap.exists()) {
    return { companyId, subCompanyId, seasonKey };
  }
  return null;
}

/** Exponential backoff for 429: 8s, 20s, 45s, 90s (4 retries) */
const QUOTA_RETRY_DELAYS_MS = [8000, 20000, 45000, 90000];

const DELAY_BETWEEN_DOCS_MS = 5000;

function isQuotaError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("Quota exceeded") ||
    msg.includes("Too Many Requests")
  );
}

async function patchWithRetryOnQuota(
  idToken: string,
  documentPath: string,
  data: Record<string, unknown>,
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= QUOTA_RETRY_DELAYS_MS.length; attempt++) {
    try {
      await firestorePatchDocument({ idToken, documentPath, data });
      return;
    } catch (e) {
      lastErr = e;
      if (isQuotaError(e) && attempt < QUOTA_RETRY_DELAYS_MS.length) {
        const delay = QUOTA_RETRY_DELAYS_MS[attempt];
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/** Create company structure via Firestore REST API. Path: companies/companyId/subCompanyId/seasonKey */
export async function setupCompanyStructureViaRest(
  idToken: string,
  options: MigrationOptions,
): Promise<CompanySetupResult> {
  const companyId = nameToId(options.companyName, "default_company");
  const subCompanyId = nameToId(options.subCompanyName, "default");
  const seasonKey = nameToId(options.seasonName, "default_season");

  const companyDocPath = ["companies", companyId].join("/");
  await patchWithRetryOnQuota(idToken, companyDocPath, {
    name: options.companyName?.trim() || "Company",
    updatedAt: new Date().toISOString(),
  });

  await new Promise((r) => setTimeout(r, DELAY_BETWEEN_DOCS_MS));

  /* Subcompany has no document - it's a subcollection. Create season doc directly. */
  const seasonDocPath = ["companies", companyId, subCompanyId, seasonKey].join("/");
  await patchWithRetryOnQuota(idToken, seasonDocPath, {
    seasonKey,
    seasonName: options.seasonName?.trim() || seasonKey,
    updatedAt: new Date().toISOString(),
  });

  await registerCompanyInIndex(companyId, subCompanyId, seasonKey, options);
  return { companyId, subCompanyId, seasonKey };
}

/** Register company in companies index for listing in selector. Adds createdBy + companyMembers when userId provided. */
async function registerCompanyInIndex(
  companyId: string,
  subCompanyId: string,
  seasonKey: string,
  options: MigrationOptions,
  userId?: string,
) {
  const ref = doc(firestoreDB, "companies", companyId);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
  const subCompanies = (existing.subCompanies as Record<string, { name: string; seasons: Record<string, string> }>) || {};
  const sub = subCompanies[subCompanyId] || { name: options.subCompanyName?.trim() || "MAIN", seasons: {} };
  sub.seasons = sub.seasons || {};
  if (seasonKey && seasonKey !== "_placeholder") {
    sub.seasons[seasonKey] = options.seasonName?.trim() || seasonKey;
  }
  subCompanies[subCompanyId] = sub;
  const companyData: Record<string, unknown> = {
    name: options.companyName?.trim() || "Company",
    subCompanies,
    updatedAt: serverTimestamp(),
  };
  if (userId) {
    companyData.createdBy = userId;
  }
  await setDoc(ref, companyData, { merge: true });
  if (userId) {
    await setDoc(
      doc(firestoreDB, "companyMembers", `${companyId}_${userId}`),
      { companyId, userId, role: "owner", createdAt: serverTimestamp() },
      { merge: true }
    );
  }
}

async function ensureCompany(companyName: string): Promise<string> {
  return nameToId(companyName, "default_company");
}

async function ensureSubCompany(
  companyId: string,
  subCompanyName: string,
): Promise<string> {
  const subCompanyId = nameToId(subCompanyName, "default");
  const ref = doc(firestoreDB, ...subCompanyPath(companyId, subCompanyId));
  await setDoc(ref, { name: subCompanyName?.trim() || "MAIN", updatedAt: serverTimestamp() }, { merge: true });
  return subCompanyId;
}

async function ensureSeason(
  companyId: string,
  subCompanyId: string,
  seasonKey: string,
  seasonName: string,
): Promise<void> {
  const ref = doc(firestoreDB, ...seasonPath(companyId, subCompanyId, seasonKey));
  await setDoc(ref, { seasonKey, seasonName: seasonName?.trim() || seasonKey, updatedAt: serverTimestamp() }, { merge: true });
}

/** Try tenant path first, then root path */
async function getSourceDocs(collectionName: string) {
  const tenantPath = getTenantCollectionPath(collectionName);
  const tenantCol = collection(firestoreDB, ...tenantPath);
  const tenantSnap = await getDocs(tenantCol);

  if (tenantSnap.size > 0) {
    return { docs: tenantSnap.docs, sourceBase: tenantPath };
  }

  const rootPath = [collectionName] as FirestorePath;
  const rootCol = collection(firestoreDB, ...rootPath);
  const rootSnap = await getDocs(rootCol);
  return { docs: rootSnap.docs, sourceBase: rootPath };
}

async function migrateOneCollection(
  collectionName: string,
  companyId: string,
  subCompanyId: string,
  seasonKey: string,
  seasonName: string,
): Promise<CollectionMigrationResult> {
  const { docs, sourceBase } = await getSourceDocs(collectionName);

  let migrated = 0;
  let skipped = 0;

  const BATCH_SIZE = 350;
  let batch = writeBatch(firestoreDB);
  let opsInBatch = 0;

  const flushBatch = async () => {
    if (opsInBatch === 0) return;
    await batch.commit();
    batch = writeBatch(firestoreDB);
    opsInBatch = 0;
  };

  const targetBase = collectionUnderSeasonPath(
    companyId,
    subCompanyId,
    seasonKey,
    collectionName,
  );

  for (const docSnap of docs) {
    const raw = docSnap.data() as Record<string, unknown>;
    const id = docSnap.id;

    if (
      raw.__erpMigrated === true &&
      raw.__erpSeason === seasonKey &&
      raw.__erpCompanyId === companyId &&
      raw.__erpSubCompanyId === subCompanyId
    ) {
      skipped++;
      continue;
    }

    // Copy: paste same data + metadata (original stays intact)
    const copyData: Record<string, unknown> = {
      ...raw,
      __companyId: companyId,
      __subCompanyId: subCompanyId,
      __seasonKey: seasonKey,
      __seasonName: seasonName,
    };

    const targetRef = doc(
      firestoreDB,
      ...([...targetBase, id] as FirestorePath),
    );
    batch.set(targetRef, copyData, { merge: false });
    opsInBatch++;

    // Marker on source (merge only - original data stays)
    const srcRef = doc(
      firestoreDB,
      ...([...sourceBase, id] as FirestorePath),
    );
    batch.set(
      srcRef,
      {
        __erpMigrated: true,
        __erpSeason: seasonKey,
        __erpCompanyId: companyId,
        __erpSubCompanyId: subCompanyId,
        __erpSeasonName: seasonName,
      },
      { merge: true },
    );
    opsInBatch++;

    migrated++;

    if (opsInBatch >= BATCH_SIZE) {
      await flushBatch();
    }
  }

  await flushBatch();

  return { migrated, skipped };
}

export interface CompanySetupResult {
  companyId: string;
  subCompanyId: string;
  seasonKey: string;
}

/** Step 1: Create Company → SubCompany → Season at root. */
export async function setupCompanyStructure(
  options: MigrationOptions,
): Promise<CompanySetupResult> {
  const companyId = await ensureCompany(options.companyName);
  const subCompanyId = await ensureSubCompany(
    companyId,
    options.subCompanyName,
  );
  const seasonKey = nameToId(options.seasonName, "default_season");

  await ensureSeason(companyId, subCompanyId, seasonKey, options.seasonName);
  const userId = typeof window !== "undefined" ? getFirebaseAuth()?.currentUser?.uid : undefined;
  await registerCompanyInIndex(companyId, subCompanyId, seasonKey, options, userId);

  return { companyId, subCompanyId, seasonKey };
}

/** Server-side only: same as setupCompanyStructure but runs in Node (API route). */
export async function setupCompanyStructureServer(
  options: MigrationOptions,
): Promise<CompanySetupResult> {
  const companyId = nameToId(options.companyName, "default_company");
  const subCompanyId = nameToId(options.subCompanyName, "default");
  const seasonKey = nameToId(options.seasonName, "default_season");

  await setDoc(
    doc(firestoreDB, "companies", companyId),
    { name: options.companyName?.trim() || "Company", updatedAt: serverTimestamp() },
    { merge: true },
  );
  await setDoc(
    doc(firestoreDB, ...subCompanyPath(companyId, subCompanyId)),
    { name: options.subCompanyName?.trim() || "MAIN", updatedAt: serverTimestamp() },
    { merge: true },
  );
  await setDoc(
    doc(firestoreDB, ...seasonPath(companyId, subCompanyId, seasonKey)),
    { seasonKey, seasonName: options.seasonName?.trim() || seasonKey, updatedAt: serverTimestamp() },
    { merge: true },
  );

  await registerCompanyInIndex(companyId, subCompanyId, seasonKey, options);
  return { companyId, subCompanyId, seasonKey };
}

export type MigrationProgressCallback = (
  pct: number,
  current: string,
  done: number,
  total: number,
) => void;

/** Step 2: Migrate data into existing structure. selectedCollections = which to migrate; omit = all. */
export async function migrateDataToSeason(
  options: MigrationOptions,
  onProgress?: MigrationProgressCallback,
  existingSetup?: CompanySetupResult | null,
  selectedCollections?: string[],
): Promise<MigrationResult> {
  const { companyId, subCompanyId, seasonKey } = existingSetup
    ? existingSetup
    : await setupCompanyStructure(options);

  const toMigrate = selectedCollections?.length
    ? selectedCollections.filter((c) => ALL_COLLECTIONS.includes(c))
    : [...ALL_COLLECTIONS];

  const perCollection: Record<string, CollectionMigrationResult> = {};
  let totalMigrated = 0;
  const total = toMigrate.length;

  for (let i = 0; i < toMigrate.length; i++) {
    const collName = toMigrate[i];
    onProgress?.((i / total) * 100, collName, i, total);

    try {
      const res = await migrateOneCollection(
        collName,
        companyId,
        subCompanyId,
        seasonKey,
        options.seasonName,
      );
      perCollection[collName] = res;
      totalMigrated += res.migrated;
    } catch (e) {
      console.error(`[ERP Migration] Failed to migrate ${collName}:`, e);
      perCollection[collName] = { migrated: 0, skipped: 0 };
    }
  }

  onProgress?.(100, "Done", total, total);

  return {
    companyId,
    subCompanyId,
    seasonKey,
    perCollection,
    totalMigrated,
  };
}

/** Legacy: full migration in one call */
export async function migrateTenantDataToSeason(
  options: MigrationOptions,
): Promise<MigrationResult> {
  return migrateDataToSeason(options);
}

/** List companies the current user has access to (created or joined via invite) */
export async function listErpCompanies(): Promise<
  { id: string; name: string; subCompanies: { id: string; name: string; seasons: { key: string; name: string }[] }[] }[]
> {
  const auth = getFirebaseAuth();
  const userId = auth?.currentUser?.uid;
  if (!userId) return [];

  const companyIds = new Set<string>();

  // Companies user created (createdBy = userId)
  const companiesCol = collection(firestoreDB, "companies");
  const companiesSnap = await getDocs(companiesCol);
  for (const d of companiesSnap.docs) {
    if (d.id.startsWith("_")) continue;
    const data = d.data() as { createdBy?: string };
    if (data.createdBy === userId) companyIds.add(d.id);
  }

  // Companies user joined (companyMembers)
  const membersRef = collection(firestoreDB, "companyMembers");
  const membersSnap = await getDocs(
    query(membersRef, where("userId", "==", userId))
  );
  for (const m of membersSnap.docs) {
    const data = m.data() as { companyId?: string };
    if (data.companyId) companyIds.add(data.companyId);
  }

  if (companyIds.size === 0) return [];

  const result: { id: string; name: string; subCompanies: { id: string; name: string; seasons: { key: string; name: string }[] }[] }[] = [];
  for (const companyId of companyIds) {
    const companyRef = doc(firestoreDB, "companies", companyId);
    const companySnap = await getDoc(companyRef);
    if (!companySnap.exists()) continue;
    const data = companySnap.data() as { name?: string; subCompanies?: Record<string, { name?: string; seasons?: Record<string, string> }> };
    const subCompanies = data.subCompanies || {};
    result.push({
      id: companyId,
      name: data.name || companyId,
      subCompanies: Object.entries(subCompanies).map(([id, s]) => ({
        id,
        name: s.name || id,
        seasons: Object.entries(s.seasons || {}).map(([key, name]) => ({ key, name })),
      })),
    });
  }
  return result;
}

/** Add new sub company under selected company (updates index only; subcollection created when first season added) */
export async function addErpSubCompany(
  companyId: string,
  companyName: string,
  subCompanyName: string,
): Promise<string> {
  const subCompanyId = nameToId(subCompanyName, "default");
  const companyRef = doc(firestoreDB, "companies", companyId);
  const snap = await getDoc(companyRef);
  const existing = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
  const subCompanies = (existing.subCompanies as Record<string, { name: string; seasons: Record<string, string> }>) || {};
  subCompanies[subCompanyId] = { name: subCompanyName?.trim() || "MAIN", seasons: {} };
  await setDoc(companyRef, { name: companyName, subCompanies, updatedAt: serverTimestamp() }, { merge: true });
  return subCompanyId;
}

/** Add new season under selected sub company */
export async function addErpSeason(
  companyId: string,
  subCompanyId: string,
  companyName: string,
  subCompanyName: string,
  seasonName: string,
): Promise<string> {
  const seasonKey = nameToId(seasonName, "default_season");
  const ref = doc(firestoreDB, ...seasonPath(companyId, subCompanyId, seasonKey));
  await setDoc(ref, { seasonKey, seasonName: seasonName?.trim() || seasonKey, updatedAt: serverTimestamp() }, { merge: true });
  await registerCompanyInIndex(companyId, subCompanyId, seasonKey, {
    companyName,
    subCompanyName,
    seasonName: seasonName?.trim() || seasonKey,
  });
  return seasonKey;
}
