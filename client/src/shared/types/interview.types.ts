export interface ResumeUploadResponse {
  resumeId: string
  originalFilename: string
  status: string
}

export interface ResumeDetails {
  resumeId: string
  originalFilename: string
  mimeType: string
  s3Key?: string
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
  s3Key?: string
  createdAt: string
}

export type InterviewSessionStatus =
  | 'created'
  | 'embedding'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'aborted'

export interface CreateSessionPayload {
  resumeId: string
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
}

export interface SessionReport {
  confidenceScore: number
  answerQualityScore: number
  strengths: string[]
  weaknesses: string[]
  advice: string
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

