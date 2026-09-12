// Importing modules
import express from "express";
import healthRouter from "./health.router.js";
import authRouter from "../../modules/public/auth/auth.router.js";
import resumeRouter from "../../modules/resume/resume.router.js";
import jdRouter from "../../modules/jobDescription/jobDescription.router.js";
import interviewSessionRouter from "../../modules/interviewSession/interviewSession.router.js";
import jobHuntRouter from "../../modules/jobHunt/jobHunt.router.js";

// making the router
const router = express.Router();

// mounting the public routers
router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/v1/auth", authRouter);

// mounting Dev A routers
router.use("/resumes", resumeRouter);
router.use("/job-descriptions", jdRouter);
router.use("/interview-sessions", interviewSessionRouter);
router.use("/job-hunt", jobHuntRouter);

// exporting the router
export default router;
