import request from "supertest";
import mongoose, { Types } from "mongoose";
import createApp from "../app.js";
import env from "../shared/config/env.config.js";
import { generateAccessToken } from "../shared/utils/token.util.js";
import Resume from "../shared/models/resume.model.js";
import JobDescription from "../shared/models/jobDescription.model.js";
import InterviewSession from "../shared/models/interviewSession.model.js";
import textExtractionService from "../shared/services/textExtraction.service.js";
import vectorService from "../shared/services/vector.service.js";

const app = createApp();

const samplePdfBuffer = Buffer.from(
    "%PDF-1.4\n" +
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n" +
    "3 0 obj<</Type/Page/MediaBox[0 0 300 144]/Parent 2 0 R/Resources<<>>/Contents 4 0 R>>endobj\n" +
    "4 0 obj<</Length 55>>stream\n" +
    "BT /F1 18 Tf 50 100 Td (Experienced Software Engineer Resume) Tj ET\n" +
    "endstream\n" +
    "endobj\n" +
    "xref\n" +
    "0 5\n" +
    "0000000000 65535 f \n" +
    "0000000009 00000 n \n" +
    "0000000058 00000 n \n" +
    "0000000115 00000 n \n" +
    "0000000210 00000 n \n" +
    "trailer<</Size 5/Root 1 0 R>>\n" +
    "startxref\n" +
    "314\n" +
    "%%EOF"
);

