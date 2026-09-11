import mongoose, { Document, Schema, Types } from "mongoose";

export interface IJobDescription extends Document {
    userId: Types.ObjectId;
    title: string;
    company: string;
    sourceType: "upload" | "pasted_text";
    s3Key?: string;
    rawText: string;
    createdAt: Date;
}

const jobDescriptionSchema = new Schema<IJobDescription>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: [true, "userId is required"],
            index: true,
        },
        title: {
            type: String,
            required: [true, "title is required"],
        },
        company: {
            type: String,
            required: [true, "company is required"],
        },
        sourceType: {
            type: String,
            enum: ["upload", "pasted_text"],
            required: [true, "sourceType is required"],
        },
        s3Key: {
            type: String,
            required: false,
        },
        rawText: {
            type: String,
            required: [true, "rawText is required"],
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

const JobDescription = mongoose.model<IJobDescription>("JobDescription", jobDescriptionSchema);

export default JobDescription;
