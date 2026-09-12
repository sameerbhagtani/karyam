import { RapidApiManager } from "../shared/services/rapidApiManager.service.js";

describe("RapidApiManager - Dynamic Key Loading & Round-Robin Failover", () => {
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
            process.env.RAPIDAPI_KEY10 = "rapid_key_10";
            process.env.RAPIDAPI_KEY1 = "rapid_key_1";
            process.env.RAPIDAPI_KEY2 = "rapid_key_2";
            process.env.RAPIDAPI_KEY_3 = "rapid_key_3";
            process.env.RAPIDAPI_KEY = "rapid_key_default";

            const manager = new RapidApiManager();
            expect(manager.getKeyCount()).toBeGreaterThanOrEqual(4);

            // First key should be rapid_key_default (index 0) or rapid_key_1 (index 1)
            const current = manager.getCurrentKey();
            expect(current).toBe("rapid_key_default");
        });

        it("should support RAPIDAPI_KEY{i} where i goes from 1...n", () => {
            Object.keys(process.env).forEach((k) => {
                if (k.startsWith("RAPIDAPI_KEY")) delete process.env[k];
            });

            process.env.RAPIDAPI_KEY1 = "key_first";
            process.env.RAPIDAPI_KEY2 = "key_second";
            process.env.RAPIDAPI_KEY3 = "key_third";

            const manager = new RapidApiManager();
            expect(manager.getKeyCount()).toBe(3);
            expect(manager.getCurrentKey()).toBe("key_first");
            expect(manager.rotateKey()).toBe("key_second");
            expect(manager.rotateKey()).toBe("key_third");
            expect(manager.rotateKey()).toBe("key_first"); // Loops around
        });

        it("should support comma-separated RAPIDAPI_KEYS", () => {
            Object.keys(process.env).forEach((k) => {
                if (k.startsWith("RAPIDAPI_KEY")) delete process.env[k];
            });

            process.env.RAPIDAPI_KEYS = "rapid_a, rapid_b, rapid_c";

            const manager = new RapidApiManager();
            expect(manager.getKeyCount()).toBe(3);
            expect(manager.getCurrentKey()).toBe("rapid_a");
            expect(manager.rotateKey()).toBe("rapid_b");
            expect(manager.rotateKey()).toBe("rapid_c");
            expect(manager.rotateKey()).toBe("rapid_a");
        });

        it("should deduplicate identical keys while preserving order", () => {
            Object.keys(process.env).forEach((k) => {
                if (k.startsWith("RAPIDAPI_KEY")) delete process.env[k];
            });

            process.env.RAPIDAPI_KEY1 = "same_key";
            process.env.RAPIDAPI_KEY2 = "same_key";
            process.env.RAPIDAPI_KEY3 = "other_key";

            const manager = new RapidApiManager();
            expect(manager.getKeyCount()).toBe(2);
            expect(manager.getAllKeys()).toEqual(["same_key", "other_key"]);
        });
    });

    describe("Rate-Limit & Quota Error Detection", () => {
        const manager = new RapidApiManager();

        it("should identify HTTP 429 and 402 as rate limit / quota errors", () => {
            expect(manager.isRateLimitError({ status: 429 })).toBe(true);
            expect(manager.isRateLimitError({ statusCode: 429 })).toBe(true);
            expect(manager.isRateLimitError({ response: { status: 429 } })).toBe(true);
            expect(manager.isRateLimitError({ status: 402 })).toBe(true);
        });

        it("should identify HTTP 403 quota exceeded messages typical in RapidAPI", () => {
            expect(
                manager.isRateLimitError({
                    status: 403,
                    responseBody: JSON.stringify({
                        message: "You have exceeded the MONTHLY quota for Requests on your current plan.",
                    }),
                })
            ).toBe(true);

            expect(
                manager.isRateLimitError({
                    status: 403,
                    responseBody: JSON.stringify({
                        message: "You have exceeded the rate limit per minute for your plan.",
                    }),
                })
            ).toBe(true);

            expect(
                manager.isRateLimitError({
                    status: 403,
                    message: "Forbidden - not subscribed or quota limit reached",
                })
            ).toBe(true);
        });

        it("should identify rate limit and quota keywords in error strings", () => {
            expect(manager.isRateLimitError(new Error("Rate limit exceeded"))).toBe(true);
            expect(manager.isRateLimitError(new Error("429 Too Many Requests"))).toBe(true);
            expect(manager.isRateLimitError(new Error("Resource exhausted: monthly quota reached"))).toBe(true);
            expect(manager.isRateLimitError(new Error("Usage limit reached for JSearch"))).toBe(true);
        });

        it("should not treat non-rate-limit errors as rate limit errors", () => {
            expect(manager.isRateLimitError(new Error("Invalid parameters in query"))).toBe(false);
            expect(manager.isRateLimitError({ status: 400 })).toBe(false);
            expect(manager.isRateLimitError({ status: 500 })).toBe(false);
        });
    });

    describe("Failover and Seamless Round-Robin Retry", () => {
        it("should automatically switch to the next key when a rate limit occurs", async () => {
            Object.keys(process.env).forEach((k) => {
                if (k.startsWith("RAPIDAPI_KEY")) delete process.env[k];
            });
            process.env.RAPIDAPI_KEYS = "rapid_alpha,rapid_beta,rapid_gamma";

            const manager = new RapidApiManager(1); // 1 minute cooldown
            expect(manager.getCurrentKey()).toBe("rapid_alpha");

            let callCount = 0;
            const attemptedKeys: string[] = [];

            const result = await manager.executeWithRetry(async (apiKey) => {
                callCount++;
                attemptedKeys.push(apiKey);

                if (apiKey === "rapid_alpha") {
                    const error = new Error("Status 429: Too Many Requests");
                    (error as unknown as { status: number }).status = 429;
                    throw error;
                }

                return `success_with_${apiKey}`;
            });

            expect(result).toBe("success_with_rapid_beta");
            expect(callCount).toBe(2);
            expect(attemptedKeys).toEqual(["rapid_alpha", "rapid_beta"]);

            // Subsequent call should stick with the active working key (rapid_beta)
            expect(manager.getCurrentKey()).toBe("rapid_beta");
        });

        it("should stop retrying immediately on non-rate-limit errors", async () => {
            Object.keys(process.env).forEach((k) => {
                if (k.startsWith("RAPIDAPI_KEY")) delete process.env[k];
            });
            process.env.RAPIDAPI_KEYS = "key_1,key_2,key_3";

            const manager = new RapidApiManager();
            let attempts = 0;

            await expect(
                manager.executeWithRetry(async () => {
                    attempts++;
                    throw new Error("Validation error: Invalid query syntax");
                })
            ).rejects.toThrow("Validation error: Invalid query syntax");

            expect(attempts).toBe(1); // Did not retry across other keys
        });

        it("should throw if all keys in the pool hit rate limits or quota", async () => {
            Object.keys(process.env).forEach((k) => {
                if (k.startsWith("RAPIDAPI_KEY")) delete process.env[k];
            });
            process.env.RAPIDAPI_KEYS = "exhaust_1,exhaust_2";

            const manager = new RapidApiManager();
            let attempts = 0;

            await expect(
                manager.executeWithRetry(async () => {
                    attempts++;
                    const err = new Error("RapidAPI monthly quota exceeded");
                    (err as unknown as { status: number }).status = 429;
                    throw err;
                })
            ).rejects.toThrow();

            expect(attempts).toBe(2); // Tried all 2 keys before giving up
        });
    });
});
