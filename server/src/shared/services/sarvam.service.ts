import env from "../config/env.config.js";
import logger from "../config/logger.config.js";
import BadRequest from "../errors/BadRequest.error.js";

export class SarvamService {
    private apiKey: string;
    private isConfigured: boolean;
    private readonly ttsUrl = "https://api.sarvam.ai/text-to-speech";
    private readonly sttUrl = "https://api.sarvam.ai/speech-to-text";

    constructor() {
        this.apiKey = env.SARVAM_API_KEY || process.env.SARVAM_API_KEY || "";
        this.isConfigured = Boolean(this.apiKey && this.apiKey.trim().length > 0);

        if (!this.isConfigured) {
            logger.warn(
                "SARVAM_API_KEY is not configured in environment. SarvamService will operate in mock/fallback mode."
            );
        }
    }

    /**
     * Converts text into spoken audio using Sarvam TTS (bulbul:v3).
     * Returns base64 encoded audio string.
     */
    async textToSpeech(
        text: string,
        options?: {
            speaker?: string;
            targetLanguageCode?: string;
            model?: string;
        }
    ): Promise<string> {
        const trimmed = text.trim();
        if (!trimmed) {
            return "";
        }

        if (!this.isConfigured) {
            // Return a minimal valid 44-byte WAV header in base64 as mock audio
            return "UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
        }

        try {
            const res = await fetch(this.ttsUrl, {
                method: "POST",
                headers: {
                    "api-subscription-key": this.apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    inputs: [trimmed],
                    target_language_code: options?.targetLanguageCode || "en-IN",
                    speaker: options?.speaker || "meera",
                    model: options?.model || "bulbul:v3",
                }),
            });

            if (!res.ok) {
                const errorText = await res.text();
                logger.error({ status: res.status, errorText }, "Sarvam TTS API error");
                throw new Error(`Sarvam TTS API failed with status ${res.status}: ${errorText}`);
            }

            const data = (await res.json()) as { audios?: string[] };
            if (!data.audios || data.audios.length === 0 || !data.audios[0]) {
                throw new Error("Sarvam TTS returned empty audio payload");
            }

            return data.audios[0];
        } catch (error) {
            logger.error(error, "Failed to synthesize speech via Sarvam TTS");
            // If live call fails, fallback to empty audio so stream does not crash
            return "UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
        }
    }

    /**
     * Transcribes an audio buffer into text using Sarvam STT (saaras:v3).
     * Discards audio after transcription.
     */
    async speechToText(
        audioBuffer: Buffer,
        mimeType: string = "audio/wav",
        originalFilename: string = "answer.wav"
    ): Promise<string> {
        if (!audioBuffer || audioBuffer.length === 0) {
            throw new BadRequest("Empty audio buffer received");
        }

        if (!this.isConfigured) {
            logger.info("Using mock transcript for Sarvam STT fallback");
            return "I have hands-on experience designing and deploying scalable backend microservices, managing databases with MongoDB, and optimizing API performance.";
        }

        try {
            const formData = new FormData();
            const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
            formData.append("file", blob, originalFilename);
            formData.append("model", "saaras:v3");
            formData.append("language_code", "en-IN");

            const res = await fetch(this.sttUrl, {
                method: "POST",
                headers: {
                    "api-subscription-key": this.apiKey,
                },
                body: formData,
            });

            if (!res.ok) {
                const errorText = await res.text();
                logger.error({ status: res.status, errorText }, "Sarvam STT API error");
                throw new BadRequest(`Failed to transcribe audio with Sarvam STT: ${errorText}`);
            }

            const data = (await res.json()) as { transcript?: string };
            const transcript = (data.transcript || "").trim();

            if (!transcript) {
                throw new BadRequest(
                    "Speech could not be transcribed clearly. Please record your answer again."
                );
            }

            return transcript;
        } catch (error) {
            logger.error(error, "Failed to transcribe speech via Sarvam STT");
            if (error instanceof BadRequest) {
                throw error;
            }
            throw new BadRequest("Failed to transcribe audio. Please ensure your microphone is working and try again.");
        }
    }
}

export const sarvamService = new SarvamService();
export default sarvamService;
