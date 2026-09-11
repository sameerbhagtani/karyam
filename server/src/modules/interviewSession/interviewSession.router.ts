import express from "express";
import InterviewSessionController from "./interviewSession.controller.js";
import authMiddleware from "../../shared/middlewares/auth.middleware.js";
import { uploadAudioFile } from "../../shared/middlewares/upload.middleware.js";
import {
    createSessionValidators,
    getSessionValidators,
    turnAnswerValidators,
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
    @route GET /api/interview-sessions/:id/start
    @desc Start interview session and stream initial question via SSE
    @access Private
*/
router.get(
    "/:id/start",
    authMiddleware,
    getSessionValidators,
    sessionController.startSession
);

/*
    @route POST /api/interview-sessions/:id/turns/:turnIndex/answer
    @desc Submit candidate spoken answer audio blob for a turn
    @access Private
*/
router.post(
    "/:id/turns/:turnIndex/answer",
    authMiddleware,
    uploadAudioFile.single("audio"),
    turnAnswerValidators,
    sessionController.submitAnswer
);

/*
    @route GET /api/interview-sessions/:id/turns/next
    @desc Stream next interview question via SSE
    @access Private
*/
router.get(
    "/:id/turns/next",
    authMiddleware,
    getSessionValidators,
    sessionController.getNextTurn
);

/*
    @route POST /api/interview-sessions/:id/end
    @desc End interview session and generate final performance report
    @access Private
*/
router.post(
    "/:id/end",
    authMiddleware,
    getSessionValidators,
    sessionController.endSession
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
