import express from "express";
import ResumeController from "./resume.controller.js";
import authMiddleware from "../../shared/middlewares/auth.middleware.js";
import uploadSingleFile from "../../shared/middlewares/upload.middleware.js";

const router = express.Router();
const resumeController = new ResumeController();

/*
    @route POST /api/resumes
    @desc Upload a resume (PDF/DOCX)
    @access Private
*/
router.post(
    "/",
    authMiddleware,
    uploadSingleFile.single("file"),
    resumeController.uploadResume
);

/*
    @route GET /api/resumes
    @desc Get all resumes uploaded by the authenticated user
    @access Private
*/
router.get(
    "/",
    authMiddleware,
    resumeController.getUserResumes
);

/*
    @route GET /api/resumes/:id
    @desc Get resume details by ID
    @access Private
*/
router.get(
    "/:id",
    authMiddleware,
    resumeController.getResumeById
);

/*
    @route DELETE /api/resumes/:id
    @desc Delete resume by ID
    @access Private
*/
router.delete(
    "/:id",
    authMiddleware,
    resumeController.deleteResume
);

export default router;
