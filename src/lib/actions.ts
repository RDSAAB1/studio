
'use server';

import nodemailer from 'nodemailer';
import { getCompanySettings } from './firestore';
import { getFirebaseAuth } from './firebase'; // Not used here, but good practice if needed

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

export async function sendEmailWithAttachment(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    const { to, subject, body, attachments, userId, userEmail } = options;

    try {
        const companySettings = await getCompanySettings(userId);

        if (!companySettings || !companySettings.email || !companySettings.appPassword) {
            return { success: false, error: "Email settings are not configured. Please go to Settings to connect your Gmail account." };
        }

        if (companySettings.email.toLowerCase() !== userEmail.toLowerCase()) {
            return { success: false, error: "Email configuration mismatch. Please re-configure your email settings." };
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: companySettings.email,
                pass: companySettings.appPassword,
            },
        });

        const mailOptions = {
            from: `"${companySettings.email}" <${companySettings.email}>`,
            to: to,
            subject: subject,
            text: body,
            html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
            attachments: attachments.map(att => ({
                filename: att.filename,
                content: Buffer.from(att.buffer),
                contentType: att.contentType,
            })),
        };

        await transporter.sendMail(mailOptions);
        
        return { success: true };
    } catch (error: any) {
        console.error('Error sending email:', error);
        let errorMessage = "Failed to send email. Please check your App Password and try again.";
         if (error.code === 'EAUTH') {
            errorMessage = 'Authentication failed. Please verify your email and App Password in Settings.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        return { success: false, error: errorMessage };
    }
}

export async function sendPasswordResetLink(email: string): Promise<{ success: boolean; error?: string }> {
    try {
        // This action isn't strictly needed as Firebase client SDK handles it,
        // but can be useful for server-side requests or more complex flows.
        // For now, we'll keep the logic on the client for simplicity.
        // This is a placeholder for potential future server-side email logic.
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
