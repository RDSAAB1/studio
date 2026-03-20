/**
 * Update company user role and permissions.
 * Only owner/admin can update. Cannot change owner's role.
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

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
      return NextResponse.json({ error: "Invalid or expired login. Please login again." }, { status: 401 });
    }
    const verifyData = await verifyRes.json();
    const currentUserId = verifyData?.users?.[0]?.localId;
    if (!currentUserId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await request.json();
    const userKey = String(body?.userKey || "").trim();
    const companyId = String(body?.companyId || "").trim();

    if (!userKey || !companyId) {
      return NextResponse.json({ error: "userKey and companyId required" }, { status: 400 });
    }

    const role = String(body?.role || "member").trim().toLowerCase();
    const validRoles = ["member", "admin", "owner"];
    const finalRole = validRoles.includes(role) ? role : "member";

    const permissions = Array.isArray(body?.permissions)
      ? body.permissions.filter((p: unknown) => typeof p === "string").map((p: string) => String(p).trim()).filter(Boolean)
      : [];

    const db = getAdminFirestore();
    let requesterRole = "member";

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
      } else {
        return NextResponse.json({ error: "You are not a member of this company." }, { status: 403 });
      }
    }
    if (requesterRole !== "owner" && requesterRole !== "admin") {
      return NextResponse.json({ error: "Only owner or admin can edit user access" }, { status: 403 });
    }

    const userRef = db.collection("companyUsers").doc(userKey);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userSnap.data() as { companyId?: string; isOwner?: boolean };
    if (userData.companyId !== companyId) {
      return NextResponse.json({ error: "User does not belong to this company" }, { status: 400 });
    }
    if (userData.isOwner) {
      return NextResponse.json({ error: "Cannot change owner's access" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      role: finalRole,
      permissions,
      isAdmin: finalRole === "admin" || finalRole === "owner",
      isOwner: finalRole === "owner",
      updatedAt: FieldValue.serverTimestamp(),
    };

    await userRef.update(updateData);

    const usernameKey = userKey.startsWith(companyId + "_") ? userKey.slice(companyId.length + 1) : userKey;
    const cuUid = `cu_${companyId}_${usernameKey}`;
    const companyMemberRef = db.collection("companyMembers").doc(`${companyId}_${cuUid}`);
    const cmSnap = await companyMemberRef.get();
    if (cmSnap.exists) {
      await companyMemberRef.update({ role: finalRole });
    }

    return NextResponse.json({
      success: true,
      message: "Access updated successfully",
    });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("company-users update error:", e);
    return NextResponse.json({ error: e.message || "Failed to update access" }, { status: 500 });
  }
}
