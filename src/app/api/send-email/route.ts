import { NextResponse } from "next/server";
import { getCompanyEmailSettings } from "@/lib/firestore";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

interface AttachmentData {
  filename: string;
  buffer: number[];
  contentType: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  attachments: AttachmentData[];
  userId: string;
  userEmail: string;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const options = (await request.json()) as EmailOptions & { erp: any };
    const { to, subject, body, attachments, userId, erp } = options;

    const companySettings = await getCompanyEmailSettings(erp);
    if (!companySettings || !companySettings.email || !companySettings.appPassword) {
      return NextResponse.json({
        success: false,
        error: "Email settings are not configured for this company. Please go to Settings -> Email to connect a Gmail account.",
      });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: companySettings.email,
        pass: companySettings.appPassword,
      },
    });

    await transporter.sendMail({
      from: `"${companySettings.email}" <${companySettings.email}>`,
      to,
      subject,
      text: body,
      html: `<p>${body.replace(/\n/g, "<br>")}</p>`,
      attachments: attachments.map((att) => ({
        filename: att.filename,
        content: Buffer.from(att.buffer),
        contentType: att.contentType,
      })),
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    let errorMessage = "Failed to send email. Please check your App Password and try again.";
    if (err.code === "EAUTH") {
      errorMessage = "Authentication failed. Please verify your email and App Password in Settings.";
    } else if (err.message) {
      errorMessage = err.message;
    }
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
