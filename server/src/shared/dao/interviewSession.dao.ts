import { Types } from "mongoose";
import InterviewSession, {
    IInterviewSession,
    InterviewSessionStatus,
    IInterviewReport,
} from "../models/interviewSession.model.js";

class InterviewSessionDao {
    SessionModel: typeof InterviewSession;

    constructor() {
        this.SessionModel = InterviewSession;
    }

    async createSession(data: Partial<IInterviewSession>): Promise<IInterviewSession> {
        return await this.SessionModel.create(data);
    }

    async findSessionById(id: string | Types.ObjectId): Promise<IInterviewSession | null> {
        return await this.SessionModel.findById(id);
    }

    async findSessionByIdAndUserId(
        id: string | Types.ObjectId,
        userId: string | Types.ObjectId
    ): Promise<IInterviewSession | null> {
        return await this.SessionModel.findOne({ _id: id, userId });
    }

    async updateSessionStatus(
        id: string | Types.ObjectId,
        status: InterviewSessionStatus
    ): Promise<IInterviewSession | null> {
        return await this.SessionModel.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );
    }

    async updateSessionReport(
        id: string | Types.ObjectId,
        report: IInterviewReport
    ): Promise<IInterviewSession | null> {
        return await this.SessionModel.findByIdAndUpdate(
            id,
            { report, status: "completed", completedAt: new Date() },
            { new: true }
        );
    }

    async findSessionsByUserId(userId: string | Types.ObjectId): Promise<IInterviewSession[]> {
        return await this.SessionModel.find({ userId }).sort({ createdAt: -1 });
    }

    async findLatestSessionByJdIdAndUserId(
        jdId: string | Types.ObjectId,
        userId: string | Types.ObjectId
    ): Promise<IInterviewSession | null> {
        return await this.SessionModel.findOne({ jdId, userId }).sort({ createdAt: -1 });
    }
}

export default InterviewSessionDao;
