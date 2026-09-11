import { Types } from "mongoose";
import InterviewTurn, { IInterviewTurn } from "../models/interviewTurn.model.js";

class InterviewTurnDao {
    TurnModel: typeof InterviewTurn;

    constructor() {
        this.TurnModel = InterviewTurn;
    }

    async createTurn(data: Partial<IInterviewTurn>): Promise<IInterviewTurn> {
        return await this.TurnModel.create(data);
    }

    async findTurnBySessionAndIndex(
        sessionId: string | Types.ObjectId,
        turnIndex: number
    ): Promise<IInterviewTurn | null> {
        return await this.TurnModel.findOne({ sessionId, turnIndex });
    }

    async updateTurnAnswer(
        sessionId: string | Types.ObjectId,
        turnIndex: number,
        transcript: string,
        answeredAt: Date = new Date()
    ): Promise<IInterviewTurn | null> {
        return await this.TurnModel.findOneAndUpdate(
            { sessionId, turnIndex },
            { $set: { answer: { transcript, answeredAt } } },
            { new: true }
        );
    }

    async updateTurnRating(
        sessionId: string | Types.ObjectId,
        turnIndex: number,
        score: number,
        feedback: string,
        ratedAt: Date = new Date()
    ): Promise<IInterviewTurn | null> {
        return await this.TurnModel.findOneAndUpdate(
            { sessionId, turnIndex },
            { $set: { rating: { score, feedback, ratedAt } } },
            { new: true }
        );
    }

    async findTurnsBySessionId(sessionId: string | Types.ObjectId): Promise<IInterviewTurn[]> {
        return await this.TurnModel.find({ sessionId }).sort({ turnIndex: 1 });
    }

    async deleteTurnsBySessionId(sessionId: string | Types.ObjectId): Promise<{ deletedCount?: number }> {
        return await this.TurnModel.deleteMany({ sessionId });
    }
}

export default InterviewTurnDao;
