
import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const db = getAdminFirestore();
    const usersSnap = await db.collection("companyUsers").get();
    
    const users = usersSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        username: data.username,
        usernameLower: data.usernameLower,
        companyId: data.companyId,
        role: data.role,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
      };
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
