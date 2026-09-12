// Importing modules
import pino from "pino";
import env from "./env.config.js";

const isProduction =
    env.NODE_ENV === "production" ||
    process.env.NODE_ENV === "production";

function createLogger() {
    if (isProduction) {
        return pino({
            level: "info",
        });
    }

    try {
        return pino({
            level: "debug",
            transport: {
                target: "pino-pretty",
                options: {
                    colorize: true,
                    translateTime: "SYS:standard",
                    ignore: "pid,hostname",
                },
            },
        });
    } catch {
        return pino({
            level: "debug",
        });
    }
}

// creating a logger instance
const logger = createLogger();

export default logger;

