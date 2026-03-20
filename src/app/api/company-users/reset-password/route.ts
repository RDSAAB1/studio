/**
 * Reset password for a company user. Returns new password once. Only owner/admin can reset.
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { hash } from "bcryptjs";

export const dynamic = 'force-static';

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCxqbx1KpLRo7GG0BsjQC3A6ANIS_1x_KU";

function randomPassword(length = 10): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < length; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

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
    const currentUserId = verifyData?.users?.[0]?.localId;
    if (!currentUserId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await request.json();
    const userKey = String(body?.userKey || body?.userId || "").trim();
    const companyId = String(body?.companyId || "").trim();
    if (!userKey || !companyId) {
      return NextResponse.json({ error: "userKey and companyId required" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const memberRef = db.collection("companyMembers").doc(`${companyId}_${currentUserId}`);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) {
      const companySnap = await db.collection("companies").doc(companyId).get();
      const companyData = companySnap.exists ? (companySnap.data() as { createdBy?: string }) : {};
      if (companyData.createdBy !== currentUserId) {
        return NextResponse.json({ error: "You are not a member of this company" }, { status: 403 });
      }
    } else {
      const memberData = memberSnap.data() as { role?: string };
      const role = memberData.role || "member";
      if (role !== "owner" && role !== "admin") {
        return NextResponse.json({ error: "Only owner or admin can reset passwords" }, { status: 403 });
      }
    }

    const userRef = db.collection("companyUsers").doc(userKey);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const userData = userSnap.data() as { companyId?: string };
    if (userData.companyId !== companyId) {
      return NextResponse.json({ error: "User not in this company" }, { status: 403 });
    }

    const newPassword = randomPassword(10);
    const passwordHash = await hash(newPassword, 10);
    await userRef.update({ passwordHash });

    return NextResponse.json({
      success: true,
      username: (userSnap.data() as { username?: string }).username || "",
      password: newPassword,
      message: "Password reset. Share the new password with the user.",
    });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("company-users reset-password error:", e);
    return NextResponse.json({ error: e.message || "Failed to reset password" }, { status: 500 });
  }
}
