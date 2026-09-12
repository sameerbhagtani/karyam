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
import vectorService from "./vector.service.js";
import logger from "../config/logger.config.js";
import BadRequest from "../errors/BadRequest.error.js";
import NotFound from "../errors/NotFound.error.js";
import { IInterviewReport } from "../models/interviewSession.model.js";

interface AnswerRatingResult {
    score: number;
    feedback: string;
    whatWentWell?: string;
    whatCouldBeBetter?: string;
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

        // Retrieve relevant context from dual Pinecone namespaces (Resume namespace & JD namespace)
        const resumeNamespace = `resume-${session.resumeId}`;
        const jdNamespace = `jd-${session.jdId}`;

        const lastAnsweredTurn = priorTurns
            .filter((t) => t.turnIndex < turnIndex && t.answer?.transcript)
            .slice(-1)[0];
        const queryText = turnIndex === 0
            ? `${jd?.title || ""} ${jd?.company || ""} Core job qualifications and candidate background`
            : `${lastAnsweredTurn?.question?.text || ""} ${lastAnsweredTurn?.answer?.transcript || ""}`;

        const { resumeChunks, jdChunks } = await vectorService
            .queryDualNamespaces(resumeNamespace, jdNamespace, queryText, 3)
            .catch(() => ({ resumeChunks: [], jdChunks: [] }));

        const jdContext = jdChunks.length > 0
            ? jdChunks.map((c, i) => `[JD Requirement ${i + 1}]:\n${c}`).join("\n\n")
            : (jd?.rawText?.slice(0, 1500) || "N/A");

        const resumeContext = resumeChunks.length > 0
            ? resumeChunks.map((c, i) => `[Resume Evidence ${i + 1}]:\n${c}`).join("\n\n")
            : (resume?.extractedText?.slice(0, 1500) || "N/A");

        // Build system prompt with exact question budget N
        const isFirstTurn = turnIndex === 0;
        const totalQuestions = session.targetLoopCount || 7;
        const isLastTurn = turnIndex >= totalQuestions - 1;

        const systemPrompt = `You are Riya, a warm, sharp, senior technical interviewer at "${jd?.company || "the company"}" conducting a live voice interview for the "${jd?.title || "Software Engineer"}" role.

INTERVIEW SCOPE & QUESTION BUDGET:
- The candidate has selected an interview duration of exactly ${totalQuestions} questions.
- You are currently asking Question ${turnIndex + 1} of ${totalQuestions}.
${isLastTurn ? "- THIS IS THE FINAL QUESTION / WRAP-UP TURN of the interview. After acknowledging their previous answer, ask a closing question or wrap-up and end by warmly wishing them the absolute best in their career, interview journey, and future endeavors!" : ""}

CANDIDATE RESUME EVIDENCE (from vector search):
${resumeContext}

JOB DESCRIPTION REQUIREMENTS (from vector search):
${jdContext}

YOUR INTERVIEWING STYLE & BEHAVIOUR:
- You speak like a real human on a phone call: warm, direct, professional, naturally flowing.
- You NEVER use markdown, bullet points, headers, dashes, asterisks, or any formatting. Pure spoken dialogue only.
- Sentences are short and conversational. Maximum 2 sentences per turn unless giving brief feedback.
- You greet the candidate warmly on the very first message and briefly set expectations before asking Turn 0.
- Deep technical exploration:
  - Dig deep into real engineering challenges, architecture choices, trade-offs, and metrics from their projects.
  - Ask dependent questions that build directly upon what the candidate just explained.
  - Cover diverse, realistic engineering areas across turns (e.g. system design, data storage trade-offs, concurrency/scalability, debugging/incident resolution, JD-aligned skills).
- You NEVER invent skills, companies, or experiences not present in the resume or just said by the candidate.

FEEDBACK BEHAVIOUR (before next question):
- After evaluating the candidate's answer internally, you ALWAYS give a brief spoken acknowledgement before moving on.
- If auto-continue is ON (default): give ONE short encouraging or corrective sentence, then immediately ask the next question. Example: "Good answer, though next time be more specific about the trade-offs. Now, tell me about..."
- If auto-continue is OFF: give 2-3 sentences of genuine spoken feedback covering what went well and what to improve, then invite them to continue. Example: "That was a solid answer. You explained the system design clearly. To make it even stronger, add the specific latency numbers you achieved. Ready for the next one?"
- Keep feedback conversational, not robotic or clinical.`;

