import mongoose, { Document, Schema, Types } from "mongoose";

export interface IInterviewReport {
    confidenceScore?: number;
    answerQualityScore?: number;
    strengths?: string[];
    weaknesses?: string[];
    advice?: string;
}

export type InterviewSessionStatus =
    | "created"
    | "embedding"
    | "ready"
    | "in_progress"
    | "completed"
    | "aborted";

export interface IInterviewSession extends Document {
    userId: Types.ObjectId;
    resumeId: Types.ObjectId;
    jdId: Types.ObjectId;
    pineconeNamespace: string;
    status: InterviewSessionStatus;
    targetLoopCount: number;
    currentTurnIndex: number;
    startedAt?: Date;
    completedAt?: Date;
    report?: IInterviewReport;
    createdAt: Date;
}

const reportSchema = new Schema<IInterviewReport>(
    {
        confidenceScore: { type: Number, min: 0, max: 10 },
        answerQualityScore: { type: Number, min: 0, max: 10 },
        strengths: { type: [String], default: [] },
        weaknesses: { type: [String], default: [] },
        advice: { type: String, default: "" },
    },
    { _id: false }
);

const interviewSessionSchema = new Schema<IInterviewSession>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: [true, "userId is required"],
            index: true,
        },
        resumeId: {
            type: Schema.Types.ObjectId,
            ref: "Resume",
            required: [true, "resumeId is required"],
        },
        jdId: {
            type: Schema.Types.ObjectId,
            ref: "JobDescription",
            required: [true, "jdId is required"],
        },
        pineconeNamespace: {
            type: String,
            required: true,
            default: function (this: IInterviewSession) {
                return this._id.toString();
            },
        },
        status: {
            type: String,
            enum: ["created", "embedding", "ready", "in_progress", "completed", "aborted"],
            default: "created",
        },
        targetLoopCount: {
            type: Number,
            default: 7,
            min: 5,
            max: 10,
        },
        currentTurnIndex: {
            type: Number,
            default: 0,
        },
        startedAt: {
            type: Date,
        },
        completedAt: {
            type: Date,
        },
        report: {
            type: reportSchema,
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

interviewSessionSchema.index({ resumeId: 1, jdId: 1 });

const InterviewSession = mongoose.model<IInterviewSession>("InterviewSession", interviewSessionSchema);

export default InterviewSession;
