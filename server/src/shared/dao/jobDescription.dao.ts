import { Types } from "mongoose";
import JobDescription, { IJobDescription } from "../models/jobDescription.model.js";

class JobDescriptionDao {
    JobDescriptionModel: typeof JobDescription;

    constructor() {
        this.JobDescriptionModel = JobDescription;
    }

    async createJobDescription(data: Partial<IJobDescription>): Promise<IJobDescription> {
        return await this.JobDescriptionModel.create(data);
    }

    async findJobDescriptionById(id: string | Types.ObjectId): Promise<IJobDescription | null> {
        return await this.JobDescriptionModel.findById(id);
    }

    async findJobDescriptionsByUserId(userId: string | Types.ObjectId): Promise<IJobDescription[]> {
        return await this.JobDescriptionModel.find({ userId }).sort({ createdAt: -1 });
    }

    async deleteJobDescriptionById(id: string | Types.ObjectId): Promise<IJobDescription | null> {
        return await this.JobDescriptionModel.findByIdAndDelete(id);
    }
}

export default JobDescriptionDao;
