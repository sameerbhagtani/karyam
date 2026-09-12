import express from "express";
import JobDescriptionController from "./jobDescription.controller.js";
import authMiddleware from "../../shared/middlewares/auth.middleware.js";
import uploadSingleFile from "../../shared/middlewares/upload.middleware.js";

const router = express.Router();
const jdController = new JobDescriptionController();

/*
    @route POST /api/job-descriptions
    @desc Create a job description (either pasted text or file upload)
    @access Private
*/
router.post(
    "/",
    authMiddleware,
    uploadSingleFile.single("file"),
    jdController.createJobDescription
);

/*
    @route GET /api/job-descriptions
    @desc Get all job descriptions created by the authenticated user
    @access Private
*/
router.get(
    "/",
    authMiddleware,
    jdController.getUserJobDescriptions
);

/*
    @route GET /api/job-descriptions/rate-limit
    @desc Get current user's ATS analysis rate limit quota
    @access Private
*/
router.get(
    "/rate-limit",
    authMiddleware,
    jdController.getRateLimit
);

/*
    @route GET /api/job-descriptions/:id/workspace
    @desc Get full JD workspace context (JD, latest resume, ATS analysis, history, interview report, rate limit)
    @access Private
*/
router.get(
    "/:id/workspace",
    authMiddleware,
    jdController.getJobDescriptionWorkspace
);

/*
    @route POST /api/job-descriptions/:id/resumes
    @desc Upload a resume for this specific JD, increment version, and run ATS analysis (rate-limited to 3/hr)
    @access Private
*/
router.post(
    "/:id/resumes",
    authMiddleware,
    uploadSingleFile.single("file"),
    jdController.uploadResumeForJobDescription
);

/*
    @route GET /api/job-descriptions/:id/ats-history/:analysisId
    @desc Retrieve full details of a specific historical ATS analysis version (free / not rate-limited)
    @access Private
*/
router.get(
    "/:id/ats-history/:analysisId",
    authMiddleware,
    jdController.getAtsAnalysisVersion
);

/*
    @route GET /api/job-descriptions/:id
    @desc Get job description details by ID
    @access Private
*/
router.get(
    "/:id",
    authMiddleware,
    jdController.getJobDescriptionById
);

/*
    @route DELETE /api/job-descriptions/:id
    @desc Delete job description by ID
    @access Private
*/
router.delete(
    "/:id",
    authMiddleware,
    jdController.deleteJobDescription
);

export default router;
