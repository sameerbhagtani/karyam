import { MistralAIEmbeddings, ChatMistralAI } from "@langchain/mistralai";
import logger from "../config/logger.config.js";

interface KeyState {
    key: string;
    rateLimitedUntil: number; // timestamp in ms
}

export class MistralManager {
    private keys: KeyState[] = [];
    private currentIndex: number = 0;
    private readonly cooldownMs: number;

    constructor(cooldownMinutes: number = 2) {
        this.cooldownMs = cooldownMinutes * 60 * 1000;
        this.loadKeysFromEnv();
    }

    /**
     * Dynamically loads all Mistral API keys from environment variables.
     * Supports:
     * - MISTRAL_API_KEY
     * - MISTRAL_API_KEY1, MISTRAL_API_KEY2, ... MISTRAL_API_KEY<N>
     * - MISTRAL_API_KEY_1, MISTRAL_API_KEY_2, ...
     * - Comma-separated MISTRAL_API_KEYS
     */
    public loadKeysFromEnv(): void {
        const discovered: { index: number; key: string }[] = [];

        // 1. Check comma-separated MISTRAL_API_KEYS
        if (process.env.MISTRAL_API_KEYS) {
            const split = process.env.MISTRAL_API_KEYS.split(",")
                .map((k) => k.trim())
                .filter(Boolean);
            split.forEach((k, idx) => discovered.push({ index: idx, key: k }));
        }

        // 2. Scan all process.env variables for numbered or standard Mistral keys
        for (const [envVar, val] of Object.entries(process.env)) {
            if (!val || typeof val !== "string") continue;
            const trimmed = val.trim();
            if (!trimmed) continue;

            const match = envVar.match(/^MISTRAL_API_KEY(?:_?(\d+))?$/);
            if (match) {
                const num = match[1] ? parseInt(match[1], 10) : 0;
                discovered.push({ index: num, key: trimmed });
            }
        }

        // Sort numerically by index
        discovered.sort((a, b) => a.index - b.index);

        // Deduplicate while preserving order
        const uniqueKeys: string[] = [];
        for (const item of discovered) {
            if (!uniqueKeys.includes(item.key)) {
                uniqueKeys.push(item.key);
            }
        }

        this.keys = uniqueKeys.map((key) => ({
            key,
            rateLimitedUntil: 0,
        }));

        this.currentIndex = 0;

        logger.info(
            { count: this.keys.length },
            `MistralManager loaded ${this.keys.length} API key(s) dynamically from environment.`
        );
    }

    /**
     * Returns the count of discovered keys.
     */
    public getKeyCount(): number {
        return this.keys.length;
    }

    /**
     * Checks if any Mistral API keys are available.
     */
    public hasKeys(): boolean {
        return this.keys.length > 0;
    }

    /**
     * Retrieves the current active key, skipping any currently on rate-limit cooldown if possible.
     */
    public getCurrentKey(): string | null {
        if (!this.hasKeys()) return null;

        const now = Date.now();
        const total = this.keys.length;

        // Try to find the first key starting from currentIndex that is not on cooldown
        for (let i = 0; i < total; i++) {
            const idx = (this.currentIndex + i) % total;
            if (this.keys[idx].rateLimitedUntil <= now) {
                this.currentIndex = idx;
                return this.keys[idx].key;
            }
        }

        // If all keys are on cooldown, pick the one that expires earliest
        let earliestIdx = 0;
        let earliestTime = Infinity;
        for (let i = 0; i < total; i++) {
            if (this.keys[i].rateLimitedUntil < earliestTime) {
                earliestTime = this.keys[i].rateLimitedUntil;
                earliestIdx = i;
            }
        }

        this.currentIndex = earliestIdx;
        return this.keys[earliestIdx].key;
    }

    /**
     * Rotates to the next API key.
     */
    public rotateKey(): string | null {
        if (!this.hasKeys()) return null;
        this.currentIndex = (this.currentIndex + 1) % this.keys.length;
        const key = this.keys[this.currentIndex].key;
        logger.info(
            {
                newIndex: this.currentIndex + 1,
                totalKeys: this.keys.length,
                keySnippet: key.slice(0, 6) + "...",
            },
            `Switched to Mistral API key #${this.currentIndex + 1}`
        );
        return key;
    }

