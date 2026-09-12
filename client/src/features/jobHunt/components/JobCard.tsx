import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePrepareJobMutation } from '../hooks/useJobHuntQueries'
import type { JobListing, JobPlatform } from '@/shared/types/jobHunt.types'
import styles from './JobCard.module.css'

interface JobCardProps {
  job: JobListing
}

export const JobCard: React.FC<JobCardProps> = ({ job }) => {
  const navigate = useNavigate()
  const prepareMutation = usePrepareJobMutation()
  const [prepareError, setPrepareError] = useState<string | null>(null)

  const handlePrepare = async () => {
    try {
      setPrepareError(null)
      const res = await prepareMutation.mutateAsync({
        title: job.title,
        company: job.company,
        description: job.description || `${job.title} at ${job.company}`,
        applyUrl: job.applyUrl,
        sourcePlatform: job.sourcePlatform,
      })
      // Direct navigation to the JD workspace as decided (Option A)
      navigate(`/jds/${res.jdId}`)
    } catch (err: unknown) {
      setPrepareError(err instanceof Error ? err.message : 'Failed to prepare workspace')
    }
  }

  const getPlatformClass = (platform: JobPlatform): string => {
    switch (platform) {
      case 'LinkedIn':
        return styles.platformLinkedIn
      case 'Indeed':
        return styles.platformIndeed
      case 'Glassdoor':
        return styles.platformGlassdoor
      case 'ZipRecruiter':
        return styles.platformZipRecruiter
      default:
        return styles.platformOther
    }
  }

  const companyInitial = job.company ? job.company.charAt(0).toUpperCase() : 'J'

  return (
    <article className={styles.card}>
      {/* Header Row */}
      <div className={styles.headerRow}>
        <div className={styles.companyCluster}>
          <div className={styles.logoWrapper}>
            {job.companyLogo ? (
              <img
                src={job.companyLogo}
                alt={`${job.company} logo`}
                className={styles.companyLogoImg}
                onError={(e) => {
                  // Fallback to text initial if image fails
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <span>{companyInitial}</span>
            )}
          </div>
          <div className={styles.companyMeta}>
            <span className={styles.companyName}>{job.company}</span>
            <div className={styles.locationSnippet}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{job.location}</span>
              {job.isRemote && <span>· Remote</span>}
            </div>
          </div>
        </div>

        <span className={`${styles.platformPill} ${getPlatformClass(job.sourcePlatform)}`}>
          {job.sourcePlatform}
        </span>
      </div>

      {/* Body / Title & Details */}
      <div className={styles.bodySection}>
        <h3 className={styles.jobTitle}>{job.title}</h3>

        {job.salarySnippet && (
          <span className={styles.salaryPill}>{job.salarySnippet}</span>
        )}

        {job.highlights && job.highlights.length > 0 ? (
          <ul className={styles.highlightsList}>
            {job.highlights.slice(0, 3).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.descriptionPreview}>{job.description}</p>
        )}
      </div>

      {/* Prepare Error Alert if any */}
      {prepareError && (
        <div style={{ fontSize: '12px', color: '#dc2626', background: '#fef2f2', padding: '6px 10px', borderRadius: '6px' }}>
          {prepareError}
        </div>
      )}

      {/* Footer Actions */}
      <div className={styles.footerActions}>
        <span className={styles.postedText}>
          {job.postedAt ? `Posted ${job.postedAt}` : 'Active opening'}
        </span>

        <div className={styles.buttonGroup}>
          <a
            href={job.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.applyBtn}
            title="Open original job listing on external website"
          >
            <span>Apply</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>

          <button
            type="button"
            className={styles.prepareBtn}
            onClick={handlePrepare}
            disabled={prepareMutation.isPending}
            title="Extract JD and launch your interview preparation workspace"
          >
            {prepareMutation.isPending ? (
              <>
                <div className={styles.spinner} />
                <span>Preparing...</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Prepare</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  )
}

export default JobCard
