
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
        const errorMsg = "Gmail credentials are not configured in .env file.";
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

        console.log('Email sent successfully via App Password.');
        return { success: true };
    } catch (error: any) {
        console.error('Error sending email:', error);
        let errorMessage = "Failed to send email. Please check your App Password and try again.";
        if (error.code === 'EAUTH') {
            errorMessage = "Authentication failed. Please verify your Gmail email and App Password in the .env file.";
        }
        return { success: false, error: errorMessage };
    }
}
