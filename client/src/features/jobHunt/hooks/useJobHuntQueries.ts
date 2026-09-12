import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { jobHuntApi } from '@/shared/api/jobHunt.api'
import type { JobPreparePayload } from '@/shared/types/jobHunt.types'

export const JOB_HUNT_KEYS = {
  all: ['jobHunt'] as const,
  rateLimit: () => [...JOB_HUNT_KEYS.all, 'rateLimit'] as const,
  search: (query: string, location?: string) =>
    [...JOB_HUNT_KEYS.all, 'search', query, location || ''] as const,
}

export function useJobHuntRateLimitQuery() {
  return useQuery({
    queryKey: JOB_HUNT_KEYS.rateLimit(),
    queryFn: () => jobHuntApi.getRateLimit(),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  })
}

export function useJobSearchQuery(query: string, location: string = '', enabled: boolean = false) {
  return useQuery({
    queryKey: JOB_HUNT_KEYS.search(query, location),
    queryFn: () => jobHuntApi.searchJobs(query, location),
    enabled: enabled && query.trim().length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    refetchOnWindowFocus: false,
  })
}

export function usePrepareJobMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: JobPreparePayload) => jobHuntApi.prepareJob(payload),
    onSuccess: () => {
      // Invalidate user job descriptions cache so new JD shows up in dashboard lists
      queryClient.invalidateQueries({ queryKey: ['jobDescriptions'] })
    },
  })
}
