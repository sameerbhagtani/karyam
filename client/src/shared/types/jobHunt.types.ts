export type JobPlatform = 'LinkedIn' | 'Indeed' | 'Glassdoor' | 'ZipRecruiter' | 'Other'

export interface JobListing {
  id: string
  title: string
  company: string
  companyLogo?: string | null
  location: string
  isRemote: boolean
  employmentType: string
  sourcePlatform: JobPlatform
  applyUrl: string
  description: string
  highlights?: string[]
  postedAt?: string | null
  salarySnippet?: string | null
}

export interface JobHuntRateLimitStatus {
  limit: number
  remaining: number
  resetAt: string
  isAllowed: boolean
}

export interface JobSearchResponse {
  success: boolean
  query: string
  location: string
  count: number
  jobs: JobListing[]
  rateLimit?: JobHuntRateLimitStatus
}

export interface JobPreparePayload {
  title: string
  company: string
  description: string
  applyUrl?: string
  sourcePlatform?: string
}

export interface JobPrepareResponse {
  success: boolean
  jdId: string
  title: string
  company: string
  message: string
}
