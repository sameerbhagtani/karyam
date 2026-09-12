import mongoose, { Document, Schema, Types } from "mongoose";

export interface IAtsSuggestion {
    point: string;
    suggestion: string;
    current?: string;
    better?: string;
}

export interface IAtsBreakdown {
    matchedSkills: string[];
    missingSkills: string[];
    missingKeywords: string[];
    experienceRelevance: string;
    atsReadability: string;
    quantifiableAchievements: string;
    jobTitleAlignment: string;
}

export interface IAtsImprovements {
    missing: string[];
    suggestions: IAtsSuggestion[];
}

export interface IAtsAnalysis extends Document {
    userId: Types.ObjectId;
    jdId: Types.ObjectId;
    resumeId: Types.ObjectId;
    version: number;
    score: number;
    summary: string;
    breakdown: IAtsBreakdown;
    improvements: IAtsImprovements;
    createdAt: Date;
}

const suggestionSchema = new Schema<IAtsSuggestion>(
    {
        point: { type: String, required: true },
        suggestion: { type: String, required: true },
        current: { type: String, required: false },
        better: { type: String, required: false },
    },
    { _id: false }
);

const breakdownSchema = new Schema<IAtsBreakdown>(
    {
        matchedSkills: { type: [String], default: [] },
        missingSkills: { type: [String], default: [] },
        missingKeywords: { type: [String], default: [] },
        experienceRelevance: { type: String, default: "" },
        atsReadability: { type: String, default: "" },
        quantifiableAchievements: { type: String, default: "" },
        jobTitleAlignment: { type: String, default: "" },
    },
    { _id: false }
);

const improvementsSchema = new Schema<IAtsImprovements>(
    {
        missing: { type: [String], default: [] },
        suggestions: { type: [suggestionSchema], default: [] },
    },
    { _id: false }
);

const atsAnalysisSchema = new Schema<IAtsAnalysis>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: [true, "userId is required"],
            index: true,
        },
        jdId: {
            type: Schema.Types.ObjectId,
            ref: "JobDescription",
            required: [true, "jdId is required"],
            index: true,
        },
        resumeId: {
            type: Schema.Types.ObjectId,
            ref: "Resume",
            required: [true, "resumeId is required"],
            index: true,
        },
        version: {
            type: Number,
            required: [true, "version is required"],
            default: 1,
        },
        score: {
            type: Number,
            required: [true, "score is required"],
            min: 0,
            max: 100,
        },
        summary: {
            type: String,
            required: [true, "summary is required"],
        },
        breakdown: {
            type: breakdownSchema,
            required: true,
        },
        improvements: {
            type: improvementsSchema,
            required: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    {
        timestamps: false,
    }
);

atsAnalysisSchema.index({ jdId: 1, version: -1 });
atsAnalysisSchema.index({ userId: 1, createdAt: -1 });

const AtsAnalysis = mongoose.model<IAtsAnalysis>("AtsAnalysis", atsAnalysisSchema);

export default AtsAnalysis;
