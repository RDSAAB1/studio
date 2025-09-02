
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

    // Retrieve email credentials from environment variables
    const gmailEmail = process.env.GMAIL_EMAIL;
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

    if (!gmailEmail || !gmailAppPassword) {
        const errorMsg = "Email credentials are not configured in .env file.";
        console.error(errorMsg);
        return { success: false, error: errorMsg };
    }

    // Create a transporter object using the default SMTP transport
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: gmailEmail,
            pass: gmailAppPassword,
        },
    });

    try {
        // Convert the array of numbers back to a Buffer
        const buffer = Buffer.from(attachmentBuffer);

        // Send mail with defined transport object
        await transporter.sendMail({
            from: `"BizSuite DataFlow" <${gmailEmail}>`,
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

        console.log('Email sent successfully');
        return { success: true };
    } catch (error: any) {
        console.error('Error sending email:', error);
        return { success: false, error: `Failed to send email: ${error.message}` };
    }
}
