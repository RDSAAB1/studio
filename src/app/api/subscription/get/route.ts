import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = String(searchParams.get("username") || "").trim().toLowerCase();
    const companyId = String(searchParams.get("companyId") || "").trim();

    if (!username && !companyId) {
      return NextResponse.json({ error: "Username or CompanyId required" }, { status: 400 });
    }

    const db = getAdminFirestore();

    // 1. Direct CompanyId Check (if provided)
    if (companyId && companyId !== "default" && companyId !== "undefined") {
      const companySubDoc = await db.collection("subscriptions").doc(companyId).get();
      if (companySubDoc.exists) {
        return NextResponse.json({ success: true, data: companySubDoc.data() });
      }
      const companyDoc = await db.collection("companies").doc(companyId).get();
      if (companyDoc.exists && companyDoc.data()?.subscription) {
        return NextResponse.json({ success: true, data: companyDoc.data()?.subscription });
      }
    }

    // 2. Direct Username (Email) Check in subscriptions
    if (username) {
      const doc = await db.collection("subscriptions").doc(username).get();
      if (doc.exists) {
        return NextResponse.json({ success: true, data: doc.data() });
      }

      // 3. Fallback: Search users collection to map email to UID, then find company subscription
      const usersSnap = await db.collection("users").where("email", "==", username).get();
      if (!usersSnap.empty) {
        const userUid = usersSnap.docs[0].id;
        const membersSnap = await db.collection("companyMembers").where("userId", "==", userUid).get();
        if (!membersSnap.empty) {
          const mappedCompanyId = membersSnap.docs[0].data().companyId;
          if (mappedCompanyId) {
            const companySubDoc = await db.collection("subscriptions").doc(mappedCompanyId).get();
            if (companySubDoc.exists) {
              return NextResponse.json({ success: true, data: companySubDoc.data() });
            }
            const companyDoc = await db.collection("companies").doc(mappedCompanyId).get();
            if (companyDoc.exists && companyDoc.data()?.subscription) {
              return NextResponse.json({ success: true, data: companyDoc.data()?.subscription });
            }
          }
        }
      }
    }

    return NextResponse.json({ success: false, error: "Subscription not found" });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("Subscription fetch error:", e);
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}
