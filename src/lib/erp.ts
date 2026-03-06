import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  deleteDoc,
  type QueryConstraint,
} from "firebase/firestore";
import { firestoreDB, getFirebaseAuth } from "./firebase";
import {
  getActiveTenant,
  getTenantCollectionPath,
  type TenantStorageMode,
} from "./tenancy";

/**
 * Core ERP types
 */

export type CompanyId = string;
export type SubCompanyId = string;
export type YearValue = number;

export type ERPModule = "sales" | "purchase" | "expenses" | "employees" | "reports";

export type CompanyRole = "admin" | "manager" | "staff";

export interface CompanyUserAccess {
  userId: string;
  displayName: string;
  email: string;
  companyId: CompanyId;
  role: CompanyRole;
  allowedSubCompanies: SubCompanyId[];
}

export interface SubCompany {
  id: SubCompanyId;
  companyId: CompanyId;
  name: string;
  createdAt: Date | null;
  createdBy: string;
}

export interface ERPRecord {
  id: string;
  data: Record<string, unknown>;
  companyId: CompanyId;
  subCompanyId: SubCompanyId;
  year: YearValue;
  createdBy: string;
  createdByName: string;
  createdAt: Date | null;
  updatedBy?: string;
  updatedAt?: Date | null;
}

export type ActivityAction = "CREATE" | "UPDATE" | "DELETE";

export interface ActivityLog {
  id: string;
  action: ActivityAction;
  module: ERPModule;
  recordId: string;
  companyId: CompanyId;
  subCompanyId: SubCompanyId;
  year: YearValue;
  performedBy: string;
  timestamp: Date | null;
}

export interface ERPContext {
  companyId: CompanyId;
  subCompanyId: SubCompanyId;
  year: YearValue;
  module: ERPModule;
  role: CompanyRole;
  userId: string;
}

/**
 * Internal helpers
 */

function assertAuthenticated() {
  const auth = getFirebaseAuth();
  const user = (auth as any)?.currentUser as { uid: string; email?: string | null; displayName?: string | null } | null;
  if (!user) {
    throw new Error("Not authenticated");
  }
  return user;
}

function getActiveCompany() {
  const tenant = getActiveTenant();
  if (!tenant?.id) {
    throw new Error("No active company selected");
  }
  return tenant;
}

function resolveCompanyRole(rawRole: unknown): CompanyRole {
  if (rawRole === "admin" || rawRole === "manager" || rawRole === "staff") {
    return rawRole;
  }
  // Default to admin for existing users until roles are explicitly set
  return "admin";
}

async function getCurrentUserAccess(): Promise<CompanyUserAccess> {
  const user = assertAuthenticated();
  const tenant = getActiveCompany();

  const userDocRef = doc(firestoreDB, "users", user.uid);
  const snap = await getDoc(userDocRef);
  const data = (snap.data() || {}) as any;

  const role = resolveCompanyRole(data.role);
  const allowedSubCompanies: string[] = Array.isArray(data.allowedSubCompanies)
    ? data.allowedSubCompanies.map((id: unknown) => String(id))
    : [];

  // Ensure base metadata is present without overwriting existing custom fields
  const updatePayload: Record<string, unknown> = {};
  if (!data.companyId) updatePayload.companyId = tenant.id;
  if (!data.createdAt) updatePayload.createdAt = serverTimestamp();
  if (!data.role) updatePayload.role = role;
  if (!data.allowedSubCompanies) updatePayload.allowedSubCompanies = allowedSubCompanies;

  if (Object.keys(updatePayload).length > 0) {
    await updateDoc(userDocRef, updatePayload);
  }

  return {
    userId: user.uid,
    displayName: user.displayName || user.email || "User",
    email: user.email || "",
    companyId: tenant.id,
    role,
    allowedSubCompanies,
  };
}

function getSubCompaniesCollection() {
  const path = getTenantCollectionPath("subCompanies");
  return collection(firestoreDB, ...path);
}

function getYearsCollection(subCompanyId: string) {
  const base = getTenantCollectionPath("subCompanies");
  return collection(firestoreDB, ...base, subCompanyId, "years");
}

function getModuleCollection(
  module: ERPModule,
  subCompanyId: string,
  year: number,
) {
  const base = getTenantCollectionPath("subCompanies");
  return collection(firestoreDB, ...base, subCompanyId, "years", String(year), module);
}

