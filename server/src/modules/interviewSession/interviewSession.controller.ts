import { Request, Response } from "express";
import { Types } from "mongoose";
import InterviewSessionDao from "../../shared/dao/interviewSession.dao.js";
import InterviewTurnDao from "../../shared/dao/interviewTurn.dao.js";
import ResumeDao from "../../shared/dao/resume.dao.js";
import JobDescriptionDao from "../../shared/dao/jobDescription.dao.js";
import BadRequest from "../../shared/errors/BadRequest.error.js";
import NotFound from "../../shared/errors/NotFound.error.js";
import vectorService from "../../shared/services/vector.service.js";
import interviewOrchestratorService from "../../shared/services/interviewOrchestrator.service.js";

export class InterviewSessionController {
    private sessionDao: InterviewSessionDao;
    private turnDao: InterviewTurnDao;
    private resumeDao: ResumeDao;
    private jdDao: JobDescriptionDao;

    constructor() {
        this.sessionDao = new InterviewSessionDao();
        this.turnDao = new InterviewTurnDao();
        this.resumeDao = new ResumeDao();
        this.jdDao = new JobDescriptionDao();
    }

    createSession = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        if (!userId) {
            throw new BadRequest("User not authenticated");
        }

        let { resumeId, jdId, targetLoopCount } = req.body;

        if (!jdId) {
            throw new BadRequest("Job Description ID (jdId) is required");
        }

        // 1. Verify Job Description exists and belongs to the authenticated user
        const jd = await this.jdDao.findJobDescriptionById(jdId);
        if (!jd || jd.userId.toString() !== userId) {
            throw new NotFound("Job Description not found or does not belong to the user");
        }

        // 2. Resolve target resume: If not provided, automatically select latest resume for this JD
        if (!resumeId) {
            const latestJdResume = await this.resumeDao.findLatestResumeByJdId(jdId);
            if (latestJdResume) {
                resumeId = latestJdResume._id.toString();
            } else {
                // Fallback to latest user resume
                const userResumes = await this.resumeDao.findResumesByUserId(userId);
                if (userResumes.length > 0) {
                    resumeId = userResumes[0]._id.toString();
                } else {
                    throw new BadRequest("Please upload a resume for this job description before starting a mock interview.");
                }
            }
        }

