/**
 * Create company in companies collection (ERP structure).
 * Used by "Create New Company" flow - no tenant creation.
 * companies/{companyId}/{subCompanyId}/{seasonKey}
 */

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { firestoreDB } from "./firebase";

type FirestorePath = [string, ...string[]];

function nameToId(raw: string, fallback: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/\//g, "_");
}

function subCompanyPath(companyId: string, subCompanyId: string): FirestorePath {
  return ["companies", companyId, subCompanyId];
}

function seasonPath(
  companyId: string,
  subCompanyId: string,
  seasonKey: string
): FirestorePath {
  return ["companies", companyId, subCompanyId, seasonKey];
}

export interface CompanySetupResult {
  companyId: string;
  subCompanyId: string;
  seasonKey: string;
}

/** Create company + default subCompany (MAIN) + default season in companies collection. */
export async function createCompanyForNewUser(
  companyName: string,
  createdByUserId?: string
): Promise<CompanySetupResult> {
  const companyId = nameToId(companyName, "default_company");
  const subCompanyId = "main";
  const seasonKey = String(new Date().getFullYear());

  await setDoc(
    doc(firestoreDB, "companies", companyId),
    {
      name: String(companyName || "Company").trim() || "Company",
      createdBy: createdByUserId || "signup",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await setDoc(
    doc(firestoreDB, ...subCompanyPath(companyId, subCompanyId)),
    {
      name: "MAIN",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await setDoc(
    doc(firestoreDB, ...seasonPath(companyId, subCompanyId, seasonKey)),
    {
      seasonKey,
      seasonName: seasonKey,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Register in company index for listErpCompanies
  const companyRef = doc(firestoreDB, "companies", companyId);
  const snap = await getDoc(companyRef);
  const existing = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
  const subCompanies =
    (existing.subCompanies as Record<
      string,
      { name: string; seasons: Record<string, string> }
    >) || {};
  const sub = subCompanies[subCompanyId] || {
    name: "MAIN",
    seasons: {} as Record<string, string>,
  };
  sub.seasons = sub.seasons || {};
  sub.seasons[seasonKey] = seasonKey;
  subCompanies[subCompanyId] = sub;

  await setDoc(
    companyRef,
    {
      name: String(companyName || "Company").trim() || "Company",
      subCompanies,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Add creator to companyMembers so they see this company in list
  if (createdByUserId) {
    await setDoc(
      doc(firestoreDB, "companyMembers", `${companyId}_${createdByUserId}`),
      {
        companyId,
        userId: createdByUserId,
        role: "owner",
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return { companyId, subCompanyId, seasonKey };
}
