import mongoose, { Document, Schema, Types } from "mongoose";

export interface IResume extends Document {
    userId: Types.ObjectId;
    jdId?: Types.ObjectId;
    version?: number;
    originalFilename: string;
    s3Key: string;
    mimeType: string;
    fileSize?: number;
    extractedText: string;
    createdAt: Date;
}

const resumeSchema = new Schema<IResume>(
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
            required: false,
            index: true,
        },
        version: {
            type: Number,
            required: false,
            default: 1,
        },
        originalFilename: {
            type: String,
            required: [true, "originalFilename is required"],
        },
        s3Key: {
            type: String,
            required: [true, "s3Key is required"],
        },
        mimeType: {
            type: String,
            required: [true, "mimeType is required"],
        },
        fileSize: {
            type: Number,
            required: false,
        },
        extractedText: {
            type: String,
            required: [true, "extractedText is required"],
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

const Resume = mongoose.model<IResume>("Resume", resumeSchema);

export default Resume;
