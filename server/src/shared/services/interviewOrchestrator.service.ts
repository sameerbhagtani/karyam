import { Response } from "express";
import { Types } from "mongoose";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatMistralAI } from "@langchain/mistralai";
import InterviewSessionDao from "../dao/interviewSession.dao.js";
import InterviewTurnDao from "../dao/interviewTurn.dao.js";
import ResumeDao from "../dao/resume.dao.js";
import JobDescriptionDao from "../dao/jobDescription.dao.js";
import sarvamService from "./sarvam.service.js";
import mistralManager from "./mistralManager.service.js";
import logger from "../config/logger.config.js";
import BadRequest from "../errors/BadRequest.error.js";
import NotFound from "../errors/NotFound.error.js";
import { IInterviewReport } from "../models/interviewSession.model.js";

interface AnswerRatingResult {
    score: number;
    feedback: string;
    followUpNeeded: boolean;
}

export class InterviewOrchestratorService {
    private sessionDao: InterviewSessionDao;
    private turnDao: InterviewTurnDao;
    private resumeDao: ResumeDao;
    private jdDao: JobDescriptionDao;

    constructor() {
        this.sessionDao = new InterviewSessionDao();
        this.turnDao = new InterviewTurnDao();
        this.resumeDao = new ResumeDao();
        this.jdDao = new JobDescriptionDao();
    }

