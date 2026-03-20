/**
 * Company user changes their own password. Requires current password.
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { hash } from "bcryptjs";
import { compare } from "bcryptjs";

export const dynamic = 'force-static';

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCxqbx1KpLRo7GG0BsjQC3A6ANIS_1x_KU";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized. Login required." }, { status: 401 });
    }

    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!verifyRes.ok) {
      return NextResponse.json({ error: "Invalid or expired login." }, { status: 401 });
    }
    const verifyData = await verifyRes.json();
    const uid = verifyData?.users?.[0]?.localId;
    if (!uid || !uid.startsWith("cu_")) {
      return NextResponse.json({ error: "Only company users can change password here." }, { status: 403 });
    }

    const body = await request.json();
    const currentPassword = String(body?.currentPassword || "");
    const newPassword = String(body?.newPassword || "");

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current password and new password required" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const userKey = uid.slice(3);
    const userRef = db.collection("companyUsers").doc(userKey);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userSnap.data() as { passwordHash?: string; username?: string };
    const isValid = await compare(currentPassword, userData.passwordHash || "");
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    const passwordHash = await hash(newPassword, 10);
    await userRef.update({ passwordHash });

    return NextResponse.json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("company-users change-password error:", e);
    return NextResponse.json({ error: e.message || "Failed to change password" }, { status: 500 });
  }
}
