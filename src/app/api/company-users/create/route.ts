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
        // Fallback to owner access
      }
    }

    const body = await request.json();
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");

    if (!username || username.length < 2) {
      return NextResponse.json({ error: "Username required (min 2 characters)" }, { status: 400 });
    }
    if (username.includes("@") || username.includes(".com") || username.includes(".in")) {
      return NextResponse.json(
        { error: "Invalid username format! Do not use @, email or domain names (e.g. rahul, sales1, omsharma)." },
        { status: 400 }
      );
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
    let requesterRole: string = "owner"; // Default to owner as logged-in user managing company

    const companySnap = await db.collection("companies").doc(companyId).get();
    const companyData = companySnap.exists ? (companySnap.data() as { createdBy?: string }) : {};

    if (isSuperAdmin || companyData.createdBy === currentUserId || !companyData.createdBy) {
      requesterRole = "owner";
    } else {
      const memberRef = db.collection("companyMembers").doc(`${companyId}_${currentUserId}`);
      const memberSnap = await memberRef.get();
      if (memberSnap.exists) {
        const memberData = memberSnap.data() as { role?: string };
        requesterRole = memberData.role || "member";
      } else {
        requesterRole = "owner"; // Company owner / creator has full authority
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
