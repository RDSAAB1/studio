
'use server';

import nodemailer from 'nodemailer';
import { getCompanySettings } from './firestore';

interface EmailOptions {
    to: string;
    subject: string;
    body: string;
    attachmentBuffer: number[];
    filename: string;
}

export async function sendEmailWithAttachment(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    const { to, subject, body, attachmentBuffer, filename } = options;

    const companySettings = await getCompanySettings();

    if (!companySettings || !companySettings.email || !companySettings.appPassword) {
        const errorMsg = "Company email settings are not configured. Please configure them on the Settings page.";
        console.error(errorMsg);
        return { success: false, error: errorMsg };
    }
    
    const fromEmail = companySettings.email;
    const appPassword = companySettings.appPassword;

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: fromEmail,
                pass: appPassword,
            },
        });

        const buffer = Buffer.from(attachmentBuffer);

        await transporter.sendMail({
            from: `"${companySettings.name || fromEmail}" <${fromEmail}>`,
            to: to,
            subject: subject,
            text: body,
            attachments: [
                {
                    filename: filename,
                    content: buffer,
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                },
            ],
        });

        return { success: true };
    } catch (error: any) {
        console.error('Error sending email:', error);
        let errorMessage = "Failed to send email. Please check your app password and try again later.";
        if (error.code === 'EAUTH') {
            errorMessage = "Authentication failed. Please check the App Password in your settings.";
        }
        return { success: false, error: errorMessage };
    }
}
