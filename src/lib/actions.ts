
'use server';

import nodemailer from 'nodemailer';
import { google } from 'googleapis';

interface EmailOptions {
    to: string;
    subject: string;
    body: string;
    attachmentBuffer: number[];
    filename: string;
    refreshToken: string;
}

const OAuth2 = google.auth.OAuth2;

const getOAuth2Client = (refreshToken: string) => {
    return new OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI 
    );
};


export async function sendEmailWithAttachment(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    const { to, subject, body, attachmentBuffer, filename, refreshToken } = options;

    const fromEmail = process.env.NEXT_PUBLIC_SENDER_EMAIL;
    if (!fromEmail) {
        const errorMsg = "Sender email is not configured in .env file.";
        console.error(errorMsg);
        return { success: false, error: errorMsg };
    }

    if (!refreshToken) {
        return { success: false, error: "Authentication failed. Please sign out and sign in again." };
    }
    
    const oauth2Client = getOAuth2Client(refreshToken);
    oauth2Client.setCredentials({
        refresh_token: refreshToken
    });

    try {
        const { token: accessToken } = await oauth2Client.getAccessToken();
        if (!accessToken) {
             return { success: false, error: "Failed to create access token. Please sign out and sign in again." };
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: fromEmail,
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                refreshToken: refreshToken,
                accessToken: accessToken,
            },
        });

        const buffer = Buffer.from(attachmentBuffer);

        await transporter.sendMail({
            from: `"${fromEmail}" <${fromEmail}>`,
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
        // Provide a more specific error message if available
        let errorMessage = "Failed to send email. Please try again later.";
        if (error.response?.data?.error_description) {
            errorMessage = error.response.data.error_description;
        } else if (error.message?.includes('invalid_grant')) {
            errorMessage = "Authentication failed. Please sign out and sign in again.";
        }
        return { success: false, error: errorMessage };
    }
}
