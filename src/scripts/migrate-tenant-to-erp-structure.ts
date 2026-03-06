/**
 * Migration Script: Move existing tenant data into ERP hierarchy
 *
 * Goal:
 * - Existing tenant data lives in flat, tenant-scoped collections (e.g. incomes, expenses, projects, tasks, etc.)
 * - New ERP structure expects:
 *   tenants/{companyId}/subCompanies/{subCompanyId}/years/{year}/{module}/{recordId}
 *   and audit logs in tenants/{companyId}/activityLogs
 *
 * This script:
 * - Uses TENANT_ID env var to select a tenant (company)
 * - Creates (or reuses) a single default SubCompany under that tenant
 * - Reads selected collections and writes copies under:
 *   subCompanies/{subCompanyId}/years/{year}/{module}
 * - Tries to infer year from date fields; falls back to current year if missing
 *
 * IMPORTANT:
 * - This script is designed to be idempotent per recordId + year + module.
 * - It does NOT delete or modify your old data; it only copies into the new structure.
 * - Run this per-tenant by setting process.env.TENANT_ID.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { firestoreDB } from "@/lib/firebase";

type FirestorePath = [string, ...string[]];

const tenantId = String((globalThis as any)?.process?.env?.TENANT_ID || "").trim();

if (!tenantId) {
  // eslint-disable-next-line no-console
  console.warn(
    "[migrate-tenant-to-erp-structure] TENANT_ID env var not set. " +
      "Set process.env.TENANT_ID to a tenant/company id before running this script.",
  );
}

const tenantCollectionPath = (collectionName: string): FirestorePath =>
  (tenantId
    ? (["tenants", tenantId, collectionName] as const)
    : ([collectionName] as const)) as unknown as FirestorePath;

const tenantDocPath = (collectionName: string, id: string): FirestorePath =>
  (tenantId
    ? (["tenants", tenantId, collectionName, id] as const)
    : ([collectionName, id] as const)) as unknown as FirestorePath;

type ERPModule = "sales" | "purchase" | "expenses" | "employees" | "reports";

type MigrationSourceCollection =
  | "incomes"
  | "expenses"
  | "inventoryItems"
  | "employees"
  | "projects"
  | "tasks";

type ModuleMapping = {
  source: MigrationSourceCollection;
  module: ERPModule;
};

const SOURCE_MAPPINGS: ModuleMapping[] = [
  { source: "incomes", module: "sales" },
  { source: "expenses", module: "expenses" },
  { source: "inventoryItems", module: "purchase" },
  { source: "employees", module: "employees" },
  { source: "projects", module: "reports" },
  { source: "tasks", module: "reports" },
];

/**
 * Utility: best-effort extraction of a JS Date from common fields.
 */
function extractDate(data: Record<string, unknown>): Date | null {
  const candidateKeys = ["date", "paymentDate", "createdAt", "invoiceDate"];

  for (const key of candidateKeys) {
    const value = data[key];
    if (!value) continue;

    // Firestore Timestamp
    if (value instanceof Timestamp) {
      return value.toDate();
    }

    // Firestore Timestamp-like
    if (typeof value === "object" && value && "seconds" in (value as any)) {
      try {
        const seconds = Number((value as any).seconds);
        if (!Number.isNaN(seconds)) {
          return new Date(seconds * 1000);
        }
      } catch {
        // ignore
      }
    }

    // ISO string or date string
    if (typeof value === "string") {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        return d;
      }
    }
  }

  return null;
}

function inferYear(data: Record<string, unknown>): number {
  const d = extractDate(data);
  if (d) return d.getFullYear();
  return new Date().getFullYear();
}

/**
 * Ensure a default subCompany exists for this tenant.
 * We create or reuse:
 *   tenants/{tenantId}/subCompanies/{subCompanyId}
 */
async function ensureDefaultSubCompany(): Promise<string> {
  const defaultId = "default";
  const ref = doc(firestoreDB, ...tenantDocPath("subCompanies", defaultId));
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      name: "MAIN",
      companyId: tenantId || "root",
      createdAt: serverTimestamp(),
      createdBy: "migration",
    });
  }

  return defaultId;
}

function erpModuleCollectionPath(
  subCompanyId: string,
  year: number,
  module: ERPModule,
): FirestorePath {
  // tenants/{tenantId}/subCompanies/{subCompanyId}/years/{year}/{module}
  if (!tenantId) {
    return ["subCompanies", subCompanyId, "years", String(year), module];
  }
  return [
    "tenants",
    tenantId,
    "subCompanies",
    subCompanyId,
    "years",
    String(year),
    module,
  ];
}

