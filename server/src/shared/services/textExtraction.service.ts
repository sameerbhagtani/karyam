import { createRequire } from "node:module";
import mammoth from "mammoth";
import BadRequest from "../errors/BadRequest.error.js";
import logger from "../config/logger.config.js";

const require = createRequire(import.meta.url);
// pdf-parse uses traditional CommonJS exports
const pdfParse = require("pdf-parse");

export class TextExtractionService {
    async extractText(buffer: Buffer, mimeType: string, originalFilename?: string): Promise<string> {
        if (!buffer || buffer.length === 0) {
            throw new BadRequest("File buffer is empty");
        }

        const isPdf =
            mimeType === "application/pdf" ||
            (originalFilename && originalFilename.toLowerCase().endsWith(".pdf"));

        const isDocx =
            mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            mimeType === "application/msword" ||
            (originalFilename &&
                (originalFilename.toLowerCase().endsWith(".docx") ||
                    originalFilename.toLowerCase().endsWith(".doc")));

        let extractedText = "";

        if (isPdf) {
            try {
                if (typeof pdfParse === "function") {
                    const pdfData = await pdfParse(buffer);
                    extractedText = pdfData.text || "";
                } else if (pdfParse && pdfParse.PDFParse) {
                    const parser = new pdfParse.PDFParse({ data: buffer });
                    const res = await parser.getText();
                    extractedText = res.text || "";
                    if (typeof parser.destroy === "function") {
                        await parser.destroy();
                    }
                } else {
                    throw new Error("Unable to initialize PDF parser");
                }
            } catch (error) {
                logger.error(error, "Failed to parse PDF file");
                throw new BadRequest("Failed to extract text from PDF. The file may be corrupt or encrypted.");
            }
        } else if (isDocx) {
            try {
                const docxData = await mammoth.extractRawText({ buffer });
                extractedText = docxData.value || "";
            } catch (error) {
                logger.error(error, "Failed to parse DOCX file");
                throw new BadRequest("Failed to extract text from DOCX document.");
            }
        } else {
            throw new BadRequest(`Unsupported file type: ${mimeType}. Please upload a PDF or DOCX file.`);
        }

        const cleanedText = extractedText
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .replace(/[ \t]+/g, " ")
            .replace(/\n\s*\n+/g, "\n\n")
            .trim();

        if (!cleanedText) {
            throw new BadRequest("Could not extract readable text from file. Please ensure the document is not an image-only scan.");
        }

        return cleanedText;
    }
}

export const textExtractionService = new TextExtractionService();
export default textExtractionService;
