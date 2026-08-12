import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email } = body || {};
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      return NextResponse.json({ success: false, error: "Invalid email" }, { status: 400 });
    }

    const db = getAdminFirestore();
    // Set userType to "extension" in the global users collection
    // This allows us to distinguish extension users from software users
    const userDoc = db.collection("users").doc(cleanEmail);
    await userDoc.set({
      email: cleanEmail,
      userType: "extension",
      isExtensionUser: true,
      updatedAt: Date.now()
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Register Extension User Error]:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to register extension user flag" }, { status: 500 });
  }
}