        const priorTurnsSummary = priorTurns
            .filter((t) => t.turnIndex < turnIndex)
            .map(
                (t) =>
                    `Turn ${t.turnIndex}:\nInterviewer: "${t.question.text}"\nCandidate: "${t.answer?.transcript || "No answer recorded"}"\nRating: ${t.rating?.score || "N/A"}/10 — ${t.rating?.feedback || ""}`
            )
            .join("\n\n");

        const userPrompt = isFirstTurn
            ? `This is Turn 0 (Question 1 of ${totalQuestions}). Greet the candidate warmly by name if available, introduce yourself as Riya, briefly let them know we will be going through ${totalQuestions} technical questions today covering their projects and technical depth, and ask your first question. Keep it natural and conversational like a phone call starting.`
            : isLastTurn
            ? `Previous interview dialogue so far:\n${priorTurnsSummary}\n\nThe candidate just finished answering. As Riya, acknowledge their answer, ask a closing question or wrap-up thought for Question ${totalQuestions} of ${totalQuestions}, and warmly wish them the very best for their upcoming interviews and future career. Keep it conversational and spoken.`
            : `Previous interview dialogue so far:\n${priorTurnsSummary}\n\nThe candidate just finished answering. As Riya, give a brief spoken acknowledgement of their answer (encouraging or gently corrective, 1-2 sentences max), then naturally ask your next question for Question ${turnIndex + 1} of ${totalQuestions}. Go deeper into their project or architecture decisions. Move to another core JD requirement if the previous topic is covered. One question only.`;

        let fullQuestionText = "";
        let textBuffer = "";