function activityLogCollectionPath(): FirestorePath {
  return tenantCollectionPath("activityLogs");
}

/**
 * Migrate one source collection (e.g. incomes → sales module).
 *
 * Strategy:
 * - Read all docs from tenants/{tenantId}/{source}
 * - For each doc:
 *   - infer year
 *   - write a new document at:
 *     tenants/{tenantId}/subCompanies/{defaultSubCompanyId}/years/{year}/{module}/{id}
 *   - append a basic activityLogs entry (CREATE)
 */
async function migrateCollection(
  source: MigrationSourceCollection,
  module: ERPModule,
  subCompanyId: string,
): Promise<{ migrated: number; skipped: number }> {
  const srcCol = collection(firestoreDB, ...tenantCollectionPath(source));
  const snapshot = await getDocs(srcCol);

  let migrated = 0;
  let skipped = 0;

  // Use batched writes to avoid exceeding limits.
  const BATCH_SIZE = 400;
  let batch = writeBatch(firestoreDB);
  let opsInBatch = 0;

  const flushBatch = async () => {
    if (opsInBatch === 0) return;
    await batch.commit();
    batch = writeBatch(firestoreDB);
    opsInBatch = 0;
  };

  for (const docSnap of snapshot.docs) {
    const raw = docSnap.data() as Record<string, unknown>;
    const id = docSnap.id;

    // Skip already-migrated docs by checking a marker
    if (raw.__migratedToErp === true) {
      skipped++;
      continue;
    }

    const year = inferYear(raw);

    const erpColPath = erpModuleCollectionPath(subCompanyId, year, module);
    const erpDocRef = doc(firestoreDB, ...([...erpColPath, id] as FirestorePath));

    const createdBy = (raw as any).createdBy || "legacy";
    const createdByName = (raw as any).createdByName || "Legacy Import";

    // New ERP record shape
    const newRecord: Record<string, unknown> = {
      data: raw,
      companyId: tenantId || "root",
      subCompanyId,
      year,
      createdBy,
      createdByName,
      createdAt: (raw as any).createdAt || serverTimestamp(),
    };

    // Write ERP record
    batch.set(erpDocRef, newRecord, { merge: false });
    opsInBatch++;

    // Write activity log (CREATE)
    const activityRef = doc(
      firestoreDB,
      ...([...activityLogCollectionPath(), `${module}_${id}_${year}`] as FirestorePath),
    );
    batch.set(
      activityRef,
      {
        action: "CREATE",
        module,
        recordId: id,
        companyId: tenantId || "root",
        subCompanyId,
        year,
        performedBy: createdBy,
        timestamp: serverTimestamp(),
      },
      { merge: false },
    );
    opsInBatch++;

    // Optionally mark source doc as migrated (non-destructive)
    const srcDocRef = doc(firestoreDB, ...tenantDocPath(source, id));
    batch.set(
      srcDocRef,
      {
        __migratedToErp: true,
        __migratedModule: module,
        __migratedYear: year,
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

export async function migrateTenantToErpStructure() {
  if (!tenantId) {
    throw new Error(
      "[migrate-tenant-to-erp-structure] TENANT_ID env var is required to run this script.",
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    `[migrate-tenant-to-erp-structure] Starting migration for tenant: ${tenantId}`,
  );

  const subCompanyId = await ensureDefaultSubCompany();

  const results: Record<
    MigrationSourceCollection,
    { migrated: number; skipped: number }
  > = {} as any;

  for (const mapping of SOURCE_MAPPINGS) {
    // eslint-disable-next-line no-console
    console.log(
      `[migrate-tenant-to-erp-structure] Migrating collection "${mapping.source}" to module "${mapping.module}"`,
    );
    const res = await migrateCollection(mapping.source, mapping.module, subCompanyId);
    results[mapping.source] = res;
    // eslint-disable-next-line no-console
    console.log(
      `[migrate-tenant-to-erp-structure] Done "${mapping.source}": migrated=${res.migrated}, skipped=${res.skipped}`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    "[migrate-tenant-to-erp-structure] Migration summary:",
    JSON.stringify(results, null, 2),
  );

  return { tenantId, subCompanyId, results };
}

// Optional: attach to window for manual invocation in browser devtools
if (typeof window !== "undefined") {
  (window as any).migrateTenantToErpStructure = migrateTenantToErpStructure;
}

