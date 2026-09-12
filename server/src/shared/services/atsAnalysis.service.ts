import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatMistralAI } from "@langchain/mistralai";
import mistralManager from "./mistralManager.service.js";
import logger from "../config/logger.config.js";
import { IAtsBreakdown, IAtsImprovements } from "../models/atsAnalysis.model.js";

export interface AtsAnalysisResult {
    score: number;
    summary: string;
    breakdown: IAtsBreakdown;
    improvements: IAtsImprovements;
}

export class AtsAnalysisService {
    /**
     * Analyzes candidate resume text against the target job description text.
     */
    async analyzeResumeAgainstJd(
        resumeText: string,
        jdTitle: string,
        jdCompany: string,
        jdText: string
    ): Promise<AtsAnalysisResult> {
        const systemPrompt = `You are an expert technical recruiter and ATS (Applicant Tracking System) optimization specialist for "${jdCompany}" evaluating candidates for the role of "${jdTitle}".

Your task is to analyze the candidate's resume against the target Job Description (JD).
Do NOT provide a generic resume critique. Every point must specifically focus on how the resume aligns with or diverges from this exact JD.

Evaluation Dimensions:
1. Keyword and technical skills matching (required vs present).
2. Relevant experience and job responsibilities alignment.
3. Missing keywords and skills explicitly mentioned in the JD.
4. Experience relevance, quantifiable impact, and job-title alignment.
5. ATS readability and document structure.

CRITICAL RULES:
- Provide an objective ATS score out of 100 based on the match percentage.
- Explain clearly WHY this score was given in simple, straightforward language.
- Actionable improvement suggestions: Tell the user exactly what is missing and where to improve.
- Never invent experience, skills, projects, companies, numbers, or achievements. Suggestions must be based only on information already in the resume or explicitly framed as "If you have experience with X, explicitly mention it in your experience bullet for Y."
- For concrete suggestions, provide both a "current" bullet snippet (or pattern) from their resume and a "better" version incorporating the target JD keywords/metrics truthfully.

Return strictly valid JSON with this exact schema:
{
  "score": <number between 0 and 100>,
  "summary": "<plain English explanation of why this score was awarded, highlighting key strengths and major gaps>",
  "breakdown": {
    "matchedSkills": ["skill1", "skill2"],
    "missingSkills": ["missingSkill1", "missingSkill2"],
    "missingKeywords": ["keyword1", "keyword2"],
    "experienceRelevance": "<concise sentence assessing how relevant candidate's past work is to this JD>",
    "atsReadability": "<concise sentence evaluating formatting, section clarity, and parsing>",
    "quantifiableAchievements": "<concise assessment of metrics, scale, and concrete results in the resume>",
    "jobTitleAlignment": "<concise assessment of how past titles align with target role>"
  },
  "improvements": {
    "missing": ["AWS", "Docker", "REST APIs"],
    "suggestions": [
      {
        "point": "<Clear description of the gap or area>",
        "suggestion": "<Actionable guidance on where and how to adjust>",
        "current": "<Current bullet or phrasing from resume>",
        "better": "<Optimized version that includes target keywords without fabricating experience>"
      }
    ]
  }
}`;

        const userMessage = `TARGET ROLE: ${jdTitle} at ${jdCompany}

TARGET JOB DESCRIPTION:
${jdText.slice(0, 4000)}

CANDIDATE RESUME:
${resumeText.slice(0, 5000)}

Perform the ATS match analysis and return strictly valid JSON.`;

        try {
            if (mistralManager.hasKeys()) {
                let parsedResult: AtsAnalysisResult | null = null;

                await mistralManager.executeWithRetry(async (apiKey) => {
                    const chat = new ChatMistralAI({
                        apiKey,
                        model: mistralManager.getChatModelName(),
                        temperature: 0.2,
                    });

                    const response = await chat.invoke([
                        new SystemMessage(systemPrompt),
                        new HumanMessage(userMessage),
                    ]);

                    const content = response.content.toString();
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const data = JSON.parse(jsonMatch[0]);
                        const score = Math.max(10, Math.min(100, Math.round(Number(data.score) || 72)));
                        parsedResult = {
                            score,
                            summary: String(data.summary || ""),
                            breakdown: {
                                matchedSkills: Array.isArray(data.breakdown?.matchedSkills)
                                    ? data.breakdown.matchedSkills
                                    : [],
                                missingSkills: Array.isArray(data.breakdown?.missingSkills)
                                    ? data.breakdown.missingSkills
                                    : [],
                                missingKeywords: Array.isArray(data.breakdown?.missingKeywords)
                                    ? data.breakdown.missingKeywords
                                    : [],
                                experienceRelevance: String(data.breakdown?.experienceRelevance || ""),
                                atsReadability: String(data.breakdown?.atsReadability || "Clean ATS-friendly layout."),
                                quantifiableAchievements: String(data.breakdown?.quantifiableAchievements || ""),
                                jobTitleAlignment: String(data.breakdown?.jobTitleAlignment || ""),
                            },
                            improvements: {
                                missing: Array.isArray(data.improvements?.missing)
                                    ? data.improvements.missing
                                    : [],
                                suggestions: Array.isArray(data.improvements?.suggestions)
                                    ? data.improvements.suggestions.map((s: any) => ({
                                          point: String(s.point || ""),
                                          suggestion: String(s.suggestion || ""),
                                          current: s.current ? String(s.current) : undefined,
                                          better: s.better ? String(s.better) : undefined,
                                      }))
                                    : [],
                            },
                        };
                    }
                });

                if (parsedResult) {
                    return parsedResult;
                }
            }
        } catch (error) {
            logger.warn(error, "AtsAnalysisService: LLM execution failed or returned invalid JSON. Using heuristic match.");
        }

