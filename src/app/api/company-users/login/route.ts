/**
 * Company user login - check credentials in Firestore, return custom token for Firestore access.
 * Credentials stored in companyUsers. User linked to company - no company code needed.
 * Login with Username + Password only.
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";

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

    console.log(`[Login API] Attempting login for username: "${username}"`);

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const usernameLower = username.toLowerCase();

    let companyId: string | null = null;
    let userData: { passwordHash?: string; username?: string; role?: string } = {};
    let userDocRef: DocumentReference | null = null;

    // First try: exact match on usernameLower
    let usersSnap = await db.collection("companyUsers").where("usernameLower", "==", usernameLower).get();
    console.log(`[Login API] Found ${usersSnap.size} matches for usernameLower: "${usernameLower}"`);

    if (usersSnap.empty) {
      console.log(`[Login API] No direct matches for "${usernameLower}". Trying fallback scan...`);
      const allSnap = await db.collection("companyUsers").get();
      console.log(`[Login API] Total documents in companyUsers: ${allSnap.size}`);
      
      for (const doc of allSnap.docs) {
        const data = doc.data() as { passwordHash?: string; username?: string; role?: string; companyId?: string };
        const docUsernameLower = (data.username || "").toLowerCase();
        
        if (docUsernameLower === usernameLower) {
          console.log(`[Login API] Found match in fallback scan: doc ID ${doc.id}`);
          const isValid = await compare(password, data.passwordHash || "");
          console.log(`[Login API] Password comparison result: ${isValid}`);
          
          if (isValid) {
            companyId = data.companyId || "";
            userData = data;
            userDocRef = doc.ref;
            break;
          }
        }
      }
    } else {
      for (const doc of usersSnap.docs) {
        const data = doc.data() as { passwordHash?: string; username?: string; role?: string; companyId?: string };
        const isValid = await compare(password, data.passwordHash || "");
        console.log(`[Login API] Match doc ID ${doc.id}, Password comparison: ${isValid}`);
        
        if (isValid) {
          companyId = data.companyId || "";
          userData = data;
          userDocRef = doc.ref;
          break;
        }
      }
    }

    if (!companyId || !userData.passwordHash) {
      console.log(`[Login API] Login failed for "${usernameLower}". User not found or password incorrect.`);
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    if (userDocRef) {
      // Ensure usernameLower is set for future optimized lookups
      await userDocRef.update({ usernameLower }).catch(() => {});
    }

    // Create custom token so client can access Firestore
    const uid = `cu_${companyId}_${toKey(userData.username || username)}`;
    const memberId = `${companyId}_${uid}`;
    
    console.log(`[Login API] Success! Generating token for uid: ${uid}`);

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
      console.error("Firebase Admin custom token error:", e);
      return NextResponse.json(
        { error: "Server not configured for token generation." },
        { status: 503 }
      );
    }

    // Exchange the custom token for a real Firebase ID token on the SERVER side.
    // This avoids Electron's renderer (Chromium) needing to make a direct fetch to googleapis.com,
    // which fails in environments with proxy/WPAD DNS issues.
    let idToken: string | null = null;
    try {
      const apiKey = "AIzaSyCxqbx1KpLRo7GG0BsjQC3A6ANIS_1x_KU";
      const tokenRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: customToken, returnSecureToken: true }),
        }
      );
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        idToken = tokenData.idToken ?? null;
        console.log(`[Login API] Server-side token exchange: ${idToken ? "SUCCESS" : "No idToken in response"}`);
      } else {
        const errBody = await tokenRes.text();
        console.warn(`[Login API] Server-side token exchange failed: ${tokenRes.status} ${errBody}`);
      }
    } catch (e) {
      console.warn("[Login API] Server-side token exchange error:", e);
    }

    return NextResponse.json({
      success: true,
      customToken,
      idToken,  // Client should prefer idToken if present (avoids Chromium direct API call)
      companyId,
      username: userData.username || username,
      role: userData.role || "member",
    });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("Critical login error:", e);
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}
