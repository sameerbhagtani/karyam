import { Request, Response } from "express";
import { Types } from "mongoose";
import path from "node:path";
import JobDescriptionDao from "../../shared/dao/jobDescription.dao.js";
import ResumeDao from "../../shared/dao/resume.dao.js";
import AtsAnalysisDao from "../../shared/dao/atsAnalysis.dao.js";
import InterviewSessionDao from "../../shared/dao/interviewSession.dao.js";
import BadRequest from "../../shared/errors/BadRequest.error.js";
import NotFound from "../../shared/errors/NotFound.error.js";
import textExtractionService from "../../shared/services/textExtraction.service.js";
import s3Service from "../../shared/services/s3.service.js";
import atsAnalysisService from "../../shared/services/atsAnalysis.service.js";
import vectorService from "../../shared/services/vector.service.js";
import logger from "../../shared/config/logger.config.js";
import { assertAtsRateLimit, getAtsRateLimitStatus } from "../../shared/utils/atsRateLimit.js";

export class JobDescriptionController {
    private jdDao: JobDescriptionDao;
    private resumeDao: ResumeDao;
    private atsDao: AtsAnalysisDao;
    private sessionDao: InterviewSessionDao;

    constructor() {
        this.jdDao = new JobDescriptionDao();
        this.resumeDao = new ResumeDao();
        this.atsDao = new AtsAnalysisDao();
        this.sessionDao = new InterviewSessionDao();
    }

    createJobDescription = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        if (!userId) {
            throw new BadRequest("User not authenticated");
        }

        const title = req.body.title?.trim();
        const company = req.body.company?.trim();

        if (!title) {
            throw new BadRequest("Job title is required");
        }
        if (!company) {
            throw new BadRequest("Company name is required");
        }

        const jdId = new Types.ObjectId();

