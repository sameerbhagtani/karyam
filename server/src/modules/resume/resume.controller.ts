import { Request, Response } from "express";
import { Types } from "mongoose";
import path from "node:path";
import ResumeDao from "../../shared/dao/resume.dao.js";
import BadRequest from "../../shared/errors/BadRequest.error.js";
import NotFound from "../../shared/errors/NotFound.error.js";
import textExtractionService from "../../shared/services/textExtraction.service.js";
import s3Service from "../../shared/services/s3.service.js";

export class ResumeController {
    private resumeDao: ResumeDao;

    constructor() {
        this.resumeDao = new ResumeDao();
    }

    uploadResume = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        if (!userId) {
            throw new BadRequest("User not authenticated");
        }

        if (!req.file) {
            throw new BadRequest("Resume file is required. Please upload a file with field name 'file'.");
        }

        const { buffer, mimetype, originalname } = req.file;

        // 1. Extract text from PDF or DOCX
        const extractedText = await textExtractionService.extractText(buffer, mimetype, originalname);

        // 2. Generate new resume ID and S3 key
        const resumeId = new Types.ObjectId();
        const ext = path.extname(originalname) || (mimetype === "application/pdf" ? ".pdf" : ".docx");
        const s3Key = `resumes/${userId}/${resumeId}${ext}`;

        // 3. Upload to S3 (or local fallback)
        await s3Service.uploadFile(s3Key, buffer, mimetype);

        // 4. Save to MongoDB
        const resume = await this.resumeDao.createResume({
            _id: resumeId,
            userId: new Types.ObjectId(userId),
            originalFilename: originalname,
            s3Key,
            mimeType: mimetype,
            extractedText,
        });

        // 5. Return PRD specified output schema
        return res.status(201).json({
            resumeId: resume._id.toString(),
            originalFilename: resume.originalFilename,
            status: "processed",
        });
    };

    getResumeById = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        const id = req.params.id as string;

        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequest("Invalid resume ID format");
        }

        const resume = await this.resumeDao.findResumeById(id);
        if (!resume || resume.userId.toString() !== userId) {
            throw new NotFound("Resume not found");
        }

        return res.status(200).json({
            resumeId: resume._id.toString(),
            originalFilename: resume.originalFilename,
            mimeType: resume.mimeType,
            s3Key: resume.s3Key,
            createdAt: resume.createdAt,
        });
    };

    getUserResumes = async (req: Request & { user?: Record<string, unknown> }, res: Response) => {
        const userId = (req.user?.userId || req.user?._id) as string;
        if (!userId) {
            throw new BadRequest("User not authenticated");
        }

        const resumes = await this.resumeDao.findResumesByUserId(userId);
        return res.status(200).json({
            resumes: resumes.map((r) => ({
                resumeId: r._id.toString(),
                originalFilename: r.originalFilename,
                mimeType: r.mimeType,
                createdAt: r.createdAt,
            })),
            latest: resumes[0]
                ? {
                      resumeId: resumes[0]._id.toString(),
                      originalFilename: resumes[0].originalFilename,
                      mimeType: resumes[0].mimeType,
                      createdAt: resumes[0].createdAt,
                  }
                : null,
        });
    };
}

export default ResumeController;