    /**
     * Marks the specified key as rate-limited and sets its cooldown timestamp.
     */
    public markKeyRateLimited(key: string): void {
        const keyIndex = this.keys.findIndex((k) => k.key === key);
        if (keyIndex !== -1) {
            this.keys[keyIndex].rateLimitedUntil = Date.now() + this.cooldownMs;
            logger.warn(
                {
                    keyIndex: keyIndex + 1,
                    cooldownMinutes: this.cooldownMs / 60000,
                    keySnippet: key.slice(0, 6) + "...",
                },
                `Mistral API key #${keyIndex + 1} hit rate limit. Marked on cooldown for ${this.cooldownMs / 60000}m.`
            );
        }
        // Rotate to the next available key immediately
        this.rotateKey();
    }

    /**
     * Detects if an error is related to rate limiting or quota exhaustion.
     */
    public isRateLimitError(error: unknown): boolean {
        if (!error) return false;

        const err = error as {
            status?: number;
            statusCode?: number;
            code?: number | string;
            response?: { status?: number };
            message?: string;
        };

        const status = err.status || err.statusCode || err.response?.status;
        if (status === 429 || status === 402) {
            return true;
        }

        const message = String(err.message || "").toLowerCase();
        return (
            message.includes("429") ||
            message.includes("rate limit") ||
            message.includes("rate_limit") ||
            message.includes("too many requests") ||
            message.includes("quota") ||
            message.includes("capacity") ||
            message.includes("resource_exhausted") ||
            message.includes("usage limit")
        );
    }

    /**
     * Executes an operation with automatic failover to subsequent keys on rate limit.
     */
    public async executeWithRetry<T>(operation: (apiKey: string) => Promise<T>): Promise<T> {
        if (!this.hasKeys()) {
            throw new Error("No Mistral API keys configured in environment.");
        }

        const maxAttempts = this.keys.length;
        let attempts = 0;
        let lastError: unknown;

        while (attempts < maxAttempts) {
            const apiKey = this.getCurrentKey();
            if (!apiKey) {
                throw new Error("No available Mistral API key found.");
            }

            try {
                return await operation(apiKey);
            } catch (error) {
                lastError = error;

                if (this.isRateLimitError(error)) {
                    logger.warn(
                        {
                            attempt: attempts + 1,
                            maxAttempts,
                            error: (error as Error).message,
                        },
                        "Rate limit detected during Mistral API call. Switching to next API key..."
                    );
                    this.markKeyRateLimited(apiKey);
                    attempts++;
                } else {
                    // Non-rate-limit error (e.g. invalid request parameters) should not rotate through all keys
                    throw error;
                }
            }
        }

        logger.error(
            { totalKeys: this.keys.length },
            "All available Mistral API keys exhausted or on cooldown due to rate limits."
        );
        throw lastError || new Error("All Mistral API keys exceeded rate limits.");
    }

    /**
     * Helper to embed a list of documents using LangChain with automatic key failover.
     */
    public async embedDocuments(texts: string[]): Promise<number[][]> {
        return await this.executeWithRetry(async (apiKey) => {
            const embeddings = new MistralAIEmbeddings({
                apiKey,
                model: "mistral-embed",
            });
            return await embeddings.embedDocuments(texts);
        });
    }

    /**
     * Helper to embed a single query text using LangChain with automatic key failover.
     */
    public async embedQuery(text: string): Promise<number[]> {
        return await this.executeWithRetry(async (apiKey) => {
            const embeddings = new MistralAIEmbeddings({
                apiKey,
                model: "mistral-embed",
            });
            return await embeddings.embedQuery(text);
        });
    }

    /**
     * Helper to instantiate a ChatMistralAI instance with the currently active key.
     */
    public getChatModel(options?: {
        model?: string;
        temperature?: number;
    }): ChatMistralAI {
        const apiKey = this.getCurrentKey();
        if (!apiKey) {
            throw new Error("No Mistral API key available for ChatMistralAI.");
        }

        return new ChatMistralAI({
            apiKey,
            model: options?.model || "mistral-medium-latest",
            temperature: options?.temperature ?? 0.7,
        });
    }
}

export const mistralManager = new MistralManager();
export default mistralManager;
