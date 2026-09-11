import multer from "multer";
import BadRequest from "../errors/BadRequest.error.js";

const storage = multer.memoryStorage();

const allowedMimeTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
];

export const uploadSingleFile = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (_req, file, cb) => {
        const isMimeAllowed = allowedMimeTypes.includes(file.mimetype);
        const hasAllowedExt =
            file.originalname.toLowerCase().endsWith(".pdf") ||
            file.originalname.toLowerCase().endsWith(".docx") ||
            file.originalname.toLowerCase().endsWith(".doc");

        if (isMimeAllowed || hasAllowedExt) {
            cb(null, true);
        } else {
            cb(new BadRequest("Invalid file type. Only PDF and DOCX files are allowed."));
        }
    },
});

export default uploadSingleFile;