        try {
            if (mistralManager.hasKeys()) {
                await mistralManager.executeWithRetry(async (apiKey) => {
                    const chat = new ChatMistralAI({
                        apiKey,
                        model: mistralManager.getChatModelName(),
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

        // Retrieve relevant context from dual Pinecone namespaces for precise answer evaluation
        const resumeNamespace = `resume-${session.resumeId}`;
        const jdNamespace = `jd-${session.jdId}`;

        const { resumeChunks, jdChunks } = await vectorService
            .queryDualNamespaces(resumeNamespace, jdNamespace, `${turn.question.text} ${transcript}`, 3)
            .catch(() => ({ resumeChunks: [], jdChunks: [] }));

        const evalJdContext = jdChunks.length > 0
            ? jdChunks.map((c, i) => `[Requirement ${i + 1}]:\n${c}`).join("\n\n")
            : (jd?.rawText?.slice(0, 1000) || "N/A");

        const evalResumeContext = resumeChunks.length > 0
            ? resumeChunks.map((c, i) => `[Resume Evidence ${i + 1}]:\n${c}`).join("\n\n")
            : (resume?.extractedText?.slice(0, 1000) || "N/A");

        // 3. Rate answer with Mistral
        const systemPrompt = `You are a principal technical hiring bar-raiser and expert engineering evaluator evaluating a candidate's spoken response.
Job Title: ${jd?.title || "Software Engineer"}
Question Asked: "${turn.question.text}"
Candidate Spoken Answer Transcript: "${transcript}"

Job Description Context (Retrieved Requirements from JD namespace):
${evalJdContext}

Candidate Resume Context (Retrieved Experience Evidence from Resume namespace):
${evalResumeContext}

Evaluation Grading Criteria:
- 1-3: Extremely vague, irrelevant, evasion, or factually/technically incorrect.
- 4-5: Basic or superficial response; mentions buzzwords without explaining implementation, trade-offs, or mechanics.
- 6-7: Solid baseline answer; explains the concept decently but lacks deep architectural trade-offs, quantitative metrics, or scale considerations.
- 8-9: Strong senior response; articulates architectural choices, edge cases, trade-offs, and concrete lessons learned from their projects.
- 10: Masterful, world-class response with thorough clarity, precision, and deep engineering wisdom.

Evaluation Instructions:
1. NEVER default to 7. Critically score based on actual technical substance, correctness, and relevance to the question.
2. In "feedback", write a rich, substantive 3 to 4 sentence evaluation:
   - Sentence 1: Evaluate technical accuracy and how directly they addressed the core question.
   - Sentence 2: Detail specific technical trade-offs, architecture aspects, or metrics they missed.
   - Sentence 3-4: Provide concrete, actionable guidance on what a staff/senior-level answer would include (e.g. specific algorithms, concurrency models, latency numbers, or failure handling).
3. In "whatWentWell", write 1-2 insightful sentences on their specific strengths.
4. In "whatCouldBeBetter", write 1-2 actionable sentences pointing out exact gaps.
5. Never invent experiences not stated by the candidate.

Output strict JSON with this exact schema:
{
  "score": <integer from 1 to 10>,
  "feedback": "<detailed 3-4 sentence technical review>",
  "whatWentWell": "<1-2 sentences on what was technically sound>",
  "whatCouldBeBetter": "<1-2 sentences on architectural gaps or missing specifics>",
  "followUpNeeded": <boolean>
}`;

        // Compute smart dynamic fallback based on transcript depth if LLM is unavailable
        const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
        const dynamicFallbackScore = wordCount < 10 ? 3 : wordCount < 25 ? 5 : wordCount < 60 ? 6 : 7;
        const dynamicFallbackFeedback = wordCount < 10
            ? "The answer was very brief and lacked the technical depth required for this role. A stronger response should elaborate on the architectural choices, tools utilized, and specific challenges encountered."
            : wordCount < 25
            ? "The response addressed the question at a high level but remained superficial. To demonstrate senior-level mastery, explain the specific trade-offs, data structures, and edge-case handling relevant to this scenario."
            : "The response demonstrated good foundational understanding of the concept. To elevate this to a top-tier answer, include specific metrics, performance trade-offs, and production scale considerations.";

        let ratingResult: AnswerRatingResult = {
            score: dynamicFallbackScore,
            feedback: dynamicFallbackFeedback,
            whatWentWell: wordCount > 20 ? "Demonstrated clear foundational understanding and communication." : "Provided a direct initial response to the question.",
            whatCouldBeBetter: "Could provide deeper architectural trade-offs, specific performance metrics, and concrete implementation examples.",
            followUpNeeded: wordCount < 30,
        };

        try {
            if (mistralManager.hasKeys()) {
                await mistralManager.executeWithRetry(async (apiKey) => {
                    const chat = new ChatMistralAI({
                        apiKey,
                        model: mistralManager.getChatModelName(),
                        temperature: 0.2,
                    });

                    const response = await chat.invoke([
                        new SystemMessage(systemPrompt),
                        new HumanMessage("Evaluate this candidate answer strictly following the criteria and JSON schema."),
                    ]);

                    const content = response.content.toString();
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const sanitized = jsonMatch[0]
                            .replace(/[\u0000-\u001F\u007F]/g, (ch) => {
                                if (ch === '\n') return '\\n';
                                if (ch === '\r') return '\\r';
                                if (ch === '\t') return '\\t';
                                return '';
                            });
                        const parsed = JSON.parse(sanitized);
                        const parsedScore = Number(parsed.score);
                        ratingResult = {
                            score: !isNaN(parsedScore) ? Math.min(10, Math.max(1, Math.round(parsedScore))) : dynamicFallbackScore,
                            feedback: String(parsed.feedback || ratingResult.feedback).trim(),
                            whatWentWell: parsed.whatWentWell ? String(parsed.whatWentWell).trim() : undefined,
                            whatCouldBeBetter: parsed.whatCouldBeBetter ? String(parsed.whatCouldBeBetter).trim() : undefined,
                            followUpNeeded: Boolean(parsed.followUpNeeded),
                        };
                    }
                });
            }
        } catch (error) {
            logger.warn(error, "Failed to rate answer via LLM; applying dynamic quality score");
        }

        // 4. Persist transcript and rating in MongoDB
        await this.turnDao.updateTurnAnswer(sessionId, turnIndex, transcript, new Date());
        await this.turnDao.updateTurnRating(
            sessionId,
            turnIndex,
            ratingResult.score,
            ratingResult.feedback,
            new Date(),
            ratingResult.whatWentWell,
            ratingResult.whatCouldBeBetter
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

        const jd = await this.jdDao.findJobDescriptionById(session.jdId);

        const prompt = `You are an executive hiring manager evaluating candidate performance for the role "${jd?.title || "Software Engineer"}" at "${jd?.company || "the company"}".

Job Description Context:
${jd?.rawText?.slice(0, 1000) || "N/A"}

Recorded Interview Turns:
${turnsSummary}

Produce an insightful, highly actionable evaluation report.
Guidelines:
1. "overallScore": 0-100 integer (e.g. 78).
2. "confidenceScore": 0.0-10.0 number (e.g. 7.5).
3. "answerQualityScore": 0.0-10.0 number (e.g. 7.8).
4. "strengths": 4-5 concise, specific bullet points highlighting what the candidate actually did well based on their real answers and experience.
5. "weaknesses": 4-5 concise, actionable bullet points ("Areas to Improve") explaining what technical or communication gaps were evident.
6. "advice": 2-3 sentences of clear, tailored guidance explaining WHY certain areas need work and what to practice next for this specific role.

Return strictly valid JSON with this exact schema:
{
  "overallScore": <integer 0-100, e.g. 78>,
  "confidenceScore": <number 0-10, e.g. 7.5>,
  "answerQualityScore": <number 0-10, e.g. 7.8>,
  "strengths": ["concise bullet 1", "concise bullet 2", "concise bullet 3", "concise bullet 4", "concise bullet 5"],
  "weaknesses": ["concise bullet 1", "concise bullet 2", "concise bullet 3", "concise bullet 4", "concise bullet 5"],
  "topicsForImprovement": ["topic 1", "topic 2"],
  "advice": "<2-3 actionable sentences explaining why and how to improve>",
  "jdPreparationAdvice": "Based on this JD, focus on these areas before your interview: <specific actionable advice tied to this exact role>"
}`;

        let report: IInterviewReport = {
            overallScore: Math.round(avgScore * 10),
            confidenceScore: 7.5,
            answerQualityScore: 7.8,
            strengths: [
                "Strong understanding of core concepts",
                "Good problem-solving approach",
                "Clear communication",
                "Relevant project experience",
                "Ability to explain trade-offs",
            ],
            weaknesses: [
                "Go deeper into system design concepts",
                "Provide more specific examples from your experience",
                "Improve on data structures and algorithms",
                "Be more concise and to the point",
                "Show better awareness of scalability and performance",
            ],
            topicsForImprovement: [
                "System design deep dives",
                "Concrete impact metrics",
            ],
            advice: `Focus on practicing system design and explaining your past projects in more depth. Since this role requires strong technical depth, make sure you're comfortable discussing distributed architecture, database decisions, and performance trade-offs.`,
            jdPreparationAdvice: `Based on this JD, focus on core requirements for ${jd?.title || "this role"} such as architecture, testing, and production scalability.`,
        };

        try {
            if (mistralManager.hasKeys()) {
                await mistralManager.executeWithRetry(async (apiKey) => {
                    const chat = new ChatMistralAI({
                        apiKey,
                        model: mistralManager.getChatModelName(),
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
                            overallScore: Number(parsed.overallScore) || avgScore,
                            confidenceScore: Number(parsed.confidenceScore) || report.confidenceScore,
                            answerQualityScore: Number(parsed.answerQualityScore) || avgScore,
                            strengths: Array.isArray(parsed.strengths) ? parsed.strengths : report.strengths,
                            weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : report.weaknesses,
                            topicsForImprovement: Array.isArray(parsed.topicsForImprovement) ? parsed.topicsForImprovement : report.topicsForImprovement,
                            advice: String(parsed.advice || report.advice),
                            jdPreparationAdvice: String(parsed.jdPreparationAdvice || report.jdPreparationAdvice),
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
