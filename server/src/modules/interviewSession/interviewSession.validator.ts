import { body, param } from "express-validator";
import validateErrors from "../../shared/utils/validateErrors.util.js";

export const createSessionValidators = [
    body("resumeId")
        .notEmpty()
        .withMessage("resumeId is required")
        .isMongoId()
        .withMessage("resumeId must be a valid MongoDB ObjectId"),

    body("jdId")
        .notEmpty()
        .withMessage("jdId is required")
        .isMongoId()
        .withMessage("jdId must be a valid MongoDB ObjectId"),

    body("targetLoopCount")
        .optional()
        .isInt({ min: 1, max: 10 })
        .withMessage("targetLoopCount must be an integer between 1 and 10"),

    validateErrors,
];

export const getSessionValidators = [
    param("id")
        .isMongoId()
        .withMessage("Session ID must be a valid MongoDB ObjectId"),

    validateErrors,
];

export const turnAnswerValidators = [
    param("id")
        .isMongoId()
        .withMessage("Session ID must be a valid MongoDB ObjectId"),

    param("turnIndex")
        .isInt({ min: 0 })
        .withMessage("turnIndex must be a non-negative integer"),

    validateErrors,
];

