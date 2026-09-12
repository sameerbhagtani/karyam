import express from "express";
import JobHuntController from "./jobHunt.controller.js";
import authMiddleware from "../../shared/middlewares/auth.middleware.js";

const router = express.Router();
const jobHuntController = new JobHuntController();

/*
    @route GET /api/job-hunt/rate-limit
    @desc Get current user's job hunt search rate limit quota
    @access Private
*/
router.get(
    "/rate-limit",
    authMiddleware,
    jobHuntController.getRateLimit
);

/*
    @route GET /api/job-hunt/search
    @desc Search curated job postings across LinkedIn, Indeed, Glassdoor (5/hr limit)
    @access Private
*/
router.get(
    "/search",
    authMiddleware,
    jobHuntController.searchJobs
);

/*
    @route POST /api/job-hunt/prepare
    @desc Ingest job details into Karyam JD workspace & trigger embedding
    @access Private
*/
router.post(
    "/prepare",
    authMiddleware,
    jobHuntController.prepareJob
);

export default router;
