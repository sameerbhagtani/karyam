const envConstants = {
    PORT: 5000,
    NODE_ENV: 'development',
    MONGO_URI: 'mongodb://localhost:27017/karya',
    CORS_ORIGIN: '*',
    FRONTEND_URL: "http://localhost:5173",
    ACCESS_TOKEN_SECRET: "super_secret_access_jwt_key_change_in_production",
    REFRESH_TOKEN_SECRET: "super_secret_refresh_jwt_key_change_in_production",
    SMTP_HOST: "smtp.gmail.com",
    SMTP_PORT: 587,
    SMTP_USER: "",
    SMTP_PASS: "",
    SENDING_USER: "karya <noreply@example.com>",
    SEND_MAIL: false,
    BREVO_API_KEY: "",
    BREVO_SENDER_EMAIL: "noreply@example.com",
    BREVO_SENDER_NAME: "Karya",
    BREVO_USE_HTTP: false,
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    GOOGLE_REDIRECT_URI: "http://localhost:5000/api/v1/auth/google/callback",
} as const;

export default envConstants;
