import { Request, Response } from "express";
import { Types } from "mongoose";
import InterviewSessionDao from "../../shared/dao/interviewSession.dao.js";
import ResumeDao from "../../shared/dao/resume.dao.js";
import JobDescriptionDao from "../../shared/dao/jobDescription.dao.js";
import BadRequest from "../../shared/errors/BadRequest.error.js";
import NotFound from "../../shared/errors/NotFound.error.js";
import vectorService from "../../shared/services/vector.service.js";

export class InterviewSessionController {
    private sessionDao: InterviewSessionDao;
    private resumeDao: ResumeDao;
    private jdDao: JobDescriptionDao;

    constructor() {
        this.sessionDao = new InterviewSessionDao();
        this.resumeDao = new ResumeDao();
        this.jdDao = new JobDescriptionDao();
    }

    createSession = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        if (!userId) {
            throw new BadRequest("User not authenticated");
        }

        const { resumeId, jdId, targetLoopCount } = req.body;

        // 1. Verify Resume exists and belongs to the authenticated user
        const resume = await this.resumeDao.findResumeById(resumeId);
        if (!resume || resume.userId.toString() !== userId) {
            throw new NotFound("Resume not found or does not belong to the user");
        }

        // 2. Verify Job Description exists and belongs to the authenticated user
        const jd = await this.jdDao.findJobDescriptionById(jdId);
        if (!jd || jd.userId.toString() !== userId) {
            throw new NotFound("Job Description not found or does not belong to the user");
        }

        // 3. Create interview session doc in Mongo with status 'embedding'
        const sessionId = new Types.ObjectId();
        const loopCount = targetLoopCount ? Number(targetLoopCount) : 7;

        const session = await this.sessionDao.createSession({
            _id: sessionId,
            userId: new Types.ObjectId(userId),
            resumeId: new Types.ObjectId(resumeId),
            jdId: new Types.ObjectId(jdId),
            pineconeNamespace: sessionId.toString(),
            status: "embedding",
            targetLoopCount: loopCount,
            currentTurnIndex: 0,
        });

        // 4. Trigger chunking, embedding, and Pinecone upsert asynchronously in background
        vectorService
            .processSessionEmbeddings(
                sessionId.toString(),
                userId,
                resume.extractedText,
                jd.rawText
            )
            .catch(() => {
                // Background errors are logged and handled inside vectorService
            });

        // 5. Immediately return response per PRD Section 9.2
        return res.status(201).json({
            sessionId: session._id.toString(),
            status: "embedding",
        });
    };

    getSessionById = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        const id = req.params.id as string;

        const session = await this.sessionDao.findSessionByIdAndUserId(id, userId);
        if (!session) {
            throw new NotFound("Interview session not found");
        }

        return res.status(200).json({
            sessionId: session._id.toString(),
            status: session.status,
            currentTurnIndex: session.currentTurnIndex,
            targetLoopCount: session.targetLoopCount,
        });
    };

    getSessionReport = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        const id = req.params.id as string;

        const session = await this.sessionDao.findSessionByIdAndUserId(id, userId);
        if (!session) {
            throw new NotFound("Interview session not found");
        }

        if (!session.report || (session.report.confidenceScore === undefined && session.report.answerQualityScore === undefined)) {
            throw new NotFound("Report not yet generated for this interview session");
        }

        return res.status(200).json({
            confidenceScore: session.report.confidenceScore ?? 0,
            answerQualityScore: session.report.answerQualityScore ?? 0,
            strengths: session.report.strengths ?? [],
            weaknesses: session.report.weaknesses ?? [],
            advice: session.report.advice ?? "",
        });
    };
}

export default InterviewSessionController;
