import { jest } from "@jest/globals";
import request from "supertest";
import mongoose, { Types } from "mongoose";
import createApp from "../app.js";
import env from "../shared/config/env.config.js";
import { generateAccessToken } from "../shared/utils/token.util.js";
import jobHuntService from "../shared/services/jobHunt.service.js";
import JobDescription from "../shared/models/jobDescription.model.js";
import JobSearchLog from "../shared/models/jobSearchLog.model.js";

const app = createApp();

// Mock RapidAPI configuration in tests to preserve the user's live RapidAPI quota
jobHuntService.isConfigured = () => false;

describe("Job Hunt Module, Service & Rate Limiting", () => {
    jest.setTimeout(30000);
    const userId = new Types.ObjectId().toString();
    const token = generateAccessToken({ userId, email: "jobhunt-user@example.com" });

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(env.MONGO_URI);
        }
        await JobSearchLog.deleteMany({ userId: new Types.ObjectId(userId) });
    });

    afterAll(async () => {
        await JobDescription.deleteMany({ userId: new Types.ObjectId(userId) });
        await JobSearchLog.deleteMany({ userId: new Types.ObjectId(userId) });
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    });

    describe("JobHuntService Direct Unit Tests", () => {
        it("should return 5 curated job listings for a search query", async () => {
            const results = await jobHuntService.searchJobs("Full Stack Developer", "Remote", 5);
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(5);

            const first = results[0];
            expect(first).toHaveProperty("id");
            expect(first).toHaveProperty("title");
            expect(first).toHaveProperty("company");
            expect(first).toHaveProperty("location");
            expect(first).toHaveProperty("sourcePlatform");
            expect(first).toHaveProperty("applyUrl");
            expect(first).toHaveProperty("description");
            expect(first.description.length).toBeGreaterThan(50);
        });
    });

    describe("API Endpoints & Rate Limiting (5/hr)", () => {
        it("should reject unauthenticated search requests with 401", async () => {
            const res = await request(app).get("/api/job-hunt/search?query=Backend");
            expect(res.status).toBe(401);
        });

        it("should return initial rate limit status (5 remaining)", async () => {
            const res = await request(app)
                .get("/api/job-hunt/rate-limit")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("rateLimit");
            expect(res.body.rateLimit.limit).toBe(5);
            expect(res.body.rateLimit.remaining).toBe(5);
            expect(res.body.rateLimit.isAllowed).toBe(true);
        });

        it("should return 400 when search query is empty", async () => {
            const res = await request(app)
                .get("/api/job-hunt/search?query=")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(400);
        });

        it("should return 200 with job listings and decrement rate limit quota", async () => {
            const res = await request(app)
                .get("/api/job-hunt/search?query=Frontend+Engineer&location=Remote")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("jobs");
            expect(Array.isArray(res.body.jobs)).toBe(true);
            expect(res.body.jobs.length).toBe(5);
            expect(res.body.rateLimit.remaining).toBe(4);
        });

        it("should enforce the 5 searches/hour rate limit and return 429 on the 6th search", async () => {
            // Perform 4 more searches to reach 5 total
            for (let i = 0; i < 4; i++) {
                const s = await request(app)
                    .get(`/api/job-hunt/search?query=Role+${i}`)
                    .set("Authorization", `Bearer ${token}`);
                expect(s.status).toBe(200);
            }

            // 6th search must return 429 Too Many Requests
            const blocked = await request(app)
                .get("/api/job-hunt/search?query=BlockedRole")
                .set("Authorization", `Bearer ${token}`);

            expect(blocked.status).toBe(429);
            expect(blocked.body.message).toContain("5 job searches per hour");
        });

        it("should prepare and create a JD record via POST /api/job-hunt/prepare", async () => {
            const payload = {
                title: "Senior Full Stack Engineer",
                company: "Stripe",
                description: "Stripe is looking for a Senior Full Stack Engineer to lead payments dashboard architecture. Must know React, Node, and TypeScript.",
                applyUrl: "https://www.linkedin.com/jobs/view/12345",
                sourcePlatform: "LinkedIn",
            };

            const res = await request(app)
                .post("/api/job-hunt/prepare")
                .set("Authorization", `Bearer ${token}`)
                .send(payload);

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty("jdId");
            expect(res.body.title).toBe("Senior Full Stack Engineer");
            expect(res.body.company).toBe("Stripe");

            // Verify in MongoDB
            const created = await JobDescription.findById(res.body.jdId);
            expect(created).not.toBeNull();
            expect(created?.title).toBe("Senior Full Stack Engineer");
            expect(created?.sourceType).toBe("pasted_text");
        });
    });
});
