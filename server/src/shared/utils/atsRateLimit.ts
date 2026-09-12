import { Types } from "mongoose";
import AtsAnalysisDao from "../dao/atsAnalysis.dao.js";
import TooManyRequests from "../errors/TooManyRequests.error.js";

const atsDao = new AtsAnalysisDao();
const ATS_HOURLY_LIMIT = 3;
const ONE_HOUR_MS = 60 * 60 * 1000;

export interface AtsRateLimitStatus {
    limit: number;
    remaining: number;
    resetAt: Date;
    isAllowed: boolean;
}

export async function getAtsRateLimitStatus(
    userId: string | Types.ObjectId
): Promise<AtsRateLimitStatus> {
    const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS);
    const count = await atsDao.countUserAnalysesSince(userId, oneHourAgo);

    let resetAt = new Date(Date.now() + ONE_HOUR_MS);
    if (count > 0) {
        const oldest = await atsDao.findOldestAnalysisSince(userId, oneHourAgo);
        if (oldest) {
            resetAt = new Date(oldest.createdAt.getTime() + ONE_HOUR_MS);
        }
    }

    const remaining = Math.max(0, ATS_HOURLY_LIMIT - count);

    return {
        limit: ATS_HOURLY_LIMIT,
        remaining,
        resetAt,
        isAllowed: count < ATS_HOURLY_LIMIT,
    };
}

export async function assertAtsRateLimit(
    userId: string | Types.ObjectId
): Promise<AtsRateLimitStatus> {
    const status = await getAtsRateLimitStatus(userId);
    if (!status.isAllowed) {
        throw new TooManyRequests(
            "You're out of analyses for this hour. You can analyze your resume again after the limit resets.",
            status.resetAt
        );
    }
    return status;
}
