import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username || "").trim().toLowerCase();

    if (!username) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }

    const companyData = {
      username,
      firmName: String(body?.firmName || "").trim(),
      firmAddress: String(body?.firmAddress || body?.address || "").trim(),
      mandiName: String(body?.mandiName || "").trim(),
      mandiType: String(body?.mandiType || "NON APMC").trim(),
      licenseNo1: String(body?.licenseNo1 || body?.licenseNo || "").trim(),
      licenseNo2: String(body?.licenseNo2 || "").trim(),
      registerNo: String(body?.registerNo || "").trim(),
      commodity: String(body?.commodity || "धान").trim(),
      fy: String(body?.fy || body?.financialYear || "2024-25").trim(),
      updatedAt: FieldValue.serverTimestamp()
    };

    const db = getAdminFirestore();
    await db.collection("companyDetails").doc(username).set(companyData, { merge: true });

    return NextResponse.json({ success: true, data: companyData });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("Company details save error:", e);
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}
