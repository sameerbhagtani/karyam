import React, { useState, useEffect } from 'react'
import { useJobSearchQuery, useJobHuntRateLimitQuery } from '../hooks/useJobHuntQueries'
import JobCard from './JobCard'
import styles from './JobHuntView.module.css'

const SUGGESTED_ROLES = [
  'Full Stack Developer',
  'Frontend Engineer',
  'Backend Engineer',
  'AI / ML Engineer',
  'DevOps Engineer',
  'Product Manager',
]

export const JobHuntView: React.FC = () => {
  const [queryInput, setQueryInput] = useState('')
  const [locationInput, setLocationInput] = useState('')

  // Strictly idle on initial page mount - 0 automatic API calls
  const [activeQuery, setActiveQuery] = useState('')
  const [activeLocation, setActiveLocation] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  // Rate limit query
  const { data: rateLimitData, refetch: refetchRateLimit } = useJobHuntRateLimitQuery()

  // Job search query - only executes when hasSearched is true and activeQuery is not empty
  const {
    data: searchData,
    isLoading,
    isError,
    error,
    refetch,
  } = useJobSearchQuery(activeQuery, activeLocation, hasSearched)

  // Sync rate limit whenever a search succeeds
  useEffect(() => {
    if (searchData?.rateLimit) {
      refetchRateLimit()
    }
  }, [searchData, refetchRateLimit])

  const currentRateLimit = searchData?.rateLimit || rateLimitData?.rateLimit
  const isRateLimited = Boolean(currentRateLimit && currentRateLimit.remaining <= 0)

  const formatResetTime = (isoString?: string) => {
    if (!isoString) return 'soon'
    try {
      const d = new Date(isoString)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return 'soon'
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!queryInput.trim() || isRateLimited) return
    setActiveQuery(queryInput.trim())
    setActiveLocation(locationInput.trim())
    setHasSearched(true)
  }

  const handleTagClick = (tag: string) => {
    if (isRateLimited) return
    setQueryInput(tag)
    setActiveQuery(tag)
    setHasSearched(true)
  }

  const jobs = searchData?.jobs || []

  return (
    <div className={styles.container}>
      {/* HEADER SECTION */}
      <section className={styles.headerSection}>
        <div className={styles.titleRow}>
          <h1 className={styles.pageTitle}>Job Hunt & AI Prep</h1>
          <span className={styles.badge}>Live Platforms</span>
        </div>
        <p className={styles.pageSubtitle}>
          Search active job postings across LinkedIn, Indeed, and Glassdoor on demand.
          Apply directly or prepare for the interview with customized ATS analysis and AI voice practice.
        </p>
      </section>

      {/* SEARCH CONTROLS CARD */}
      <section className={styles.searchBarCard}>
        {/* Rate Limit Status Pill */}
        {currentRateLimit && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: isRateLimited ? '#fef2f2' : '#f4f4f2',
              border: `1px solid ${isRateLimited ? '#fecaca' : '#ebeae5'}`,
              color: isRateLimited ? '#991b1b' : '#52525b',
            }}
          >
            <span>
              <strong>Search Quota:</strong> {currentRateLimit.remaining} of {currentRateLimit.limit} searches remaining this hour
            </span>
            {isRateLimited && (
              <span style={{ fontWeight: 600 }}>
                Resets at {formatResetTime(currentRateLimit.resetAt)}
              </span>
            )}
          </div>
        )}

        <form onSubmit={handleSearchSubmit} className={styles.formGrid}>
          {/* Job title / keyword input */}
          <div className={styles.inputWrapper}>
            <svg className={styles.inputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className={styles.inputField}
              placeholder="Enter role (e.g. Full Stack Developer, React Engineer)..."
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              disabled={isRateLimited}
            />
          </div>

          {/* Location input */}
          <div className={styles.inputWrapper}>
            <svg className={styles.inputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <input
              type="text"
              className={styles.inputField}
              placeholder="Location or 'Remote'..."
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              disabled={isRateLimited}
            />
          </div>

          {/* Search trigger button */}
          <button
            type="submit"
            className={styles.searchBtn}
            disabled={isLoading || !queryInput.trim() || isRateLimited}
          >
            {isLoading ? (
              <span>Searching...</span>
            ) : isRateLimited ? (
              <span>Limit Reached</span>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span>Search Jobs</span>
              </>
            )}
          </button>
        </form>

        {/* Quick popular suggestion tags */}
        <div className={styles.quickFiltersRow}>
          <span>Popular searches:</span>
          {SUGGESTED_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              className={styles.filterTag}
              onClick={() => handleTagClick(role)}
              disabled={isRateLimited}
            >
              {role}
            </button>
          ))}
        </div>
      </section>

      {/* RESULTS SECTION */}
      <section className={styles.resultsSection}>
        {/* 1. INITIAL EMPTY STATE - No API calls made yet */}
        {!hasSearched && (
          <div className={styles.emptyStateCard} style={{ padding: '60px 24px' }}>
            <div className={styles.emptyIcon}>🎯</div>
            <h3 className={styles.emptyTitle}>Ready to Find Your Next Opportunity</h3>
            <p className={styles.emptySubtitle}>
              Type a role and location above, or pick one of the popular search suggestions, then click <strong>Search Jobs</strong> to pull live listings.
            </p>
          </div>
        )}

        {/* 2. HEADER WHEN SEARCH HAS BEEN TRIGGERED */}
        {hasSearched && (
          <div className={styles.resultsHeader}>
            <h2 className={styles.resultsTitle}>
              Top Openings for "{activeQuery}"
            </h2>
            <span className={styles.resultsMeta}>
              {activeLocation ? `In ${activeLocation} · ` : ''}Showing best {jobs.length} results
            </span>
          </div>
        )}

        {/* 3. LOADING SKELETON */}
        {isLoading && (
          <div className={styles.cardsGrid}>
            {[1, 2, 3].map((n) => (
              <div key={n} className={styles.skeletonCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div className={styles.skeletonBar} style={{ width: '44px', height: '44px', borderRadius: '12px' }} />
                    <div>
                      <div className={styles.skeletonBar} style={{ width: '120px', height: '14px', marginBottom: '6px' }} />
                      <div className={styles.skeletonBar} style={{ width: '80px', height: '12px' }} />
                    </div>
                  </div>
                  <div className={styles.skeletonBar} style={{ width: '70px', height: '22px', borderRadius: '9999px' }} />
                </div>
                <div className={styles.skeletonBar} style={{ width: '60%', height: '20px' }} />
                <div className={styles.skeletonBar} style={{ width: '100%', height: '40px' }} />
              </div>
            ))}
          </div>
        )}

        {/* 4. ERROR / RATE LIMIT STATE */}
        {!isLoading && isError && (
          <div className={styles.emptyStateCard}>
            <div className={styles.emptyIcon}>⚠️</div>
            <h3 className={styles.emptyTitle}>Unable to fetch job postings</h3>
            <p className={styles.emptySubtitle}>
              {error instanceof Error ? error.message : 'An error occurred while fetching jobs.'}
            </p>
            {!isRateLimited && (
              <button
                type="button"
                className={styles.searchBtn}
                onClick={() => refetch()}
                style={{ marginTop: '8px' }}
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {/* 5. EMPTY RESULTS STATE */}
        {!isLoading && !isError && hasSearched && jobs.length === 0 && (
          <div className={styles.emptyStateCard}>
            <div className={styles.emptyIcon}>🔍</div>
            <h3 className={styles.emptyTitle}>No matching job positions found</h3>
            <p className={styles.emptySubtitle}>
              We couldn't find active listings matching "{activeQuery}". Try searching with broader keywords or checking different locations.
            </p>
          </div>
        )}

        {/* 6. SUCCESS RESULTS LIST */}
        {!isLoading && !isError && hasSearched && jobs.length > 0 && (
          <div className={styles.cardsGrid}>
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default JobHuntView
