import mongoose, { Document, Schema, Types } from "mongoose";

export interface IQuestionInfo {
    text: string;
    askedAt: Date;
}

export interface IAnswerInfo {
    transcript: string;
    answeredAt: Date;
}

export interface IRatingInfo {
    score: number;
    feedback: string;
    whatWentWell?: string;
    whatCouldBeBetter?: string;
    ratedAt: Date;
}

export interface IInterviewTurn extends Document {
    sessionId: Types.ObjectId;
    turnIndex: number;
    question: IQuestionInfo;
    answer?: IAnswerInfo;
    rating?: IRatingInfo;
    createdAt: Date;
}

const questionSchema = new Schema<IQuestionInfo>(
    {
        text: { type: String, required: true },
        askedAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const answerSchema = new Schema<IAnswerInfo>(
    {
        transcript: { type: String, required: true },
        answeredAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const ratingSchema = new Schema<IRatingInfo>(
    {
        score: { type: Number, min: 0, max: 10, required: true },
        feedback: { type: String, required: true },
        whatWentWell: { type: String, default: "" },
        whatCouldBeBetter: { type: String, default: "" },
        ratedAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const interviewTurnSchema = new Schema<IInterviewTurn>(
    {
        sessionId: {
            type: Schema.Types.ObjectId,
            ref: "InterviewSession",
            required: [true, "sessionId is required"],
        },
        turnIndex: {
            type: Number,
            required: [true, "turnIndex is required"],
        },
        question: {
            type: questionSchema,
            required: true,
        },
        answer: {
            type: answerSchema,
            required: false,
        },
        rating: {
            type: ratingSchema,
            required: false,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: false,
    }
);

// Compound unique index to prevent duplicate turn indexes per session
interviewTurnSchema.index({ sessionId: 1, turnIndex: 1 }, { unique: true });

const InterviewTurn = mongoose.model<IInterviewTurn>("InterviewTurn", interviewTurnSchema);

export default InterviewTurn;
