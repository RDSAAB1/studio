
'use server';

import nodemailer from 'nodemailer';
import { google } from 'googleapis';

interface EmailOptions {
    to: string;
    subject: string;
    body: string;
    attachmentBuffer: number[];
    filename: string;
    userEmail: string;
    refreshToken: string;
}

const getOAuth2Client = (refreshToken: string) => {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI // This can be a placeholder if you're not doing a full web flow here
    );
    if (refreshToken) {
        oauth2Client.setCredentials({ refresh_token: refreshToken });
    }
    return oauth2Client;
};

export async function sendEmailWithAttachment(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    const { to, subject, body, attachmentBuffer, filename, userEmail, refreshToken } = options;

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        const errorMsg = "Google OAuth credentials are not configured in .env file.";
        console.error(errorMsg);
        return { success: false, error: errorMsg };
    }
    
    if (!refreshToken) {
        return { success: false, error: "Authentication failed. Please sign out and sign in again." };
    }

    try {
        const oauth2Client = getOAuth2Client(refreshToken);
        const { token: newAccessToken } = await oauth2Client.getAccessToken();

        if (!newAccessToken) {
            throw new Error("Failed to retrieve new access token.");
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: userEmail,
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                refreshToken: refreshToken,
                accessToken: newAccessToken,
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

        console.log('Email sent successfully via OAuth2');
        return { success: true };
    } catch (error: any) {
        console.error('Error sending email:', error.response?.data || error.message);
        let errorMessage = "Failed to send email. Please try again later.";
        if (error.response?.data?.error === 'invalid_grant' || error.responseCode === 401) {
            errorMessage = "Authentication failed. Please sign out and sign in again.";
        }
        return { success: false, error: errorMessage };
    }
}
