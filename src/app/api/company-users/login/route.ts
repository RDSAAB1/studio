/**
 * Company user login - check credentials in Firestore, return custom token for Firestore access.
 * Credentials stored in companyUsers. User linked to company - no company code needed.
 * Login with Username + Password only.
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";

export const dynamic = 'force-static';
import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { compare } from "bcryptjs";

function toKey(str: string): string {
  return String(str || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const usernameLower = username.toLowerCase();

    let companyId: string | null = null;
    let userData: { passwordHash?: string; username?: string; role?: string } = {};
    let userDocRef: DocumentReference | null = null;

    let usersSnap = await db.collection("companyUsers").where("usernameLower", "==", usernameLower).get();
    if (usersSnap.empty) {
      const allSnap = await db.collection("companyUsers").get();
      for (const doc of allSnap.docs) {
        const data = doc.data() as { passwordHash?: string; username?: string; role?: string; companyId?: string };
        const docUsernameLower = (data.username || "").toLowerCase();
        if (docUsernameLower !== usernameLower) continue;
        const isValid = await compare(password, data.passwordHash || "");
        if (isValid) {
          companyId = data.companyId || "";
          userData = data;
          userDocRef = doc.ref;
          break;
        }
      }
    } else {
      for (const doc of usersSnap.docs) {
        const data = doc.data() as { passwordHash?: string; username?: string; role?: string; companyId?: string };
        const isValid = await compare(password, data.passwordHash || "");
        if (isValid) {
          companyId = data.companyId || "";
          userData = data;
          userDocRef = doc.ref;
          break;
        }
      }
    }

    if (!companyId || !userData.passwordHash) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    if (userDocRef) {
      await userDocRef.update({ usernameLower }).catch(() => {});
    }

    // Create custom token so client can access Firestore (needs companyMembers)
    const uid = `cu_${companyId}_${toKey(userData.username || username)}`;
    const memberId = `${companyId}_${uid}`;
    const memberRef = db.collection("companyMembers").doc(memberId);
    if (!(await memberRef.get()).exists) {
      await memberRef.set({
        companyId,
        userId: uid,
        role: userData.role || "member",
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    let customToken: string;
    try {
      const { getAdminAuth } = await import("@/lib/firebase-admin");
      customToken = await getAdminAuth().createCustomToken(uid, { companyId, username: userData.username || username });
    } catch (e) {
      console.error("Firebase Admin init for custom token:", e);
      return NextResponse.json(
        { error: "Server not configured for company user login. Add FIREBASE_ADMIN_* to .env.local" },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      customToken,
      companyId,
      username: userData.username || username,
      role: userData.role || "member",
    });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("company-users login error:", e);
    return NextResponse.json({ error: e.message || "Login failed" }, { status: 500 });
  }
}