function getActivityLogsCollection() {
  const base = getTenantCollectionPath("activityLogs");
  return collection(firestoreDB, ...base);
}

async function ensureYearDocument(
  subCompanyId: string,
  year: number,
  performedBy: string,
) {
  const yearsCol = getYearsCollection(subCompanyId);
  const yearDocRef = doc(yearsCol, String(year));
  const snap = await getDoc(yearDocRef);
  if (!snap.exists()) {
    await updateDoc(yearDocRef, {
      year,
      createdAt: serverTimestamp(),
      createdBy: performedBy,
    }).catch(async () => {
      // If document does not exist, updateDoc will fail; fall back to setDoc
      await (await import("firebase/firestore")).setDoc(yearDocRef, {
        year,
        createdAt: serverTimestamp(),
        createdBy: performedBy,
      });
    });
  }
}

async function logActivity(params: {
  action: ActivityAction;
  module: ERPModule;
  recordId: string;
  companyId: CompanyId;
  subCompanyId: SubCompanyId;
  year: YearValue;
  performedBy: string;
}) {
  const ref = getActivityLogsCollection();
  await addDoc(ref, {
    action: params.action,
    module: params.module,
    recordId: params.recordId,
    companyId: params.companyId,
    subCompanyId: params.subCompanyId,
    year: params.year,
    performedBy: params.performedBy,
    timestamp: serverTimestamp(),
  });
}

/**
 * Public API: Sub Companies
 */

export async function listSubCompanies(): Promise<SubCompany[]> {
  const access = await getCurrentUserAccess();
  const col = getSubCompaniesCollection();
  const q = query(col, orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      companyId: String(data.companyId || access.companyId),
      name: String(data.name || d.id),
      createdAt: data.createdAt ? (data.createdAt.toDate?.() ?? null) : null,
      createdBy: String(data.createdBy || ""),
    };
  });
}

export async function createSubCompany(name: string): Promise<SubCompany> {
  const access = await getCurrentUserAccess();
  if (access.role !== "admin") {
    throw new Error("Only admins can create sub companies");
  }

  const col = getSubCompaniesCollection();
  const docRef = await addDoc(col, {
    name: String(name || "Sub Company").trim() || "Sub Company",
    companyId: access.companyId,
    createdAt: serverTimestamp(),
    createdBy: access.userId,
  });

  const snap = await getDoc(docRef);
  const data = snap.data() as any;
  return {
    id: docRef.id,
    companyId: String(data.companyId || access.companyId),
    name: String(data.name || docRef.id),
    createdAt: data.createdAt ? (data.createdAt.toDate?.() ?? null) : null,
    createdBy: String(data.createdBy || access.userId),
  };
}

/**
 * Public API: Sales module (CRUD)
 */

function assertCanAccessSubCompany(
  access: CompanyUserAccess,
  subCompanyId: string,
) {
  if (access.role === "admin") return;

  if (access.role === "manager") {
    if (access.allowedSubCompanies.length > 0 && !access.allowedSubCompanies.includes(subCompanyId)) {
      throw new Error("Manager is not allowed to access this sub company");
    }
    return;
  }

  if (access.role === "staff") {
    if (access.allowedSubCompanies.length > 0 && !access.allowedSubCompanies.includes(subCompanyId)) {
      throw new Error("Staff is not allowed to access this sub company");
    }
  }
}

export interface CreateSalesInput {
  subCompanyId: string;
  year: number;
  data: Record<string, unknown>;
}

export async function createSalesRecord(input: CreateSalesInput): Promise<ERPRecord> {
  const access = await getCurrentUserAccess();
  assertCanAccessSubCompany(access, input.subCompanyId);

  await ensureYearDocument(input.subCompanyId, input.year, access.userId);

  const col = getModuleCollection("sales", input.subCompanyId, input.year);
  const docRef = await addDoc(col, {
    data: input.data,
    companyId: access.companyId,
    subCompanyId: input.subCompanyId,
    year: input.year,
    createdBy: access.userId,
    createdByName: access.displayName,
    createdAt: serverTimestamp(),
  });

  await logActivity({
    action: "CREATE",
    module: "sales",
    recordId: docRef.id,
    companyId: access.companyId,
    subCompanyId: input.subCompanyId,
    year: input.year,
    performedBy: access.userId,
  });

  const snap = await getDoc(docRef);
  const data = snap.data() as any;
  return {
    id: docRef.id,
    data: data.data || {},
    companyId: String(data.companyId || access.companyId),
    subCompanyId: String(data.subCompanyId || input.subCompanyId),
    year: Number(data.year || input.year),
    createdBy: String(data.createdBy || access.userId),
    createdByName: String(data.createdByName || access.displayName),
    createdAt: data.createdAt ? (data.createdAt.toDate?.() ?? null) : null,
    updatedBy: data.updatedBy ? String(data.updatedBy) : undefined,
    updatedAt: data.updatedAt ? (data.updatedAt.toDate?.() ?? null) : undefined,
  };
}

