export interface ResumeUploadResponse {
  resumeId: string
  originalFilename: string
  status: string
}

export interface ResumeDetails {
  resumeId: string
  originalFilename: string
  mimeType: string
  fileSize?: number
  s3Key?: string
  extractedText?: string
  createdAt: string
}

export interface UserResumesResponse {
  resumes: ResumeDetails[]
  latest: ResumeDetails | null
}

export interface UserJobDescriptionsResponse {
  jobDescriptions: JobDescriptionDetails[]
  latest: JobDescriptionDetails | null
}

export interface JobDescriptionPastedPayload {
  title: string
  company: string
  rawText: string
  location?: string
  employmentType?: string
  category?: string
}

export interface JobDescriptionResponse {
  jdId: string
}

export interface JobDescriptionDetails {
  jdId: string
  title: string
  company: string
  sourceType: 'upload' | 'pasted_text'
  rawText: string
  wordCount?: number
  location?: string
  employmentType?: string
  category?: string
  s3Key?: string
  createdAt: string
}

export interface UserSessionItem {
  sessionId: string
  status: InterviewSessionStatus
  targetLoopCount: number
  currentTurnIndex: number
  startedAt?: string
  completedAt?: string
  createdAt: string
  report?: SessionReport | null
  jd?: {
    jdId: string
    title: string
    company: string
  } | null
  resume?: {
    resumeId: string
    originalFilename: string
  } | null
}

export interface UserSessionsResponse {
  sessions: UserSessionItem[]
}

export type InterviewSessionStatus =
  | 'created'
  | 'embedding'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'aborted'

export interface CreateSessionPayload {
  resumeId?: string
  jdId: string
  targetLoopCount?: number
}

export interface CreateSessionResponse {
  sessionId: string
  status: InterviewSessionStatus
}

export interface InterviewSessionDetails {
  sessionId: string
  status: InterviewSessionStatus
  currentTurnIndex: number
  targetLoopCount: number
  startedAt?: string
  completedAt?: string
  createdAt?: string
  turns?: TurnHistoryItem[]
  jd?: {
    jdId: string
    title: string
    company: string
  } | null
  resume?: {
    resumeId: string
    originalFilename: string
  } | null
}

export interface ReportTurnItem {
  turnIndex: number
  question: {
    text: string
    askedAt?: string
  }
  answer?: {
    transcript: string
    answeredAt?: string
  }
  rating?: {
    score: number
    feedback: string
    whatWentWell?: string
    whatCouldBeBetter?: string
  } | null
  durationFormatted?: string
}

export interface SessionReport {
  overallScore?: number
  confidenceScore: number
  answerQualityScore: number
  strengths: string[]
  weaknesses: string[]
  topicsForImprovement?: string[]
  advice: string
  jdPreparationAdvice?: string
  session?: {
    sessionId: string
    status: InterviewSessionStatus
    startedAt?: string
    completedAt?: string
    createdAt?: string
    targetLoopCount?: number
    questionCount?: number
    durationMinutes?: number
  }
  jd?: {
    jdId: string
    title: string
    company: string
  } | null
  resume?: {
    resumeId: string
    originalFilename: string
  } | null
  turns?: ReportTurnItem[]
}

export interface AtsSuggestion {
  point: string
  suggestion: string
  current?: string
  better?: string
}

export interface AtsBreakdown {
  matchedSkills: string[]
  missingSkills: string[]
  missingKeywords: string[]
  experienceRelevance: string
  atsReadability: string
  quantifiableAchievements: string
  jobTitleAlignment: string
}

export interface AtsImprovements {
  missing: string[]
  suggestions: AtsSuggestion[]
}

export interface AtsAnalysis {
  analysisId: string
  resumeId?: string
  version: number
  score: number
  summary: string
  breakdown: AtsBreakdown
  improvements: AtsImprovements
  createdAt: string
}

export interface AtsHistoryItem {
  analysisId: string
  resumeId?: string
  version: number
  score: number
  summary: string
  breakdown?: AtsBreakdown
  improvements?: AtsImprovements
  createdAt: string
}

export interface AtsRateLimit {
  limit: number
  remaining: number
  resetAt: string
  isAllowed: boolean
}

export interface JdWorkspaceData {
  jd: JobDescriptionDetails
  userResumes?: ResumeDetails[]
  latestResume: (ResumeDetails & { version?: number }) | null
  latestAnalysis: AtsAnalysis | null
  history: AtsHistoryItem[]
  latestInterviewSession: {
    sessionId: string
    status: InterviewSessionStatus
    currentTurnIndex: number
    targetLoopCount: number
    report: SessionReport | null
    createdAt: string
  } | null
  rateLimit: AtsRateLimit
}

export interface UploadResumeForJdResponse {
  resume: ResumeDetails & { version: number }
  analysis: AtsAnalysis
  rateLimit: AtsRateLimit
}

export interface TurnRating {
  score: number
  feedback: string
  followUpNeeded?: boolean
}

export interface TurnAnswerResponse {
  turnIndex: number
  transcript: string
  rating: TurnRating
  sessionComplete: boolean
}

export interface SseMetadataEvent {
  turnIndex: number
  sessionId: string
  targetLoopCount: number
}

export interface SseAudioChunkEvent {
  chunk: string // base64 encoded wav audio
  text: string  // sentence subtitle
}

export interface SseDoneEvent {
  turnIndex: number
  question: string
}

export interface TurnHistoryItem {
  turnIndex: number
  question: string
  transcript?: string
  rating?: TurnRating
  answeredAt?: string
}

export type InterviewStage =
  | 'initializing'
  | 'streaming_question'
  | 'ai_speaking'
  | 'candidate_speaking'
  | 'submitting_answer'
  | 'turn_evaluated'
  | 'finishing'
  | 'completed'

