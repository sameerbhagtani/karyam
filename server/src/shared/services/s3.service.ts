import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import path from "node:path";
import env from "../config/env.config.js";
import logger from "../config/logger.config.js";

class S3Service {
    private client: S3Client | null = null;
    private bucketName: string;
    private isConfigured: boolean;

    constructor() {
        this.bucketName = env.AWS_S3_BUCKET_NAME || "karyam-uploads";
        this.isConfigured = Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);

        if (this.isConfigured) {
            this.client = new S3Client({
                region: env.AWS_REGION || "us-east-1",
                credentials: {
                    accessKeyId: env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
                },
                ...(env.AWS_ENDPOINT ? { endpoint: env.AWS_ENDPOINT, forcePathStyle: true } : {}),
            });
        } else {
            logger.warn("AWS S3 credentials not fully configured; using local storage fallback.");
        }
    }

    async uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<string> {
        if (this.isConfigured && this.client) {
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: buffer,
                ContentType: mimeType,
            });

            await this.client.send(command);
            logger.info({ key, bucket: this.bucketName }, "File uploaded to S3 successfully");
            return key;
        }

        // Local fallback for offline/development mode
        const localBasePath = path.resolve(process.cwd(), "uploads");
        const filePath = path.join(localBasePath, key);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, buffer);
        logger.info({ key, localPath: filePath }, "File saved to local storage fallback");
        return key;
    }
}

export const s3Service = new S3Service();
export default s3Service;
