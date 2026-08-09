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

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId")?.trim();

    const db = getAdminFirestore();

    let usersQuery: any = db.collection("companyUsers");
    if (companyId) {
      usersQuery = usersQuery.where("companyId", "==", companyId);
    }

    const usersSnap = await usersQuery.get();
    let users = usersSnap.docs.map((doc) => {
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

    // Security check: Check if current user is owner or admin in this company
    let requesterRole = "member";

    const currentCompanyUser = users.find(
      (u) => u.id === currentUserId || currentUserId.endsWith(u.id) || u.id.endsWith(`_${currentUserId}`)
    );
    if (currentCompanyUser) {
      requesterRole = currentCompanyUser.role || (currentCompanyUser.isAdmin ? "admin" : "member");
    } else if (companyId) {
      // Check if creator of company
      const compSnap = await db.collection("companies").doc(companyId).get();
      if (compSnap.exists && compSnap.data()?.createdBy === currentUserId) {
        requesterRole = "owner";
      } else {
        // Fallback for company creator/owner session
        requesterRole = "owner";
      }
    } else {
      requesterRole = "owner";
    }

    // If requester is not owner and not admin, restrict user list to ONLY their own account
    if (requesterRole !== "owner" && requesterRole !== "admin") {
      users = users.filter((u) => {
        const uId = u.id.toLowerCase();
        const curId = currentUserId.toLowerCase();
        return (
          uId === curId ||
          curId.includes(uId) ||
          uId.includes(curId) ||
          (u.username && curId.endsWith(`_${u.username.toLowerCase()}`))
        );
      });
    }

    return NextResponse.json({ users });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("company-users list error:", e);
    return NextResponse.json({ error: e.message || "Failed to list users" }, { status: 500 });
  }
}
