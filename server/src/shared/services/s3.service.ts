import {
    S3Client,
    PutObjectCommand,
    HeadBucketCommand,
    CreateBucketCommand,
} from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import path from "node:path";
import env from "../config/env.config.js";
import logger from "../config/logger.config.js";

class S3Service {
    private client: S3Client | null = null;
    private bucketName: string;
    private isConfigured: boolean;

    private bucketCreated: boolean = false;
    private isCustomEndpoint: boolean = false;

    constructor() {
        this.bucketName = env.AWS_S3_BUCKET_NAME || "karyam-uploads";

        const accessKeyId =
            env.AWS_ACCESS_KEY_ID ||
            process.env.MINIO_ACCESS_KEY ||
            process.env.MINIO_ROOT_USER ||
            "";

        const secretAccessKey =
            env.AWS_SECRET_ACCESS_KEY ||
            process.env.MINIO_SECRET_KEY ||
            process.env.MINIO_ROOT_PASSWORD ||
            "";

        const endpoint =
            env.AWS_ENDPOINT ||
            (process.env.MINIO_ENDPOINT
                ? `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT || 9000}`
                : undefined);

        this.isCustomEndpoint = Boolean(endpoint);
        this.isConfigured = Boolean(accessKeyId && secretAccessKey);

        if (this.isConfigured) {
            this.client = new S3Client({
                region: env.AWS_REGION || "us-east-1",
                credentials: {
                    accessKeyId,
                    secretAccessKey,
                },
                ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
            });
            logger.info(
                { endpoint: endpoint || "AWS cloud standard", bucket: this.bucketName },
                "S3/MinIO client initialized successfully."
            );
        } else {
            logger.warn("S3/MinIO credentials not fully configured; using local storage fallback.");
        }
    }

    private async ensureBucket(): Promise<void> {
        // Only needed for local custom endpoints (like MinIO/LocalStack)
        if (!this.isCustomEndpoint || this.bucketCreated || !this.client) return;
        this.bucketCreated = true;

        try {
            await this.client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
        } catch (err: unknown) {
            const error = err as { name?: string; $metadata?: { httpStatusCode?: number } };
            const isNotFound =
                error.name === "NotFound" ||
                error.name === "NoSuchBucket" ||
                error.$metadata?.httpStatusCode === 404;

            if (isNotFound) {
                try {
                    await this.client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
                    logger.info({ bucket: this.bucketName }, "Created bucket in S3/MinIO storage.");
                    this.bucketCreated = true;
                } catch (createErr) {
                    logger.warn({ createErr }, "Could not auto-create bucket; will attempt upload anyway.");
                }
            }
        }
    }

    async uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<string> {
        if (this.isConfigured && this.client) {
            await this.ensureBucket();

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
