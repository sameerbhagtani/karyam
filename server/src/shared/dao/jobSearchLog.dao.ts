import { Types } from "mongoose";
import JobSearchLog, { IJobSearchLog } from "../models/jobSearchLog.model.js";

export class JobSearchLogDao {
    private model: typeof JobSearchLog;

    constructor() {
        this.model = JobSearchLog;
    }

    async logSearch(userId: string | Types.ObjectId, query: string, location: string = ""): Promise<IJobSearchLog> {
        return await this.model.create({
            userId: new Types.ObjectId(userId.toString()),
            query,
            location,
            createdAt: new Date(),
        });
    }

    async countUserSearchesSince(userId: string | Types.ObjectId, sinceDate: Date): Promise<number> {
        return await this.model.countDocuments({
            userId: new Types.ObjectId(userId.toString()),
            createdAt: { $gte: sinceDate },
        });
    }

    async findOldestSearchSince(
        userId: string | Types.ObjectId,
        sinceDate: Date
    ): Promise<IJobSearchLog | null> {
        return await this.model
            .findOne({
                userId: new Types.ObjectId(userId.toString()),
                createdAt: { $gte: sinceDate },
            })
            .sort({ createdAt: 1 });
    }
}

export const jobSearchLogDao = new JobSearchLogDao();
export default JobSearchLogDao;
