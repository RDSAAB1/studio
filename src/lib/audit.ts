/**
 * Audit trail: createdBy, editedBy, activity log, recycle bin.
 * Use with all Firestore writes to track who did what.
 */

import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  writeBatch,
} from "firebase/firestore";
import { firestoreDB, getFirebaseAuth } from "./firebase";
import { getTenantCollectionPath } from "./tenancy";

export type ActivityType = "create" | "edit" | "delete";

export type AuditMetadata = {
  createdAt?: string;
  createdBy?: string;
  createdByName?: string;
  updatedAt?: string;
  editedBy?: string;
  editedByName?: string;
};

export type ActivityLogEntry = {
  id: string;
  type: ActivityType;
  collection: string;
  docId: string;
  docPath: string;
  userId: string;
  userName: string;
  summary: string;
  timestamp: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
};

export type RecycleBinEntry = {
  id: string;
  collection: string;
  docId: string;
  docPath: string;
  deletedAt: string;
  deletedBy: string;
  deletedByName: string;
  data: Record<string, unknown>;
};

/** Get current user ID (Firebase UID or company user ID) */
export function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  const uid = getFirebaseAuth()?.currentUser?.uid;
  return uid || null;
}

/** Get current user display name (Firebase user or company user) */
export function getCurrentUserName(): string {
  if (typeof window === "undefined") return "System";
  const user = getFirebaseAuth()?.currentUser;
  if (!user) return "System";
  if (user.uid?.startsWith("cu_")) {
    const parts = user.uid.split("_");
    return parts.length >= 3 ? parts.slice(2).join("_") : "Company User";
  }
  return user.displayName || user.email || user.uid?.slice(0, 8) || "Unknown";
}

/** Get audit metadata for create */
export function getCreateMetadata(): AuditMetadata {
  const now = new Date().toISOString();
  const uid = getCurrentUserId();
  const name = getCurrentUserName();
  return {
    createdAt: now,
    createdBy: uid || undefined,
    createdByName: name,
    updatedAt: now,
    editedBy: uid || undefined,
    editedByName: name,
  };
}

/** Get audit metadata for update (editedBy only) */
export function getEditMetadata(): Partial<AuditMetadata> {
  const now = new Date().toISOString();
  const uid = getCurrentUserId();
  const name = getCurrentUserName();
  return {
    updatedAt: now,
    editedBy: uid || undefined,
    editedByName: name,
  };
}

/** Merge audit metadata into data for create */
export function withCreateMetadata<T extends Record<string, unknown>>(data: T): T & AuditMetadata {
  const meta = getCreateMetadata();
  return { ...data, ...meta } as T & AuditMetadata;
}

/** Merge audit metadata into data for update */
export function withEditMetadata<T extends Record<string, unknown>>(data: T): T & Partial<AuditMetadata> {
  const meta = getEditMetadata();
  return { ...data, ...meta } as T & Partial<AuditMetadata>;
}

/** Log activity to activityLog collection */
export async function logActivity(params: {
  type: ActivityType;
  collection: string;
  docId: string;
  docPath: string;
  summary: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
}): Promise<void> {
  try {
    const userId = getCurrentUserId();
    const userName = getCurrentUserName();
    const path = getTenantCollectionPath("activityLog");
    const colRef = collection(firestoreDB, ...path);
    const docData: Record<string, unknown> = {
      type: params.type,
      collection: params.collection,
      docId: params.docId,
      docPath: params.docPath,
      userId: userId || "system",
      userName,
      summary: params.summary,
      timestamp: new Date().toISOString(),
    };
    if (params.beforeData != null) docData.beforeData = sanitizeForLog(params.beforeData);
    if (params.afterData != null) docData.afterData = sanitizeForLog(params.afterData);
    await addDoc(colRef, docData);
  } catch (e) {
    console.error("[audit] logActivity failed:", e);
  }
}

