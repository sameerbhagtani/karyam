import express from "express";
import InterviewSessionController from "./interviewSession.controller.js";
import authMiddleware from "../../shared/middlewares/auth.middleware.js";
import {
    createSessionValidators,
    getSessionValidators,
} from "./interviewSession.validator.js";

const router = express.Router();
const sessionController = new InterviewSessionController();

/*
    @route POST /api/interview-sessions
    @desc Create a new interview session and kick off embedding
    @access Private
*/
router.post(
    "/",
    authMiddleware,
    createSessionValidators,
    sessionController.createSession
);

/*
    @route GET /api/interview-sessions/:id
    @desc Get interview session status
    @access Private
*/
router.get(
    "/:id",
    authMiddleware,
    getSessionValidators,
    sessionController.getSessionById
);

/*
    @route GET /api/interview-sessions/:id/report
    @desc Get interview session report
    @access Private
*/
router.get(
    "/:id/report",
    authMiddleware,
    getSessionValidators,
    sessionController.getSessionReport
);

export default router;