        // Reliable heuristic fallback analysis
        return this.generateHeuristicAnalysis(resumeText, jdTitle, jdCompany, jdText);
    }

    private generateHeuristicAnalysis(
        resumeText: string,
        jdTitle: string,
        jdCompany: string,
        jdText: string
    ): AtsAnalysisResult {
        const resumeLower = resumeText.toLowerCase();
        const jdLower = jdText.toLowerCase();

        // Common high-frequency tech terms to cross-check
        const commonTech = [
            "react", "node", "typescript", "javascript", "python", "aws", "docker",
            "kubernetes", "sql", "postgresql", "mongodb", "rest api", "graphql",
            "ci/cd", "git", "microservices", "redis", "agile", "unit testing"
        ];

        const jdFound = commonTech.filter((t) => jdLower.includes(t));
        const matched = jdFound.filter((t) => resumeLower.includes(t));
        const missing = jdFound.filter((t) => !resumeLower.includes(t));

        const baseScore = jdFound.length > 0 ? Math.round((matched.length / jdFound.length) * 45) + 40 : 70;
        const score = Math.max(35, Math.min(92, baseScore));

        const formattedMatched = matched.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
        const formattedMissing = missing.map((s) => s.charAt(0).toUpperCase() + s.slice(1));

        const summary =
            formattedMissing.length > 0
                ? `Your resume matches several foundational requirements for ${jdTitle} at ${jdCompany}, but the job description specifically prioritizes ${formattedMissing.slice(0, 3).join(", ")}. Highlighting verified experience with these technologies will significantly improve your ATS ranking.`
                : `Your resume shows strong alignment with the core technical requirements for ${jdTitle} at ${jdCompany}. Further strengthening quantified metrics in your experience bullets will maximize interview callbacks.`;

        const suggestions = [];
        if (formattedMissing.length > 0) {
            suggestions.push({
                point: `Incorporate explicit mentions of ${formattedMissing.slice(0, 2).join(" & ")}`,
                suggestion: `The target JD specifically asks for ${formattedMissing.slice(0, 2).join(" and ")}. If you have professional or project experience with these, add them to your skills list and reference them in relevant project descriptions.`,
                current: "Worked on frontend and backend features for web application.",
                better: `Developed full-stack features using ${formattedMatched[0] || "React"} and integrated ${formattedMissing[0] || "relevant APIs"} to improve system performance.`,
            });
        }

        suggestions.push({
            point: "Add quantifiable impact metrics to recent experience bullets",
            suggestion: "ATS parsers and recruiters prioritize measurable achievements over plain responsibility statements. Include numbers, percentages, or team sizes where appropriate.",
            current: "Responsible for optimizing application performance.",
            better: "Optimized database queries and API response times, reducing average page load latency by 35%.",
        });

        return {
            score,
            summary,
            breakdown: {
                matchedSkills: formattedMatched,
                missingSkills: formattedMissing,
                missingKeywords: formattedMissing,
                experienceRelevance: `Past experience aligns moderately well with ${jdTitle} expectations.`,
                atsReadability: "Standard single/double-column layout with recognizable section headers.",
                quantifiableAchievements: "Several responsibilities listed; adding impact metrics would elevate the profile.",
                jobTitleAlignment: `Title alignment with ${jdTitle} is positive.`,
            },
            improvements: {
                missing: formattedMissing,
                suggestions,
            },
        };
    }
}

export const atsAnalysisService = new AtsAnalysisService();
export default atsAnalysisService;