function sanitizeForLog(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith("_") || v === undefined) continue;
    if (v && typeof v === "object" && "toDate" in v) {
      out[k] = (v as { toDate: () => Date }).toDate?.()?.toISOString?.() ?? v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Move doc to recycle bin and log delete */
export async function moveToRecycleBin(params: {
  collection: string;
  docId: string;
  docPath: string;
  data: Record<string, unknown>;
  summary: string;
}): Promise<void> {
  try {
    const userId = getCurrentUserId();
    const userName = getCurrentUserName();
    const path = getTenantCollectionPath("recycleBin");
    const colRef = collection(firestoreDB, ...path);
    const docRef = doc(colRef, `${params.collection}_${params.docId}`);

    await setDoc(docRef, {
      collection: params.collection,
      docId: params.docId,
      docPath: params.docPath,
      deletedAt: new Date().toISOString(),
      deletedBy: userId || "system",
      deletedByName: userName,
      data: sanitizeForLog(params.data),
    });

    await logActivity({
      type: "delete",
      collection: params.collection,
      docId: params.docId,
      docPath: params.docPath,
      summary: params.summary,
      beforeData: params.data,
    });
  } catch (e) {
    console.error("[audit] moveToRecycleBin failed:", e);
  }
}

/** Fetch activity log (paginated) */
export async function fetchActivityLog(
  type: ActivityType | "all",
  pageSize: number = 10,
  lastDoc?: QueryDocumentSnapshot<DocumentData>
): Promise<{ entries: ActivityLogEntry[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null; hasError?: boolean }> {
  try {
    const path = getTenantCollectionPath("activityLog");
    const colRef = collection(firestoreDB, ...path);

    const constraints: unknown[] = [orderBy("timestamp", "desc"), limit(pageSize)];
    if (type !== "all") {
      constraints.unshift(where("type", "==", type));
    }
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const q = query(colRef, ...constraints);
    const snap = await getDocs(q);
    const entries: ActivityLogEntry[] = snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        type: x.type as ActivityType,
        collection: x.collection || "",
        docId: x.docId || "",
        docPath: x.docPath || "",
        userId: x.userId || "",
        userName: x.userName || "Unknown",
        summary: x.summary || "",
        timestamp: x.timestamp || "",
        beforeData: x.beforeData,
        afterData: x.afterData,
      };
    });

    const last = snap.docs[snap.docs.length - 1] ?? null;
    return { entries, lastDoc: last };
  } catch (e) {
    console.error("[audit] fetchActivityLog failed:", e);
    return { entries: [], lastDoc: null, hasError: true };
  }
}

/** Fetch recycle bin entries */
export async function fetchRecycleBin(
  pageSize: number = 20,
  lastDoc?: QueryDocumentSnapshot<DocumentData>
): Promise<{ entries: RecycleBinEntry[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null; hasError?: boolean }> {
  try {
    const path = getTenantCollectionPath("recycleBin");
    const colRef = collection(firestoreDB, ...path);

    let q = query(
      colRef,
      orderBy("deletedAt", "desc"),
      limit(pageSize)
    );

    if (lastDoc) {
      q = query(colRef, orderBy("deletedAt", "desc"), startAfter(lastDoc), limit(pageSize));
    }

    const snap = await getDocs(q);
    const entries: RecycleBinEntry[] = snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        collection: x.collection || "",
        docId: x.docId || "",
        docPath: x.docPath || "",
        deletedAt: x.deletedAt || "",
        deletedBy: x.deletedBy || "",
        deletedByName: x.deletedByName || "Unknown",
        data: (x.data as Record<string, unknown>) || {},
      };
    });

    const last = snap.docs[snap.docs.length - 1] ?? null;
    return { entries, lastDoc: last };
  } catch (e) {
    console.error("[audit] fetchRecycleBin failed:", e);
    return { entries: [], lastDoc: null, hasError: true };
  }
}

