/**
 * Extension user registration — accepts simple username (e.g. "akash1") without email requirement.
 * Stores credentials in Firestore `extensionUsers` collection with bcrypt-hashed password.
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { hash } from "bcryptjs";

export const dynamic = "force-dynamic";

function toKey(str: string): string {
  return String(str || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawUsername = String(body?.username || "").trim();
    const password = String(body?.password || "");

    if (!rawUsername || rawUsername.length < 3) {
      return NextResponse.json({ success: false, error: "Username must be at least 3 characters." }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ success: false, error: "Password must be at least 6 characters." }, { status: 400 });
    }

    // Allow only letters, numbers, underscore, dot, hyphen, @ (for email usernames)
    if (!/^[a-zA-Z0-9._@\-]+$/.test(rawUsername)) {
      return NextResponse.json({ success: false, error: "Username can only contain letters, numbers, _, ., @, -" }, { status: 400 });
    }

    const username = rawUsername;
    const usernameLower = rawUsername.toLowerCase();
    const docId = toKey(rawUsername);

    const db = getAdminFirestore();

    // Check if username already exists
    const existingSnap = await db.collection("extensionUsers").where("usernameLower", "==", usernameLower).limit(1).get();
    if (!existingSnap.empty) {
      return NextResponse.json({ success: false, error: "Username already taken. Please choose another." }, { status: 409 });
    }

    // Hash password
    const passwordHash = await hash(password, 10);

    // Save to Firestore
    await db.collection("extensionUsers").doc(docId).set({
      username,
      usernameLower,
      passwordHash,
      isExtensionUser: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    return NextResponse.json({ success: true, username });
  } catch (error: any) {
    console.error("[Register Extension User Error]:", error);
    return NextResponse.json({ success: false, error: error.message || "Registration failed" }, { status: 500 });
  }
}
