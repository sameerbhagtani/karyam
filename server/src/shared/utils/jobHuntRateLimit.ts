import { Types } from "mongoose";
import JobSearchLogDao from "../dao/jobSearchLog.dao.js";
import TooManyRequests from "../errors/TooManyRequests.error.js";

const searchLogDao = new JobSearchLogDao();
export const JOB_HUNT_HOURLY_LIMIT = 5;
const ONE_HOUR_MS = 60 * 60 * 1000;

export interface JobHuntRateLimitStatus {
    limit: number;
    remaining: number;
    resetAt: Date;
    isAllowed: boolean;
}

export async function getJobHuntRateLimitStatus(
    userId: string | Types.ObjectId
): Promise<JobHuntRateLimitStatus> {
    const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS);
    const count = await searchLogDao.countUserSearchesSince(userId, oneHourAgo);

    let resetAt = new Date(Date.now() + ONE_HOUR_MS);
    if (count > 0) {
        const oldest = await searchLogDao.findOldestSearchSince(userId, oneHourAgo);
        if (oldest && oldest.createdAt) {
            resetAt = new Date(oldest.createdAt.getTime() + ONE_HOUR_MS);
        }
    }

    const remaining = Math.max(0, JOB_HUNT_HOURLY_LIMIT - count);

    return {
        limit: JOB_HUNT_HOURLY_LIMIT,
        remaining,
        resetAt,
        isAllowed: count < JOB_HUNT_HOURLY_LIMIT,
    };
}

export async function assertJobHuntRateLimit(
    userId: string | Types.ObjectId
): Promise<JobHuntRateLimitStatus> {
    const status = await getJobHuntRateLimitStatus(userId);
    if (!status.isAllowed) {
        const resetTimeStr = status.resetAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        throw new TooManyRequests(
            `You have reached the limit of ${JOB_HUNT_HOURLY_LIMIT} job searches per hour. You can search again at ${resetTimeStr}.`,
            status.resetAt
        );
    }
    return status;
}
