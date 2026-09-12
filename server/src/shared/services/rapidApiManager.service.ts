import logger from "../config/logger.config.js";

export interface KeyState {
    key: string;
    rateLimitedUntil: number; // timestamp in ms
}

export class RapidApiManager {
    private keys: KeyState[] = [];
    private currentIndex: number = 0;
    private readonly cooldownMs: number;

    constructor(cooldownMinutes: number = 15) {
        this.cooldownMs = cooldownMinutes * 60 * 1000;
        this.loadKeysFromEnv();
    }

    /**
     * Dynamically loads all RapidAPI keys from environment variables.
     * Supports:
     * - RAPIDAPI_KEY
     * - RAPIDAPI_KEY1, RAPIDAPI_KEY2, ... RAPIDAPI_KEY<N>
     * - RAPIDAPI_KEY_1, RAPIDAPI_KEY_2, ...
     * - Comma-separated RAPIDAPI_KEYS
     */
    public loadKeysFromEnv(): void {
        const discovered: { index: number; key: string }[] = [];

        // 1. Check comma-separated RAPIDAPI_KEYS
        if (process.env.RAPIDAPI_KEYS) {
            const split = process.env.RAPIDAPI_KEYS.split(",")
                .map((k) => k.trim())
                .filter(Boolean);
            split.forEach((k, idx) => discovered.push({ index: idx, key: k }));
        }

        // 2. Scan all process.env variables for numbered or standard RapidAPI keys
        for (const [envVar, val] of Object.entries(process.env)) {
            if (!val || typeof val !== "string") continue;
            const trimmed = val.trim();
            if (!trimmed) continue;

            const match = envVar.match(/^RAPIDAPI_KEY(?:_?(\d+))?$/);
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
            `RapidApiManager loaded ${this.keys.length} API key(s) dynamically from environment.`
        );
    }

    /**
     * Returns the count of discovered keys.
     */
    public getKeyCount(): number {
        return this.keys.length;
    }

    /**
     * Checks if any RapidAPI keys are available.
     */
    public hasKeys(): boolean {
        return this.keys.length > 0;
    }

    /**
     * Returns all unique discovered keys.
     */
    public getAllKeys(): string[] {
        return this.keys.map((k) => k.key);
    }

    /**
     * Returns the 0-based index of the currently selected key.
     */
    public getCurrentIndex(): number {
        return this.currentIndex;
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
     * Rotates to the next API key in round-robin fashion.
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
            `Switched to RapidAPI key #${this.currentIndex + 1}`
        );
        return key;
    }

    /**
     * Marks the specified key as rate-limited or quota-exhausted and sets its cooldown timestamp.
     */
    public markKeyRateLimited(key: string, cooldownMinutes?: number): void {
        const keyIndex = this.keys.findIndex((k) => k.key === key);
        const cooldown = cooldownMinutes !== undefined ? cooldownMinutes * 60 * 1000 : this.cooldownMs;
        if (keyIndex !== -1) {
            this.keys[keyIndex].rateLimitedUntil = Date.now() + cooldown;
            logger.warn(
                {
                    keyIndex: keyIndex + 1,
                    cooldownMinutes: cooldown / 60000,
                    keySnippet: key.slice(0, 6) + "...",
                },
                `RapidAPI key #${keyIndex + 1} hit rate limit / quota. Marked on cooldown for ${cooldown / 60000}m.`
            );
        }
        // Rotate to the next available key immediately
        this.rotateKey();
    }

    /**
     * Checks if an HTTP response from RapidAPI indicates rate limiting or quota exhaustion.
     */
    public isRateLimitResponse(status: number, responseBody: string = ""): boolean {
        if (status === 429 || status === 402) {
            return true;
        }

        const body = responseBody.toLowerCase();

        // 403 on RapidAPI is returned when monthly quota is exceeded, plan limit reached, or unsubscribed
        if (status === 403) {
            return (
                body.includes("quota") ||
                body.includes("exceeded") ||
                body.includes("rate limit") ||
                body.includes("rate_limit") ||
                body.includes("subscribed") ||
                body.includes("subscription") ||
                body.includes("limit") ||
                body.includes("plan") ||
                body.includes("unauthorized") ||
                body.includes("credits") ||
                body.length === 0
            );
        }

        return (
            body.includes("429") ||
            body.includes("rate limit") ||
            body.includes("rate_limit") ||
            body.includes("too many requests") ||
            body.includes("quota") ||
            body.includes("exceeded") ||
            body.includes("resource_exhausted") ||
            body.includes("usage limit")
        );
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
            response?: { status?: number; data?: unknown };
            responseBody?: string;
            message?: string;
        };

        const status = err.status || err.statusCode || err.response?.status;
        const responseText =
            err.responseBody ||
            (typeof err.response?.data === "string"
                ? err.response?.data
                : JSON.stringify(err.response?.data || ""));

        if (status && this.isRateLimitResponse(Number(status), responseText)) {
            return true;
        }

        const message = String(err.message || "").toLowerCase();
        return (
            message.includes("429") ||
            message.includes("rate limit") ||
            message.includes("rate_limit") ||
            message.includes("too many requests") ||
            message.includes("quota") ||
            message.includes("exceeded") ||
            message.includes("capacity") ||
            message.includes("resource_exhausted") ||
            message.includes("usage limit")
        );
    }

    /**
     * Executes an operation with automatic failover to subsequent keys upon rate limit or quota exhaustion.
     */
    public async executeWithRetry<T>(operation: (apiKey: string) => Promise<T>): Promise<T> {
        if (!this.hasKeys()) {
            throw new Error("No RapidAPI keys configured in environment.");
        }

        const availableCount = this.keys.filter((k) => k.rateLimitedUntil <= Date.now()).length;
        const maxAttempts = availableCount > 0 ? availableCount : 1;
        let attempts = 0;
        let lastError: unknown;

        while (attempts < maxAttempts) {
            const apiKey = this.getCurrentKey();
            if (!apiKey) {
                throw new Error("No available RapidAPI key found.");
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
                        "Rate limit / quota exhaustion detected during RapidAPI call. Switching to next API key..."
                    );
                    this.markKeyRateLimited(apiKey);
                    attempts++;
                } else {
                    // Non-rate-limit error (e.g. invalid query) should fail fast
                    throw error;
                }
            }
        }

        logger.error(
            { totalKeys: this.keys.length },
            "All available RapidAPI keys exhausted or on cooldown due to rate limits."
        );
        throw lastError || new Error("All RapidAPI keys exceeded rate limits or quota.");
    }
}

export const rapidApiManager = new RapidApiManager();
export default rapidApiManager;
