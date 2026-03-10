import type { User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { firestoreDB, getFirebaseAuth } from "@/lib/firebase";
import { createCompanyForNewUser } from "@/lib/create-company";

export type TenantStorageMode = "root" | "tenant";
export type TenantRole = "owner" | "admin" | "member";

export type TenantSummary = {
  id: string;
  name: string;
  storageMode: TenantStorageMode;
  role: TenantRole;
};

export type FirestorePath = [string, ...string[]];

type ActiveTenantStored = {
  id: string;
  storageMode: TenantStorageMode;
  name?: string;
};

const ACTIVE_TENANT_STORAGE_KEY = "activeTenant";
const TENANT_LIST_STORAGE_KEY = "tenantList";
const PENDING_COMPANY_NAME_KEY = "pendingCompanyName";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getActiveTenant(): ActiveTenantStored | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ActiveTenantStored> | null;
    if (!parsed?.id) return null;
    const storageMode: TenantStorageMode =
      parsed.storageMode === "tenant" ? "tenant" : "root";
    return { id: parsed.id, storageMode, name: parsed.name };
  } catch {
    return null;
  }
}

export function setActiveTenant(active: ActiveTenantStored) {
  if (!isBrowser()) return;
  localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, JSON.stringify(active));
  window.dispatchEvent(
    new CustomEvent("tenant:changed", { detail: { activeTenant: active } })
  );
}

