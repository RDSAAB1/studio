
'use server';

import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { getRefreshToken } from './firestore';


interface EmailOptions {
    to: string;
    subject: string;
    body: string;
    attachmentBuffer: number[];
    filename: string;
    userEmail: string;
    userId: string;
}

const getOAuth2Client = () => {
    return new google.auth.OAuth2(
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET,
        "http://localhost" // This is a placeholder, but required for the library
    );
};

export async function sendEmailWithAttachment(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    const { to, subject, body, attachmentBuffer, filename, userEmail, userId } = options;

    if (!userId) {
        return { success: false, error: "Authentication failed. User ID not provided." };
    }

    try {
        const refreshToken = await getRefreshToken(userId);
        if (!refreshToken) {
            return { success: false, error: "Authentication failed. Refresh token not found. Please sign out and sign in again." };
        }

        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        const { token: accessToken } = await oauth2Client.getAccessToken();

        if (!accessToken) {
            return { success: false, error: "Failed to obtain access token." };
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: userEmail,
                clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
                clientSecret: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET,
                refreshToken: refreshToken,
                accessToken: accessToken,
            },
        });

        const buffer = Buffer.from(attachmentBuffer);

        await transporter.sendMail({
            from: `"${userEmail}" <${userEmail}>`,
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
        console.error('Error sending email:', error.response?.data || error.message);
        let errorMessage = "Failed to send email. Please try again later.";
        if (error.response?.data?.error === 'invalid_grant' || (error.message && error.message.includes('invalid_grant'))) {
            errorMessage = "Authentication failed. Please sign out and sign in again.";
        } else if (error.message) {
            errorMessage = error.message;
        }
        return { success: false, error: errorMessage };
    }
}
