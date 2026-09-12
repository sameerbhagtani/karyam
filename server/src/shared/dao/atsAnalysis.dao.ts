import { Types } from "mongoose";
import AtsAnalysis, { IAtsAnalysis } from "../models/atsAnalysis.model.js";

export class AtsAnalysisDao {
    AtsAnalysisModel: typeof AtsAnalysis;

    constructor() {
        this.AtsAnalysisModel = AtsAnalysis;
    }

    async createAnalysis(data: Partial<IAtsAnalysis>): Promise<IAtsAnalysis> {
        return await this.AtsAnalysisModel.create(data);
    }

    async findAnalysisById(id: string | Types.ObjectId): Promise<IAtsAnalysis | null> {
        return await this.AtsAnalysisModel.findById(id);
    }

    async findLatestAnalysisByJdId(jdId: string | Types.ObjectId): Promise<IAtsAnalysis | null> {
        return await this.AtsAnalysisModel.findOne({ jdId }).sort({ version: -1, createdAt: -1 });
    }

    async findLatestAnalysisByJdAndResume(
        jdId: string | Types.ObjectId,
        resumeId: string | Types.ObjectId
    ): Promise<IAtsAnalysis | null> {
        return await this.AtsAnalysisModel.findOne({ jdId, resumeId }).sort({ version: -1, createdAt: -1 });
    }

    async findAnalysesByJdId(jdId: string | Types.ObjectId): Promise<IAtsAnalysis[]> {
        return await this.AtsAnalysisModel.find({ jdId }).sort({ version: -1, createdAt: -1 });
    }

    async countUserAnalysesSince(userId: string | Types.ObjectId, sinceDate: Date): Promise<number> {
        return await this.AtsAnalysisModel.countDocuments({
            userId: new Types.ObjectId(userId.toString()),
            createdAt: { $gte: sinceDate },
        });
    }

    async findOldestAnalysisSince(
        userId: string | Types.ObjectId,
        sinceDate: Date
    ): Promise<IAtsAnalysis | null> {
        return await this.AtsAnalysisModel.findOne({
            userId: new Types.ObjectId(userId.toString()),
            createdAt: { $gte: sinceDate },
        }).sort({ createdAt: 1 });
    }
}

export default AtsAnalysisDao;