        if (req.file) {
            // Case 1: Uploaded document (PDF/DOCX)
            const { buffer, mimetype, originalname } = req.file;
            const rawText = await textExtractionService.extractText(buffer, mimetype, originalname);

            const ext = path.extname(originalname) || (mimetype === "application/pdf" ? ".pdf" : ".docx");
            const s3Key = `job-descriptions/${userId}/${jdId}${ext}`;

            await s3Service.uploadFile(s3Key, buffer, mimetype);

            const jd = await this.jdDao.createJobDescription({
                _id: jdId,
                userId: new Types.ObjectId(userId),
                title,
                company,
                sourceType: "upload",
                s3Key,
                rawText,
            });

            // Asynchronously chunk and embed JD into dedicated Pinecone namespace
            vectorService
                .embedAndUpsertDocument(
                    `jd-${jd._id}`,
                    rawText,
                    "jd",
                    jd._id.toString(),
                    userId
                )
                .catch((err) => {
                    logger.warn(
                        { err: err?.message, jdId: jd._id.toString() },
                        "Async JD embedding error in createJobDescription (upload)"
                    );
                });

            return res.status(201).json({ jdId: jd._id.toString() });
        } else {
            // Case 2: Pasted text
            const rawText = req.body.rawText?.trim();
            if (!rawText) {
                throw new BadRequest("Job description text or file is required. Provide 'rawText' or upload a 'file'.");
            }

            const jd = await this.jdDao.createJobDescription({
                _id: jdId,
                userId: new Types.ObjectId(userId),
                title,
                company,
                sourceType: "pasted_text",
                rawText,
            });

            // Asynchronously chunk and embed JD into dedicated Pinecone namespace
            vectorService
                .embedAndUpsertDocument(
                    `jd-${jd._id}`,
                    rawText,
                    "jd",
                    jd._id.toString(),
                    userId
                )
                .catch((err) => {
                    logger.warn(
                        { err: err?.message, jdId: jd._id.toString() },
                        "Async JD embedding error in createJobDescription (pasted)"
                    );
                });

            return res.status(201).json({ jdId: jd._id.toString() });
        }
    };

    getJobDescriptionById = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        const id = req.params.id as string;

        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequest("Invalid job description ID format");
        }

        const jd = await this.jdDao.findJobDescriptionById(id);
        if (!jd || jd.userId.toString() !== userId) {
            throw new NotFound("Job description not found");
        }

        return res.status(200).json({
            jdId: jd._id.toString(),
            title: jd.title,
            company: jd.company,
            sourceType: jd.sourceType,
            s3Key: jd.s3Key,
            rawText: jd.rawText,
            createdAt: jd.createdAt,
        });
    };

    getUserJobDescriptions = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        if (!userId) {
            throw new BadRequest("User not authenticated");
        }

        const jds = await this.jdDao.findJobDescriptionsByUserId(userId);
        return res.status(200).json({
            jobDescriptions: jds.map((j) => {
                const words = j.rawText ? j.rawText.trim().split(/\s+/).filter(Boolean).length : 0;
                return {
                    jdId: j._id.toString(),
                    title: j.title,
                    company: j.company,
                    sourceType: j.sourceType,
                    rawText: j.rawText,
                    wordCount: words,
                    createdAt: j.createdAt,
                };
            }),
            latest: jds[0]
                ? {
                      jdId: jds[0]._id.toString(),
                      title: jds[0].title,
                      company: jds[0].company,
                      sourceType: jds[0].sourceType,
                      rawText: jds[0].rawText,
                      wordCount: jds[0].rawText ? jds[0].rawText.trim().split(/\s+/).filter(Boolean).length : 0,
                      createdAt: jds[0].createdAt,
                  }
                : null,
        });
    };

    deleteJobDescription = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        const id = req.params.id as string;

        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequest("Invalid job description ID format");
        }

        const jd = await this.jdDao.findJobDescriptionById(id);
        if (!jd || jd.userId.toString() !== userId) {
            throw new NotFound("Job description not found");
        }

        await this.jdDao.deleteJobDescriptionById(id);
        return res.status(200).json({
            success: true,
            message: "Job description deleted successfully",
        });
    };

    /**
     * Complete JD Workspace data:
     * - Job Description details
     * - Latest submitted resume for this JD
     * - Latest ATS analysis for this JD
     * - Version history
     * - Latest mock interview session & report
     * - Rate limit status
     */
    getJobDescriptionWorkspace = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        const id = req.params.id as string;

        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequest("Invalid job description ID format");
        }

        const jd = await this.jdDao.findJobDescriptionById(id);
        if (!jd || jd.userId.toString() !== userId) {
            throw new NotFound("Job description not found");
        }

        // Fetch resumes and ATS analyses for this JD
        const jdResumes = await this.resumeDao.findResumesByJdId(id);
        const userResumes = await this.resumeDao.findResumesByUserId(userId);
        const analyses = await this.atsDao.findAnalysesByJdId(id);
        const latestSession = await this.sessionDao.findLatestSessionByJdIdAndUserId(id, userId);
        const rateLimit = await getAtsRateLimitStatus(userId);

        const latestAnalysis = analyses[0] || null;
        const matchingResume = latestAnalysis?.resumeId
            ? userResumes.find((r) => r._id.toString() === latestAnalysis.resumeId.toString()) ||
              jdResumes.find((r) => r._id.toString() === latestAnalysis.resumeId.toString())
            : null;
        const latestResume = matchingResume || jdResumes[0] || userResumes[0] || null;

        return res.status(200).json({
            jd: {
                jdId: jd._id.toString(),
                title: jd.title,
                company: jd.company,
                sourceType: jd.sourceType,
                s3Key: jd.s3Key,
                rawText: jd.rawText,
                createdAt: jd.createdAt,
            },
            userResumes: userResumes.map((r) => ({
                resumeId: r._id.toString(),
                originalFilename: r.originalFilename,
                mimeType: r.mimeType,
                createdAt: r.createdAt,
            })),
            latestResume: latestResume
                ? {
                      resumeId: latestResume._id.toString(),
                      originalFilename: latestResume.originalFilename,
                      version: latestResume.version || 1,
                      mimeType: latestResume.mimeType,
                      createdAt: latestResume.createdAt,
                  }
                : null,
            latestAnalysis: latestAnalysis
                ? {
                      analysisId: latestAnalysis._id.toString(),
                      resumeId: latestAnalysis.resumeId?.toString(),
                      version: latestAnalysis.version,
                      score: latestAnalysis.score,
                      summary: latestAnalysis.summary,
                      breakdown: latestAnalysis.breakdown,
                      improvements: latestAnalysis.improvements,
                      createdAt: latestAnalysis.createdAt,
                  }
                : null,
            history: analyses.map((a) => ({
                analysisId: a._id.toString(),
                resumeId: a.resumeId?.toString(),
                version: a.version,
                score: a.score,
                summary: a.summary,
                breakdown: a.breakdown,
                improvements: a.improvements,
                createdAt: a.createdAt,
            })),
            latestInterviewSession: latestSession
                ? {
                      sessionId: latestSession._id.toString(),
                      status: latestSession.status,
                      currentTurnIndex: latestSession.currentTurnIndex,
                      targetLoopCount: latestSession.targetLoopCount,
                      report: latestSession.report || null,
                      createdAt: latestSession.createdAt,
                  }
                : null,
            rateLimit,
        });
    };

    /**
     * Uploads resume for a specific JD, increments version, runs ATS analysis,
     * enforcing the 3 analyses/hour rate limit on the backend.
     */
    uploadResumeForJobDescription = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        const id = req.params.id as string;

        if (!userId) {
            throw new BadRequest("User not authenticated");
        }

        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequest("Invalid job description ID format");
        }

        const jd = await this.jdDao.findJobDescriptionById(id);
        if (!jd || jd.userId.toString() !== userId) {
            throw new NotFound("Job description not found");
        }

        const resumeIdParam = (req.body?.resumeId as string)?.trim();
        const forceReanalyze = Boolean(req.body?.forceReanalyze);

        if (!req.file && !resumeIdParam) {
            throw new BadRequest("Resume file or resumeId is required.");
        }

        // If user is selecting an existing library resume and did not explicitly request reanalysis:
        // Check if an analysis is ALREADY saved in MongoDB for this JD and resume!
        if (resumeIdParam && !forceReanalyze) {
            if (!Types.ObjectId.isValid(resumeIdParam)) {
                throw new BadRequest("Invalid resumeId format.");
            }
            const existingResume = await this.resumeDao.findResumeById(resumeIdParam);
            if (!existingResume || existingResume.userId.toString() !== userId) {
                throw new NotFound("Selected resume from library not found.");
            }

            let existingAnalysis = await this.atsDao.findLatestAnalysisByJdAndResume(id, existingResume._id);
            if (!existingAnalysis) {
                // Check if any clone of this resume was analyzed
                const jdResumes = await this.resumeDao.findResumesByJdId(id);
                const matchingJdResume = jdResumes.find(
                    (r) => r.s3Key === existingResume.s3Key || r.originalFilename === existingResume.originalFilename
                );
                if (matchingJdResume) {
                    existingAnalysis = await this.atsDao.findLatestAnalysisByJdAndResume(id, matchingJdResume._id);
                }
            }

            if (existingAnalysis) {
                const rateLimit = await getAtsRateLimitStatus(userId);
                return res.status(200).json({
                    resume: {
                        resumeId: existingResume._id.toString(),
                        originalFilename: existingResume.originalFilename,
                        version: existingAnalysis.version,
                        mimeType: existingResume.mimeType,
                        createdAt: existingResume.createdAt,
                    },
                    analysis: {
                        analysisId: existingAnalysis._id.toString(),
                        resumeId: existingResume._id.toString(),
                        version: existingAnalysis.version,
                        score: existingAnalysis.score,
                        summary: existingAnalysis.summary,
                        breakdown: existingAnalysis.breakdown,
                        improvements: existingAnalysis.improvements,
                        createdAt: existingAnalysis.createdAt,
                    },
                    rateLimit,
                    cached: true,
                });
            }
        }

        // 1. Enforce backend rate limit (3 per user per hour) for new analyses
        await assertAtsRateLimit(userId);

        let extractedText = "";
        let originalname = "";
        let mimetype = "application/pdf";
        let resumeToUse: any = null;

        if (req.file) {
            const { buffer, mimetype: fileMime, originalname: fileName } = req.file;
            mimetype = fileMime;
            originalname = fileName;
            extractedText = await textExtractionService.extractText(buffer, mimetype, originalname);

            // Determine next version number for this JD
            const existingResumes = await this.resumeDao.findResumesByJdId(id);
            const nextVersion = existingResumes.length > 0 ? (existingResumes[0].version || existingResumes.length) + 1 : 1;

            // Save to S3
            const newResumeId = new Types.ObjectId();
            const ext = path.extname(originalname) || (mimetype === "application/pdf" ? ".pdf" : ".docx");
            const s3Key = `resumes/${userId}/${jd._id}/v${nextVersion}-${newResumeId}${ext}`;
            await s3Service.uploadFile(s3Key, buffer, mimetype);

            // Persist Resume in Mongo
            resumeToUse = await this.resumeDao.createResume({
                _id: newResumeId,
                userId: new Types.ObjectId(userId),
                jdId: jd._id as Types.ObjectId,
                version: nextVersion,
                originalFilename: originalname,
                s3Key,
                mimeType: mimetype,
                extractedText,
            });

            // Asynchronously chunk and embed into dedicated Pinecone resume namespace
            vectorService
                .embedAndUpsertDocument(
                    `resume-${resumeToUse._id}`,
                    extractedText,
                    "resume",
                    resumeToUse._id.toString(),
                    userId
                )
                .catch((err) => {
                    logger.warn(
                        { err: err?.message, resumeId: resumeToUse._id.toString() },
                        "Async resume embedding error in uploadResumeForJobDescription"
                    );
                });
        } else {
            // Use existing resume from user's library
            if (!Types.ObjectId.isValid(resumeIdParam)) {
                throw new BadRequest("Invalid resumeId format.");
            }
            const existingResume = await this.resumeDao.findResumeById(resumeIdParam);
            if (!existingResume || existingResume.userId.toString() !== userId) {
                throw new NotFound("Selected resume from library not found.");
            }

            extractedText = existingResume.extractedText;
            originalname = existingResume.originalFilename;
            mimetype = existingResume.mimeType;

            const existingJdResumes = await this.resumeDao.findResumesByJdId(id);
            const nextVersion = existingJdResumes.length > 0 ? (existingJdResumes[0].version || existingJdResumes.length) + 1 : 1;

            // Link copy or attach version to this JD
            resumeToUse = await this.resumeDao.createResume({
                _id: new Types.ObjectId(),
                userId: new Types.ObjectId(userId),
                jdId: jd._id as Types.ObjectId,
                version: nextVersion,
                originalFilename: originalname,
                s3Key: existingResume.s3Key,
                mimeType: mimetype,
                fileSize: existingResume.fileSize,
                extractedText,
            });
        }

        const resume = resumeToUse;

        // 6. Perform AI ATS analysis
        const analysisResult = await atsAnalysisService.analyzeResumeAgainstJd(
            extractedText,
            jd.title,
            jd.company,
            jd.rawText
        );

        // 7. Persist AtsAnalysis in Mongo - store direct reference to selected resumeId if provided
        const targetResumeId = resumeIdParam ? new Types.ObjectId(resumeIdParam) : (resume._id as Types.ObjectId);
        const analysis = await this.atsDao.createAnalysis({
            userId: new Types.ObjectId(userId),
            jdId: jd._id as Types.ObjectId,
            resumeId: targetResumeId,
            version: resume.version || 1,
            score: analysisResult.score,
            summary: analysisResult.summary,
            breakdown: analysisResult.breakdown,
            improvements: analysisResult.improvements,
        });

        // 8. Fetch updated rate limit
        const rateLimit = await getAtsRateLimitStatus(userId);

        return res.status(201).json({
            resume: {
                resumeId: targetResumeId.toString(),
                originalFilename: resume.originalFilename,
                version: resume.version,
                mimeType: resume.mimeType,
                createdAt: resume.createdAt,
            },
            analysis: {
                analysisId: analysis._id.toString(),
                resumeId: targetResumeId.toString(),
                version: analysis.version,
                score: analysis.score,
                summary: analysis.summary,
                breakdown: analysis.breakdown,
                improvements: analysis.improvements,
                createdAt: analysis.createdAt,
            },
            rateLimit,
        });
    };

    /**
     * Retrieve full details of a specific historical ATS analysis version.
     * Does NOT consume an analysis rate limit.
     */
    getAtsAnalysisVersion = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        const analysisId = req.params.analysisId as string;

        if (!Types.ObjectId.isValid(analysisId)) {
            throw new BadRequest("Invalid analysis ID format");
        }

        const analysis = await this.atsDao.findAnalysisById(analysisId);
        if (!analysis || analysis.userId.toString() !== userId) {
            throw new NotFound("ATS analysis version not found");
        }

        return res.status(200).json({
            analysisId: analysis._id.toString(),
            resumeId: analysis.resumeId?.toString(),
            version: analysis.version,
            score: analysis.score,
            summary: analysis.summary,
            breakdown: analysis.breakdown,
            improvements: analysis.improvements,
            createdAt: analysis.createdAt,
        });
    };

    /**
     * Returns current rate limit quota for ATS analysis requests.
     */
    getRateLimit = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        if (!userId) {
            throw new BadRequest("User not authenticated");
        }

        const rateLimit = await getAtsRateLimitStatus(userId);
        return res.status(200).json(rateLimit);
    };
}

export default JobDescriptionController;

