import React, { useEffect, useState } from 'react'
import { interviewApi } from '@/shared/api/interview.api'
import type { ResumeDetails } from '@/shared/types/interview.types'
import styles from './ResumeViewModal.module.css'

interface ResumeViewModalProps {
  resume: ResumeDetails
  onClose: () => void
  onPracticeInterview?: (resumeId: string) => void
}

export const ResumeViewModal: React.FC<ResumeViewModalProps> = ({
  resume,
  onClose,
  onPracticeInterview,
}) => {
  const [fullResume, setFullResume] = useState<ResumeDetails | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const fetchFullDetails = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const data = await interviewApi.getResume(resume.resumeId)
        if (isMounted) {
          setFullResume(data)
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load resume details')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchFullDetails()
    return () => {
      isMounted = false
    }
  }, [resume.resumeId])

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  const handlePrint = () => {
    window.print()
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    try {
      const d = new Date(dateString)
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return dateString
    }
  }

  const rawText = fullResume?.extractedText || ''

  // Simple clean heuristic section splitter for clean rendering
  const parseSections = (text: string) => {
    if (!text.trim()) return []
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    const sections: { title: string; lines: string[] }[] = []
    let currentSection = { title: 'Overview', lines: [] as string[] }

    const isHeader = (line: string) => {
      const upper = line.toUpperCase()
      return (
        upper === 'EXPERIENCE' ||
        upper === 'WORK EXPERIENCE' ||
        upper === 'EDUCATION' ||
        upper === 'PROJECTS' ||
        upper === 'TECHNICAL SKILLS' ||
        upper === 'SKILLS' ||
        upper === 'SUMMARY' ||
        upper === 'CERTIFICATIONS' ||
        upper === 'ACHIEVEMENTS'
      )
    }

    for (const line of lines) {
      if (isHeader(line)) {
        if (currentSection.lines.length > 0) {
          sections.push(currentSection)
        }
        currentSection = { title: line, lines: [] }
      } else {
        currentSection.lines.push(line)
      }
    }
    if (currentSection.lines.length > 0) {
      sections.push(currentSection)
    }
    return sections
  }

  const parsedSections = parseSections(rawText)

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        {/* Top Header Bar */}
        <header className={styles.modalHeader}>
          <div className={styles.headerMeta}>
            <div className={styles.fileIconBadge}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <div>
              <h3 className={styles.modalTitle}>{resume.originalFilename}</h3>
              <p className={styles.modalSubtitle}>
                Uploaded on {formatDate(resume.createdAt)} · {formatFileSize(resume.fileSize)}
              </p>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.exportPdfBtn}
              onClick={handlePrint}
              title="Save or Export as structured PDF"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9V2h12v7" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>Export PDF</span>
            </button>

            {onPracticeInterview && (
              <button
                type="button"
                className={styles.practiceBtn}
                onClick={() => onPracticeInterview(resume.resumeId)}
              >
                Mock Interview
              </button>
            )}

            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close dialog"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </header>

        {/* Content Viewer Body */}
        <div className={styles.modalBody}>
          {isLoading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <span>Formatting resume document...</span>
            </div>
          ) : error ? (
            <div className={styles.errorState}>
              <p>{error}</p>
            </div>
          ) : (
            <div className={styles.documentSheet} id="karyam-printable-resume">
              {/* Sheet Top Header */}
              <div className={styles.sheetHeader}>
                <div className={styles.sheetLogoBrand}>
                  <span className={styles.karyamTag}>KARYAM RESUME ARCHIVE</span>
                </div>
                <h1 className={styles.sheetDocumentTitle}>{resume.originalFilename}</h1>
                <div className={styles.sheetMetaRow}>
                  <span>Indexed Document</span>
                  <span>·</span>
                  <span>{formatDate(resume.createdAt)}</span>
                  <span>·</span>
                  <span>Size: {formatFileSize(resume.fileSize)}</span>
                </div>
              </div>

              {/* Parsed Sections or Raw Text */}
              {parsedSections.length > 0 ? (
                <div className={styles.sectionsContainer}>
                  {parsedSections.map((sec, idx) => (
                    <section key={idx} className={styles.resumeSection}>
                      <h2 className={styles.sectionHeading}>{sec.title}</h2>
                      <div className={styles.sectionContent}>
                        {sec.lines.map((line, lIdx) => (
                          <p key={lIdx} className={styles.sectionLine}>
                            {line}
                          </p>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className={styles.rawTextContainer}>
                  <pre className={styles.rawTextPre}>{rawText || 'No text extracted from this document.'}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
