
'use server';

import nodemailer from 'nodemailer';

interface EmailOptions {
    to: string;
    subject: string;
    body: string;
    attachmentBuffer: number[];
    filename: string;
}

export async function sendEmailWithAttachment(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    const { to, subject, body, attachmentBuffer, filename } = options;

    const fromEmail = process.env.GMAIL_APP_EMAIL;
    const appPassword = process.env.GMAIL_APP_PASSWORD;

    if (!fromEmail || !appPassword) {
        const errorMsg = "Gmail credentials are not configured in the environment variables.";
        console.error(errorMsg);
        return { success: false, error: errorMsg };
    }

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
        let errorMessage = "Failed to send email. Please check your app password and try again later.";
        if (error.code === 'EAUTH') {
            errorMessage = "Authentication failed. Please check your Gmail App Password in the .env file.";
        }
        return { success: false, error: errorMessage };
    }
}
