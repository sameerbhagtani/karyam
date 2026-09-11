// importing modules
import { BrevoClient } from "@getbrevo/brevo";
import nodemailer from "nodemailer";
import env from "./env.config.js";

// Initialize Brevo SDK Client if API key is provided
let brevoClient: BrevoClient | null = null;

if (env.BREVO_API_KEY) {
    brevoClient = new BrevoClient({
        apiKey: env.BREVO_API_KEY,
    });
}

// Fallback SMTP transporter
const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST || "smtp.gmail.com",
    port: Number(env.SMTP_PORT || 587),
    auth: {
        user: env.SMTP_USER || "",
        pass: env.SMTP_PASS || "",
    },
});

export { brevoClient, transporter };
export default brevoClient;
