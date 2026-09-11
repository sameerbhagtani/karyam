import { Request, Response } from "express";
import { Types } from "mongoose";
import path from "node:path";
import JobDescriptionDao from "../../shared/dao/jobDescription.dao.js";
import BadRequest from "../../shared/errors/BadRequest.error.js";
import NotFound from "../../shared/errors/NotFound.error.js";
import textExtractionService from "../../shared/services/textExtraction.service.js";
import s3Service from "../../shared/services/s3.service.js";

export class JobDescriptionController {
    private jdDao: JobDescriptionDao;

    constructor() {
        this.jdDao = new JobDescriptionDao();
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
            jobDescriptions: jds.map((j) => ({
                jdId: j._id.toString(),
                title: j.title,
                company: j.company,
                sourceType: j.sourceType,
                createdAt: j.createdAt,
            })),
            latest: jds[0]
                ? {
                      jdId: jds[0]._id.toString(),
                      title: jds[0].title,
                      company: jds[0].company,
                      sourceType: jds[0].sourceType,
                      createdAt: jds[0].createdAt,
                  }
                : null,
        });
    };
}

export default JobDescriptionController;
