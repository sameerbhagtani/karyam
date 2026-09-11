import { MistralManager } from "../shared/services/mistralManager.service.js";

describe("MistralManager - Dynamic Key Loading & Round-Robin Failover", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe("Dynamic Key Discovery", () => {
        it("should dynamically discover arbitrary numbers of keys and order them numerically", () => {
            // Set arbitrary numbered keys in random order
            process.env.MISTRAL_API_KEY10 = "key_10";
            process.env.MISTRAL_API_KEY1 = "key_1";
            process.env.MISTRAL_API_KEY2 = "key_2";
            process.env.MISTRAL_API_KEY_3 = "key_3";
            process.env.MISTRAL_API_KEY = "key_default";

            const manager = new MistralManager();
            expect(manager.getKeyCount()).toBeGreaterThanOrEqual(4);

            // First key should be key_default (index 0) or key_1 (index 1)
            const current = manager.getCurrentKey();
            expect(current).toBeDefined();
        });

        it("should support comma-separated MISTRAL_API_KEYS", () => {
            // Clear single keys
            Object.keys(process.env).forEach((k) => {
                if (k.startsWith("MISTRAL_API_KEY")) delete process.env[k];
            });

            process.env.MISTRAL_API_KEYS = "custom_key_a, custom_key_b, custom_key_c";

            const manager = new MistralManager();
            expect(manager.getKeyCount()).toBe(3);
            expect(manager.getCurrentKey()).toBe("custom_key_a");
            expect(manager.rotateKey()).toBe("custom_key_b");
            expect(manager.rotateKey()).toBe("custom_key_c");
            expect(manager.rotateKey()).toBe("custom_key_a"); // Loops back
        });
    });

    describe("Rate-Limit Error Detection", () => {
        const manager = new MistralManager();

        it("should identify HTTP 429 as rate limit error", () => {
            expect(manager.isRateLimitError({ status: 429 })).toBe(true);
            expect(manager.isRateLimitError({ statusCode: 429 })).toBe(true);
            expect(manager.isRateLimitError({ response: { status: 429 } })).toBe(true);
        });

        it("should identify rate limit messages in error strings", () => {
            expect(manager.isRateLimitError(new Error("Rate limit exceeded"))).toBe(true);
            expect(manager.isRateLimitError(new Error("429 Too Many Requests"))).toBe(true);
            expect(manager.isRateLimitError(new Error("Resource exhausted: quota limit reached"))).toBe(true);
            expect(manager.isRateLimitError(new Error("Usage limit reached for model"))).toBe(true);
        });

        it("should not treat regular errors as rate limit errors", () => {
            expect(manager.isRateLimitError(new Error("Invalid JSON in prompt"))).toBe(false);
            expect(manager.isRateLimitError({ status: 400 })).toBe(false);
            expect(manager.isRateLimitError({ status: 500 })).toBe(false);
        });
    });

    describe("Failover and Seamless Retry", () => {
        it("should automatically switch to the next key when a rate limit occurs", async () => {
            Object.keys(process.env).forEach((k) => {
                if (k.startsWith("MISTRAL_API_KEY")) delete process.env[k];
            });
            process.env.MISTRAL_API_KEYS = "key_alpha,key_beta,key_gamma";

            const manager = new MistralManager(1); // 1 minute cooldown
            expect(manager.getCurrentKey()).toBe("key_alpha");

            let callCount = 0;
            const attemptedKeys: string[] = [];

            const result = await manager.executeWithRetry(async (apiKey) => {
                callCount++;
                attemptedKeys.push(apiKey);

                if (apiKey === "key_alpha") {
                    const error = new Error("Status 429: Too Many Requests");
                    (error as unknown as { status: number }).status = 429;
                    throw error;
                }

                return `success_with_${apiKey}`;
            });

            expect(result).toBe("success_with_key_beta");
            expect(callCount).toBe(2);
            expect(attemptedKeys).toEqual(["key_alpha", "key_beta"]);

            // Subsequent call should stick with the active working key (key_beta)
            expect(manager.getCurrentKey()).toBe("key_beta");
        });

        it("should stop retrying immediately on non-rate-limit errors", async () => {
            Object.keys(process.env).forEach((k) => {
                if (k.startsWith("MISTRAL_API_KEY")) delete process.env[k];
            });
            process.env.MISTRAL_API_KEYS = "key_1,key_2,key_3";

            const manager = new MistralManager();
            let attempts = 0;

            await expect(
                manager.executeWithRetry(async () => {
                    attempts++;
                    throw new Error("Validation error: Prompt too long");
                })
            ).rejects.toThrow("Validation error: Prompt too long");

            expect(attempts).toBe(1); // Did not retry across other keys
        });

        it("should throw if all keys in the pool hit rate limits", async () => {
            Object.keys(process.env).forEach((k) => {
                if (k.startsWith("MISTRAL_API_KEY")) delete process.env[k];
            });
            process.env.MISTRAL_API_KEYS = "exhaust_1,exhaust_2";

            const manager = new MistralManager();
            let attempts = 0;

            await expect(
                manager.executeWithRetry(async () => {
                    attempts++;
                    const err = new Error("Rate limit 429");
                    (err as unknown as { status: number }).status = 429;
                    throw err;
                })
            ).rejects.toThrow();

            expect(attempts).toBe(2); // Tried all 2 keys before giving up
        });
    });
});
