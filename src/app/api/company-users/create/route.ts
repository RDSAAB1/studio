/**
 * Create a company user (username + password).
 * Simple: Store in Firestore. No Firebase Auth needed.
 * Only company owner/admin can create (verified via Firebase Auth token).
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { hash } from "bcryptjs";

export const dynamic = 'force-static';

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCxqbx1KpLRo7GG0BsjQC3A6ANIS_1x_KU";

function toKey(str: string): string {
  return String(str || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized. Login required." }, { status: 401 });
    }

    // Verify admin via Firebase Auth REST API (admin is already logged in with Firebase)
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!verifyRes.ok) {
      return NextResponse.json({ error: "Invalid or expired login. Please login again." }, { status: 401 });
    }
    const verifyData = await verifyRes.json();
    const currentUserId = verifyData?.users?.[0]?.localId;
    if (!currentUserId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await request.json();
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");

    if (!username || username.length < 2) {
      return NextResponse.json({ error: "Username required (min 2 characters)" }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password required (min 6 characters)" }, { status: 400 });
    }
    const companyId = String(body?.companyId || "").trim();
    if (!companyId) {
      return NextResponse.json({ error: "Company ID required" }, { status: 400 });
    }

    const role = String(body?.role || "member").trim().toLowerCase();
    const validRoles = ["member", "admin", "owner"];
    const finalRole = validRoles.includes(role) ? role : "member";

    const permissions = Array.isArray(body?.permissions)
      ? body.permissions.filter((p: unknown) => typeof p === "string").map((p: string) => String(p).trim()).filter(Boolean)
      : [];

    const db = getAdminFirestore();
    let requesterRole: string = "member";

    const memberRef = db.collection("companyMembers").doc(`${companyId}_${currentUserId}`);
    const memberSnap = await memberRef.get();
    if (memberSnap.exists) {
      const memberData = memberSnap.data() as { role?: string };
      requesterRole = memberData.role || "member";
    } else {
      const companySnap = await db.collection("companies").doc(companyId).get();
      const companyData = companySnap.exists ? (companySnap.data() as { createdBy?: string }) : {};
      if (companyData.createdBy === currentUserId) {
        requesterRole = "owner";
        await memberRef.set(
          { companyId, userId: currentUserId, role: "owner", createdAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      } else {
        return NextResponse.json({ error: "You are not a member of this company. Join via invite code first." }, { status: 403 });
      }
    }
    if (requesterRole !== "owner" && requesterRole !== "admin") {
      return NextResponse.json({ error: "Only owner or admin can add users" }, { status: 403 });
    }

    const userKey = `${companyId}_${toKey(username)}`;
    const userRef = db.collection("companyUsers").doc(userKey);
    const existingSnap = await userRef.get();
    if (existingSnap.exists) {
      return NextResponse.json({ error: "This username is already taken for this company" }, { status: 400 });
    }

    const passwordHash = await hash(password, 10);
    const userId = `cu_${companyId}_${toKey(username)}`;

    const userData = {
      companyId,
      username: username.trim(),
      usernameLower: username.trim().toLowerCase(),
      passwordHash,
      role: finalRole,
      permissions,
      isAdmin: finalRole === "admin" || finalRole === "owner",
      isOwner: finalRole === "owner",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: currentUserId,
    };

    try {
      await userRef.set(userData);
    } catch (writeErr: unknown) {
      const err = writeErr as { message?: string; code?: string };
      console.error("companyUsers write error:", err);
      return NextResponse.json(
        { error: `Database write failed: ${err.message || "Could not save to companyUsers collection"}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      userId,
      username: username.trim(),
      password,
      companyId,
      role: finalRole,
      permissions,
      message: "User created. Share username and password with them. They login with Username + Password only.",
    });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("company-users create error:", e);
    return NextResponse.json(
      { error: e.message || "Failed to create user" },
      { status: 500 }
    );
  }
}