export function getCachedTenants(): TenantSummary[] {
  if (!isBrowser()) return [];
  const raw = localStorage.getItem(TENANT_LIST_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as TenantSummary[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setCachedTenants(tenants: TenantSummary[]) {
  if (!isBrowser()) return;
  localStorage.setItem(TENANT_LIST_STORAGE_KEY, JSON.stringify(tenants));
  window.dispatchEvent(
    new CustomEvent("tenant:list-updated", { detail: { tenants } })
  );
}

const ERP_SELECTION_KEY = "erpSelection";
const ERP_MODE_KEY = "erpMode";

/** Call when ERP companies exist - prevents tenant fallback when no season selected */
export function setErpMode(active: boolean) {
  if (!isBrowser()) return;
  localStorage.setItem(ERP_MODE_KEY, active ? "1" : "0");
  window.dispatchEvent(new CustomEvent("erp:mode-changed", { detail: { active } }));
}

function getErpMode(): boolean {
  if (!isBrowser()) return false;
  return localStorage.getItem(ERP_MODE_KEY) === "1";
}

function getErpSelection(): { companyId: string; subCompanyId: string; seasonKey: string } | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(ERP_SELECTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { companyId?: string; subCompanyId?: string; seasonKey?: string };
    if (parsed?.companyId && parsed?.subCompanyId && parsed?.seasonKey) return parsed as { companyId: string; subCompanyId: string; seasonKey: string };
  } catch {}
  return null;
}

/** Set ERP selection (used when creating company in companies collection). */
export function setErpSelectionStorage(sel: {
  companyId: string;
  subCompanyId: string;
  seasonKey: string;
}) {
  if (!isBrowser()) return;
  localStorage.setItem(ERP_SELECTION_KEY, JSON.stringify(sel));
  window.dispatchEvent(new CustomEvent("erp:selection-changed", { detail: sel }));
}

/** ERP path: companies/companyId/subCompanyId/seasonKey/collectionName */
export function getErpCollectionPath(collectionName: string, erp: { companyId: string; subCompanyId: string; seasonKey: string }): FirestorePath {
  return ["companies", erp.companyId, erp.subCompanyId, erp.seasonKey, collectionName] as FirestorePath;
}

/** Returns a unique suffix for storage keys (lastSync, etc.) so data is never mixed across tenants/companies */
export function getStorageKeySuffix(): string {
  const erp = getErpSelection();
  if (erp) {
    return `${erp.companyId}_${erp.subCompanyId}_${erp.seasonKey}`;
  }
  const active = getActiveTenant();
  if (active?.id) {
    return `tenant_${active.id}`;
  }
  return "default";
}

export function getTenantCollectionPath(collectionName: string): FirestorePath {
  const globalCollections = new Set(["users", "tenants", "tenantMembers", "tenantInvites", "companies"]);
  if (globalCollections.has(collectionName)) {
    return [collectionName] as FirestorePath;
  }
  const erp = getErpSelection();
  if (erp) {
    return getErpCollectionPath(collectionName, erp);
  }
  if (getErpMode()) {
    return ["companies", "_none", "_none", "_none", collectionName] as FirestorePath;
  }
  if (isBrowser() && localStorage.getItem(ERP_SELECTION_KEY)) {
    return ["companies", "_none", "_none", "_none", collectionName] as FirestorePath;
  }
  const active = getActiveTenant();
  if (active?.storageMode === "tenant" && active.id) {
    return ["tenants", active.id, collectionName] as FirestorePath;
  }
  return ["companies", "_none", "_none", "_none", collectionName] as FirestorePath;
}

export function getTenantDocPath(collectionName: string, docId: string): FirestorePath {
  return [...getTenantCollectionPath(collectionName), docId] as FirestorePath;
}

function deriveTenantName(user: User) {
  const email = String(user.email || "").trim();
  if (!email) return "Company";
  const domainPart = email.split("@")[1]?.split(".")[0];
  const name = domainPart ? domainPart : email.split("@")[0];
  return name ? name.toUpperCase() : "Company";
}

/** Set before signup when user chooses "Create New Company" - ensureTenantForUser will use this name. */
export function setPendingCompanyName(name: string) {
  if (!isBrowser()) return;
  const v = String(name || "").trim();
  if (v) sessionStorage.setItem(PENDING_COMPANY_NAME_KEY, v);
  else sessionStorage.removeItem(PENDING_COMPANY_NAME_KEY);
}

function consumePendingCompanyName(): string | null {
  if (!isBrowser()) return null;
  const v = sessionStorage.getItem(PENDING_COMPANY_NAME_KEY);
  sessionStorage.removeItem(PENDING_COMPANY_NAME_KEY);
  return v && v.trim() ? v.trim() : null;
}

export async function ensureTenantForUser(user: User): Promise<{
  active: ActiveTenantStored;
  tenants: TenantSummary[];
}> {
  const userId = user.uid;

  const userDocRef = doc(firestoreDB, "users", userId);
  const userSnap = await getDoc(userDocRef);
  if (!userSnap.exists()) {
    await setDoc(
      userDocRef,
      {
        email: user.email || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } else {
    await setDoc(
      userDocRef,
      { email: user.email || "", updatedAt: serverTimestamp() },
      { merge: true }
    );
  }

  const membersRef = collection(firestoreDB, "tenantMembers");
  const membersSnap = await getDocs(
    query(membersRef, where("userId", "==", userId))
  );

  if (membersSnap.empty) {
    const pendingCompanyName = consumePendingCompanyName();
    if (pendingCompanyName) {
      // Create in companies collection (ERP structure), not tenants
      const { companyId, subCompanyId, seasonKey } =
        await createCompanyForNewUser(pendingCompanyName, userId);
      setErpMode(true);
      setErpSelectionStorage({ companyId, subCompanyId, seasonKey });
      const fallback: ActiveTenantStored = { id: "root", storageMode: "root" };
      setActiveTenant(fallback);
      setCachedTenants([]);
      if (typeof window !== "undefined") {
        await clearLocalDataForContextSwitch();
        window.location.reload();
      }
      return { active: fallback, tenants: [] };
    }

    // Admin returning: user has companies (created or joined) but no tenantMembers
    const { listErpCompanies } = await import("@/lib/erp-migration");
    const erpCompanies = await listErpCompanies();
    if (erpCompanies.length > 0) {
      const stored = getErpSelection();
      const company = stored ? erpCompanies.find((c) => c.id === stored.companyId) : null;
      const sub = company && stored ? company.subCompanies.find((s) => s.id === stored.subCompanyId) : null;
      const seasonKey = sub && stored && sub.seasons.some((s) => s.key === stored.seasonKey) ? stored.seasonKey : sub?.seasons[0]?.key;
      const storedValid = company && sub && seasonKey;
      if (storedValid) {
        // Preserve user's selection - do NOT overwrite on refresh
        setErpMode(true);
        setActiveTenant({ id: "root", storageMode: "root" });
        setCachedTenants([]);
        return { active: { id: "root", storageMode: "root" }, tenants: [] };
      }
      const first = erpCompanies[0];
      const subWithSeason = first.subCompanies.find((s) => s.seasons.length > 0);
      const subFallback = subWithSeason ?? first.subCompanies[0];
      const season = subFallback?.seasons[0];
      if (first && subFallback && season) {
        setErpMode(true);
        setErpSelectionStorage({ companyId: first.id, subCompanyId: subFallback.id, seasonKey: season.key });
        const fallback: ActiveTenantStored = { id: "root", storageMode: "root" };
        setActiveTenant(fallback);
        setCachedTenants([]);
        return { active: fallback, tenants: [] };
      }
    }

    const preferredName = deriveTenantName(user);
    const tenantsRef = collection(firestoreDB, "tenants");
    const tenantDocRef = await addDoc(tenantsRef, {
      name: preferredName,
      storageMode: "root" satisfies TenantStorageMode,
      createdAt: serverTimestamp(),
      createdBy: userId,
    });

    await setDoc(doc(firestoreDB, "tenantMembers", `${tenantDocRef.id}_${userId}`), {
      tenantId: tenantDocRef.id,
      userId,
      role: "owner" satisfies TenantRole,
      createdAt: serverTimestamp(),
    });

    await setDoc(userDocRef, { activeTenantId: tenantDocRef.id }, { merge: true });
  }

  const updatedMembersSnap = await getDocs(
    query(membersRef, where("userId", "==", userId))
  );

  const tenants: TenantSummary[] = [];
  for (const memberDoc of updatedMembersSnap.docs) {
    const data = memberDoc.data() as any;
    const tenantId = String(data.tenantId || "").trim();
    if (!tenantId) continue;

    const tenantSnap = await getDoc(doc(firestoreDB, "tenants", tenantId));
    if (!tenantSnap.exists()) continue;
    const tenantData = tenantSnap.data() as any;
    const storageMode: TenantStorageMode =
      tenantData.storageMode === "tenant" ? "tenant" : "root";
    const role: TenantRole =
      tenantData.role === "admin" || tenantData.role === "member"
        ? tenantData.role
        : data.role === "admin" || data.role === "member"
          ? data.role
          : "owner";
    tenants.push({
      id: tenantId,
      name: String(tenantData.name || tenantId),
      storageMode,
      role,
    });
  }

  const storedActive = getActiveTenant();
  const storedActiveValid =
    storedActive && tenants.some((t) => t.id === storedActive.id);

  let desiredTenantId = storedActiveValid ? storedActive!.id : "";
  if (!desiredTenantId) {
    const latestUserSnap = await getDoc(userDocRef);
    const userData = latestUserSnap.exists() ? (latestUserSnap.data() as any) : null;
    const userPreferred = String(userData?.activeTenantId || "").trim();
    if (userPreferred && tenants.some((t) => t.id === userPreferred)) {
      desiredTenantId = userPreferred;
    } else {
      desiredTenantId = tenants[0]?.id || "";
    }
  }

  const desired = tenants.find((t) => t.id === desiredTenantId) || tenants[0];
  if (!desired) {
    const fallback: ActiveTenantStored = { id: "root", storageMode: "root" };
    setActiveTenant(fallback);
    setCachedTenants([]);
    return { active: fallback, tenants: [] };
  }

  const active: ActiveTenantStored = {
    id: desired.id,
    storageMode: desired.storageMode,
    name: desired.name,
  };

  setActiveTenant(active);
  setCachedTenants(tenants);
  await setDoc(userDocRef, { activeTenantId: desired.id }, { merge: true });

  return { active, tenants };
}

function getCurrentUserId(): string {
  const auth = getFirebaseAuth();
  const uid = (auth as any)?.currentUser?.uid as string | undefined;
  if (!uid) {
    throw new Error("Not authenticated");
  }
  return uid;
}

/** Get current user's role in a company. Returns "owner" | "admin" | "member" | null. */
export async function getCompanyMemberRole(companyId: string): Promise<string | null> {
  const userId = getFirebaseAuth()?.currentUser?.uid;
  if (!userId || !companyId) return null;
  const memberRef = doc(firestoreDB, "companyMembers", `${companyId}_${userId}`);
  const snap = await getDoc(memberRef);
  if (snap.exists()) {
    return (snap.data() as { role?: string }).role || null;
  }
  const companyRef = doc(firestoreDB, "companies", companyId);
  const companySnap = await getDoc(companyRef);
  if (companySnap.exists() && (companySnap.data() as { createdBy?: string }).createdBy === userId) {
    return "owner";
  }
  return null;
}

/** Get current user's role in active tenant. Returns "owner" | "admin" | "member" | null. */
export async function getTenantMemberRole(tenantId: string): Promise<string | null> {
  const userId = getFirebaseAuth()?.currentUser?.uid;
  if (!userId || !tenantId) return null;
  const memberRef = doc(firestoreDB, "tenantMembers", `${tenantId}_${userId}`);
  const snap = await getDoc(memberRef);
  if (!snap.exists()) return null;
  return (snap.data() as { role?: string }).role || null;
}

export async function createTenant(name: string): Promise<TenantSummary> {
  const userId = getCurrentUserId();
  const tenantsRef = collection(firestoreDB, "tenants");
  const tenantDocRef = await addDoc(tenantsRef, {
    name: String(name || "Company").trim() || "Company",
    storageMode: "tenant" satisfies TenantStorageMode,
    createdAt: serverTimestamp(),
    createdBy: userId,
  });

  await setDoc(doc(firestoreDB, "tenantMembers", `${tenantDocRef.id}_${userId}`), {
    tenantId: tenantDocRef.id,
    userId,
    role: "owner" satisfies TenantRole,
    createdAt: serverTimestamp(),
  });

  const tenant: TenantSummary = {
    id: tenantDocRef.id,
    name: String(name || "Company").trim() || tenantDocRef.id,
    storageMode: "tenant",
    role: "owner",
  };

  const nextTenants = [...getCachedTenants().filter((t) => t.id !== tenant.id), tenant];
  setCachedTenants(nextTenants);
  await activateTenant(tenant);
  return tenant;
}

export async function createTenantInviteCode(tenantId: string, role: TenantRole = "member"): Promise<string> {
  const userId = getCurrentUserId();
  const codeBase = `${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-2)}`.toUpperCase();
  const code = codeBase.replace(/[^A-Z0-9]/g, "").slice(0, 8);
  await setDoc(doc(firestoreDB, "tenantInvites", code), {
    tenantId,
    role,
    createdAt: serverTimestamp(),
    createdBy: userId,
    active: true,
  });
  return code;
}

/** Create invite code for company (companies collection). Joining adds user to companyMembers. Only owner/admin can create. */
export async function createCompanyInviteCode(companyId: string, role: TenantRole = "member"): Promise<string> {
  const userId = getCurrentUserId();
  const memberRef = doc(firestoreDB, "companyMembers", `${companyId}_${userId}`);
  const memberSnap = await getDoc(memberRef);
  if (!memberSnap.exists()) throw new Error("You are not a member of this company");
  const memberData = memberSnap.data() as { role?: string };
  const myRole = memberData.role || "member";
  if (myRole !== "owner" && myRole !== "admin") throw new Error("Only owner or admin can generate invite codes");

  const codeBase = `${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-2)}`.toUpperCase();
  const code = codeBase.replace(/[^A-Z0-9]/g, "").slice(0, 8);
  await setDoc(doc(firestoreDB, "companyInvites", code), {
    companyId,
    role,
    createdAt: serverTimestamp(),
    createdBy: userId,
    active: true,
  });
  return code;
}

/** Join company via invite code. Adds user to companyMembers. */
export async function joinCompanyByInviteCode(codeRaw: string): Promise<void> {
  const userId = getCurrentUserId();
  const code = String(codeRaw || "").trim().toUpperCase();
  if (!code) throw new Error("Invalid invite code");

  const inviteRef = doc(firestoreDB, "companyInvites", code);
  const inviteSnap = await getDoc(inviteRef);
  if (!inviteSnap.exists()) throw new Error("Invite code not found");

  const invite = inviteSnap.data() as { companyId?: string; active?: boolean };
  if (invite.active === false) throw new Error("Invite code is inactive");
  const companyId = String(invite.companyId || "").trim();
  if (!companyId) throw new Error("Invite code is invalid");

  const companySnap = await getDoc(doc(firestoreDB, "companies", companyId));
  if (!companySnap.exists()) throw new Error("Company not found");

  await setDoc(
    doc(firestoreDB, "companyMembers", `${companyId}_${userId}`),
    {
      companyId,
      userId,
      role: "member",
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  const companyData = companySnap.data() as { name?: string; subCompanies?: Record<string, { seasons?: Record<string, string> }> };
  const subCompanies = companyData.subCompanies || {};
  const firstSub = Object.entries(subCompanies)[0];
  const subCompanyId = firstSub?.[0] || "main";
  const seasons = firstSub?.[1]?.seasons || {};
  const seasonKey = Object.keys(seasons)[0] || String(new Date().getFullYear());

  setErpMode(true);
  setErpSelectionStorage({ companyId, subCompanyId, seasonKey });
  if (typeof window !== "undefined") {
    await clearLocalDataForContextSwitch();
    window.location.reload();
  }
}

export async function joinTenantByInviteCode(codeRaw: string): Promise<TenantSummary> {
  const userId = getCurrentUserId();
  const code = String(codeRaw || "").trim().toUpperCase();
  if (!code) throw new Error("Invalid invite code");

  const inviteRef = doc(firestoreDB, "tenantInvites", code);
  const inviteSnap = await getDoc(inviteRef);
  if (!inviteSnap.exists()) throw new Error("Invite code not found");

  const invite = inviteSnap.data() as any;
  if (invite.active === false) throw new Error("Invite code is inactive");
  const tenantId = String(invite.tenantId || "").trim();
  if (!tenantId) throw new Error("Invite code is invalid");

  const tenantSnap = await getDoc(doc(firestoreDB, "tenants", tenantId));
  if (!tenantSnap.exists()) throw new Error("Tenant not found");

  const tenantData = tenantSnap.data() as any;
  const storageMode: TenantStorageMode = tenantData.storageMode === "tenant" ? "tenant" : "root";
  const role: TenantRole = invite.role === "admin" || invite.role === "member" ? invite.role : "member";

  await setDoc(doc(firestoreDB, "tenantMembers", `${tenantId}_${userId}`), {
    tenantId,
    userId,
    role,
    createdAt: serverTimestamp(),
  }, { merge: true });

  const tenant: TenantSummary = {
    id: tenantId,
    name: String(tenantData.name || tenantId),
    storageMode,
    role,
  };

  const nextTenants = [...getCachedTenants().filter((t) => t.id !== tenant.id), tenant];
  setCachedTenants(nextTenants);
  await activateTenant(tenant);
  return tenant;
}

export async function activateTenant(tenant: Pick<TenantSummary, "id" | "name" | "storageMode">): Promise<void> {
  const userId = getCurrentUserId();
  setActiveTenant({ id: tenant.id, name: tenant.name, storageMode: tenant.storageMode });
  await setDoc(doc(firestoreDB, "users", userId), { activeTenantId: tenant.id }, { merge: true });

  if (typeof window !== "undefined") {
    await clearLocalDataForContextSwitch();
    window.location.reload();
  }
}

/** On company/tenant switch we only invalidate the in-memory DB reference and reload.
 * We do NOT delete IndexedDB or clear tables: each company has its own DB (bizsuiteDB_v2_<suffix>),
 * so when the user switches back to a company, their data is still in local and we avoid extra Firebase reads.
 * lastSync keys are already per-context (they include getStorageKeySuffix()), so no need to clear them. */
export async function clearLocalDataForContextSwitch(): Promise<void> {
  if (typeof window === "undefined") return;
  // No-op: DB is per-company; context change listener in database.ts invalidates the instance so next access opens the new context's DB.
}
