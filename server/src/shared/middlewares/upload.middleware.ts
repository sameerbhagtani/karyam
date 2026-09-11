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

export const uploadAudioFile = multer({
    storage,
    limits: {
        fileSize: 25 * 1024 * 1024, // 25MB max audio file size
    },
    fileFilter: (_req, file, cb) => {
        const isAudio =
            file.mimetype.startsWith("audio/") ||
            file.originalname.toLowerCase().match(/\.(wav|webm|ogg|mp3|m4a|aac|flac)$/);

        if (isAudio) {
            cb(null, true);
        } else {
            cb(new BadRequest("Invalid file type. Only audio files (wav, webm, mp3, ogg, etc.) are allowed."));
        }
    },
});

export default uploadSingleFile;

