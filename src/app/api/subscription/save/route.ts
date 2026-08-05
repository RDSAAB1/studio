import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username || "").trim().toLowerCase();
    const verified = body?.subscription_verified === true;
    const expiry = Number(body?.subscription_expiry || 0);
    const duration = String(body?.subscription_duration || "monthly");

    const companyId = String(body?.companyId || "").trim();
    const planLabel = String(body?.plan_label || "Active Subscription");

    if (!username && !companyId) {
      return NextResponse.json({ error: "Username or CompanyId required" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const payload = {
      subscription_verified: verified,
      subscription_expiry: expiry,
      subscription_duration: duration,
      plan_label: planLabel,
      companyId: companyId || undefined,
      updatedAt: FieldValue.serverTimestamp()
    };

    if (username) {
      await db.collection("subscriptions").doc(username).set(payload, { merge: true });
    }
    if (companyId) {
      await db.collection("subscriptions").doc(companyId).set(payload, { merge: true });
      await db.collection("companies").doc(companyId).set({ subscription: payload }, { merge: true });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("Subscription save error:", e);
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}
