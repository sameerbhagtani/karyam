import ApiError from "../utils/ApiError.util.js";
import HTTP_STATUS from "../constants/StatusCodes.constants.js";

class TooManyRequests extends ApiError {
    public resetAt?: Date;

    constructor(
        message: string = "You're out of analyses for this hour. You can analyze your resume again after the limit resets.",
        resetAt?: Date
    ) {
        super(HTTP_STATUS.TOO_MANY_REQUESTS, message);
        this.message = message;
        this.resetAt = resetAt;
    }
}

export default TooManyRequests;
