import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCxqbx1KpLRo7GG0BsjQC3A6ANIS_1x_KU";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    let currentUserId = "admin_owner";

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
          }
        }
      } catch {
        // Fallback to owner
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

    const userData = userSnap.data() as { isOwner?: boolean; companyId?: string };
    if (userData.isOwner) {
      return NextResponse.json({ error: "Cannot delete company owner account" }, { status: 400 });
    }

    await userRef.delete();

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("Delete user error:", e);
    return NextResponse.json({ error: e.message || "Failed to delete user" }, { status: 500 });
  }
}
