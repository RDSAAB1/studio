import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

function getSubscriptionDetailsByCode(code: string) {
  const clean = code.trim();
  const len = clean.length;
  if (len === 5) {
    return {
      duration: "1_month",
      days: 30,
      expiryMs: Date.now() + 30 * 24 * 60 * 60 * 1000,
      label: "1 Month Plan"
    };
  } else if (len === 7) {
    return {
      duration: "1_year",
      days: 365,
      expiryMs: Date.now() + 365 * 24 * 60 * 60 * 1000,
      label: "1 Year Plan"
    };
  } else if (len === 9) {
    return {
      duration: "lifetime",
      days: 36500,
      expiryMs: Date.now() + 36500 * 24 * 60 * 60 * 1000,
      label: "Lifetime Plan"
    };
  }
  return {
    duration: "1_month",
    days: 30,
    expiryMs: Date.now() + 30 * 24 * 60 * 60 * 1000,
    label: "1 Month Plan"
  };
}

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json().catch(() => ({}));
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanCode = String(code || "").trim();

    if (!cleanCode) {
      return NextResponse.json({ success: false, error: "Activation code is required" }, { status: 400 });
    }

    const db = getAdminFirestore();

    // 1. Check if matching code exists in verification_codes collection in Firestore
    let matchedDocData: any = null;

    try {
      if (cleanEmail) {
        const userDoc = await db.collection("verification_codes").doc(cleanEmail).get();
        if (userDoc.exists && userDoc.data()?.code === cleanCode) {
          matchedDocData = userDoc.data();
        }
      }

      if (!matchedDocData) {
        // Query by code across all pending requests
        const codeQuery = await db.collection("verification_codes").where("code", "==", cleanCode).get();
        if (!codeQuery.empty) {
          matchedDocData = codeQuery.docs[0].data();
        }
      }
    } catch (dbErr) {
      console.warn("[Firestore Verify Code Warning]:", dbErr);
    }

    // STRICT SECURITY: If code is not found or does not match stored code
    if (!matchedDocData || matchedDocData.code !== cleanCode) {
      return NextResponse.json(
        {
          success: false,
          error: "Galt Activation Code! Sahi code enter karein jo rdsaab1@gmail.com par bheja gaya hai."
        },
        { status: 400 }
      );
    }

    // Check expiration
    if (matchedDocData.expiresAt && matchedDocData.expiresAt < Date.now()) {
      return NextResponse.json(
        { success: false, error: "Activation code expire ho gaya hai. Dobara 'Subscribe' click karke new code lein." },
        { status: 400 }
      );
    }

    const subDetails = getSubscriptionDetailsByCode(cleanCode);

    // Code is 100% verified & matching!
    if (cleanEmail) {
      try {
        await db.collection("subscriptions").doc(cleanEmail).set({
          subscription_verified: true,
          subscription_expiry: subDetails.expiryMs,
          subscription_duration: subDetails.duration,
          plan_label: subDetails.label,
          activation_code: cleanCode,
          updatedAt: Date.now()
        });
      } catch (e) {
        console.warn("[Subscription Firestore Error]:", e);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Code Verified! ${subDetails.label} activated.`,
      subscription: subDetails
    });
  } catch (error: any) {
    console.error("[Verify Code Error]:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to verify code" }, { status: 500 });
  }
}
