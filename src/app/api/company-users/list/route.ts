/**
 * List company users for a company. Only owner/admin can list.
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";

export const dynamic = 'force-static';

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCxqbx1KpLRo7GG0BsjQC3A6ANIS_1x_KU";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId")?.trim();
    if (!companyId) {
      return NextResponse.json({ error: "Company ID required" }, { status: 400 });
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
        return NextResponse.json({ error: "Only owner or admin can view user list" }, { status: 403 });
      }
    }

    const usersSnap = await db.collection("companyUsers").where("companyId", "==", companyId).get();
    const users = usersSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        username: d.username || "",
        role: d.role || "member",
        permissions: Array.isArray(d.permissions) ? d.permissions : [],
        isAdmin: !!d.isAdmin,
        isOwner: !!d.isOwner,
        createdAt: d.createdAt?.toMillis?.() ? new Date(d.createdAt.toMillis()).toISOString() : null,
      };
    });

    return NextResponse.json({ users });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("company-users list error:", e);
    return NextResponse.json({ error: e.message || "Failed to list users" }, { status: 500 });
  }
}
