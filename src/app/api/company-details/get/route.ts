import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = String(searchParams.get("username") || "").trim().toLowerCase();

    if (!username) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const doc = await db.collection("companyDetails").doc(username).get();

    if (doc.exists) {
      return NextResponse.json({ success: true, data: doc.data() });
    } else {
      return NextResponse.json({ success: false, error: "Company profile not found" });
    }
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("Company details fetch error:", e);
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}
