import mongoose, { Document, Schema, Types } from "mongoose";

export interface IJobSearchLog extends Document {
    userId: Types.ObjectId;
    query: string;
    location?: string;
    createdAt: Date;
}

const jobSearchLogSchema = new Schema<IJobSearchLog>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        query: {
            type: String,
            required: true,
            trim: true,
        },
        location: {
            type: String,
            required: false,
            default: "",
            trim: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
            // Automatically clean up records after 2 hours
            expires: 7200,
        },
    },
    {
        timestamps: false,
    }
);

jobSearchLogSchema.index({ userId: 1, createdAt: -1 });

const JobSearchLog =
    mongoose.models.JobSearchLog ||
    mongoose.model<IJobSearchLog>("JobSearchLog", jobSearchLogSchema);

export default JobSearchLog;
