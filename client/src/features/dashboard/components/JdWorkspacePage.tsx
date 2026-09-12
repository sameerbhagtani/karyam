import React, { useState, useRef, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  useJdWorkspaceQuery,
  useUploadResumeForJdMutation,
  useAnalyzeLibraryResumeMutation,
  useAtsAnalysisVersionQuery,
  useCreateSessionMutation,
  useUserResumesQuery,
} from '@/features/interview/hooks/useInterviewQueries'
import styles from './JdWorkspace.module.css'
import { CustomResumeDropdown } from './CustomResumeDropdown'

export const JdWorkspacePage: React.FC = () => {
  const { id: jdId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: workspace, isLoading, isError, refetch } = useJdWorkspaceQuery(jdId)
  const { data: userResumesData } = useUserResumesQuery()
  const uploadMutation = useUploadResumeForJdMutation(jdId || '')
  const analyzeLibraryMutation = useAnalyzeLibraryResumeMutation(jdId || '')
  const createSessionMutation = useCreateSessionMutation()

  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null)
  const [showUploadSection, setShowUploadSection] = useState(false)
  const [showJdDetails, setShowJdDetails] = useState(false)
  const [selectedLibraryResumeId, setSelectedLibraryResumeId] = useState<string>('')
  const [selectedInterviewResumeId, setSelectedInterviewResumeId] = useState<string>('')
  const [libraryViewMode, setLibraryViewMode] = useState<'dropdown' | 'list'>('dropdown')
  const [resumeMode, setResumeMode] = useState<'library' | 'upload'>('library')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isStartingInterview, setIsStartingInterview] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Query specific version if user selects an older analysis
  const isViewingHistorical = Boolean(
    selectedAnalysisId &&
    workspace?.latestAnalysis &&
    selectedAnalysisId !== workspace.latestAnalysis.analysisId
  )

  const { data: historicalAnalysis } = useAtsAnalysisVersionQuery(
    jdId,
    selectedAnalysisId || undefined,
    Boolean(isViewingHistorical)
  )

  // Fast resolution from history if already populated with breakdown from Mongo
  const historyMatch = workspace?.history?.find(
    (h) => h.analysisId === selectedAnalysisId
  ) as (import('@/shared/types/interview.types').AtsAnalysis) | undefined

  const activeAnalysis = isViewingHistorical
    ? (historyMatch?.breakdown ? historyMatch : historicalAnalysis)
    : workspace?.latestAnalysis

  const latestAnalysis = workspace?.latestAnalysis

  const availableResumes = workspace?.userResumes || userResumesData?.resumes || []

  // Auto-select first resume from library if not selected
  useEffect(() => {
    if (!selectedLibraryResumeId && availableResumes.length > 0) {
      setSelectedLibraryResumeId(availableResumes[0].resumeId)
    }
  }, [availableResumes, selectedLibraryResumeId])

  // Auto-select interview resume from library if not selected
  useEffect(() => {
    if (!selectedInterviewResumeId && availableResumes.length > 0) {
      setSelectedInterviewResumeId(availableResumes[0].resumeId)
    }
  }, [availableResumes, selectedInterviewResumeId])

  if (isLoading) {
    return (
      <div className={styles.workspaceShell}>
        <main className={styles.mainContent}>
          <div style={{ padding: '80px 0', textAlign: 'center', color: '#71717a' }}>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>Loading workspace...</div>
            <div style={{ fontSize: '13px', marginTop: '6px' }}>Fetching job description and latest resume context.</div>
          </div>
        </main>
      </div>
    )
  }

  if (isError || !workspace) {
    return (
      <div className={styles.workspaceShell}>
        <main className={styles.mainContent}>
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 10px' }}>Workspace Not Found</h2>
            <p style={{ color: '#71717a', fontSize: '14px', margin: '0 0 20px' }}>
              We couldn't locate this job description or you may not have permission to view it.
            </p>
            <Link to="/dashboard" className={styles.uploadNewBtn} style={{ textDecoration: 'none' }}>
              ← Return to Dashboard
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const { jd, latestResume, history, rateLimit } = workspace

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const validTypes = ['.pdf', '.docx']
      const isValid = validTypes.some((ext) => file.name.toLowerCase().endsWith(ext))
      if (!isValid) {
        setUploadError('Please upload a PDF (.pdf) or Word document (.docx).')
        setSelectedFile(null)
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploadError('File exceeds 10MB maximum size limit.')
        setSelectedFile(null)
        return
      }
      setUploadError(null)
      setSelectedFile(file)
    }
  }

  const handleAnalyzeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (rateLimit.remaining <= 0) {
      setUploadError(
        "You're out of analyses for this hour. You can analyze your resume again after the limit resets."
      )
      return
    }

    try {
      setUploadError(null)
      if (resumeMode === 'library') {
        const resumeIdToUse = selectedLibraryResumeId || availableResumes[0]?.resumeId
        if (!resumeIdToUse) {
          setUploadError('Please select a resume from your library or upload a new file.')
          return
        }
        const res = await analyzeLibraryMutation.mutateAsync(resumeIdToUse)
        setShowUploadSection(false)
        setSelectedAnalysisId(res.analysis.analysisId)
        refetch()
      } else {
        if (!selectedFile) {
          setUploadError('Please choose a resume file to upload.')
          return
        }
        const res = await uploadMutation.mutateAsync(selectedFile)
        setSelectedFile(null)
        setShowUploadSection(false)
        setSelectedAnalysisId(res.analysis.analysisId)
        refetch()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze resume.'
      setUploadError(msg)
    }
  }

  const activeInterviewResumeId =
    selectedInterviewResumeId || latestResume?.resumeId || (availableResumes.length > 0 ? availableResumes[0].resumeId : '')

  const activeInterviewResume =
    availableResumes.find((r) => r.resumeId === activeInterviewResumeId) || latestResume

  const activeAnalysisResumeId =
    activeAnalysis?.resumeId ||
    workspace?.history?.find((h) => h.analysisId === activeAnalysis?.analysisId)?.resumeId ||
    latestResume?.resumeId ||
    selectedLibraryResumeId ||
    (availableResumes.length > 0 ? availableResumes[0].resumeId : '')

  const handleSelectAtsResume = async (resumeId: string) => {
    if (resumeId === activeAnalysisResumeId && activeAnalysis) {
      return
    }

    // Check if an analysis for this resume is already saved in MongoDB history
    const existingInHistory = workspace?.history?.find((h) => h.resumeId === resumeId)
    if (existingInHistory) {
      setSelectedAnalysisId(existingInHistory.analysisId)
      setSelectedLibraryResumeId(resumeId)
      return
    }

    try {
      setUploadError(null)
      const res = await analyzeLibraryMutation.mutateAsync(resumeId)
      setSelectedAnalysisId(res.analysis.analysisId)
      setSelectedLibraryResumeId(resumeId)
      refetch()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze selected resume.'
      setUploadError(msg)
    }
  }

  const handleStartMockInterview = async () => {
    const resumeIdToUse = activeInterviewResumeId
    if (!resumeIdToUse) {
      setShowUploadSection(true)
      return
    }

    try {
      setIsStartingInterview(true)
      const session = await createSessionMutation.mutateAsync({
        jdId: jd.jdId,
        resumeId: resumeIdToUse,
        targetLoopCount: 7,
      })
      navigate(`/sessions/${session.sessionId}/interview`)
    } catch (err: unknown) {
      setIsStartingInterview(false)
      alert(err instanceof Error ? err.message : 'Failed to initialize interview.')
    }
  }

  const formatResetTime = (isoString: string) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return 'soon'
    }
  }

  const matchedKeywords = activeAnalysis?.breakdown?.matchedSkills || []
  const missingKeywords =
    activeAnalysis?.breakdown?.missingKeywords ||
    activeAnalysis?.breakdown?.missingSkills ||
    activeAnalysis?.improvements?.missing ||
    []
  const suggestions = activeAnalysis?.improvements?.suggestions || []

  // Create lookup set for latest matched skills to track resolved mistakes across iterations
  const latestMatchedSet = new Set(
    (latestAnalysis?.breakdown?.matchedSkills || []).map((s) => s.toLowerCase().trim())
  )

  return (
    <div className={styles.workspaceShell}>
      <main className={styles.mainContent}>
        {/* TOP NAVIGATION & BREADCRUMB */}
        <div className={styles.topNavRow}>
          <button type="button" onClick={() => navigate('/dashboard/jds')} className={styles.backLink}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Back to Job Descriptions</span>
          </button>

          <span style={{ fontSize: '13px', color: '#71717a' }}>
            Job Workspace
          </span>
        </div>

        {/* HEADER CARD: JD SUMMARY */}
        <header className={styles.headerCard}>
          <div className={styles.headerLeft}>
            <span className={styles.companyBadge}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              {jd.company}
            </span>
            <h1 className={styles.jobTitle}>{jd.title}</h1>
            <p className={styles.metaText}>
              Created on {new Date(jd.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {' · '}
              {jd.sourceType === 'upload' ? 'Uploaded document' : 'Pasted description'}
            </p>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.viewJdBtn}
              onClick={() => setShowJdDetails((prev) => !prev)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>{showJdDetails ? 'Hide Job Description' : 'View Job Description'}</span>
            </button>
          </div>
        </header>

        {/* INLINE JOB DESCRIPTION DETAILS (COLLAPSIBLE, NO POPUP) */}
        {showJdDetails && (
          <section className={styles.atsCard} style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#111113' }}>
                Full Job Description ({jd.title} at {jd.company})
              </h3>
              <button
                type="button"
                onClick={() => setShowJdDetails(false)}
                className={styles.versionPill}
              >
                Close View ✕
              </button>
            </div>
            <div
              style={{
                fontSize: '14px',
                lineHeight: 1.65,
                color: '#3f3f46',
                whiteSpace: 'pre-wrap',
                maxHeight: '400px',
                overflowY: 'auto',
                background: '#fafaf9',
                padding: '20px',
                borderRadius: '14px',
                border: '1px solid #f0efea',
              }}
            >
              {jd.rawText}
            </div>
          </section>
        )}

        {/* INLINE RESUME SELECTION & UPLOAD SECTION */}
        {(showUploadSection || !latestResume) && (
          <section className={styles.atsCard} style={{ marginBottom: '24px', border: '1.5px solid #2563eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px', color: '#111113' }}>
                  {latestResume ? 'Analyze Different Resume Version' : 'Choose Resume for ATS Analysis'}
                </h3>
                <p style={{ fontSize: '13px', color: '#71717a', margin: 0 }}>
                  Compare your resume directly against <strong>{jd.title}</strong> at <strong>{jd.company}</strong>.
                </p>
              </div>
              {latestResume && (
                <button
                  type="button"
                  onClick={() => setShowUploadSection(false)}
                  className={styles.versionPill}
                >
                  Cancel ✕
                </button>
              )}
            </div>

            {/* MODE TOGGLE TABS: Choose From Resumes OR Upload New */}
            {availableResumes.length > 0 && (
              <div className={styles.modeTabsRow}>
                <button
                  type="button"
                  className={`${styles.modeTabBtn} ${resumeMode === 'library' ? styles.modeTabBtnActive : ''}`}
                  onClick={() => setResumeMode('library')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>My Resumes ({availableResumes.length})</span>
                </button>
                <button
                  type="button"
                  className={`${styles.modeTabBtn} ${resumeMode === 'upload' ? styles.modeTabBtnActive : ''}`}
                  onClick={() => setResumeMode('upload')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Upload New File</span>
                </button>
              </div>
            )}

            {rateLimit.remaining <= 0 ? (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '12px',
                  padding: '16px',
                  color: '#991b1b',
                  fontSize: '14px',
                  lineHeight: 1.5,
                  marginTop: '16px',
                }}
              >
                <strong>You're out of analyses for this hour.</strong>
                <br />
                You can analyze your resume again after the limit resets at {formatResetTime(rateLimit.resetAt)}.
              </div>
            ) : (
              <form onSubmit={handleAnalyzeSubmit} style={{ marginTop: '8px' }}>
                {resumeMode === 'library' && availableResumes.length > 0 ? (
                  <div>
                    {availableResumes.length > 2 && (
                      <div className={styles.viewModeToggleRow}>
                        <span className={styles.viewModeLabel}>
                          Your Resumes ({availableResumes.length}):
                        </span>
                        <div className={styles.viewModeToggle}>
                          <button
                            type="button"
                            className={`${styles.viewToggleBtn} ${libraryViewMode === 'dropdown' ? styles.viewToggleBtnActive : ''}`}
                            onClick={() => setLibraryViewMode('dropdown')}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                            <span>Dropdown</span>
                          </button>
                          <button
                            type="button"
                            className={`${styles.viewToggleBtn} ${libraryViewMode === 'list' ? styles.viewToggleBtnActive : ''}`}
                            onClick={() => setLibraryViewMode('list')}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="8" y1="6" x2="21" y2="6" />
                              <line x1="8" y1="12" x2="21" y2="12" />
                              <line x1="8" y1="18" x2="21" y2="18" />
                              <line x1="3" y1="6" x2="3.01" y2="6" />
                              <line x1="3" y1="12" x2="3.01" y2="12" />
                              <line x1="3" y1="18" x2="3.01" y2="18" />
                            </svg>
                            <span>List</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {availableResumes.length > 2 && libraryViewMode === 'dropdown' ? (
                      <div className={styles.libraryDropdownSection}>
                        <CustomResumeDropdown
                          resumes={availableResumes}
                          selectedResumeId={selectedLibraryResumeId || availableResumes[0].resumeId}
                          onSelect={(id) => setSelectedLibraryResumeId(id)}
                          theme="light"
                          variant="select"
                          fullWidth
                        />

                        {(() => {
                          const currentSelected =
                            availableResumes.find(
                              (r) => r.resumeId === (selectedLibraryResumeId || availableResumes[0].resumeId)
                            ) || availableResumes[0]
                          return (
                            <div className={styles.atsSelectedResumeCard}>
                              <div className={styles.atsSelectedResumeInfo}>
                                <span style={{ fontSize: '22px' }}>📄</span>
                                <div>
                                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#18181b' }}>
                                    {currentSelected.originalFilename}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#71717a', marginTop: '2px' }}>
                                    Uploaded on {new Date(currentSelected.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    {currentSelected.resumeId === availableResumes[0].resumeId && (
                                      <span style={{ marginLeft: '8px', color: '#2563eb', fontWeight: 600 }}>• Latest Upload</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <span className={styles.selectedStatusBadge}>Ready to analyze</span>
                            </div>
                          )
                        })()}
                      </div>
                    ) : (
                      <div className={styles.resumeLibraryList}>
                        {availableResumes.map((r, idx) => {
                          const isSelected = (selectedLibraryResumeId || availableResumes[0].resumeId) === r.resumeId
                          return (
                            <div
                              key={r.resumeId}
                              className={`${styles.resumeLibraryItem} ${isSelected ? styles.resumeLibraryItemActive : ''}`}
                              onClick={() => setSelectedLibraryResumeId(r.resumeId)}
                            >
                              <div className={styles.resumeLibraryItemLeft}>
                                <div className={`${styles.resumeRadioCircle} ${isSelected ? styles.resumeRadioCircleActive : ''}`}>
                                  {isSelected && <div className={styles.resumeRadioInner} />}
                                </div>
                                <div>
                                  <p className={styles.resumeItemTitle}>{r.originalFilename}</p>
                                  <p className={styles.resumeItemDate}>
                                    Uploaded on {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    {idx === 0 && ' · Latest Upload'}
                                  </p>
                                </div>
                              </div>
                              {isSelected && (
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb' }}>
                                  Selected
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      border: '2px dashed #d4d4d8',
                      borderRadius: '16px',
                      padding: '32px 20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: '#fafaf9',
                      marginBottom: '16px',
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                    />
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#111113' }}>
                      {selectedFile ? selectedFile.name : 'Click to select PDF or DOCX file'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#71717a', marginTop: '4px' }}>
                      {selectedFile ? `${Math.round(selectedFile.size / 1024)} KB` : 'Maximum file size: 10MB'}
                    </div>
                  </div>
                )}

                {uploadError && (
                  <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '14px' }}>
                    {uploadError}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  {latestResume && (
                    <button
                      type="button"
                      onClick={() => setShowUploadSection(false)}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '9999px',
                        border: '1px solid #e5e5e0',
                        background: '#fff',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    className={styles.uploadNewBtn}
                    disabled={
                      (resumeMode === 'upload' && !selectedFile) ||
                      (resumeMode === 'library' && availableResumes.length === 0) ||
                      uploadMutation.isPending ||
                      analyzeLibraryMutation.isPending
                    }
                  >
                    {uploadMutation.isPending || analyzeLibraryMutation.isPending
                      ? 'Analyzing Resume...'
                      : 'Analyze Now'}
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        {/* PRIMARY 2-COLUMN GRID: ATS SCORE & MOCK INTERVIEW */}
        <div className={styles.overviewGrid}>
          {/* LEFT: ATS RESUME ANALYSIS */}
          <section className={styles.atsCard} aria-label="ATS Resume Analysis">
            <div className={styles.atsHeader}>
              <div>
                <div className={styles.atsScoreLabel}>Target ATS Match Score</div>
                <div className={styles.atsScoreBox}>
                  <span className={styles.scoreValue}>
                    {activeAnalysis ? activeAnalysis.score : '—'}
                  </span>
                  <span className={styles.scoreOutOf}>/100</span>
                </div>
              </div>

              {availableResumes.length > 0 && (
                <CustomResumeDropdown
                  resumes={availableResumes}
                  selectedResumeId={activeAnalysisResumeId}
                  onSelect={handleSelectAtsResume}
                  variant="pill"
                  align="right"
                  isLoading={analyzeLibraryMutation.isPending}
                />
              )}
            </div>

            {/* WHY EXPLANATION */}
            {activeAnalysis ? (
              <p className={styles.atsSummaryText}>{activeAnalysis.summary}</p>
            ) : (
              <p className={styles.atsSummaryText}>
                No resume has been uploaded for this job description yet. Upload your resume to calculate your target ATS score and get actionable improvement recommendations.
              </p>
            )}

            {/* RATE LIMIT BADGE */}
            <div
              className={`${styles.rateLimitBar} ${
                rateLimit.remaining === 0 ? styles.rateLimitExhausted : ''
              }`}
            >
              <span>
                {rateLimit.remaining > 0 ? (
                  <>
                    <span className={styles.rateLimitQuota}>
                      {rateLimit.remaining} of {rateLimit.limit}
                    </span>{' '}
                    analyses remaining this hour
                  </>
                ) : (
                  <>
                    <strong>Limit reached:</strong> Resets at {formatResetTime(rateLimit.resetAt)}
                  </>
                )}
              </span>
              <span style={{ fontSize: '11px', opacity: 0.8 }}>Hourly Rate Limit</span>
            </div>

            {/* ACTIONS */}
            <div className={styles.atsActionsRow}>
              <button
                type="button"
                className={styles.uploadNewBtn}
                onClick={() => {
                  setSelectedFile(null)
                  setUploadError(null)
                  setShowUploadSection((prev) => !prev)
                }}
                disabled={rateLimit.remaining === 0}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>
                  {showUploadSection
                    ? 'Hide Upload Form'
                    : latestResume
                    ? 'Analyze Improved Resume'
                    : 'Upload Resume for ATS Analysis'}
                </span>
              </button>
            </div>
          </section>

          {/* RIGHT: PERSONALIZED MOCK INTERVIEW CARD */}
          <section className={styles.interviewCard} aria-label="Mock Interview">
            <svg className={styles.interviewWaveSvg} viewBox="0 0 500 240" fill="none" aria-hidden="true">
              <path
                d="M0 120 C 140 60, 260 180, 390 110 C 440 80, 480 150, 520 120"
                stroke="#ffffff"
                strokeWidth="1.2"
                strokeOpacity="0.25"
              />
              <path
                d="M0 150 C 150 90, 280 210, 410 140 C 450 110, 490 180, 520 150"
                stroke="#ffffff"
                strokeWidth="0.9"
                strokeOpacity="0.18"
              />
            </svg>

            <div className={styles.interviewContent}>
              <div className={styles.interviewTopBlock}>
                <span className={styles.interviewEyebrow}>AI MOCK INTERVIEW</span>
                <h2 className={styles.interviewTitle}>
                  Practice specifically for
                  <br />
                  {jd.company}
                </h2>
                <p className={styles.interviewDesc}>
                  {activeInterviewResume
                    ? `Grounded in your selected resume (${activeInterviewResume.originalFilename}) and the real responsibilities of ${jd.title}.`
                    : 'Upload your resume first to generate personalized interview questions based on your actual experience.'}
                </p>

                {availableResumes.length > 0 && (
                  <div className={styles.interviewResumeSelector}>
                    <label className={styles.interviewResumeLabel}>
                      Select Resume for Interview
                    </label>
                    <CustomResumeDropdown
                      resumes={availableResumes}
                      selectedResumeId={activeInterviewResumeId}
                      onSelect={(id) => setSelectedInterviewResumeId(id)}
                      theme="dark"
                      variant="select"
                      direction="up"
                      fullWidth
                    />
                  </div>
                )}
              </div>

              <div className={styles.interviewBottomBlock}>
                <button
                  type="button"
                  className={styles.launchInterviewBtn}
                  onClick={handleStartMockInterview}
                  disabled={isStartingInterview || !activeInterviewResumeId}
                >
                  <span>
                    {isStartingInterview
                      ? 'Preparing Room...'
                      : activeInterviewResumeId
                      ? 'Start Targeted Interview'
                      : 'Upload Resume First'}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* HISTORICAL VERSION NOTICE BANNER & COMPARISON */}
        {isViewingHistorical && activeAnalysis && latestAnalysis && (
          <div className={styles.historicalBanner}>
            <div className={styles.historicalBannerLeft}>
              <div className={styles.historicalBannerBadge}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Viewing Historical Iteration</span>
              </div>
              <div className={styles.historicalBannerText}>
                Viewing <strong>Version {activeAnalysis.version}</strong> ({new Date(activeAnalysis.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}) — ATS Match: <strong>{activeAnalysis.score}%</strong>.
                {latestAnalysis.score !== activeAnalysis.score && (
                  <span className={styles.historicalBannerDiff}>
                    {latestAnalysis.score > activeAnalysis.score
                      ? ` Latest version scored ${latestAnalysis.score}% (+${latestAnalysis.score - activeAnalysis.score}% improvement!)`
                      : ` Latest version scored ${latestAnalysis.score}%.`}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              className={styles.returnLatestBtn}
              onClick={() => setSelectedAnalysisId(latestAnalysis.analysisId)}
            >
              <span>Return to Latest (V{latestAnalysis.version})</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}

        {/* VERSION HISTORY BAR */}
        {history && history.length > 0 && (
          <section className={styles.historySection} aria-label="Analysis Version History">
            <div className={styles.historyHeader}>
              <div className={styles.historyHeaderLeft}>
                <span className={styles.historyIcon}>🕒</span>
                <div>
                  <h3 className={styles.historyTitle}>Resume Iterations & Analysis History</h3>
                  <p className={styles.historySubtitle}>
                    All analyses and detected mistakes are saved in DB. Click any iteration to inspect past mistakes and track improvements.
                  </p>
                </div>
              </div>
              <span className={styles.historyCountBadge}>
                {history.length} {history.length === 1 ? 'saved analysis' : 'saved analyses'}
              </span>
            </div>
            <div className={styles.versionChipsRow}>
              {history.map((h, idx) => {
                const isActive = activeAnalysis?.analysisId === h.analysisId
                const isLatest = idx === 0
                const scoreClass =
                  h.score >= 75
                    ? styles.versionScoreHigh
                    : h.score >= 50
                    ? styles.versionScoreMed
                    : styles.versionScoreLow

                const missingCount =
                  (h.breakdown?.missingKeywords?.length ||
                    h.breakdown?.missingSkills?.length ||
                    h.improvements?.missing?.length ||
                    0)
                const sugCount = h.improvements?.suggestions?.length || 0
                const totalGaps = missingCount + sugCount

                return (
                  <button
                    key={h.analysisId}
                    type="button"
                    className={`${styles.versionPill} ${isActive ? styles.versionPillActive : ''}`}
                    onClick={() => setSelectedAnalysisId(h.analysisId)}
                  >
                    <span className={styles.versionLabel}>
                      V{h.version}
                      {isLatest && <span className={styles.latestTag}>Latest</span>}
                    </span>
                    <span className={`${styles.versionScore} ${scoreClass}`}>{h.score}%</span>
                    {totalGaps > 0 && (
                      <span className={styles.versionGapsBadge}>
                        {totalGaps} {totalGaps === 1 ? 'gap to fix' : 'gaps to fix'}
                      </span>
                    )}
                    <span className={styles.versionDate}>
                      {new Date(h.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* KEYWORD GAPS & MATCHED SKILLS */}
        {activeAnalysis && (
          <section className={styles.keywordGrid} aria-label="Keywords Breakdown">
            {/* MATCHED */}
            <div className={`${styles.keywordCard} ${styles.keywordCardMatched}`}>
              <div className={styles.keywordHeader}>
                <div className={styles.keywordIconGreen}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <div className={styles.keywordTitleRow}>
                    <h3 className={styles.keywordTitle}>Matched Keywords</h3>
                    <span className={styles.matchedBadgeCount}>{matchedKeywords.length}</span>
                  </div>
                  <p className={styles.keywordDesc}>
                    These qualifications and technologies from the job description are strongly represented on your resume.
                  </p>
                </div>
              </div>

              {matchedKeywords.length > 0 ? (
                <div className={styles.chipsContainer}>
                  {matchedKeywords.map((kw: string, i: number) => (
                    <span key={i} className={styles.matchedChip}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{kw}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyKeywordsMsg}>
                  No direct keyword matches detected. Incorporate target skills from the job description.
                </div>
              )}
            </div>

            {/* MISSING / MISTAKES TO IMPROVE */}
            <div className={`${styles.keywordCard} ${styles.keywordCardMissing}`}>
              <div className={styles.keywordHeader}>
                <div className={styles.keywordIconAmber}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div>
                  <div className={styles.keywordTitleRow}>
                    <h3 className={styles.keywordTitle}>
                      {isViewingHistorical ? `Missing Qualifications (Version ${activeAnalysis.version})` : 'Missing Key Qualifications'}
                    </h3>
                    <span className={styles.missingBadgeCount}>{missingKeywords.length}</span>
                  </div>
                  <p className={styles.keywordDesc}>
                    {isViewingHistorical
                      ? 'Gaps detected in this iteration. See which ones were resolved in subsequent versions or still need work.'
                      : 'Consider adding genuine experience or projects involving these skills to improve ATS pass rates.'}
                  </p>
                </div>
              </div>

              {missingKeywords.length > 0 ? (
                <div className={styles.chipsContainer}>
                  {missingKeywords.map((kw: string, i: number) => {
                    const isResolved = isViewingHistorical && latestMatchedSet.has(kw.toLowerCase().trim())
                    if (isResolved) {
                      return (
                        <span key={i} className={styles.resolvedChip}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>{kw}</span>
                          <span className={styles.resolvedSubtag}>Fixed in V{latestAnalysis?.version}</span>
                        </span>
                      )
                    }
                    return (
                      <span key={i} className={styles.missingChip}>
                        <span style={{ fontWeight: 800, fontSize: '13px' }}>+</span>
                        <span>{kw}</span>
                        {isViewingHistorical && (
                          <span className={styles.stillMissingTag}>Still Missing</span>
                        )}
                      </span>
                    )
                  })}
                </div>
              ) : (
                <div className={styles.perfectKeywordsMsg}>
                  🎉 Outstanding! No critical keyword gaps identified for this role.
                </div>
              )}
            </div>
          </section>
        )}

        {/* ACTIONABLE IMPROVEMENT RECOMMENDATIONS */}
        {activeAnalysis && suggestions.length > 0 && (
          <section className={styles.suggestionsSection} aria-label="Actionable Recommendations">
            <div className={styles.suggestionsHeader}>
              <div className={styles.suggestionsTitleRow}>
                <div className={styles.sugHeaderIcon}>💡</div>
                <div>
                  <h3 className={styles.suggestionsTitle}>
                    {isViewingHistorical
                      ? `Mistakes & Phrasing Gaps (Version ${activeAnalysis.version})`
                      : 'Actionable Resume Improvements & Mistakes to Fix'}
                  </h3>
                  <p className={styles.suggestionsSubtitle}>
                    {isViewingHistorical
                      ? `Here are the phrasing mistakes and weaknesses recorded for Version ${activeAnalysis.version} stored in the DB.`
                      : 'Edit your resume to fix these specific phrasing and metric weaknesses, then upload an updated version above to re-run ATS scoring.'}
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.suggestionsList}>
              {suggestions.map((sug, idx: number) => (
                <div key={idx} className={styles.suggestionCard}>
                  <div className={styles.sugCardTop}>
                    <div className={styles.sugIndexBadge}>Mistake {idx + 1}</div>
                    <h4 className={styles.sugPointTitle}>{sug.point}</h4>
                  </div>

                  <p className={styles.sugReason}>{sug.suggestion}</p>

                  {(sug.current || sug.better) && (
                    <div className={styles.diffBox}>
                      {sug.current && (
                        <div className={styles.currentBox}>
                          <div className={styles.diffHeaderRow}>
                            <span className={styles.diffLabelRed}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                              </svg>
                              Current Phrasing (Mistake / Weakness)
                            </span>
                          </div>
                          <p className={styles.diffTextRed}>"{sug.current}"</p>
                        </div>
                      )}
                      {sug.better && (
                        <div className={styles.betterBox}>
                          <div className={styles.diffHeaderRow}>
                            <span className={styles.diffLabelGreen}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Recommended Improvement (Action & Metrics)
                            </span>
                            <button
                              type="button"
                              className={styles.copyBtn}
                              onClick={() => {
                                navigator.clipboard.writeText(sug.better || '')
                                setCopiedIdx(idx)
                                setTimeout(() => setCopiedIdx(null), 2000)
                              }}
                              title="Copy recommended phrasing"
                            >
                              {copiedIdx === idx ? (
                                <>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                  </svg>
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                          <p className={styles.diffTextGreen}>"{sug.better}"</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default JdWorkspacePage
