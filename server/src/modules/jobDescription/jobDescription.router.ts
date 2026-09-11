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
    @route GET /api/job-descriptions/:id
    @desc Get job description details by ID
    @access Private
*/
router.get(
    "/:id",
    authMiddleware,
    jdController.getJobDescriptionById
);

export default router;
