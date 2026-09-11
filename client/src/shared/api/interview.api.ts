import { apiClient } from './client'
import type {
  ResumeUploadResponse,
  ResumeDetails,
  JobDescriptionPastedPayload,
  JobDescriptionResponse,
  JobDescriptionDetails,
  CreateSessionPayload,
  CreateSessionResponse,
  InterviewSessionDetails,
  SessionReport,
  TurnAnswerResponse,
  SseMetadataEvent,
  SseAudioChunkEvent,
  SseDoneEvent,
} from '../types/interview.types'

export const interviewApi = {
  async uploadResume(file: File): Promise<ResumeUploadResponse> {
    const formData = new FormData()
    formData.append('file', file)

    return apiClient.post<ResumeUploadResponse>('/api/resumes', formData)
  },

  async getUserResumes(): Promise<{ resumes: ResumeDetails[]; latest: ResumeDetails | null }> {
    return apiClient.get<{ resumes: ResumeDetails[]; latest: ResumeDetails | null }>('/api/resumes')
  },

  async getResume(id: string): Promise<ResumeDetails> {
    return apiClient.get<ResumeDetails>(`/api/resumes/${id}`)
  },

  async getUserJobDescriptions(): Promise<{ jobDescriptions: JobDescriptionDetails[]; latest: JobDescriptionDetails | null }> {
    return apiClient.get<{ jobDescriptions: JobDescriptionDetails[]; latest: JobDescriptionDetails | null }>('/api/job-descriptions')
  },

  async createJobDescriptionFromText(payload: JobDescriptionPastedPayload): Promise<JobDescriptionResponse> {
    return apiClient.post<JobDescriptionResponse>('/api/job-descriptions', payload)
  },

  async createJobDescriptionFromFile(title: string, company: string, file: File): Promise<JobDescriptionResponse> {
    const formData = new FormData()
    formData.append('title', title)
    formData.append('company', company)
    formData.append('file', file)

    return apiClient.post<JobDescriptionResponse>('/api/job-descriptions', formData)
  },

  async getJobDescription(id: string): Promise<JobDescriptionDetails> {
    return apiClient.get<JobDescriptionDetails>(`/api/job-descriptions/${id}`)
  },

  async createInterviewSession(payload: CreateSessionPayload): Promise<CreateSessionResponse> {
    return apiClient.post<CreateSessionResponse>('/api/interview-sessions', payload)
  },

  async getInterviewSession(sessionId: string): Promise<InterviewSessionDetails> {
    return apiClient.get<InterviewSessionDetails>(`/api/interview-sessions/${sessionId}`)
  },

  async getSessionReport(sessionId: string): Promise<SessionReport> {
    return apiClient.get<SessionReport>(`/api/interview-sessions/${sessionId}/report`)
  },

  async submitTurnAnswer(sessionId: string, turnIndex: number, audioBlob: Blob): Promise<TurnAnswerResponse> {
    const formData = new FormData()
    formData.append('audio', audioBlob, 'candidate-answer.wav')

    const res = await apiClient.request(`/api/interview-sessions/${sessionId}/turns/${turnIndex}/answer`, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to submit answer (status ${res.status})`)
    }

    return res.json()
  },

  async endInterviewSession(sessionId: string): Promise<{ sessionId: string; status: string; report: SessionReport }> {
    const res = await apiClient.request(`/api/interview-sessions/${sessionId}/end`, {
      method: 'POST',
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to end interview session (status ${res.status})`)
    }

    return res.json()
  },

  /**
   * Streams interview question via Server-Sent Events (SSE) with Bearer token authentication.
   */
  streamInterviewQuestionSse(
    sessionId: string,
    isInitialTurn: boolean,
    callbacks: {
      onMetadata?: (data: SseMetadataEvent) => void
      onAudioChunk?: (data: SseAudioChunkEvent) => void
      onDone?: (data: SseDoneEvent) => void
      onError?: (error: Error) => void
    }
  ): () => void {
    const abortController = new AbortController()
    const url = isInitialTurn
      ? `/api/interview-sessions/${sessionId}/start`
      : `/api/interview-sessions/${sessionId}/turns/next`

    let isAborted = false

    ;(async () => {
      try {
        const response = await apiClient.request(url, {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
          },
          signal: abortController.signal,
        })

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.message || `SSE connection failed with status ${response.status}`)
        }

        if (!response.body) {
          throw new Error('Response body is null, SSE stream unavailable')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (!isAborted) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const blocks = buffer.split('\n\n')
          buffer = blocks.pop() || '' // Keep unfinished block in buffer

          for (const block of blocks) {
            if (!block.trim()) continue

            const lines = block.split('\n')
            let currentEvent = 'message'
            let currentData = ''

            for (const line of lines) {
              if (line.startsWith('event:')) {
                currentEvent = line.slice(6).trim()
              } else if (line.startsWith('data:')) {
                currentData = line.slice(5).trim()
              }
            }

            if (!currentData) continue

            try {
              const parsed = JSON.parse(currentData)
              if (currentEvent === 'metadata') {
                callbacks.onMetadata?.(parsed as SseMetadataEvent)
              } else if (currentEvent === 'audio-chunk') {
                callbacks.onAudioChunk?.(parsed as SseAudioChunkEvent)
              } else if (currentEvent === 'done') {
                callbacks.onDone?.(parsed as SseDoneEvent)
              }
            } catch {
              // Ignore non-JSON ping/heartbeat data
            }
          }
        }
      } catch (err: unknown) {
        if (!isAborted && err instanceof Error && err.name !== 'AbortError') {
          callbacks.onError?.(err)
        }
      }
    })()

    return () => {
      isAborted = true
      abortController.abort()
    }
  },
}
