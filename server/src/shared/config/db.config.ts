// Importing modules
import mongoose from "mongoose";
import env from "./env.config.js";
import logger from "./logger.config.js";
import dns from "dns";

// Set reliable DNS servers (Google + Cloudflare) so mongodb+srv:// SRV queries resolve on Windows/local networks
try {
    dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
} catch (dnsErr) {
    logger.warn(dnsErr, "Could not set custom DNS servers for SRV resolution");
}

// function to connect to the database
async function connectDB() {

    try {

        // connecting to the database
        mongoose.set("strictQuery", false);
        await mongoose.connect(env.MONGO_URI);
        logger.info("Connected to the database");

    }
    catch (error) {

        // logging the error
        logger.error(error, "Error connecting to the database");

    }

}

export default connectDB;
