import React, { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Logo from '@/shared/components/Logo/Logo'
import { useAuth } from '@/shared/context/useAuth'
import { CompanyLogo } from '@/shared/components/Icons/CompanyLogo'
import { useSessionReportQuery } from '@/features/interview/hooks/useInterviewQueries'
import styles from './SessionReportPage.module.css'

export const SessionReportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [showProfileMenu, setShowProfileMenu] = useState(false)
  // Expand question 0 by default; map of expanded turn indices
  const [expandedTurns, setExpandedTurns] = useState<Record<number, boolean>>({ 0: true })
  const [allExpanded, setAllExpanded] = useState(false)

  const { data: report, isLoading, isError, error } = useSessionReportQuery(id)

  const displayName = user?.name ? user.name.split(' ')[0] : 'Bhavya'
  const displayInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'B'

  const toggleTurnExpand = (index: number) => {
    setExpandedTurns((prev) => ({
      ...prev,
      [index]: !prev[index],
    }))
  }

  const toggleAllTurns = () => {
    if (!report?.turns) return
    const nextState = !allExpanded
    setAllExpanded(nextState)
    const updated: Record<number, boolean> = {}
    report.turns.forEach((_, idx) => {
      updated[idx] = nextState
    })
    setExpandedTurns(updated)
  }

  const handleDownloadReport = () => {
    // Open print view which uses clean printable stylesheet hiding sidebar and controls
    window.print()
  }

  const handleStartNewInterview = () => {
    navigate('/interviews')
  }

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch {
      navigate('/login')
    }
  }

  // Helper to format date
  const formatReportDate = (isoString?: string) => {
    if (!isoString) return '10 Sep 2026'
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return '10 Sep 2026'
    }
  }

  // Dynamic Headline and description for Overall Score
  const getPerformanceFeedback = (score: number) => {
    if (score >= 85) {
      return {
        headline: 'Outstanding Performance!',
        description: 'You demonstrated deep architectural understanding and clear communication. Ready for top-tier technical rounds.',
      }
    }
    if (score >= 70) {
      return {
        headline: 'Good Performance!',
        description: 'You showed strong technical understanding. Focus on a few key areas to perform even better.',
      }
    }
    if (score >= 50) {
      return {
        headline: 'Solid Effort!',
        description: 'You covered the fundamentals well. Diving deeper into specific edge cases and architecture decisions will elevate your score.',
      }
    }
    return {
      headline: 'Needs Practice!',
      description: 'Spend more time preparing core concepts and practicing real-world implementation examples for this role.',
    }
  }

  // Navigation handlers
  const handleNavClick = (tab: string) => {
    switch (tab) {
      case 'home':
        navigate('/dashboard')
        break
      case 'resumes':
        navigate('/dashboard/resumes')
        break
      case 'jds':
        navigate('/dashboard/jds')
        break
      case 'interviews':
        navigate('/dashboard/interviews')
        break
      case 'settings':
        navigate('/dashboard/settings')
        break
    }
  }

  // Gauge calculation
  const overallScoreVal = report?.overallScore ?? 78
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (overallScoreVal / 100) * circumference
  const perf = getPerformanceFeedback(overallScoreVal)

  // Context metadata
  const jdCompany = report?.jd?.company || 'Google'
  const jdTitle = report?.jd?.title || 'Software Engineer'
  const resumeName = report?.resume?.originalFilename || 'Bhavya_Dhanwani_Resume_V3.pdf'
  const completedDate = formatReportDate(report?.session?.completedAt || report?.session?.createdAt)
  const questionCount = report?.session?.questionCount || report?.turns?.length || 7
  const durationMins = report?.session?.durationMinutes || 18

  return (
    <div className={styles.dashboardShell}>
      {/* LEFT SIDEBAR */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <Link to="/dashboard" className={styles.logoLink}>
            <Logo />
          </Link>

          <nav className={styles.nav} aria-label="Main Navigation">
            <button
              type="button"
              className={styles.navItem}
              onClick={() => handleNavClick('home')}
            >
              <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>Home</span>
            </button>

            <button
              type="button"
              className={styles.navItem}
              onClick={() => handleNavClick('resumes')}
            >
              <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>My Resumes</span>
            </button>

            <button
              type="button"
              className={styles.navItem}
              onClick={() => handleNavClick('jds')}
            >
              <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              <span>Job Descriptions</span>
            </button>

            <button
              type="button"
              className={`${styles.navItem} ${styles.navItemActive}`}
              onClick={() => handleNavClick('interviews')}
            >
              <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>Interviews</span>
            </button>

            <div className={styles.navDivider} />

            <button
              type="button"
              className={styles.navItem}
              onClick={() => handleNavClick('settings')}
            >
              <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Settings</span>
            </button>
          </nav>
        </div>

        <div className={styles.sidebarBottom}>
          <div className={styles.brandCard}>
            <div className={styles.brandDeco} aria-hidden="true" />
            <p className={styles.brandText}>
              Better Conversations.
              <br />
              Brighter Careers.
            </p>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className={styles.mainContent}>
        {/* TOP BAR */}
        <header className={styles.topBar}>
          <div className={styles.topBarActions}>
            <button
              type="button"
              className={styles.notifBtn}
              aria-label="Notifications"
              title="Notifications"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </button>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={styles.profileButton}
                onClick={() => setShowProfileMenu((prev) => !prev)}
                aria-expanded={showProfileMenu}
              >
                <div className={styles.avatar}>{displayInitial}</div>
                <span className={styles.userName}>{displayName}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {showProfileMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '180px',
                    background: '#ffffff',
                    border: '1px solid #ebeae5',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
                    zIndex: 50,
                    padding: '6px',
                  }}
                >
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '9px 12px',
                      background: 'none',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#dc2626',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                    onClick={handleLogout}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* NAVIGATION BACK LINK */}
        <Link to="/interviews" className={styles.backLink}>
          ← Back to Interviews
        </Link>

        {/* LOADING STATE */}
        {isLoading && (
          <div className={styles.stateCard}>
            <div className={styles.spinner} />
            <h2 className={styles.stateHeading}>Preparing your interview report...</h2>
            <p className={styles.stateDescription}>
              Your interview is complete. We&apos;re putting together your comprehensive performance evaluation.
            </p>
          </div>
        )}

        {/* ERROR / NOT FOUND STATE */}
        {!isLoading && (isError || !report) && (
          <div className={styles.stateCard}>
            <div style={{ fontSize: '32px' }}>📋</div>
            <h2 className={styles.stateHeading}>Report not available yet</h2>
            <p className={styles.stateDescription}>
              {error instanceof Error && error.message.includes('in progress')
                ? 'Your interview is still in progress.'
                : 'The report for this interview hasn&apos;t been generated yet or is still processing.'}
            </p>
            <div className={styles.stateButtonRow}>
              {id && (
                <button
                  type="button"
                  className={styles.btnStartNew}
                  onClick={() => navigate(`/sessions/${id}/interview`)}
                >
                  Go to Interview Room →
                </button>
              )}
              <button
                type="button"
                className={styles.btnDownload}
                onClick={() => navigate('/interviews')}
              >
                Back to Interviews
              </button>
            </div>
          </div>
        )}

        {/* REPORT CONTENT (When data loaded) */}
        {!isLoading && report && (
          <>
            {/* HEADER AREA */}
            <div className={styles.reportHeaderRow}>
              <div className={styles.reportHeaderLeft}>
                <div className={styles.reportEyebrow}>INTERVIEW REPORT</div>
                <h1 className={styles.reportTitle}>
                  {jdTitle} — {jdCompany}
                </h1>
                <p className={styles.reportSubtitle}>
                  A detailed analysis of your mock interview performance.
                </p>

                {/* METADATA PILLS */}
                <div className={styles.pillsRow}>
                  <div className={styles.metaPill}>
                    <CompanyLogo company={jdCompany} size={16} />
                    <span>{jdCompany}</span>
                  </div>

                  <div className={styles.metaPill}>
                    <svg className={styles.pillIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                    <span>{jdTitle}</span>
                  </div>

                  <div className={styles.metaPill}>
                    <svg className={styles.pillIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    <span>{resumeName}</span>
                  </div>
                </div>
              </div>

              {/* HEADER RIGHT ACTIONS */}
              <div className={styles.reportHeaderRight}>
                <div className={styles.sessionMetaText}>
                  <span>Completed on {completedDate}</span>
                  <span className={styles.metaDot}>•</span>
                  <span>{questionCount} questions</span>
                  <span className={styles.metaDot}>•</span>
                  <span>{durationMins} mins</span>
                </div>

                <div className={styles.headerActionRow}>
                  <button
                    type="button"
                    className={styles.btnDownload}
                    onClick={handleDownloadReport}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>Download Report</span>
                  </button>

                  <button
                    type="button"
                    className={styles.btnStartNew}
                    onClick={handleStartNewInterview}
                  >
                    <span>Start New Interview</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            </div>

            {/* SCORE SECTION: 3 CARDS */}
            <section className={styles.scoresGrid} aria-label="Scores Overview">
              {/* CARD 1: OVERALL SCORE */}
              <div className={styles.scoreCard}>
                <div className={styles.scoreCardHeader}>Overall Score</div>
                <div className={styles.overallContentRow}>
                  <div className={styles.gaugeContainer}>
                    <svg className={styles.gaugeSvg} viewBox="0 0 96 96">
                      <circle
                        className={styles.gaugeTrack}
                        cx="48"
                        cy="48"
                        r={radius}
                      />
                      <circle
                        className={styles.gaugeIndicator}
                        cx="48"
                        cy="48"
                        r={radius}
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                      />
                    </svg>
                    <div className={styles.gaugeCenterText}>
                      <span className={styles.overallScoreNumber}>{overallScoreVal}</span>
                      <span className={styles.overallScoreLabel}>out of 100</span>
                    </div>
                  </div>

                  <div className={styles.overallDivider} />

                  <div className={styles.overallPerformanceGroup}>
                    <div className={styles.performanceHeadline}>{perf.headline}</div>
                    <p className={styles.performanceDescription}>{perf.description}</p>
                  </div>
                </div>
              </div>

              {/* CARD 2: CONFIDENCE SCORE */}
              <div className={styles.scoreCard}>
                <div className={styles.scoreCardHeader}>Confidence Score</div>
                <div className={styles.metricContent}>
                  <div className={styles.metricIconBox}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                  </div>

                  <div className={styles.scoreRow}>
                    <span className={styles.metricScoreNumber}>
                      {Number(report.confidenceScore).toFixed(1)}
                    </span>
                    <span className={styles.metricDenominator}>/ 10</span>
                  </div>

                  <p className={styles.metricDescription}>
                    You communicated your ideas clearly and confidently throughout the interview.
                  </p>
                </div>
              </div>

              {/* CARD 3: ANSWER QUALITY */}
              <div className={styles.scoreCard}>
                <div className={styles.scoreCardHeader}>Answer Quality</div>
                <div className={styles.metricContent}>
                  <div className={styles.metricIconBox}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </div>

                  <div className={styles.scoreRow}>
                    <span className={styles.metricScoreNumber}>
                      {Number(report.answerQualityScore).toFixed(1)}
                    </span>
                    <span className={styles.metricDenominator}>/ 10</span>
                  </div>

                  <p className={styles.metricDescription}>
                    Your answers were relevant, structured, and accurately addressed the role requirements.
                  </p>
                </div>
              </div>
            </section>

            {/* STRENGTHS & AREAS TO IMPROVE (2 CARDS) */}
            <section className={styles.strengthsImprovementsGrid} aria-label="Strengths and Areas to Improve">
              {/* KEY STRENGTHS */}
              <div className={styles.whiteSectionCard}>
                <div className={styles.cardTitleRow}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#18181b' }}>
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                  <h2 className={styles.cardHeading}>Key Strengths</h2>
                </div>

                {report.strengths && report.strengths.length > 0 ? (
                  <ul className={styles.bulletList}>
                    {report.strengths.map((str, idx) => (
                      <li key={idx} className={styles.bulletItem}>
                        <span className={styles.bulletDot}>•</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: '13px', color: '#71717a', margin: 0 }}>
                    No strengths were recorded for this session.
                  </p>
                )}
              </div>

              {/* AREAS TO IMPROVE */}
              <div className={styles.whiteSectionCard}>
                <div className={styles.cardTitleRow}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#18181b' }}>
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                  <h2 className={styles.cardHeading}>Areas to Improve</h2>
                </div>

                {report.weaknesses && report.weaknesses.length > 0 ? (
                  <ul className={styles.bulletList}>
                    {report.weaknesses.map((weak, idx) => (
                      <li key={idx} className={styles.bulletItem}>
                        <span className={styles.bulletDot}>•</span>
                        <span>{weak}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: '13px', color: '#71717a', margin: 0 }}>
                    No areas for improvement were recorded.
                  </p>
                )}
              </div>
            </section>

            {/* PERSONALIZED ADVICE (FULL-WIDTH CARD) */}
            <section className={styles.adviceCard} aria-label="Personalized Advice">
              <div className={styles.adviceIconContainer}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="9" y1="18" x2="15" y2="18" />
                  <line x1="10" y1="22" x2="14" y2="22" />
                  <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
                </svg>
              </div>

              <div className={styles.adviceTextGroup}>
                <h2 className={styles.adviceHeading}>Personalized Advice</h2>
                <p className={styles.adviceBody}>
                  {report.advice ||
                    'Focus on explaining your system-design decisions more clearly. Practice discussing scalability, database choices, and trade-offs.'}
                </p>
              </div>
            </section>

            {/* QUESTION BY QUESTION REVIEW */}
            <section className={styles.reviewSection} aria-label="Question by Question Review">
              <div className={styles.reviewHeaderRow}>
                <h2 className={styles.reviewHeading}>Question by Question Review</h2>
                {report.turns && report.turns.length > 0 && (
                  <button
                    type="button"
                    className={styles.viewAllBtn}
                    onClick={toggleAllTurns}
                  >
                    <span>{allExpanded ? 'Collapse all' : 'View all questions'}</span>
                    <span>→</span>
                  </button>
                )}
              </div>

              {/* QUESTIONS LIST */}
              {report.turns && report.turns.length > 0 ? (
                <div className={styles.questionsList}>
                  {report.turns
                    .slice()
                    .sort((a, b) => a.turnIndex - b.turnIndex)
                    .map((turn, idx) => {
                      const isExpanded = Boolean(expandedTurns[idx])
                      const questionNum = turn.turnIndex + 1
                      const scoreNum = turn.rating?.score ?? 8
                      const whatWentWellText =
                        turn.rating?.whatWentWell ||
                        'You gave a clear and structured overview of your background, highlighting relevant experience.'
                      const whatCouldBeBetterText =
                        turn.rating?.whatCouldBeBetter ||
                        turn.rating?.feedback ||
                        'Tailor your answer more specifically to the concrete architecture requirements of this role.'

                      return (
                        <div key={idx} className={styles.questionCard}>
                          <button
                            type="button"
                            className={styles.questionHeaderBtn}
                            onClick={() => toggleTurnExpand(idx)}
                            aria-expanded={isExpanded}
                          >
                            <div className={styles.questionHeaderLeft}>
                              <div className={styles.questionIndexBadge}>{questionNum}</div>
                              <h3 className={styles.questionText}>{turn.question.text}</h3>
                            </div>

                            <div className={styles.questionHeaderRight}>
                              <span className={styles.durationBadge}>
                                {turn.durationFormatted || '01:23'}
                              </span>
                              <svg
                                className={`${styles.chevronIcon} ${isExpanded ? styles.chevronExpanded : ''}`}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M6 9l6 6 6-6" />
                              </svg>
                            </div>
                          </button>

                          {/* EXPANDABLE BODY */}
                          {isExpanded && (
                            <div className={styles.questionBody}>
                              {/* CANDIDATE TRANSCRIPT */}
                              {turn.answer?.transcript && (
                                <div className={styles.transcriptContainer}>
                                  <div className={styles.transcriptLabel}>Your Answer Transcript</div>
                                  <p className={styles.transcriptQuote}>
                                    &ldquo;{turn.answer.transcript}&rdquo;
                                  </p>
                                </div>
                              )}

                              {/* FEEDBACK ROW */}
                              <div className={styles.feedbackRow}>
                                {/* SCORE BOX */}
                                <div className={styles.feedbackScoreBox}>
                                  <span className={styles.fbScoreLabel}>Score</span>
                                  <span className={styles.fbScoreValue}>{scoreNum} / 10</span>
                                </div>

                                {/* WHAT WENT WELL */}
                                <div className={styles.feedbackItemBox}>
                                  <div className={styles.feedbackTitleRow}>
                                    <svg className={styles.fbSuccessIcon} viewBox="0 0 24 24" fill="currentColor">
                                      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.74-5.25z" clipRule="evenodd" />
                                    </svg>
                                    <span className={styles.feedbackHeading}>What went well</span>
                                  </div>
                                  <p className={styles.feedbackText}>{whatWentWellText}</p>
                                </div>

                                {/* WHAT COULD BE BETTER */}
                                <div className={styles.feedbackItemBox}>
                                  <div className={styles.feedbackTitleRow}>
                                    <svg className={styles.fbInfoIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <circle cx="12" cy="12" r="10" />
                                      <line x1="12" y1="16" x2="12" y2="12" />
                                      <line x1="12" y1="8" x2="12.01" y2="8" />
                                    </svg>
                                    <span className={styles.feedbackHeading}>What could be better</span>
                                  </div>
                                  <p className={styles.feedbackText}>{whatCouldBeBetterText}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              ) : (
                <div style={{ padding: '24px', background: '#ffffff', border: '1px solid #ebeae5', borderRadius: '16px', color: '#71717a', fontSize: '14px' }}>
                  No question-level reviews recorded for this session.
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default SessionReportPage
