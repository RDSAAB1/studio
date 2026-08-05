import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      return NextResponse.json({ success: false, error: "Valid email is required" }, { status: 400 });
    }

    // Generate 6-digit random code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store in Firestore verification_codes collection
    const db = getAdminFirestore();
    await db.collection("verification_codes").doc(cleanEmail).set({
      email: cleanEmail,
      code,
      expiresAt,
      createdAt: Date.now()
    });

    // Try sending email if SMTP credentials exist or default transport
    try {
      const emailUser = process.env.SMTP_USER || process.env.GMAIL_USER || "rdsaab1@gmail.com";
      const emailPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || "";

      if (emailUser && emailPass) {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: emailUser,
            pass: emailPass
          }
        });

        await transporter.sendMail({
          from: `"eMandi Subscription & Verification" <${emailUser}>`,
          to: "rdsaab1@gmail.com",
          subject: `Signup Request for ${cleanEmail} - Verification Code: ${code}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #0f172a; color: #f8fafc; rounded: 12px;">
              <h2 style="color: #a855f7;">eMandi Software Signup Verification</h2>
              <p>Your 6-digit verification code to create your company account is:</p>
              <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #22c55e; background: #1e293b; padding: 12px 24px; display: inline-block; border-radius: 8px; margin: 16px 0;">
                ${code}
              </div>
              <p style="font-size: 12px; color: #94a3b8;">This code is valid for 10 minutes. Please do not share it with anyone.</p>
              <hr style="border-color: #334155; margin-top: 20px;" />
              <p style="font-size: 11px; color: #64748b;">eMandi Subscription System | Support: rdsaab1@gmail.com | UPI: emandi@upi</p>
            </div>
          `
        });
      } else {
        console.log(`[Verification Code Mock/Console] Code for ${cleanEmail}: ${code}`);
      }
    } catch (mailError) {
      console.warn("[Verification Code Email Send Warning]:", mailError);
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email",
      // Include code in response for local/testing if mailer is unconfigured
      debugCode: process.env.NODE_ENV === "development" ? code : undefined
    });
  } catch (error: any) {
    console.error("[Send Verification Code Error]:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to send code" }, { status: 500 });
  }
}
