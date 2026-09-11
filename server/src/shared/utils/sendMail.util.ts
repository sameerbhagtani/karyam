// Importing modules
import { brevoClient, transporter } from "../config/mail.config.js";
import logger from "../config/logger.config.js";
import env from "../config/env.config.js";

interface SendMailOptions {
    senderName?: string;
    senderEmail?: string;
}

/**
 * Sends a transactional email using Brevo (SDK or HTTP API),
 * with fallback to SMTP transporter or mock logger.
 */
async function sendMail(to: string, subject: string, html: string, options?: SendMailOptions): Promise<void> {
    const senderName = options?.senderName || env.BREVO_SENDER_NAME || "Karya";
    const senderEmail = options?.senderEmail || env.BREVO_SENDER_EMAIL || "noreply@example.com";

    // If mail sending is disabled, log mock mail
    if (!env.SEND_MAIL) {
        logger.info(`[Mail Mock Log] To: ${to} | Subject: ${subject} | HTML: ${html}`);
        return;
    }

    try {
        // 1. Send via Brevo HTTP API if configured
        if (env.BREVO_API_KEY && env.BREVO_USE_HTTP) {
            const response = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    accept: "application/json",
                    "api-key": env.BREVO_API_KEY,
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    sender: { name: senderName, email: senderEmail },
                    to: [{ email: to }],
                    subject,
                    htmlContent: html,
                }),
            });

            if (!response.ok) {
                const errorData = await response.text();
                logger.error(`[Brevo HTTP] Failed to send email to ${to}: ${response.status} - ${errorData}`);
                return;
            }

            const data = await response.json();
            logger.info(`[Brevo HTTP] Email sent successfully to ${to}. MessageId: ${(data as { messageId?: string }).messageId}`);
            return;
        }

        // 2. Send via Brevo SDK if API key and client are available
        if (brevoClient) {
            const result = await brevoClient.transactionalEmails.sendTransacEmail({
                subject,
                htmlContent: html,
                sender: { name: senderName, email: senderEmail },
                to: [{ email: to }],
            });

            logger.info(`[Brevo SDK] Email sent successfully to ${to}. MessageId: ${(result as { messageId?: string })?.messageId}`);
            return;
        }

        // 3. Fallback to Nodemailer SMTP transporter if no Brevo key is set
        await transporter.sendMail({
            from: `"${senderName}" <${senderEmail}>`,
            to,
            subject,
            html,
        });
        logger.info(`[Nodemailer SMTP] Email sent successfully to ${to}`);
    } catch (error) {
        logger.error(`[Mail Error] Failed to send email to ${to} (${subject}): ${error instanceof Error ? error.message : String(error)}`);
    }
}

export default sendMail;