describe("Dev A Backend - Ingestion, Storage & Session Setup", () => {
    const user1Id = new Types.ObjectId().toString();
    const user2Id = new Types.ObjectId().toString();

    const user1Token = generateAccessToken({ userId: user1Id, email: "user1@example.com" });
    const user2Token = generateAccessToken({ userId: user2Id, email: "user2@example.com" });

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(env.MONGO_URI);
        }
    });

    afterAll(async () => {
        await Resume.deleteMany({ userId: { $in: [user1Id, user2Id] } });
        await JobDescription.deleteMany({ userId: { $in: [user1Id, user2Id] } });
        await InterviewSession.deleteMany({ userId: { $in: [user1Id, user2Id] } });
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    });

    describe("Core Services Unit Tests", () => {
        it("should extract text from a valid PDF buffer", async () => {
            const text = await textExtractionService.extractText(
                samplePdfBuffer,
                "application/pdf",
                "sample.pdf"
            );
            expect(text).toContain("Experienced Software Engineer");
        });

        it("should reject unsupported file types", async () => {
            await expect(
                textExtractionService.extractText(
                    Buffer.from("fake image data"),
                    "image/png",
                    "photo.png"
                )
            ).rejects.toThrow("Unsupported file type");
        });

        it("should chunk resume and JD text correctly", async () => {
            const resumeText =
                "Full Stack Developer with 5 years experience in Node.js, React, TypeScript and MongoDB. Built high throughput systems.";
            const chunks = await vectorService.chunkText(resumeText, "resume");
            expect(chunks.length).toBeGreaterThan(0);
            expect(chunks[0].sourceType).toBe("resume");
            expect(chunks[0].text).toContain("Full Stack Developer");
        });
    });

    describe("POST /api/resumes", () => {
        it("should reject unauthenticated upload requests", async () => {
            const res = await request(app)
                .post("/api/resumes")
                .attach("file", samplePdfBuffer, "resume.pdf");

            expect(res.status).toBe(401);
        });

        it("should return 400 when no file is uploaded", async () => {
            const res = await request(app)
                .post("/api/resumes")
                .set("Authorization", `Bearer ${user1Token}`);

            expect(res.status).toBe(400);
        });

        it("should successfully upload a PDF resume and return PRD-matching response", async () => {
            const res = await request(app)
                .post("/api/resumes")
                .set("Authorization", `Bearer ${user1Token}`)
                .attach("file", samplePdfBuffer, "john_doe_resume.pdf");

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty("resumeId");
            expect(res.body.originalFilename).toBe("john_doe_resume.pdf");
            expect(res.body.status).toBe("processed");

            // Verify in database
            const doc = await Resume.findById(res.body.resumeId);
            expect(doc).not.toBeNull();
            expect(doc?.userId.toString()).toBe(user1Id);
            expect(doc?.s3Key).toContain(`resumes/${user1Id}/`);
            expect(doc?.extractedText).toContain("Experienced Software Engineer");
        });

        it("should fetch resume by ID when requested by owner", async () => {
            const uploadRes = await request(app)
                .post("/api/resumes")
                .set("Authorization", `Bearer ${user1Token}`)
                .attach("file", samplePdfBuffer, "my_resume.pdf");

            const resumeId = uploadRes.body.resumeId;

            const getRes = await request(app)
                .get(`/api/resumes/${resumeId}`)
                .set("Authorization", `Bearer ${user1Token}`);

            expect(getRes.status).toBe(200);
            expect(getRes.body.resumeId).toBe(resumeId);
            expect(getRes.body.originalFilename).toBe("my_resume.pdf");

            // Other user cannot access it
            const unauthorizedGet = await request(app)
                .get(`/api/resumes/${resumeId}`)
                .set("Authorization", `Bearer ${user2Token}`);

            expect(unauthorizedGet.status).toBe(404);
        });
    });

    describe("POST /api/job-descriptions", () => {
        it("should reject unauthenticated requests", async () => {
            const res = await request(app)
                .post("/api/job-descriptions")
                .send({
                    title: "Senior Backend Engineer",
                    company: "Tech Corp",
                    rawText: "We are seeking a senior backend developer...",
                });

            expect(res.status).toBe(401);
        });

        it("should successfully create a job description with pasted text", async () => {
            const res = await request(app)
                .post("/api/job-descriptions")
                .set("Authorization", `Bearer ${user1Token}`)
                .send({
                    title: "Senior Backend Engineer",
                    company: "Tech Corp",
                    rawText: "Seeking expertise in Node.js, Express, MongoDB and microservices.",
                });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty("jdId");

            const doc = await JobDescription.findById(res.body.jdId);
            expect(doc).not.toBeNull();
            expect(doc?.sourceType).toBe("pasted_text");
            expect(doc?.title).toBe("Senior Backend Engineer");
            expect(doc?.company).toBe("Tech Corp");
            expect(doc?.s3Key).toBeUndefined();
        });

        it("should successfully create a job description via file upload", async () => {
            const res = await request(app)
                .post("/api/job-descriptions")
                .set("Authorization", `Bearer ${user1Token}`)
                .field("title", "Staff Engineer")
                .field("company", "Global Innovations")
                .attach("file", samplePdfBuffer, "jd.pdf");

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty("jdId");

            const doc = await JobDescription.findById(res.body.jdId);
            expect(doc).not.toBeNull();
            expect(doc?.sourceType).toBe("upload");
            expect(doc?.s3Key).toContain(`job-descriptions/${user1Id}/`);
            expect(doc?.rawText).toContain("Experienced Software Engineer");
        });

        it("should fetch job description by ID", async () => {
            const createRes = await request(app)
                .post("/api/job-descriptions")
                .set("Authorization", `Bearer ${user1Token}`)
                .send({
                    title: "Lead Developer",
                    company: "Acme",
                    rawText: "Lead Developer requirements...",
                });

            const jdId = createRes.body.jdId;

            const getRes = await request(app)
                .get(`/api/job-descriptions/${jdId}`)
                .set("Authorization", `Bearer ${user1Token}`);

            expect(getRes.status).toBe(200);
            expect(getRes.body.jdId).toBe(jdId);
            expect(getRes.body.title).toBe("Lead Developer");

            // User 2 cannot access user 1's JD
            const forbiddenRes = await request(app)
                .get(`/api/job-descriptions/${jdId}`)
                .set("Authorization", `Bearer ${user2Token}`);

            expect(forbiddenRes.status).toBe(404);
        });
    });

    describe("Interview Session Lifecycle", () => {
        let resumeId: string;
        let jdId: string;

        beforeAll(async () => {
            const resume = await Resume.create({
                userId: new Types.ObjectId(user1Id),
                originalFilename: "session_test_resume.pdf",
                s3Key: `resumes/${user1Id}/test.pdf`,
                mimeType: "application/pdf",
                extractedText: "Experienced in cloud native applications and distributed systems.",
            });
            resumeId = resume._id.toString();

            const jd = await JobDescription.create({
                userId: new Types.ObjectId(user1Id),
                title: "Cloud Architect",
                company: "Cloud Corp",
                sourceType: "pasted_text",
                rawText: "Must have deep knowledge of distributed systems and Kubernetes.",
            });
            jdId = jd._id.toString();
        });

        it("should reject session creation if unauthenticated", async () => {
            const res = await request(app)
                .post("/api/interview-sessions")
                .send({ resumeId, jdId, targetLoopCount: 7 });

            expect(res.status).toBe(401);
        });

        it("should reject session creation with invalid targetLoopCount", async () => {
            const res = await request(app)
                .post("/api/interview-sessions")
                .set("Authorization", `Bearer ${user1Token}`)
                .send({ resumeId, jdId, targetLoopCount: 15 });

            expect(res.status).toBe(400);
        });

        it("should reject session creation if resume belongs to another user", async () => {
            const res = await request(app)
                .post("/api/interview-sessions")
                .set("Authorization", `Bearer ${user2Token}`)
                .send({ resumeId, jdId, targetLoopCount: 7 });

            expect(res.status).toBe(404);
        });

        it("should successfully create interview session and return status 'embedding'", async () => {
            const res = await request(app)
                .post("/api/interview-sessions")
                .set("Authorization", `Bearer ${user1Token}`)
                .send({ resumeId, jdId, targetLoopCount: 8 });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty("sessionId");
            expect(res.body.status).toBe("embedding");

            const sessionId = res.body.sessionId;

            // Wait a brief moment for background stub embedding to transition to 'ready'
            await new Promise((resolve) => setTimeout(resolve, 500));

            const statusRes = await request(app)
                .get(`/api/interview-sessions/${sessionId}`)
                .set("Authorization", `Bearer ${user1Token}`);

            expect(statusRes.status).toBe(200);
            expect(statusRes.body.sessionId).toBe(sessionId);
            expect(["embedding", "ready"]).toContain(statusRes.body.status);
            expect(statusRes.body.currentTurnIndex).toBe(0);
            expect(statusRes.body.targetLoopCount).toBe(8);
        });

        it("should handle session report endpoints", async () => {
            // Create a completed session fixture with report
            const session = await InterviewSession.create({
                userId: new Types.ObjectId(user1Id),
                resumeId: new Types.ObjectId(resumeId),
                jdId: new Types.ObjectId(jdId),
                pineconeNamespace: "test-report-session",
                status: "completed",
                targetLoopCount: 7,
                currentTurnIndex: 7,
                report: {
                    confidenceScore: 8,
                    answerQualityScore: 7,
                    strengths: ["Strong architectural concepts", "Clear communication"],
                    weaknesses: ["Could provide more specific metric outcomes"],
                    advice: "Practice STAR method examples for leadership questions.",
                },
            });

            const reportRes = await request(app)
                .get(`/api/interview-sessions/${session._id}/report`)
                .set("Authorization", `Bearer ${user1Token}`);

            expect(reportRes.status).toBe(200);
            expect(reportRes.body.confidenceScore).toBe(8);
            expect(reportRes.body.answerQualityScore).toBe(7);
            expect(reportRes.body.strengths).toEqual([
                "Strong architectural concepts",
                "Clear communication",
            ]);
            expect(reportRes.body.weaknesses).toEqual([
                "Could provide more specific metric outcomes",
            ]);
            expect(reportRes.body.advice).toContain("Practice STAR method");
        });

        it("should return 404 for report when session has not completed / has no report", async () => {
            const pendingSession = await InterviewSession.create({
                userId: new Types.ObjectId(user1Id),
                resumeId: new Types.ObjectId(resumeId),
                jdId: new Types.ObjectId(jdId),
                pineconeNamespace: "pending-report-session",
                status: "ready",
                targetLoopCount: 7,
                currentTurnIndex: 0,
            });

            const res = await request(app)
                .get(`/api/interview-sessions/${pendingSession._id}/report`)
                .set("Authorization", `Bearer ${user1Token}`);

            expect(res.status).toBe(404);
        });
    });
});
