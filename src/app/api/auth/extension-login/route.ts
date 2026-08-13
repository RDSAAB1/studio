/**
 * Extension user login — verifies username + password against extensionUsers collection.
 * Returns username for use in subscription lookup.
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { compare } from "bcryptjs";

export const dynamic = "force-dynamic";

function toKey(str: string): string {
  return String(str || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawUsername = String(body?.username || "").trim();
    const password = String(body?.password || "");

    if (!rawUsername || !password) {
      return NextResponse.json({ success: false, error: "Username and password required" }, { status: 400 });
    }

    const usernameLower = rawUsername.toLowerCase();
    const docId = toKey(rawUsername);

    const db = getAdminFirestore();

    // 1. Try direct doc lookup by key
    const directDoc = await db.collection("extensionUsers").doc(docId).get();
    let userData: any = null;

    if (directDoc.exists) {
      userData = directDoc.data();
    } else {
      // 2. Fallback: query by usernameLower
      const snap = await db.collection("extensionUsers").where("usernameLower", "==", usernameLower).limit(1).get();
      if (!snap.empty) {
        userData = snap.docs[0].data();
      }
    }

    if (!userData || !userData.passwordHash) {
      return NextResponse.json({ success: false, error: "Invalid username or password" }, { status: 401 });
    }

    const isValid = await compare(password, userData.passwordHash);
    if (!isValid) {
      return NextResponse.json({ success: false, error: "Invalid username or password" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      username: userData.username || rawUsername,
      companyId: "default"
    });
  } catch (error: any) {
    console.error("[Extension Login Error]:", error);
    return NextResponse.json({ success: false, error: error.message || "Login failed" }, { status: 500 });
  }
}
