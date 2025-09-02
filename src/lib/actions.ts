
'use server';

import nodemailer from 'nodemailer';
import { getGoogleProvider } from './firebase';
import {getOAuth2Client} from 'google-auth-library';

interface EmailOptions {
    to: string;
    subject: string;
    body: string;
    attachmentBuffer: number[];
    filename: string;
    userEmail: string;
}

export async function sendEmailWithAttachment(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    const { to, subject, body, attachmentBuffer, filename, userEmail } = options;
    const provider = getGoogleProvider();

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        const errorMsg = "Google OAuth credentials are not configured in .env file.";
        console.error(errorMsg);
        return { success: false, error: errorMsg };
    }

    try {
        const oauth2Client = getOAuth2Client();

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
        console.error('Error sending email:', error);
        let errorMessage = "Failed to send email. Please try again later.";
        if (error.code === 'EAUTH' || error.response?.data?.error === 'invalid_grant' || error.responseCode === 401) {
            errorMessage = "Authentication failed. Please sign out and sign in again.";
        } else if (error.message.includes('Token has been expired or revoked')) {
             errorMessage = "Your session has expired. Please sign out and sign in again to refresh your permissions.";
        }
        return { success: false, error: errorMessage };
    }
}