        const resume = await this.resumeDao.findResumeById(resumeId);
        if (!resume || resume.userId.toString() !== userId) {
            throw new NotFound("Resume not found or does not belong to the user");
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
                jd.rawText,
                resumeId.toString(),
                jdId.toString()
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

        const jd = await this.jdDao.findJobDescriptionById(session.jdId);
        const resume = await this.resumeDao.findResumeById(session.resumeId);
        const turns = await this.turnDao.findTurnsBySessionId(id);

        const formattedTurns = turns.map((t) => ({
            turnIndex: t.turnIndex,
            question: t.question?.text || "",
            transcript: t.answer?.transcript || "",
            rating: t.rating ? {
                score: t.rating.score,
                feedback: t.rating.feedback,
                whatWentWell: t.rating.whatWentWell,
                whatCouldBeBetter: t.rating.whatCouldBeBetter,
            } : undefined,
            answeredAt: t.answer?.answeredAt?.toISOString(),
        }));

        return res.status(200).json({
            sessionId: session._id.toString(),
            status: session.status,
            currentTurnIndex: session.currentTurnIndex,
            targetLoopCount: session.targetLoopCount,
            startedAt: session.startedAt,
            completedAt: session.completedAt,
            createdAt: session.createdAt,
            turns: formattedTurns,
            jd: jd ? {
                jdId: jd._id.toString(),
                title: jd.title,
                company: jd.company,
            } : null,
            resume: resume ? {
                resumeId: resume._id.toString(),
                originalFilename: resume.originalFilename,
            } : null,
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
            // If session is already completed or ended, generate the report automatically
            if (session.status === "completed") {
                try {
                    const generatedReport = await interviewOrchestratorService.generateFinalReport(id);
                    session.report = generatedReport;
                } catch {
                    throw new NotFound("Report not yet generated for this interview session");
                }
            } else {
                throw new NotFound("Report not yet generated for this interview session");
            }
        }

        const jd = await this.jdDao.findJobDescriptionById(session.jdId);
        const resume = await this.resumeDao.findResumeById(session.resumeId);
        const turns = await this.turnDao.findTurnsBySessionId(id);

        const durationMinutes = session.startedAt && session.completedAt
            ? Math.max(1, Math.round((new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 60000))
            : turns.length > 0 ? Math.max(1, turns.length * 2.5) : 18;

        let overallScore = 78;
        if (session.report.overallScore !== undefined) {
            overallScore = session.report.overallScore <= 10
                ? Math.round(session.report.overallScore * 10)
                : Math.round(session.report.overallScore);
        } else if (session.report.confidenceScore !== undefined && session.report.answerQualityScore !== undefined) {
            overallScore = Math.round(((session.report.confidenceScore + session.report.answerQualityScore) / 2) * 10);
        }

        const formattedTurns = turns.map((t, idx) => {
            const timeDiff = t.answer?.answeredAt && t.question?.askedAt
                ? Math.max(1, Math.round((new Date(t.answer.answeredAt).getTime() - new Date(t.question.askedAt).getTime()) / 1000))
                : 83; // fallback ~01:23
            const minutes = Math.floor(timeDiff / 60);
            const seconds = timeDiff % 60;
            const durationFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

            const feedbackText = t.rating?.feedback || "";
            let whatWentWell = (t.rating as any)?.whatWentWell || "";
            let whatCouldBeBetter = (t.rating as any)?.whatCouldBeBetter || "";

            if (!whatWentWell && !whatCouldBeBetter && feedbackText) {
                const sentences = feedbackText.split(/(?<=[.?!])\s+/).filter(Boolean);
                if (sentences.length >= 2) {
                    whatWentWell = sentences[0];
                    whatCouldBeBetter = sentences.slice(1).join(" ");
                } else {
                    whatWentWell = feedbackText;
                    whatCouldBeBetter = "Could provide more specific concrete trade-offs and real-world examples.";
                }
            }

            return {
                turnIndex: t.turnIndex ?? idx,
                question: t.question,
                answer: t.answer,
                rating: t.rating ? {
                    score: t.rating.score,
                    feedback: t.rating.feedback,
                    whatWentWell: whatWentWell || "Answer addressed the main technical concepts requested.",
                    whatCouldBeBetter: whatCouldBeBetter || "Could expand on practical production considerations.",
                } : null,
                durationFormatted,
            };
        });

        return res.status(200).json({
            // Backward-compatible fields expected by tests
            confidenceScore: session.report.confidenceScore ?? 0,
            answerQualityScore: session.report.answerQualityScore ?? 0,
            strengths: session.report.strengths ?? [],
            weaknesses: session.report.weaknesses ?? [],
            advice: session.report.advice ?? "",
            overallScore,
            topicsForImprovement: session.report.topicsForImprovement ?? [],
            jdPreparationAdvice: session.report.jdPreparationAdvice ?? "",
            // Rich session and question context for the Report UI
            session: {
                sessionId: session._id.toString(),
                status: session.status,
                startedAt: session.startedAt,
                completedAt: session.completedAt,
                createdAt: session.createdAt,
                targetLoopCount: session.targetLoopCount,
                questionCount: turns.length > 0 ? turns.length : session.targetLoopCount,
                durationMinutes: Math.round(durationMinutes),
            },
            jd: jd ? {
                jdId: jd._id.toString(),
                title: jd.title,
                company: jd.company,
            } : null,
            resume: resume ? {
                resumeId: resume._id.toString(),
                originalFilename: resume.originalFilename,
            } : null,
            turns: formattedTurns,
        });
    };

    startSession = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        const id = req.params.id as string;

        const session = await this.sessionDao.findSessionByIdAndUserId(id, userId);
        if (!session) {
            throw new NotFound("Interview session not found");
        }

        if (session.status === "completed" || session.status === "aborted") {
            throw new BadRequest(`Cannot start interview session with status '${session.status}'`);
        }

        await interviewOrchestratorService.streamQuestionToSse(res, id, 0);
    };

    submitAnswer = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        const id = req.params.id as string;
        const turnIndex = parseInt(req.params.turnIndex as string, 10);

        if (isNaN(turnIndex) || turnIndex < 0) {
            throw new BadRequest("turnIndex must be a non-negative integer");
        }

        const session = await this.sessionDao.findSessionByIdAndUserId(id, userId);
        if (!session) {
            throw new NotFound("Interview session not found");
        }

        if (session.status === "completed" || session.status === "aborted") {
            throw new BadRequest(`Cannot submit answer for interview session with status '${session.status}'`);
        }

        if (!req.file || !req.file.buffer) {
            throw new BadRequest("Audio file is required in 'audio' field");
        }

        const result = await interviewOrchestratorService.processCandidateAnswer(
            id,
            turnIndex,
            req.file.buffer,
            req.file.mimetype || "audio/wav",
            req.file.originalname || "answer.wav"
        );

        return res.status(200).json(result);
    };

    getNextTurn = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        const id = req.params.id as string;

        const session = await this.sessionDao.findSessionByIdAndUserId(id, userId);
        if (!session) {
            throw new NotFound("Interview session not found");
        }

        if (session.status === "completed" || session.status === "aborted") {
            throw new BadRequest(`Cannot continue interview session with status '${session.status}'`);
        }

        if (session.currentTurnIndex >= session.targetLoopCount) {
            throw new BadRequest("Maximum interview turns reached. Please end the session to view your report.");
        }

        await interviewOrchestratorService.streamQuestionToSse(res, id, session.currentTurnIndex);
    };

    endSession = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        const id = req.params.id as string;

        const session = await this.sessionDao.findSessionByIdAndUserId(id, userId);
        if (!session) {
            throw new NotFound("Interview session not found");
        }

        const report = await interviewOrchestratorService.generateFinalReport(id);

        return res.status(200).json({
            sessionId: session._id.toString(),
            status: "completed",
            report,
        });
    };

    getUserSessions = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        if (!userId) {
            throw new BadRequest("User not authenticated");
        }

        const sessions = await this.sessionDao.findSessionsByUserId(userId);
        const populated = await Promise.all(
            sessions.map(async (s) => {
                const jd = await this.jdDao.findJobDescriptionById(s.jdId);
                const resume = await this.resumeDao.findResumeById(s.resumeId);
                return {
                    sessionId: s._id.toString(),
                    status: s.status,
                    targetLoopCount: s.targetLoopCount,
                    currentTurnIndex: s.currentTurnIndex,
                    startedAt: s.startedAt,
                    completedAt: s.completedAt,
                    createdAt: s.createdAt,
                    report: s.report || null,
                    jd: jd
                        ? {
                              jdId: jd._id.toString(),
                              title: jd.title,
                              company: jd.company,
                          }
                        : null,
                    resume: resume
                        ? {
                              resumeId: resume._id.toString(),
                              originalFilename: resume.originalFilename,
                          }
                        : null,
                };
            })
        );

        return res.status(200).json({ sessions: populated });
    };
}

export default InterviewSessionController;

