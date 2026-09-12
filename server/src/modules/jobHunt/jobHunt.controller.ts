import { Request, Response } from "express";
import { Types } from "mongoose";
import jobHuntService from "../../shared/services/jobHunt.service.js";
import JobDescriptionDao from "../../shared/dao/jobDescription.dao.js";
import JobSearchLogDao from "../../shared/dao/jobSearchLog.dao.js";
import { assertJobHuntRateLimit, getJobHuntRateLimitStatus } from "../../shared/utils/jobHuntRateLimit.js";
import vectorService from "../../shared/services/vector.service.js";
import logger from "../../shared/config/logger.config.js";
import BadRequest from "../../shared/errors/BadRequest.error.js";

export class JobHuntController {
    private jdDao: JobDescriptionDao;
    private searchLogDao: JobSearchLogDao;

    constructor() {
        this.jdDao = new JobDescriptionDao();
        this.searchLogDao = new JobSearchLogDao();
    }

    /**
     * Search for jobs across platforms with a 5 searches/hour rate limit.
     * @route GET /api/job-hunt/search
     * @access Private
     */
    searchJobs = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        if (!userId) {
            throw new BadRequest("User not authenticated");
        }

        const query = (req.query.query as string) || "";
        const location = (req.query.location as string) || "";

        if (!query.trim()) {
            throw new BadRequest("Job title or search query is required");
        }

        // 1. Enforce 5 searches per hour per authenticated user
        await assertJobHuntRateLimit(userId);

        // 2. Fetch jobs
        const jobs = await jobHuntService.searchJobs(query, location, 5);

        // 3. Log search occurrence for rate limiting
        await this.searchLogDao.logSearch(userId, query, location);

        // 4. Return results with updated quota info
        const rateLimit = await getJobHuntRateLimitStatus(userId);

        return res.status(200).json({
            success: true,
            query,
            location: location || "Any",
            count: jobs.length,
            jobs,
            rateLimit,
        });
    };

    /**
     * Get current user's job hunt search rate limit status.
     * @route GET /api/job-hunt/rate-limit
     * @access Private
     */
    getRateLimit = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        if (!userId) {
            throw new BadRequest("User not authenticated");
        }

        const rateLimit = await getJobHuntRateLimitStatus(userId);

        return res.status(200).json({
            success: true,
            rateLimit,
        });
    };

    /**
     * Ingests a job listing into Karyam's Job Description system,
     * triggers Pinecone vector embedding, and returns the created jdId.
     * @route POST /api/job-hunt/prepare
     * @access Private
     */
    prepareJob = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        if (!userId) {
            throw new BadRequest("User not authenticated");
        }

        const title = req.body.title?.trim();
        const company = req.body.company?.trim();
        const description = req.body.description?.trim();

        if (!title) {
            throw new BadRequest("Job title is required to prepare workspace");
        }
        if (!company) {
            throw new BadRequest("Company name is required to prepare workspace");
        }
        if (!description) {
            throw new BadRequest("Job description text is required to prepare workspace");
        }

        const jdId = new Types.ObjectId();

        // 1. Create JD in MongoDB
        const jd = await this.jdDao.createJobDescription({
            _id: jdId,
            userId: new Types.ObjectId(userId),
            title,
            company,
            sourceType: "pasted_text",
            rawText: description,
        });

        // 2. Asynchronously chunk and embed into Pinecone namespace
        vectorService
            .embedAndUpsertDocument(
                `jd-${jd._id}`,
                description,
                "jd",
                jd._id.toString(),
                userId
            )
            .catch((err) => {
                logger.warn(
                    { err: err?.message, jdId: jd._id.toString() },
                    "Async JD embedding error in jobHunt.prepareJob"
                );
            });

        return res.status(201).json({
            success: true,
            jdId: jd._id.toString(),
            title: jd.title,
            company: jd.company,
            message: "Job description workspace initialized successfully",
        });
    };
}

export default JobHuntController;
