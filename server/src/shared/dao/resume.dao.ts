import { Types } from "mongoose";
import Resume, { IResume } from "../models/resume.model.js";

class ResumeDao {
    ResumeModel: typeof Resume;

    constructor() {
        this.ResumeModel = Resume;
    }

    async createResume(data: Partial<IResume>): Promise<IResume> {
        return await this.ResumeModel.create(data);
    }

    async findResumeById(id: string | Types.ObjectId): Promise<IResume | null> {
        return await this.ResumeModel.findById(id);
    }

    async findResumesByUserId(userId: string | Types.ObjectId): Promise<IResume[]> {
        return await this.ResumeModel.find({ userId }).sort({ createdAt: -1 });
    }

    async findResumesByJdId(jdId: string | Types.ObjectId): Promise<IResume[]> {
        return await this.ResumeModel.find({ jdId }).sort({ version: -1, createdAt: -1 });
    }

    async findLatestResumeByJdId(jdId: string | Types.ObjectId): Promise<IResume | null> {
        return await this.ResumeModel.findOne({ jdId }).sort({ version: -1, createdAt: -1 });
    }

    async deleteResumeById(id: string | Types.ObjectId): Promise<IResume | null> {
        return await this.ResumeModel.findByIdAndDelete(id);
    }
}

export default ResumeDao;
