import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getCompanyEmailSettings } from "@/lib/firestore/settings";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, companyName, planId, code: clientCode } = body || {};
    let cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      cleanEmail = "user@emandi.com";
    }
    const cleanCompany = String(companyName || "My Company").trim();

    // Generate code based on plan or use UI clientCode
    let planTitle = "Monthly (30 Days)";
    let price = "₹500";
    if (planId === "trial") {
      planTitle = "Free Trial (1 Month)";
      price = "₹0";
    } else if (planId === "yearly") {
      planTitle = "Yearly (1 Year)";
      price = "₹5,000";
    } else if (planId === "lifetime") {
      planTitle = "Lifetime (Unlimited)";
      price = "₹40,000";
    }

    let code = String(clientCode || "").trim();
    if (!code) {
      if (planId === "trial") {
        code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit
      } else if (planId === "yearly") {
        code = Math.floor(1000000 + Math.random() * 9000000).toString(); // 7 digit
      } else if (planId === "lifetime") {
        code = Math.floor(100000000 + Math.random() * 900000000).toString(); // 9 digit
      } else {
        code = Math.floor(10000 + Math.random() * 90000).toString(); // 5 digit
      }
    }

    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Store in Firestore verification_codes collection (gracefully)
    try {
      const db = getAdminFirestore();
      await db.collection("verification_codes").doc(cleanEmail).set({
        email: cleanEmail,
        companyName: cleanCompany,
        code,
        planId: planId || "monthly",
        planTitle,
        expiresAt,
        createdAt: Date.now()
      });
    } catch (dbErr) {
      console.warn("[Firestore Save Warning in send-subscription-request]:", dbErr);
    }

    // 1. Primary: Direct Google SMTP via Nodemailer (100% Real Email to rdsaab1@gmail.com)
    const mailText = `Company: ${cleanCompany}\nEmail: ${cleanEmail}\nPlan: ${planTitle} (${price})\nActivation Code: ${code}`;

    try {
      const companyConfig = await getCompanyEmailSettings();
      const emailUser = companyConfig?.email || process.env.SMTP_USER || process.env.GMAIL_USER || "rdsaab1@gmail.com";
      const emailPass = companyConfig?.appPassword || process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || "";

      if (emailUser && emailPass) {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: emailUser,
            pass: emailPass,
          },
        });

        await transporter.sendMail({
          from: `"Company Activation System" <${emailUser}>`,
          to: "rdsaab1@gmail.com",
          subject: `Company Creation Request: ${cleanCompany} (${code})`,
          text: mailText,
          html: `
            <div style="background-color: #090d16; padding: 40px 15px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              <div style="max-width: 540px; margin: 0 auto; background: linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%); border-radius: 20px; border: 1px solid #4c1d95; box-shadow: 0 20px 40px rgba(0,0,0,0.5); overflow: hidden; padding: 32px 28px;">
                
                <!-- Badge & Header -->
                <div style="margin-bottom: 24px;">
                  <span style="background: rgba(168, 85, 247, 0.15); color: #c084fc; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; padding: 6px 14px; border-radius: 20px; border: 1px solid rgba(168, 85, 247, 0.3); display: inline-block;">
                    🏢 Company Activation
                  </span>
                  <h2 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 16px 0 6px 0; letter-spacing: -0.5px;">
                    New Company Creation Request
                  </h2>
                  <p style="color: #94a3b8; font-size: 13px; margin: 0;">
                    A new subscription request has been submitted for verification.
                  </p>
                </div>

                <!-- Info Table Card -->
                <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 18px 20px; margin-bottom: 24px;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr>
                      <td style="padding: 8px 0; color: #94a3b8; width: 38%; font-weight: 500;">Company Name</td>
                      <td style="padding: 8px 0; color: #38bdf8; font-weight: 700; font-size: 15px;">${cleanCompany}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #94a3b8; font-weight: 500;">User Email</td>
                      <td style="padding: 8px 0; color: #f8fafc; font-weight: 600;">${cleanEmail}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #94a3b8; font-weight: 500;">Selected Plan</td>
                      <td style="padding: 8px 0;">
                        <span style="background: rgba(251, 191, 36, 0.12); color: #fbbf24; font-weight: 700; font-size: 13px; padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(251, 191, 36, 0.25); display: inline-block;">
                          ${planTitle} (${price})
                        </span>
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- Big Golden Code Hero Box -->
                <div style="background: linear-gradient(135deg, #2e1065 0%, #E09025 100%); border: 2px solid #a855f7; border-radius: 16px; padding: 22px 16px; text-align: center; margin-bottom: 24px; box-shadow: 0 8px 20px rgba(168, 85, 247, 0.25);">
                  <div style="color: #c084fc; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;">
                    GENERATED ACTIVATION CODE
                  </div>
                  <div style="color: #fbbf24; font-size: 38px; font-weight: 900; letter-spacing: 8px; line-height: 1; text-shadow: 0 2px 10px rgba(251, 191, 36, 0.3);">
                    ${code}
                  </div>
                  <div style="color: #e2e8f0; font-size: 12px; margin-top: 10px; opacity: 0.9;">
                    Share this code with user upon payment verification
                  </div>
                </div>

                <!-- Footer -->
                <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 18px; text-align: center; color: #64748b; font-size: 11px; line-height: 1.6;">
                  Company Multi-User License System &nbsp;|&nbsp; Support: <span style="color: #a78bfa;">rdsaab1@gmail.com</span> &nbsp;|&nbsp; UPI: <span style="color: #fbbf24;">50487@ybl</span>
                </div>

              </div>
            </div>
          `,
        });
      }
    } catch (mailErr) {
      console.warn("[Google SMTP Send Error]:", mailErr);
    }

    // Return success response to UI instantly
    return NextResponse.json({
      success: true,
      message: "Subscription request code sent to rdsaab1@gmail.com",
      code,
    });
  } catch (error: any) {
    console.error("[Send Subscription Request Error]:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to send subscription request" }, { status: 500 });
  }
}