export interface ListSalesInput {
  subCompanyId: string;
  year: number;
}

export async function listSalesRecords(input: ListSalesInput): Promise<ERPRecord[]> {
  const access = await getCurrentUserAccess();
  assertCanAccessSubCompany(access, input.subCompanyId);

  const col = getModuleCollection("sales", input.subCompanyId, input.year);
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc")];

  if (access.role === "staff") {
    constraints.push(where("createdBy", "==", access.userId));
  }

  const q = query(col, ...constraints);
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      data: data.data || {},
      companyId: String(data.companyId || access.companyId),
      subCompanyId: String(data.subCompanyId || input.subCompanyId),
      year: Number(data.year || input.year),
      createdBy: String(data.createdBy || access.userId),
      createdByName: String(data.createdByName || access.displayName),
      createdAt: data.createdAt ? (data.createdAt.toDate?.() ?? null) : null,
      updatedBy: data.updatedBy ? String(data.updatedBy) : undefined,
      updatedAt: data.updatedAt ? (data.updatedAt.toDate?.() ?? null) : undefined,
    };
  });
}

export interface UpdateSalesInput {
  id: string;
  subCompanyId: string;
  year: number;
  data: Record<string, unknown>;
}

export async function updateSalesRecord(input: UpdateSalesInput): Promise<ERPRecord> {
  const access = await getCurrentUserAccess();
  assertCanAccessSubCompany(access, input.subCompanyId);

  const col = getModuleCollection("sales", input.subCompanyId, input.year);
  const ref = doc(col, input.id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("Sales record not found");
  }

  const existing = snap.data() as any;

  if (access.role === "staff" && String(existing.createdBy || "") !== access.userId) {
    throw new Error("Staff can only modify their own records");
  }

  await updateDoc(ref, {
    data: input.data,
    updatedBy: access.userId,
    updatedAt: serverTimestamp(),
  });

  await logActivity({
    action: "UPDATE",
    module: "sales",
    recordId: ref.id,
    companyId: access.companyId,
    subCompanyId: input.subCompanyId,
    year: input.year,
    performedBy: access.userId,
  });

  const updatedSnap = await getDoc(ref);
  const data = updatedSnap.data() as any;

  return {
    id: ref.id,
    data: data.data || {},
    companyId: String(data.companyId || access.companyId),
    subCompanyId: String(data.subCompanyId || input.subCompanyId),
    year: Number(data.year || input.year),
    createdBy: String(data.createdBy || access.userId),
    createdByName: String(data.createdByName || access.displayName),
    createdAt: data.createdAt ? (data.createdAt.toDate?.() ?? null) : null,
    updatedBy: data.updatedBy ? String(data.updatedBy) : undefined,
    updatedAt: data.updatedAt ? (data.updatedAt.toDate?.() ?? null) : undefined,
  };
}

export interface DeleteSalesInput {
  id: string;
  subCompanyId: string;
  year: number;
}

export async function deleteSalesRecord(input: DeleteSalesInput): Promise<void> {
  const access = await getCurrentUserAccess();
  assertCanAccessSubCompany(access, input.subCompanyId);

  const col = getModuleCollection("sales", input.subCompanyId, input.year);
  const ref = doc(col, input.id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return;
  }

  const existing = snap.data() as any;

  if (access.role === "staff" && String(existing.createdBy || "") !== access.userId) {
    throw new Error("Staff can only delete their own records");
  }

  await deleteDoc(ref);

  await logActivity({
    action: "DELETE",
    module: "sales",
    recordId: ref.id,
    companyId: access.companyId,
    subCompanyId: input.subCompanyId,
    year: input.year,
    performedBy: access.userId,
  });
}

