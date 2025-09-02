
'use server';

import nodemailer from 'nodemailer';
import { getCompanySettings } from './firestore';


interface EmailOptions {
    to: string;
    subject: string;
    body: string;
    attachmentBuffer: number[];
    filename: string;
    userId: string;
    userEmail: string; // Add userEmail to ensure we use the logged-in user's credentials
}

export async function sendEmailWithAttachment(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    const { to, subject, body, attachmentBuffer, filename, userId, userEmail } = options;

    try {
        const companySettings = await getCompanySettings(userId);

        if (!companySettings || !companySettings.email || !companySettings.appPassword) {
            return { success: false, error: "Email settings are not configured. Please go to Settings to connect your Gmail account." };
        }

        // Security check: ensure the settings' email matches the logged-in user's email
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

        const buffer = Buffer.from(attachmentBuffer);

        const mailOptions = {
            from: `"${companySettings.email}" <${companySettings.email}>`,
            to: to,
            subject: subject,
            text: body,
            html: `<p>${body.replace(/\n/g, '<br>')}</p>`, // Basic HTML version
            attachments: [
                {
                    filename: filename,
                    content: buffer,
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                },
            ],
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
