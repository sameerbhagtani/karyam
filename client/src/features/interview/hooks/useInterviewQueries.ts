import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { interviewApi } from '../../../shared/api/interview.api'
import type {
  CreateSessionPayload,
  JobDescriptionPastedPayload,
} from '../../../shared/types/interview.types'

export const INTERVIEW_QUERY_KEYS = {
  resumesList: ['resumes-list'] as const,
  jobDescriptionsList: ['job-descriptions-list'] as const,
  resume: (id: string) => ['resume', id] as const,
  jobDescription: (id: string) => ['job-description', id] as const,
  session: (id: string) => ['interview-session', id] as const,
  report: (id: string) => ['session-report', id] as const,
}

export function useUserResumesQuery(enabled = true) {
  return useQuery({
    queryKey: INTERVIEW_QUERY_KEYS.resumesList,
    queryFn: () => interviewApi.getUserResumes(),
    enabled,
    staleTime: 1000 * 60, // 1 minute
  })
}

export function useUserJobDescriptionsQuery(enabled = true) {
  return useQuery({
    queryKey: INTERVIEW_QUERY_KEYS.jobDescriptionsList,
    queryFn: () => interviewApi.getUserJobDescriptions(),
    enabled,
    staleTime: 1000 * 60,
  })
}

export function useUploadResumeMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => interviewApi.uploadResume(file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: INTERVIEW_QUERY_KEYS.resumesList })
      queryClient.invalidateQueries({ queryKey: INTERVIEW_QUERY_KEYS.resume(data.resumeId) })
    },
  })
}

export function useCreateJobDescriptionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { type: 'text'; data: JobDescriptionPastedPayload } | { type: 'file'; title: string; company: string; file: File }) => {
      if (payload.type === 'text') {
        return interviewApi.createJobDescriptionFromText(payload.data)
      } else {
        return interviewApi.createJobDescriptionFromFile(payload.title, payload.company, payload.file)
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: INTERVIEW_QUERY_KEYS.jobDescriptionsList })
      queryClient.invalidateQueries({ queryKey: INTERVIEW_QUERY_KEYS.jobDescription(data.jdId) })
    },
  })
}

export function useCreateSessionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSessionPayload) => interviewApi.createInterviewSession(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: INTERVIEW_QUERY_KEYS.session(data.sessionId) })
    },
  })
}

export function useInterviewSessionQuery(sessionId?: string, enabled = true) {
  return useQuery({
    queryKey: sessionId ? INTERVIEW_QUERY_KEYS.session(sessionId) : ['interview-session', 'none'],
    queryFn: () => {
      if (!sessionId) throw new Error('Session ID required')
      return interviewApi.getInterviewSession(sessionId)
    },
    enabled: !!sessionId && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      // Poll every 1.5s while in embedding phase; stop once ready, completed or failed
      if (status === 'embedding') {
        return 1500
      }
      return false
    },
    refetchIntervalInBackground: true,
  })
}

export function useSessionReportQuery(sessionId?: string, enabled = true) {
  return useQuery({
    queryKey: sessionId ? INTERVIEW_QUERY_KEYS.report(sessionId) : ['session-report', 'none'],
    queryFn: () => {
      if (!sessionId) throw new Error('Session ID required')
      return interviewApi.getSessionReport(sessionId)
    },
    enabled: !!sessionId && enabled,
    retry: 2,
    staleTime: 1000 * 60 * 5,
  })
}

export function useResumeQuery(resumeId?: string) {
  return useQuery({
    queryKey: resumeId ? INTERVIEW_QUERY_KEYS.resume(resumeId) : ['resume', 'none'],
    queryFn: () => {
      if (!resumeId) throw new Error('Resume ID required')
      return interviewApi.getResume(resumeId)
    },
    enabled: !!resumeId,
  })
}

export function useJobDescriptionQuery(jdId?: string) {
  return useQuery({
    queryKey: jdId ? INTERVIEW_QUERY_KEYS.jobDescription(jdId) : ['job-description', 'none'],
    queryFn: () => {
      if (!jdId) throw new Error('JD ID required')
      return interviewApi.getJobDescription(jdId)
    },
    enabled: !!jdId,
  })
}
