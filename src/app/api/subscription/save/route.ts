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

    if (!username) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }

    const db = getAdminFirestore();
    await db.collection("subscriptions").doc(username).set({
      subscription_verified: verified,
      subscription_expiry: expiry,
      subscription_duration: duration,
      updatedAt: FieldValue.serverTimestamp()
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("Subscription save error:", e);
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}