/** Map Firestore collection name -> internal name for notifySyncRegistry and IndexedDB */
async function getInternalCollectionName(firestoreName: string): Promise<string> {
  const { COLLECTION_MAP } = await import("./sync-registry");
  const entry = Object.entries(COLLECTION_MAP).find(([, fs]) => fs === firestoreName);
  return entry ? entry[0] : firestoreName;
}

/** Collections that have direct IndexedDB table mapping (for restore) */
const IDB_RESTORE_TABLES = new Set(["suppliers", "customers", "payments", "customerPayments", "loans", "projects", "fundTransactions", "inventoryItems", "bankAccounts", "banks", "bankBranches", "accounts", "employees", "kantaParchi", "customerDocuments", "supplierBankAccounts"]);

/** Restore from recycle bin */
export async function restoreFromRecycleBin(entryId: string): Promise<string | null> {
  try {
    const path = getTenantCollectionPath("recycleBin");
    const colRef = collection(firestoreDB, ...path);
    const docRef = doc(colRef, entryId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    const x = snap.data();
    const collectionName = (x.collection as string) || "";
    const docId = (x.docId as string) || "";
    const data = ((x.data as Record<string, unknown>) || {}) as Record<string, unknown>;

    if (!collectionName || !docId) {
      throw new Error("Invalid recycle bin entry: missing collection or docId");
    }

    const targetPath = getTenantCollectionPath(collectionName);
    const targetRef = doc(firestoreDB, ...targetPath, docId);

    const batch = writeBatch(firestoreDB);
    const restoredData = { ...data, updatedAt: new Date().toISOString() };
    batch.set(targetRef, restoredData);
    batch.delete(docRef);

    const { notifySyncRegistry } = await import("./sync-registry");
    const internalName = await getInternalCollectionName(collectionName);
    notifySyncRegistry(internalName, { batch });
    if (internalName === "suppliers") notifySyncRegistry("payments", { batch });
    if (internalName === "customers") notifySyncRegistry("customerPayments", { batch });

    await batch.commit();

    await logActivity({
      type: "create",
      collection: collectionName,
      docId,
      docPath: targetPath.join("/"),
      summary: `Restored ${collectionName}/${docId} from recycle bin`,
      afterData: data,
    });

    if (typeof window !== "undefined") {
      try {
        const { db } = await import("./database");
        if (db && IDB_RESTORE_TABLES.has(internalName) && (db as any)[internalName]) {
          try {
            const table = (db as any)[internalName] as { put: (v: unknown) => Promise<void> };
            const toPut = { ...restoredData, id: docId };
            await table.put(toPut);
          } catch (putErr) {
            console.warn("[audit] restoreFromRecycleBin: IndexedDB put failed, will sync", putErr);
          }
        }
        try {
          const { forceSyncCollectionFromFirestore } = await import("./local-first-sync");
          await forceSyncCollectionFromFirestore(internalName);
        } catch (syncErr) {
          window.dispatchEvent(new CustomEvent("indexeddb:collection:changed", { detail: { collection: internalName } }));
        }
      } catch (e) {
        console.warn("[audit] restoreFromRecycleBin: IndexedDB/sync update skipped", e);
      }
    }

    return docId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[audit] restoreFromRecycleBin failed:", e);
    throw new Error(`Restore failed: ${msg}`);
  }
}

const BATCH_LIMIT = 500;

/** Clear all activity log entries (admin only) */
export async function clearAllActivityLog(): Promise<number> {
  const path = getTenantCollectionPath("activityLog");
  const colRef = collection(firestoreDB, ...path);
  const snap = await getDocs(colRef);
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(firestoreDB);
    snap.docs.slice(i, i + BATCH_LIMIT).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.size;
}

/** Clear all recycle bin entries (admin only) */
export async function clearAllRecycleBin(): Promise<number> {
  const path = getTenantCollectionPath("recycleBin");
  const colRef = collection(firestoreDB, ...path);
  const snap = await getDocs(colRef);
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(firestoreDB);
    snap.docs.slice(i, i + BATCH_LIMIT).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.size;
}

