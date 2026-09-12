// Importing modules
import { config } from "dotenv";
import z from "zod";
import envConstants from "../constants/env.constants.js";

// loading environment variables
config();

// defining the schema for environment variables
const envSchema = z.object({
    PORT: z.coerce.number().default(envConstants.PORT),
    NODE_ENV: z.enum(["development", "production", "test"]).default(envConstants.NODE_ENV),
    MONGO_URI: z.string().default(envConstants.MONGO_URI),
    CORS_ORIGIN: z.string().default(envConstants.CORS_ORIGIN),
    FRONTEND_URL: z.string().default(envConstants.FRONTEND_URL),
    ACCESS_TOKEN_SECRET: z.string().default(envConstants.ACCESS_TOKEN_SECRET),
    REFRESH_TOKEN_SECRET: z.string().default(envConstants.REFRESH_TOKEN_SECRET),
    SMTP_HOST: z.string().default(envConstants.SMTP_HOST),
    SMTP_PORT: z.coerce.number().default(envConstants.SMTP_PORT),
    SMTP_USER: z.string().default(envConstants.SMTP_USER),
    SMTP_PASS: z.string().default(envConstants.SMTP_PASS),
    SENDING_USER: z.string().default(envConstants.SENDING_USER),
    SEND_MAIL: z.preprocess((val) => {
        if (typeof val === "string") return val.toLowerCase() === "true";
        return val;
    }, z.boolean()).default(envConstants.SEND_MAIL),
    BREVO_API_KEY: z.string().default(envConstants.BREVO_API_KEY),
    BREVO_SENDER_EMAIL: z.string().default(envConstants.BREVO_SENDER_EMAIL),
    BREVO_SENDER_NAME: z.string().default(envConstants.BREVO_SENDER_NAME),
    BREVO_USE_HTTP: z.preprocess((val) => {
        if (typeof val === "string") return val.toLowerCase() === "true";
        return val;
    }, z.boolean()).default(envConstants.BREVO_USE_HTTP),
    GOOGLE_CLIENT_ID: z.string().default(envConstants.GOOGLE_CLIENT_ID),
    GOOGLE_CLIENT_SECRET: z.string().default(envConstants.GOOGLE_CLIENT_SECRET),
    GOOGLE_REDIRECT_URI: z.string().url().default(envConstants.GOOGLE_REDIRECT_URI),
    AWS_REGION: z.string().default(envConstants.AWS_REGION),
    AWS_ACCESS_KEY_ID: z.string().default(envConstants.AWS_ACCESS_KEY_ID),
    AWS_SECRET_ACCESS_KEY: z.string().default(envConstants.AWS_SECRET_ACCESS_KEY),
    AWS_S3_BUCKET_NAME: z.string().default(envConstants.AWS_S3_BUCKET_NAME),
    AWS_ENDPOINT: z.string().default(envConstants.AWS_ENDPOINT),
    MISTRAL_API_KEY: z.string().default(envConstants.MISTRAL_API_KEY),
    PINECONE_API_KEY: z.string().default(envConstants.PINECONE_API_KEY),
    PINECONE_INDEX_NAME: z.string().default(envConstants.PINECONE_INDEX_NAME),
    PINECONE_HOST: z.string().default(envConstants.PINECONE_HOST),
    SARVAM_API_KEY: z.string().default(envConstants.SARVAM_API_KEY),
    RAPIDAPI_KEY: z.string().default(envConstants.RAPIDAPI_KEY),
});

// parsing and validating environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error("Invalid environment variables:", parsedEnv.error.format());
    process.exit(1);
}

// getting the validated environment variables
const env = parsedEnv.data;

export default env;
