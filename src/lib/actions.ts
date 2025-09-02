
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

const getOAuth2Client = () => {
    return new google.auth.OAuth2(
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET,
        // The redirect URI can be a placeholder as we are not using it for the auth flow on the server
        'http://localhost:3000/api/auth/callback/google'
    );
};

export async function sendEmailWithAttachment(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    const { to, subject, body, attachmentBuffer, filename, refreshToken } = options;

    if (!refreshToken) {
        return { success: false, error: "Authentication failed. Please sign out and sign in again." };
    }

    try {
        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        const { token: accessToken, res } = await oauth2Client.getAccessToken();

        if (!accessToken) {
             let errorMessage = "Failed to obtain access token.";
             if (res?.data?.error_description) {
                 errorMessage += ` Details: ${res.data.error_description}`;
             }
             if (res?.data?.error === 'invalid_grant') {
                 errorMessage = "Authentication failed. The token is invalid or expired. Please sign out and sign in again.";
             }
            throw new Error(errorMessage);
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: 'me', // The user's email will be used automatically
                clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
                clientSecret: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET,
                refreshToken: refreshToken,
                accessToken: accessToken,
            },
        });

        const buffer = Buffer.from(attachmentBuffer);

        await transporter.sendMail({
            from: 'me', // Will use the authenticated user's email
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
        if (error.response?.data?.error === 'invalid_grant' || error.message.includes('invalid_grant')) {
            errorMessage = "Authentication failed. Please sign out and sign in again.";
        } else if (error.message) {
            errorMessage = error.message;
        }
        return { success: false, error: errorMessage };
    }
}