    /**
     * Splits streamed tokens into sentence chunks based on punctuation boundaries.
     */
    private extractSentences(buffer: string): { sentences: string[]; remainder: string } {
        const sentences: string[] = [];
        // Match full sentences ending in ., ?, or ! followed by space or end of string
        const regex = /([^.?!]+[.?!]+)(?:\s+|$)/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(buffer)) !== null) {
            const sentence = match[1].trim();
            if (sentence.length > 0) {
                sentences.push(sentence);
                lastIndex = regex.lastIndex;
            }
        }

        const remainder = buffer.slice(lastIndex);
        return { sentences, remainder };
    }

    /**
     * Streams question generation from Mistral, buffers into sentences,
     * sends to Sarvam TTS in real-time, and streams audio-chunks over SSE.
     */
    async streamQuestionToSse(
        res: Response,
        sessionId: string,
        turnIndex: number
    ): Promise<void> {
        const session = await this.sessionDao.findSessionById(sessionId);
        if (!session) {
            throw new NotFound("Interview session not found");
        }

        if (session.status === "aborted" || session.status === "completed") {
            throw new BadRequest(`Cannot continue session in status '${session.status}'`);
        }

        // Transition session to in_progress if starting
        if (session.status !== "in_progress") {
            await this.sessionDao.updateSessionStatus(sessionId, "in_progress");
            if (!session.startedAt) {
                session.startedAt = new Date();
                await session.save();
            }
        }

        // Fetch resume and JD documents
        const resume = await this.resumeDao.findResumeById(session.resumeId);
        const jd = await this.jdDao.findJobDescriptionById(session.jdId);
        const priorTurns = await this.turnDao.findTurnsBySessionId(sessionId);

        // Configure SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders?.();

        // 1. Emit metadata event
        res.write(
            `event: metadata\ndata: ${JSON.stringify({
                turnIndex,
                sessionId,
                targetLoopCount: session.targetLoopCount,
            })}\n\n`
        );

        // Build prompt context
        const systemPrompt = `You are an expert, professional technical interviewer interviewing a candidate for the position of "${jd?.title || "Software Engineer"}" at "${jd?.company || "the company"}".
Job Description Context:
${jd?.rawText?.slice(0, 1500) || "N/A"}

Candidate Resume Context:
${resume?.extractedText?.slice(0, 1500) || "N/A"}

Instructions:
- Formulate the NEXT single interview question (Turn ${turnIndex} of ${session.targetLoopCount}).
- If turnIndex == 0: Welcome the candidate briefly in 1 warm sentence, then ask a foundational technical/introductory question.
- If turnIndex > 0: Follow up on what was asked or move to a relevant skill from the JD that has not yet been assessed.
- Keep the output purely spoken conversational text. Do NOT use markdown symbols, bullet points, headers, or asterisks.
- Speak naturally so text-to-speech audio sounds fluid and human.`;

        const priorTurnsSummary = priorTurns
            .filter((t) => t.turnIndex < turnIndex)
            .map(
                (t) =>
                    `Turn ${t.turnIndex}:\nInterviewer: ${t.question.text}\nCandidate: ${t.answer?.transcript || "No answer"}\nRating: ${t.rating?.score || "N/A"}/10`
            )
            .join("\n\n");

        const userPrompt = priorTurnsSummary
            ? `Previous turns:\n${priorTurnsSummary}\n\nAsk Question for Turn ${turnIndex}:`
            : `Ask initial Question for Turn 0:`;

        let fullQuestionText = "";
        let textBuffer = "";

        try {
            if (mistralManager.hasKeys()) {
                await mistralManager.executeWithRetry(async (apiKey) => {
                    const chat = new ChatMistralAI({
                        apiKey,
                        model: "mistral-medium-latest",
                        temperature: 0.7,
                    });

                    const stream = await chat.stream([
                        new SystemMessage(systemPrompt),
                        new HumanMessage(userPrompt),
                    ]);

                    for await (const chunk of stream) {
                        const token = chunk.content.toString();
                        fullQuestionText += token;
                        textBuffer += token;

                        // Check if we reached a sentence boundary
                        const { sentences, remainder } = this.extractSentences(textBuffer);
                        if (sentences.length > 0) {
                            textBuffer = remainder;
                            for (const sentence of sentences) {
                                const audioChunk = await sarvamService.textToSpeech(sentence);
                                res.write(
                                    `event: audio-chunk\ndata: ${JSON.stringify({
                                        chunk: audioChunk,
                                        text: sentence,
                                    })}\n\n`
                                );
                            }
                        }
                    }
                });
            } else {
                // Fallback question when no LLM keys are configured
                fullQuestionText = `Hello, welcome to the interview for ${jd?.title || "this position"}. Could you please walk me through your background and the most impactful technical project you have worked on?`;
                textBuffer = fullQuestionText;
            }
        } catch (error) {
            logger.error(error, "Failed to stream question from LLM; utilizing fallback question");
            fullQuestionText = fullQuestionText || `Could you describe your core technical experience related to ${jd?.title || "this role"}?`;
            textBuffer = "";
            const audioChunk = await sarvamService.textToSpeech(fullQuestionText);
            res.write(
                `event: audio-chunk\ndata: ${JSON.stringify({
                    chunk: audioChunk,
                    text: fullQuestionText,
                })}\n\n`
            );
        }

        // Flush any remaining text in the buffer
        if (textBuffer.trim().length > 0) {
            const finalChunk = textBuffer.trim();
            const audioChunk = await sarvamService.textToSpeech(finalChunk);
            res.write(
                `event: audio-chunk\ndata: ${JSON.stringify({
                    chunk: audioChunk,
                    text: finalChunk,
                })}\n\n`
            );
        }

        fullQuestionText = fullQuestionText.trim();

        // 2. Persist turn question in Mongo
        const existingTurn = await this.turnDao.findTurnBySessionAndIndex(sessionId, turnIndex);
        if (!existingTurn) {
            await this.turnDao.createTurn({
                sessionId: new Types.ObjectId(sessionId),
                turnIndex,
                question: {
                    text: fullQuestionText,
                    askedAt: new Date(),
                },
            });
        }

        // 3. Emit done event
        res.write(
            `event: done\ndata: ${JSON.stringify({
                turnIndex,
                question: fullQuestionText,
            })}\n\n`
        );

        res.end();
    }

    /**
     * Processes candidate's uploaded audio blob:
     * 1. Transcribes via Sarvam STT
     * 2. Evaluates answer via Mistral (structured rating)
     * 3. Persists turn and checks if session loop is complete
     */
    async processCandidateAnswer(
        sessionId: string,
        turnIndex: number,
        audioBuffer: Buffer,
        mimeType: string = "audio/wav",
        filename: string = "answer.wav"
    ): Promise<{
        turnIndex: number;
        transcript: string;
        rating: { score: number; feedback: string };
        sessionComplete: boolean;
    }> {
        const session = await this.sessionDao.findSessionById(sessionId);
        if (!session) {
            throw new NotFound("Interview session not found");
        }

        // 1. Transcribe audio using Sarvam STT
        const transcript = await sarvamService.speechToText(audioBuffer, mimeType, filename);

        // 2. Fetch turn question
        let turn = await this.turnDao.findTurnBySessionAndIndex(sessionId, turnIndex);
        if (!turn) {
            // If turn question was not previously recorded, create placeholder
            turn = await this.turnDao.createTurn({
                sessionId: new Types.ObjectId(sessionId),
                turnIndex,
                question: {
                    text: "Interview question",
                    askedAt: new Date(),
                },
            });
        }

        // Fetch resume and JD for grounding
        const resume = await this.resumeDao.findResumeById(session.resumeId);
        const jd = await this.jdDao.findJobDescriptionById(session.jdId);

        // 3. Rate answer with Mistral
        const systemPrompt = `You are an expert technical interviewer evaluating a candidate's answer.
Job Title: ${jd?.title || "Software Engineer"}
Question Asked: "${turn.question.text}"
Candidate Spoken Answer Transcript: "${transcript}"

Job Description Context:
${jd?.rawText?.slice(0, 1000) || "N/A"}

Candidate Resume Context:
${resume?.extractedText?.slice(0, 1000) || "N/A"}

Output strict JSON with this schema:
{
  "score": <integer from 0 to 10>,
  "feedback": "<concise 1-2 sentence constructive evaluation>",
  "followUpNeeded": <boolean>
}`;

        let ratingResult: AnswerRatingResult = {
            score: 7,
            feedback: "Solid answer with clear technical explanation.",
            followUpNeeded: false,
        };

        try {
            if (mistralManager.hasKeys()) {
                await mistralManager.executeWithRetry(async (apiKey) => {
                    const chat = new ChatMistralAI({
                        apiKey,
                        model: "mistral-medium-latest",
                        temperature: 0.3,
                    });

                    const response = await chat.invoke([
                        new SystemMessage(systemPrompt),
                        new HumanMessage("Please evaluate the answer in valid JSON."),
                    ]);

                    const content = response.content.toString();
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        ratingResult = {
                            score: Math.min(10, Math.max(0, Number(parsed.score) || 7)),
                            feedback: String(parsed.feedback || ratingResult.feedback),
                            followUpNeeded: Boolean(parsed.followUpNeeded),
                        };
                    }
                });
            }
        } catch (error) {
            logger.warn(error, "Failed to rate answer via LLM; applying default score");
        }

        // 4. Persist transcript and rating in MongoDB
        await this.turnDao.updateTurnAnswer(sessionId, turnIndex, transcript, new Date());
        await this.turnDao.updateTurnRating(
            sessionId,
            turnIndex,
            ratingResult.score,
            ratingResult.feedback,
            new Date()
        );

        // 5. Update session turn index and loop state
        const nextTurnIndex = turnIndex + 1;
        const sessionComplete = nextTurnIndex >= session.targetLoopCount;

        session.currentTurnIndex = nextTurnIndex;
        await session.save();

        return {
            turnIndex,
            transcript,
            rating: {
                score: ratingResult.score,
                feedback: ratingResult.feedback,
            },
            sessionComplete,
        };
    }

    /**
     * Generates final session report via Mistral using all recorded turns.
     */
    async generateFinalReport(sessionId: string): Promise<IInterviewReport> {
        const session = await this.sessionDao.findSessionById(sessionId);
        if (!session) {
            throw new NotFound("Interview session not found");
        }

        if (session.status === "completed" && session.report && session.report.confidenceScore !== undefined) {
            return session.report;
        }

        const turns = await this.turnDao.findTurnsBySessionId(sessionId);
        if (turns.length === 0) {
            throw new BadRequest("Cannot generate report: No interview turns found for this session.");
        }

        const validTurns = turns.filter((t) => t.rating && t.rating.score !== undefined);
        const avgScore = validTurns.length > 0
            ? Math.round(
                  validTurns.reduce((acc, t) => acc + (t.rating?.score || 0), 0) / validTurns.length
              )
            : 7;

        const turnsSummary = turns
            .map(
                (t) =>
                    `Turn ${t.turnIndex}:\nQuestion: ${t.question.text}\nAnswer: ${t.answer?.transcript || "N/A"}\nScore: ${t.rating?.score || 0}/10\nFeedback: ${t.rating?.feedback || "N/A"}`
            )
            .join("\n\n");

        const prompt = `Based on the following interview turns, produce a comprehensive candidate evaluation report.
Turns:
${turnsSummary}

Return strictly valid JSON with this exact schema:
{
  "confidenceScore": <integer 0-10>,
  "answerQualityScore": <integer 0-10>,
  "strengths": ["string", "string"],
  "weaknesses": ["string", "string"],
  "advice": "<actionable advice for future interviews>"
}`;

        let report: IInterviewReport = {
            confidenceScore: Math.min(10, avgScore + 1),
            answerQualityScore: avgScore,
            strengths: [
                "Demonstrated good domain knowledge",
                "Communicated ideas in a structured manner",
            ],
            weaknesses: [
                "Could provide more quantified impact metrics",
                "Consider diving deeper into architectural trade-offs",
            ],
            advice: "Continue practicing technical deep dives and focus on structuring answers with concrete real-world examples.",
        };

        try {
            if (mistralManager.hasKeys()) {
                await mistralManager.executeWithRetry(async (apiKey) => {
                    const chat = new ChatMistralAI({
                        apiKey,
                        model: "mistral-medium-latest",
                        temperature: 0.3,
                    });

                    const response = await chat.invoke([
                        new SystemMessage("You are an executive hiring manager synthesizing an interview report."),
                        new HumanMessage(prompt),
                    ]);

                    const content = response.content.toString();
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        report = {
                            confidenceScore: Number(parsed.confidenceScore) || report.confidenceScore,
                            answerQualityScore: Number(parsed.answerQualityScore) || avgScore,
                            strengths: Array.isArray(parsed.strengths) ? parsed.strengths : report.strengths,
                            weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : report.weaknesses,
                            advice: String(parsed.advice || report.advice),
                        };
                    }
                });
            }
        } catch (error) {
            logger.warn(error, "Failed to generate LLM report; using calculated averages");
        }

        // Save report on session and complete it
        await this.sessionDao.updateSessionReport(sessionId, report);

        return report;
    }
}

export const interviewOrchestratorService = new InterviewOrchestratorService();
export default interviewOrchestratorService;
