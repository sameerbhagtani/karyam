import request from "supertest";
import mongoose, { Types } from "mongoose";
import createApp from "../app.js";
import env from "../shared/config/env.config.js";
import { generateAccessToken } from "../shared/utils/token.util.js";
import Resume from "../shared/models/resume.model.js";
import JobDescription from "../shared/models/jobDescription.model.js";
import InterviewSession from "../shared/models/interviewSession.model.js";
import InterviewTurn from "../shared/models/interviewTurn.model.js";
import InterviewTurnDao from "../shared/dao/interviewTurn.dao.js";
import sarvamService from "../shared/services/sarvam.service.js";
import mistralManager from "../shared/services/mistralManager.service.js";

const app = createApp();

// Mock mistralManager.hasKeys in integration tests to prevent calling external free-tier APIs
mistralManager.hasKeys = () => false;


// Valid 44-byte minimal WAV audio buffer for test fixtures
const sampleWavBuffer = Buffer.from(
    "UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
    "base64"
);

describe("Dev B Backend - Voice Pipeline & Interview Engine", () => {
    const userId = new Types.ObjectId().toString();
    const otherUserId = new Types.ObjectId().toString();

    const userToken = generateAccessToken({ userId, email: "devb-user@example.com" });
    const otherUserToken = generateAccessToken({
        userId: otherUserId,
        email: "devb-other@example.com",
    });

    let testResumeId: Types.ObjectId;
    let testJdId: Types.ObjectId;
    let testSessionId: Types.ObjectId;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(env.MONGO_URI);
        }

        // Setup test resume
        const resume = await Resume.create({
            userId: new Types.ObjectId(userId),
            originalFilename: "resume.pdf",
            mimeType: "application/pdf",
            s3Key: "test/resume.pdf",
            extractedText:
                "Experienced Full Stack Engineer with 4 years in Node.js, Express, React, MongoDB, and TypeScript. Designed resilient microservices.",
        });
        testResumeId = resume._id;

        // Setup test JD
        const jd = await JobDescription.create({
            userId: new Types.ObjectId(userId),
            title: "Senior Backend Engineer",
            company: "Acme Corp",
            sourceType: "pasted_text",
            rawText:
                "Looking for a Senior Backend Engineer skilled in Node.js, MongoDB, distributed systems, and real-time streaming architectures.",
        });
        testJdId = jd._id;

        // Setup test Interview Session
        const session = await InterviewSession.create({
            userId: new Types.ObjectId(userId),
            resumeId: testResumeId,
            jdId: testJdId,
            pineconeNamespace: "test-session-devb",
            status: "ready",
            targetLoopCount: 5,
            currentTurnIndex: 0,
        });
        testSessionId = session._id;
    });

    afterAll(async () => {
        await InterviewTurn.deleteMany({ sessionId: testSessionId });
        await InterviewSession.deleteMany({ userId: { $in: [userId, otherUserId] } });
        await Resume.deleteMany({ userId: { $in: [userId, otherUserId] } });
        await JobDescription.deleteMany({ userId: { $in: [userId, otherUserId] } });

        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    });

    describe("1. Sarvam AI Service Unit Tests", () => {
        it("should return empty audio string when text is empty", async () => {
            const result = await sarvamService.textToSpeech("");
            expect(result).toBe("");
        });

        it("should synthesize speech and return base64 audio string", async () => {
            const result = await sarvamService.textToSpeech(
                "Hello, welcome to the technical interview."
            );
            expect(typeof result).toBe("string");
            expect(result.length).toBeGreaterThan(0);
        });

        it("should reject speechToText when audio buffer is empty", async () => {
            await expect(sarvamService.speechToText(Buffer.alloc(0))).rejects.toThrow(
                "Empty audio buffer received"
            );
        });

        it("should transcribe audio buffer to text transcript", async () => {
            const transcript = await sarvamService.speechToText(
                sampleWavBuffer,
                "audio/wav",
                "answer.wav"
            );
            expect(typeof transcript).toBe("string");
            expect(transcript.length).toBeGreaterThan(0);
        });
    });

    describe("2. InterviewTurn Model & DAO Tests", () => {
        const turnDao = new InterviewTurnDao();

        it("should create an interview turn record", async () => {
            const turn = await turnDao.createTurn({
                sessionId: testSessionId,
                turnIndex: 99,
                question: {
                    text: "What is your experience with Node.js event loops?",
                    askedAt: new Date(),
                },
            });

            expect(turn).toBeDefined();
            expect(turn.turnIndex).toBe(99);
            expect(turn.question.text).toBe("What is your experience with Node.js event loops?");
        });

        it("should enforce compound unique index on sessionId and turnIndex", async () => {
            await expect(
                turnDao.createTurn({
                    sessionId: testSessionId,
                    turnIndex: 99,
                    question: {
                        text: "Duplicate turn question",
                        askedAt: new Date(),
                    },
                })
            ).rejects.toThrow();
        });

        it("should update turn answer and rating", async () => {
            const updatedAnswer = await turnDao.updateTurnAnswer(
                testSessionId,
                99,
                "The event loop is single-threaded and handles async I/O via libuv phases."
            );
            expect(updatedAnswer?.answer?.transcript).toContain("libuv");

            const updatedRating = await turnDao.updateTurnRating(
                testSessionId,
                99,
                9,
                "Excellent grasp of libuv and event loop mechanics."
            );
            expect(updatedRating?.rating?.score).toBe(9);
            expect(updatedRating?.rating?.feedback).toContain("libuv");
        });

        it("should find turns sorted by turnIndex", async () => {
            const turns = await turnDao.findTurnsBySessionId(testSessionId);
            expect(Array.isArray(turns)).toBe(true);
            expect(turns.length).toBeGreaterThanOrEqual(1);
        });

        afterAll(async () => {
            await InterviewTurn.deleteOne({ sessionId: testSessionId, turnIndex: 99 });
        });
    });

    describe("3. GET /api/interview-sessions/:id/start (SSE)", () => {
        it("should reject unauthenticated request with 401", async () => {
            const res = await request(app).get(`/api/interview-sessions/${testSessionId}/start`);
            expect(res.status).toBe(401);
        });

        it("should reject if session does not belong to user with 404", async () => {
            const res = await request(app)
                .get(`/api/interview-sessions/${testSessionId}/start`)
                .set("Authorization", `Bearer ${otherUserToken}`);
            expect(res.status).toBe(404);
        });

        it("should stream question via SSE with metadata, audio-chunk, and done events", async () => {
            const res = await request(app)
                .get(`/api/interview-sessions/${testSessionId}/start`)
                .set("Authorization", `Bearer ${userToken}`);

            expect(res.status).toBe(200);
            expect(res.headers["content-type"]).toContain("text/event-stream");

            const text = res.text;
            expect(text).toContain("event: metadata");
            expect(text).toContain("event: audio-chunk");
            expect(text).toContain("event: done");

            // Verify turn 0 question was persisted
            const turn0 = await InterviewTurn.findOne({
                sessionId: testSessionId,
                turnIndex: 0,
            });
            expect(turn0).not.toBeNull();
            expect(turn0?.question.text.length).toBeGreaterThan(0);

            // Verify session status transitioned to in_progress
            const session = await InterviewSession.findById(testSessionId);
            expect(session?.status).toBe("in_progress");
        });
    });

    describe("4. POST /api/interview-sessions/:id/turns/:turnIndex/answer", () => {
        it("should reject unauthenticated answer submission with 401", async () => {
            const res = await request(app).post(
                `/api/interview-sessions/${testSessionId}/turns/0/answer`
            );
            expect(res.status).toBe(401);
        });

        it("should reject if no audio file is attached with 400", async () => {
            const res = await request(app)
                .post(`/api/interview-sessions/${testSessionId}/turns/0/answer`)
                .set("Authorization", `Bearer ${userToken}`);

            expect(res.status).toBe(400);
            expect(res.body.message).toContain("Audio file is required");
        });

        it("should transcribe audio, rate answer, and advance turnIndex", async () => {
            const res = await request(app)
                .post(`/api/interview-sessions/${testSessionId}/turns/0/answer`)
                .set("Authorization", `Bearer ${userToken}`)
                .attach("audio", sampleWavBuffer, "candidate-answer.wav");

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("turnIndex", 0);
            expect(res.body).toHaveProperty("transcript");
            expect(res.body).toHaveProperty("rating");
            expect(res.body.rating).toHaveProperty("score");
            expect(typeof res.body.rating.score).toBe("number");
            expect(res.body.rating).toHaveProperty("feedback");
            expect(res.body).toHaveProperty("sessionComplete");

            // Verify updated turn in DB
            const turn0 = await InterviewTurn.findOne({
                sessionId: testSessionId,
                turnIndex: 0,
            });
            expect(turn0?.answer?.transcript).toBeDefined();
            expect(turn0?.rating?.score).toBeDefined();

            // Verify session currentTurnIndex updated to 1
            const session = await InterviewSession.findById(testSessionId);
            expect(session?.currentTurnIndex).toBe(1);
        });
    });

    describe("5. GET /api/interview-sessions/:id/turns/next (SSE)", () => {
        it("should stream next question for turnIndex 1 via SSE", async () => {
            const res = await request(app)
                .get(`/api/interview-sessions/${testSessionId}/turns/next`)
                .set("Authorization", `Bearer ${userToken}`);

            expect(res.status).toBe(200);
            expect(res.headers["content-type"]).toContain("text/event-stream");

            const text = res.text;
            expect(text).toContain("event: metadata");
            expect(text).toContain('turnIndex":1');
            expect(text).toContain("event: audio-chunk");
            expect(text).toContain("event: done");

            // Verify turn 1 was created in DB
            const turn1 = await InterviewTurn.findOne({
                sessionId: testSessionId,
                turnIndex: 1,
            });
            expect(turn1).not.toBeNull();
        });
    });

    describe("6. POST /api/interview-sessions/:id/end & Report Verification", () => {
        it("should reject unauthenticated report generation with 401", async () => {
            const res = await request(app).post(`/api/interview-sessions/${testSessionId}/end`);
            expect(res.status).toBe(401);
        });

        it("should complete session and generate comprehensive report", async () => {
            const res = await request(app)
                .post(`/api/interview-sessions/${testSessionId}/end`)
                .set("Authorization", `Bearer ${userToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("sessionId", testSessionId.toString());
            expect(res.body).toHaveProperty("status", "completed");
            expect(res.body).toHaveProperty("report");

            const report = res.body.report;
            expect(typeof report.confidenceScore).toBe("number");
            expect(typeof report.answerQualityScore).toBe("number");
            expect(Array.isArray(report.strengths)).toBe(true);
            expect(Array.isArray(report.weaknesses)).toBe(true);
            expect(typeof report.advice).toBe("string");

            // Verify session status updated in MongoDB
            const session = await InterviewSession.findById(testSessionId);
            expect(session?.status).toBe("completed");
            expect(session?.report?.confidenceScore).toBeDefined();
        });

        it("should retrieve generated report via GET /api/interview-sessions/:id/report", async () => {
            const res = await request(app)
                .get(`/api/interview-sessions/${testSessionId}/report`)
                .set("Authorization", `Bearer ${userToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("confidenceScore");
            expect(res.body).toHaveProperty("answerQualityScore");
            expect(res.body).toHaveProperty("strengths");
            expect(res.body).toHaveProperty("weaknesses");
            expect(res.body).toHaveProperty("advice");
        });

        it("should reject further answers once session is completed with 400", async () => {
            const res = await request(app)
                .post(`/api/interview-sessions/${testSessionId}/turns/1/answer`)
                .set("Authorization", `Bearer ${userToken}`)
                .attach("audio", sampleWavBuffer, "answer.wav");

            expect(res.status).toBe(400);
            expect(res.body.message).toContain("status 'completed'");
        });

        it("should reject further question streaming once session is completed with 400", async () => {
            const res = await request(app)
                .get(`/api/interview-sessions/${testSessionId}/turns/next`)
                .set("Authorization", `Bearer ${userToken}`);

            expect(res.status).toBe(400);
            expect(res.body.message).toContain("status 'completed'");
        });
    });
});
