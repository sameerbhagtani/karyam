import { apiClient } from './client'
import type {
  JobSearchResponse,
  JobPreparePayload,
  JobPrepareResponse,
} from '../types/jobHunt.types'

export const jobHuntApi = {
  /**
   * Search jobs across LinkedIn, Indeed, Glassdoor via JSearch API
   */
  async searchJobs(query: string, location?: string): Promise<JobSearchResponse> {
    const params = new URLSearchParams({ query })
    if (location && location.trim()) {
      params.append('location', location.trim())
    }
    return apiClient.get<JobSearchResponse>(`/api/job-hunt/search?${params.toString()}`)
  },

  /**
   * Ingest job listing into Karyam JD workspace & trigger embedding
   */
  async prepareJob(payload: JobPreparePayload): Promise<JobPrepareResponse> {
    return apiClient.post<JobPrepareResponse>('/api/job-hunt/prepare', payload)
  },

  /**
   * Get current user's job hunt search rate limit status
   */
  async getRateLimit(): Promise<{ success: boolean; rateLimit: import('../types/jobHunt.types').JobHuntRateLimitStatus }> {
    return apiClient.get('/api/job-hunt/rate-limit')
  },
}
