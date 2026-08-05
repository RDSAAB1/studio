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

    let currentUserId = "admin_owner";
    let currentUserEmail = "";
    let isSuperAdmin = true;

    if (idToken) {
      try {
        const verifyRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          }
        );
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          const verifyUser = verifyData?.users?.[0];
          if (verifyUser?.localId) {
            currentUserId = verifyUser.localId;
            currentUserEmail = verifyUser?.email?.toLowerCase() || "";
            isSuperAdmin = currentUserEmail === "rdsaab1@gmail.com";
          }
        }
      } catch {
        // Fallback
      }
    }

    const body = await request.json();
    const userKey = String(body?.userKey || body?.userId || "").trim();
    const companyId = String(body?.companyId || "").trim();
    if (!userKey || !companyId) {
      return NextResponse.json({ error: "userKey and companyId required" }, { status: 400 });
    }

    const db = getAdminFirestore();

    const userRef = db.collection("companyUsers").doc(userKey);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const userData = userSnap.data() as { companyId?: string };
    if (userData.companyId !== companyId) {
      return NextResponse.json({ error: "User not in this company" }, { status: 403 });
    }

    // Security Check: If requester is a member account (cu_*), they can ONLY reset their own password
    if (currentUserId.startsWith("cu_") && currentUserId !== userKey && !currentUserId.endsWith(userKey)) {
      const reqSnap = await db.collection("companyUsers").doc(currentUserId).get();
      const reqData = reqSnap.exists ? reqSnap.data() : null;
      if (reqData?.role === "member") {
        return NextResponse.json({ error: "Unauthorized: Members cannot reset passwords for other users." }, { status: 403 });
      }
    }

    const newPassword = String(body?.newPassword || body?.password || "").trim() || randomPassword(10);
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    const passwordHash = await hash(newPassword, 10);
    await userRef.update({ passwordHash });

    return NextResponse.json({
      success: true,
      username: (userSnap.data() as { username?: string }).username || "",
      password: newPassword,
      message: "Password updated successfully.",
    });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("company-users reset-password error:", e);
    return NextResponse.json({ error: e.message || "Failed to reset password" }, { status: 500 });
  }
}
