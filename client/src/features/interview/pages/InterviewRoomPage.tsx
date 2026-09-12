import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Logo from '@/shared/components/Logo/Logo'
import { useAuth } from '@/shared/context/useAuth'
import { CompanyLogo } from '@/shared/components/Icons/CompanyLogo'
import { interviewApi } from '../../../shared/api/interview.api'
import { useInterviewSessionQuery } from '../hooks/useInterviewQueries'
import { useAudioQueuePlayer } from '../hooks/useAudioQueuePlayer'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import { useCameraStream } from '../hooks/useCameraStream'
import type {
  InterviewStage,
  TurnHistoryItem,
  TurnRating,
} from '../../../shared/types/interview.types'
import styles from './InterviewRoomPage.module.css'

export const InterviewRoomPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const sessionId = id || ''
  const { user, logout } = useAuth()

  const { data: session, isLoading: isSessionLoading } = useInterviewSessionQuery(sessionId)

  const [stage, setStage] = useState<InterviewStage>('initializing')
  const [currentTurn, setCurrentTurn] = useState<number>(0)
  const [targetLoopCount, setTargetLoopCount] = useState<number>(7)
  const [currentQuestion, setCurrentQuestion] = useState<string>('')
  const [, setIsSseActive] = useState<boolean>(false)
  const [hasStartedSession, setHasStartedSession] = useState<boolean>(false)
  const [latestRating, setLatestRating] = useState<TurnRating | null>(null)
  const [, setLatestTranscript] = useState<string>('')
  const [turnHistory, setTurnHistory] = useState<TurnHistoryItem[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Auto continue & countdown
  const [autoContinue, setAutoContinue] = useState<boolean>(true)
  const [countdown, setCountdown] = useState<number | null>(null)

  // Timer & UI modals
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)
  const [showEndModal, setShowEndModal] = useState<boolean>(false)
  const [isEndingSession, setIsEndingSession] = useState<boolean>(false)
  const [showTranscriptModal, setShowTranscriptModal] = useState<boolean>(false)
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false)

  const streamCleanupRef = useRef<(() => void) | null>(null)
  const isComponentMounted = useRef<boolean>(true)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Audio queue player handles streaming chunks from Sarvam TTS
  const handlePlaybackFinished = useCallback(() => {
    if (!isComponentMounted.current) return
    setStage('candidate_speaking')
  }, [])

  const audioPlayer = useAudioQueuePlayer({
    onAllPlaybackEnded: handlePlaybackFinished,
  })

  // Stable ref so onAutoStop always calls the latest submit handler
  const submitAnswerRef = useRef<() => void>(() => {})

  // Auto-submit if recording reaches max limit (5 minutes)
  const handleAutoStop = useCallback(() => {
    setErrorMessage('Max recording limit reached (5 min) — submitting answer.')
    submitAnswerRef.current()
  }, [])

  // Voice recorder handles candidate microphone input
  const voiceRecorder = useVoiceRecorder({ onAutoStop: handleAutoStop })

  // Camera stream handles optional candidate webcam preview
  const cameraStream = useCameraStream()

  // Clean up on unmount
  useEffect(() => {
    isComponentMounted.current = true
    return () => {
      isComponentMounted.current = false
      if (streamCleanupRef.current) {
        streamCleanupRef.current()
        streamCleanupRef.current = null
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
      audioPlayer.stopAll()
      voiceRecorder.cancelRecording()
      cameraStream.stopCamera()
    }
  }, [])

  // Sync initial target loop count and prior turn history from session
  useEffect(() => {
    if (session?.targetLoopCount) {
      setTargetLoopCount(session.targetLoopCount)
    }
    if (session?.currentTurnIndex !== undefined) {
      setCurrentTurn(session.currentTurnIndex)
      if (session.currentTurnIndex > 0) {
        setHasStartedSession(true)
      }
    }
    if (session?.turns && session.turns.length > 0) {
      setTurnHistory(session.turns)
      const lastAnswered = [...session.turns].reverse().find((t) => t.rating)
      if (lastAnswered?.rating) {
        setLatestRating(lastAnswered.rating)
      }
      if (lastAnswered?.transcript) {
        setLatestTranscript(lastAnswered.transcript)
      }
    }
    if (session?.status === 'completed') {
      navigate(`/sessions/${sessionId}/report`)
    }
  }, [session, sessionId, navigate])

  // Timer: count elapsed seconds when session is active
  useEffect(() => {
    if (!hasStartedSession || stage === 'finishing') return
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [hasStartedSession, stage])

  // Format elapsed time as mm:ss
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60)
    const secs = totalSec % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  // Stream question via SSE
  const startTurnStream = useCallback(
    (isInitial: boolean) => {
      if (!sessionId) return

      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
      setCountdown(null)
      setErrorMessage(null)
      setIsSseActive(true)
      setStage('streaming_question')
      setCurrentQuestion('')
      setLatestRating(null)
      setLatestTranscript('')
      audioPlayer.resetQueue()

      if (streamCleanupRef.current) {
        streamCleanupRef.current()
        streamCleanupRef.current = null
      }

      const cleanup = interviewApi.streamInterviewQuestionSse(sessionId, isInitial, {
        onMetadata: (meta) => {
          if (!isComponentMounted.current) return
          setCurrentTurn(meta.turnIndex)
          if (meta.targetLoopCount) {
            setTargetLoopCount(meta.targetLoopCount)
          }
        },
        onAudioChunk: (chunkEvent) => {
          if (!isComponentMounted.current) return
          setStage('ai_speaking')
          if (chunkEvent.text) {
            const text = chunkEvent.text.trim()
            if (text) {
              setCurrentQuestion((prev) => {
                if (!prev) return text
                if (prev.includes(text)) return prev
                return `${prev} ${text}`
              })
            }
          }
          audioPlayer.enqueueChunk(chunkEvent)
        },
        onDone: (doneEvent) => {
          if (!isComponentMounted.current) return
          setIsSseActive(false)
          if (doneEvent.question) {
            setCurrentQuestion(doneEvent.question)
          }
          audioPlayer.markStreamDone()
        },
        onError: (err) => {
          if (!isComponentMounted.current) return
          setIsSseActive(false)
          setErrorMessage(err.message || 'Failed to stream interview question.')
        },
      })

      streamCleanupRef.current = cleanup
    },
    [sessionId, audioPlayer]
  )

  // Start the interview session
  const handleStartInterview = useCallback(() => {
    setHasStartedSession(true)
    const isInitial = (session?.currentTurnIndex || 0) === 0
    startTurnStream(isInitial)
  }, [session?.currentTurnIndex, startTurnStream])

  // Advance to next question
  const handleNextQuestion = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    setCountdown(null)
    startTurnStream(false)
  }, [startTurnStream])

  // Keep a stable ref to startTurnStream so the countdown interval doesn't go stale
  const startTurnStreamRef = useRef(startTurnStream)
  useEffect(() => {
    startTurnStreamRef.current = startTurnStream
  }, [startTurnStream])

  // Auto-advance countdown timer when turn is evaluated
  useEffect(() => {
    if (stage !== 'turn_evaluated' || !autoContinue) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
      setCountdown(null)
      return
    }

    setCountdown(4)
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
            countdownIntervalRef.current = null
          }
          // Use ref so we always call latest version without adding to deps
          startTurnStreamRef.current(false)
          return null
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
    }
  }, [stage, autoContinue])

  // Submit candidate spoken answer
  const handleSubmitCandidateAnswer = async () => {
    try {
      const audioBlob = await voiceRecorder.stopRecording()
      if (!audioBlob || audioBlob.size === 0) {
        setErrorMessage('No audio captured. Please click the mic and speak your answer.')
        return
      }

      setStage('submitting_answer')
      setErrorMessage(null)

      const result = await interviewApi.submitTurnAnswer(sessionId, currentTurn, audioBlob)

      setLatestTranscript(result.transcript)
      setLatestRating(result.rating)

      // Add to conversation history
      setTurnHistory((prev) => [
        ...prev,
        {
          turnIndex: currentTurn,
          question: currentQuestion || audioPlayer.spokenSentences.join(' '),
          transcript: result.transcript,
          rating: result.rating,
          answeredAt: new Date().toISOString(),
        },
      ])

      // Check if session completed
      if (result.sessionComplete || currentTurn + 1 >= targetLoopCount) {
        setStage('finishing')
        try {
          await interviewApi.endInterviewSession(sessionId)
        } catch {
          // Proceed to report
        }
        navigate(`/sessions/${sessionId}/report`)
      } else {
        setStage('turn_evaluated')
        setCurrentTurn((prev) => prev + 1)
      }
    } catch (err: unknown) {
      console.error('Answer submission error:', err)
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to submit answer. Please try again.'
      )
      setStage('candidate_speaking')
    }
  }

  // Update ref every render so the auto-stop timeout always calls the latest version
  submitAnswerRef.current = handleSubmitCandidateAnswer

  // Toggle candidate recording
  const handleToggleMic = () => {
    if (voiceRecorder.isRecording) {
      handleSubmitCandidateAnswer()
    } else if (stage === 'candidate_speaking' || stage === 'turn_evaluated') {
      voiceRecorder.startRecording()
    }
  }

  // Confirm and end session
  const handleConfirmEndSession = async () => {
    setIsEndingSession(true)
    setStage('finishing')
    audioPlayer.stopAll()
    voiceRecorder.cancelRecording()
    cameraStream.stopCamera()

    try {
      await interviewApi.endInterviewSession(sessionId)
    } catch {
      // Proceed even if ended
    }
    navigate(`/sessions/${sessionId}/report`)
  }

  // Dynamic waveform bars calculation
  const waveBars = useMemo(() => {
    const count = 9
    return Array.from({ length: count }, (_, i) => {
      const isCenter = 1 - Math.abs(i - 4) / 4.5
      if (stage === 'ai_speaking') {
        const level = audioPlayer.audioLevel || 0.4
        const height = Math.max(8, Math.round(level * 46 * isCenter + Math.random() * 8))
        return { height, isIdle: false }
      }
      if (voiceRecorder.isRecording) {
        const vol = voiceRecorder.micVolume || 0.35
        const height = Math.max(8, Math.round(vol * 46 * isCenter + Math.random() * 6))
        return { height, isIdle: false }
      }
      return { height: 8 + Math.round(isCenter * 8), isIdle: true }
    })
  }, [stage, audioPlayer.audioLevel, voiceRecorder.isRecording, voiceRecorder.micVolume])

  const displayName = user?.name ? user.name.split(' ')[0] : 'Bhavya'
  const displayInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'B'
  const companyName = session?.jd?.company || 'Target Company'
  const jobTitle = session?.jd?.title || 'Software Engineer'
  const resumeName = session?.resume?.originalFilename || 'Resume_V3.pdf'

  const progressPercent = Math.min(
    100,
    Math.round(((currentTurn + (stage === 'turn_evaluated' ? 1 : 0)) / targetLoopCount) * 100)
  )

  if (isSessionLoading && !session) {
    return (
      <div className={styles.roomLayout}>
        <div className={styles.loadingContainer} style={{ margin: 'auto' }}>
          <div className={styles.spinner} />
          <p>Loading interview room...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.roomLayout}>
      {/* LEFT SIDEBAR */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <Link to="/dashboard" className={styles.logoLink} title="Karyam Dashboard">
            <Logo />
          </Link>

          <nav className={styles.nav}>
            <Link to="/dashboard" className={styles.navItem}>
              <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline strokeLinecap="round" strokeLinejoin="round" points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>Home</span>
            </Link>

            <Link to="/dashboard/resumes" className={styles.navItem}>
              <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline strokeLinecap="round" strokeLinejoin="round" points="14 2 14 8 20 8" />
              </svg>
              <span>My Resumes</span>
            </Link>

            <Link to="/dashboard/jobs" className={styles.navItem}>
              <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect strokeLinecap="round" strokeLinejoin="round" x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              <span>Job Descriptions</span>
            </Link>

            <Link to="/dashboard/interviews" className={`${styles.navItem} ${styles.navItemActive}`}>
              <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line strokeLinecap="round" strokeLinejoin="round" x1="12" y1="19" x2="12" y2="23" />
                <line strokeLinecap="round" strokeLinejoin="round" x1="8" y1="23" x2="16" y2="23" />
              </svg>
              <span>Interviews</span>
            </Link>

            <div className={styles.navDivider} />

            <Link to="/dashboard" className={styles.navItem}>
              <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Settings</span>
            </Link>
          </nav>
        </div>

        <div className={styles.sidebarBottom}>
          {showProfileMenu && (
            <div className={styles.profileMenu}>
              <Link to="/dashboard" className={styles.profileMenuItem}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>View Profile</span>
              </Link>
              <button
                type="button"
                className={styles.profileMenuItem}
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Log out</span>
              </button>
            </div>
          )}

          <button
            type="button"
            className={styles.userProfile}
            onClick={() => setShowProfileMenu((prev) => !prev)}
            aria-expanded={showProfileMenu}
          >
            <div className={styles.userAvatar}>{displayInitial}</div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{displayName}</span>
              <span className={styles.userRole}>Candidate</span>
            </div>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className={styles.mainContent}>
        {/* TOP BAR */}
        <header className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <Link to="/dashboard/interviews" className={styles.backLink}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Back to Interviews</span>
            </Link>

            <div className={styles.titleRow}>
              <div className={styles.userHeaderBadge}>
                <span className={styles.userSmallAvatar}>{displayInitial}</span>
                <span>{displayName}</span>
              </div>
              <span className={styles.dividerDot}>•</span>
              <h1 className={styles.sessionMainTitle}>
                {jobTitle} – {companyName}
              </h1>
            </div>

            <div className={styles.metaPillsRow}>
              <span className={styles.pillBadge}>
                <CompanyLogo company={companyName} size={14} />
                <span>{companyName}</span>
              </span>
              <span className={styles.pillBadge}>
                <svg className={styles.pillBadgeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                <span>{jobTitle}</span>
              </span>
              <span className={styles.pillBadge}>
                <svg className={styles.pillBadgeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span>{resumeName}</span>
              </span>
            </div>
          </div>

          <div className={styles.topBarRight}>
            <div className={styles.progressGroup}>
              <div className={styles.progressLabelRow}>
                <span>Question {Math.min(currentTurn + 1, targetLoopCount)} of {targetLoopCount}</span>
              </div>
              <div className={styles.progressBarTrack}>
                <div
                  className={styles.progressBarFill}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className={styles.timerPill} title="Elapsed Interview Time">
              <svg className={styles.timerIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>{formatTime(elapsedSeconds)}</span>
            </div>
          </div>
        </header>

        {/* ERROR NOTIFICATION */}
        {errorMessage && (
          <div
            style={{
              padding: '10px 16px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              color: '#dc2626',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 2-COLUMN ROOM GRID */}
        <div className={styles.roomGrid}>
          {/* CENTER INTERVIEW CARD */}
          <section className={styles.centerCard}>
            <div className={styles.cardHeaderRow}>
              {/* Status Pill */}
              <div
                className={`${styles.statePill} ${
                  stage === 'candidate_speaking' ? styles.statePillActive : ''
                } ${stage === 'submitting_answer' ? styles.statePillSubmitting : ''}`}
              >
                {stage === 'ai_speaking' && (
                  <>
                    <span className={`${styles.statusDotPulse} ${styles.statusDotPulseAi}`} />
                    <span>AI Interviewer (Speaking...)</span>
                  </>
                )}
                {stage === 'candidate_speaking' && (
                  <>
                    <span className={styles.statusDotPulse} />
                    <span>{voiceRecorder.isRecording ? 'Listening... (Recording)' : 'Listening... (Your turn)'}</span>
                  </>
                )}
                {stage === 'submitting_answer' && (
                  <>
                    <span className={`${styles.statusDotPulse} ${styles.statusDotPulseSubmitting}`} />
                    <span>Analyzing your answer...</span>
                  </>
                )}
                {stage === 'turn_evaluated' && (
                  <>
                    <span className={styles.statusDotPulse} />
                    <span>Answer Evaluated</span>
                  </>
                )}
                {stage === 'streaming_question' && (
                  <>
                    <span className={`${styles.statusDotPulse} ${styles.statusDotPulseAi}`} />
                    <span>Formulating question...</span>
                  </>
                )}
                {stage === 'initializing' && (
                  <span>Ready to start</span>
                )}
                {stage === 'finishing' && (
                  <span>Generating Interview Report...</span>
                )}
              </div>

              {/* End Interview Header Button */}
              <button
                type="button"
                className={styles.endInterviewHeaderBtn}
                onClick={() => setShowEndModal(true)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
                <span>End Interview</span>
              </button>
            </div>

            {/* Visual Orb & Waveform (or Camera Preview if enabled) */}
            <div className={styles.visualContainer}>
              {cameraStream.isCameraOn ? (
                <div className={styles.cameraPreviewBox}>
                  <video
                    ref={cameraStream.videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={styles.cameraVideoElement}
                  />
                  <div className={styles.cameraLiveBadge}>
                    <span className={styles.cameraLiveDot} />
                    <span>Live Video</span>
                  </div>
                </div>
              ) : null}

              <div
                className={`${styles.orbBackdrop} ${
                  audioPlayer.isPlaying || voiceRecorder.isRecording ? styles.orbBackdropSpeaking : ''
                }`}
              >
                <div className={styles.waveformRow}>
                  {waveBars.map((bar, idx) => (
                    <span
                      key={idx}
                      className={`${styles.waveBar} ${bar.isIdle ? styles.waveBarIdle : ''}`}
                      style={{ height: `${bar.height}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Question Box */}
            <div className={styles.questionBox}>
              {!hasStartedSession ? (
                <>
                  <h2 className={styles.questionTitle}>
                    Welcome to your mock interview with Karyam
                  </h2>
                  <p className={styles.questionSubtitle}>
                    When you are ready, click below to begin your voice session.
                  </p>
                  <div style={{ marginTop: '20px' }}>
                    <button
                      type="button"
                      className={styles.recordAnswerBtn}
                      onClick={handleStartInterview}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      <span>Begin Interview</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className={styles.questionTitle}>
                    {currentQuestion || 'Thinking of next question...'}
                  </h2>
                  <p className={styles.questionSubtitle}>
                    {stage === 'ai_speaking' && 'Listen carefully to the interviewer...'}
                    {stage === 'candidate_speaking' && (voiceRecorder.isRecording ? 'Take your time. I\'m listening...' : 'Ready when you are. Click speak or use the mic below.')}
                    {stage === 'submitting_answer' && 'Evaluating answer quality and communication clarity...'}
                    {stage === 'turn_evaluated' && 'Feedback ready. Review below or proceed to next question.'}
                    {stage === 'streaming_question' && 'Generating question tailored to your resume and JD...'}
                  </p>
                </>
              )}
            </div>




            {/* Inline Turn Evaluation Result */}
            {stage === 'turn_evaluated' && latestRating && (
              <div className={styles.evalResultBox}>
                <div className={styles.evalResultHeader}>
                  <span className={styles.evalResultTitle}>Turn Feedback</span>
                  <span
                    className={`${styles.scoreBadge} ${
                      latestRating.score >= 7 ? styles.scoreBadgeGood : styles.scoreBadgeAverage
                    }`}
                  >
                    Score: {latestRating.score} / 10
                  </span>
                </div>
                <p className={styles.evalFeedbackText}>
                  {latestRating.feedback}
                </p>
                <div className={styles.nextTurnActionRow}>
                  {autoContinue && countdown !== null && (
                    <span className={styles.countdownBadge}>
                      Advancing to next question in {countdown}s...
                    </span>
                  )}
                  <button
                    type="button"
                    className={styles.nextTurnBtn}
                    onClick={handleNextQuestion}
                    style={{ marginLeft: 'auto' }}
                  >
                    <span>Next Question</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Card Bottom Bar */}
            <div className={styles.cardBottomBar}>
              <div className={styles.statusDotCol}>
                <span
                  className={`${styles.statusDotPulse} ${
                    stage === 'ai_speaking' ? styles.statusDotPulseAi : ''
                  } ${stage === 'submitting_answer' ? styles.statusDotPulseSubmitting : ''}`}
                />
                <span>
                  {stage === 'ai_speaking' && 'AI Speaking...'}
                  {stage === 'candidate_speaking' && 'Listening...'}
                  {stage === 'submitting_answer' && 'Evaluating...'}
                  {stage === 'turn_evaluated' && 'Ready for next question'}
                  {stage === 'streaming_question' && 'Formulating...'}
                  {stage === 'initializing' && 'Standby'}
                  {stage === 'finishing' && 'Wrapping up...'}
                </span>
              </div>

              {/* Turn Pagination Dots */}
              <div className={styles.turnDotsRow}>
                {Array.from({ length: targetLoopCount }, (_, idx) => {
                  const isActive = idx === currentTurn
                  const isCompleted = idx < currentTurn
                  return (
                    <span
                      key={idx}
                      className={`${styles.turnDot} ${isActive ? styles.turnDotActive : ''} ${
                        isCompleted ? styles.turnDotCompleted : ''
                      }`}
                      title={`Turn ${idx + 1}`}
                    />
                  )
                })}
              </div>

              {/* Auto Continue Switch */}
              <div className={styles.autoContinueSwitchGroup}>
                <span>Auto-continue</span>
                <div
                  className={`${styles.switchTrack} ${autoContinue ? styles.switchTrackActive : ''}`}
                  onClick={() => setAutoContinue((prev) => !prev)}
                  role="switch"
                  aria-checked={autoContinue}
                  tabIndex={0}
                >
                  <span
                    className={`${styles.switchThumb} ${autoContinue ? styles.switchThumbActive : ''}`}
                  />
                </div>
                <svg
                  className={styles.infoIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-label="Automatically advances to the next question after your answer is evaluated"
                >
                  <title>Auto-continue</title>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN */}
          <div className={styles.rightCol}>
            {/* Conversation Feed */}
            <div className={styles.sideCard}>
              <div className={styles.sideCardHeader}>
                <h3 className={styles.sideCardTitle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>Conversation</span>
                </h3>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {turnHistory.length} completed
                </span>
              </div>

              <div className={styles.conversationFeed}>
                {turnHistory.length === 0 && !currentQuestion && (
                  <p className={styles.conversationFeedEmpty}>
                    Turns will appear here in real-time as the interview progresses.
                  </p>
                )}

                {turnHistory.map((item, idx) => (
                  <React.Fragment key={idx}>
                    {/* AI Question */}
                    <div className={styles.chatMessage}>
                      <div className={styles.chatMessageHeader}>
                        <div className={styles.chatSenderRow}>
                          <span className={styles.chatAvatarAi}>AI</span>
                          <span className={styles.chatSenderName}>Interviewer</span>
                        </div>
                        <span className={styles.chatTimestamp}>Turn {item.turnIndex + 1}</span>
                      </div>
                      <p className={styles.chatText}>{item.question}</p>
                    </div>

                    {/* Candidate Answer */}
                    {item.transcript && (
                      <div className={styles.chatMessage}>
                        <div className={styles.chatMessageHeader}>
                          <div className={styles.chatSenderRow}>
                            <span className={styles.chatAvatarUser}>{displayInitial}</span>
                            <span className={styles.chatSenderName}>You</span>
                          </div>
                          {item.rating && (
                            <span
                              className={`${styles.scoreBadge} ${
                                item.rating.score >= 7 ? styles.scoreBadgeGood : styles.scoreBadgeAverage
                              }`}
                              style={{ padding: '2px 8px', fontSize: '11px' }}
                            >
                              {item.rating.score}/10
                            </span>
                          )}
                        </div>
                        <p className={`${styles.chatText} ${styles.chatTextUser}`}>
                          {item.transcript}
                        </p>
                      </div>
                    )}
                  </React.Fragment>
                ))}

                {/* Live turn in-progress if AI is speaking */}
                {currentQuestion && (
                  <div className={styles.chatMessage}>
                    <div className={styles.chatMessageHeader}>
                      <div className={styles.chatSenderRow}>
                        <span className={styles.chatAvatarAi}>AI</span>
                        <span className={styles.chatSenderName}>Interviewer</span>
                      </div>
                      <span className={styles.chatTimestamp}>Now</span>
                    </div>
                    <p className={styles.chatText} style={{ borderLeft: '3px solid #2563eb' }}>
                      {currentQuestion}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Tips Card */}
            <div className={styles.sideCard}>
              <div className={styles.sideCardHeader}>
                <h3 className={styles.sideCardTitle}>
                  <span>💡 Tips</span>
                </h3>
              </div>

              <ul className={styles.tipsList}>
                <li className={styles.tipItem}>
                  <span className={styles.tipBullet} />
                  <span>Structure your answer using the STAR method: Situation, Task, Action, Result.</span>
                </li>
                <li className={styles.tipItem}>
                  <span className={styles.tipBullet} />
                  <span>Speak clearly and pace yourself; take a brief pause to organize your thoughts before speaking.</span>
                </li>
                <li className={styles.tipItem}>
                  <span className={styles.tipBullet} />
                  <span>Tie your experiences back to the specific job requirements for {companyName}.</span>
                </li>
                <li className={styles.tipItem}>
                  <span className={styles.tipBullet} />
                  <span>Aim for 1–2 minutes per response for maximum clarity and depth.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* BOTTOM FIXED CONTROLS DOCK */}
        <div className={styles.bottomControlsDock}>
          {/* Mic Button — disabled when AI is speaking or submitting */}
          <button
            type="button"
            className={`${styles.circleControlBtn} ${
              voiceRecorder.isRecording ? styles.micBtnActive : ''
            }`}
            onClick={handleToggleMic}
            disabled={stage === 'ai_speaking' || stage === 'streaming_question' || stage === 'submitting_answer' || stage === 'finishing' || !hasStartedSession}
            title={
              voiceRecorder.isRecording
                ? `Stop & Submit (${formatTime(voiceRecorder.duration)})`
                : stage === 'candidate_speaking'
                ? 'Click to speak your answer'
                : 'Mic available when it is your turn'
            }
          >
            {voiceRecorder.isRecording ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            )}
          </button>

          {/* Recording status: live duration timer with recording pulse indicator */}
          {voiceRecorder.isRecording && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '9999px',
            }}>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                boxShadow: '0 0 8px rgba(239, 68, 68, 0.8)',
                display: 'inline-block',
                animation: 'pulse 1.5s infinite',
              }} />
              <span style={{
                fontSize: '12px',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: voiceRecorder.duration >= 270 ? '#dc2626' : '#1f2937',
                letterSpacing: '0.02em',
              }}>
                {formatTime(voiceRecorder.duration)}
              </span>
            </div>
          )}

          {/* End Call / Interview Button */}
          <button
            type="button"
            className={styles.endCallCircleBtn}
            onClick={() => setShowEndModal(true)}
            title="End Interview Early"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.8 19.8 0 0 1-3.11-8.69A2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" transform="rotate(135 12 12)" />
            </svg>
          </button>

          {/* Camera On/Off Toggle Button */}
          <button
            type="button"
            className={`${styles.circleControlBtn} ${cameraStream.isCameraOn ? styles.cameraBtnActive : ''}`}
            onClick={cameraStream.toggleCamera}
            title={cameraStream.isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
          >
            {cameraStream.isCameraOn ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M21 15.5V7l-5 3.5" />
                <path d="M16 16.5A2 2 0 0 1 14 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1.5" />
              </svg>
            )}
          </button>

          {/* Speaker Mute/Unmute Button */}
          <button
            type="button"
            className={styles.circleControlBtn}
            onClick={audioPlayer.toggleMute}
            title={audioPlayer.isMuted ? 'Unmute AI Voice' : 'Mute AI Voice'}
          >
            {audioPlayer.isMuted ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>

          {/* Show Transcript Button */}
          <button
            type="button"
            className={styles.transcriptDockBtn}
            onClick={() => setShowTranscriptModal(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span>Show Transcript</span>
          </button>
        </div>

        {/* END INTERVIEW CONFIRMATION MODAL */}
        {showEndModal && !isEndingSession && (
          <div className={styles.modalBackdrop}>
            <div className={styles.modalCard}>
              <h3 className={styles.modalTitle}>End Interview Session?</h3>
              <p className={styles.modalText}>
                Are you sure you want to end this interview? Your report and performance evaluation will be generated based on the questions completed so far ({turnHistory.length} completed).
              </p>
              <div className={styles.modalActionRow}>
                <button
                  type="button"
                  className={styles.modalBtnCancel}
                  onClick={() => setShowEndModal(false)}
                  disabled={isEndingSession}
                >
                  Continue Interview
                </button>
                <button
                  type="button"
                  className={styles.modalBtnDanger}
                  onClick={handleConfirmEndSession}
                  disabled={isEndingSession}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: isEndingSession ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isEndingSession ? (
                    <>
                      <svg
                        className={styles.spinnerIcon}
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                      <span>Ending & Generating Report...</span>
                    </>
                  ) : (
                    'End & View Report'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FULLSCREEN ENDING & REPORT GENERATION LOADER */}
        {(isEndingSession || stage === 'finishing') && (
          <div className={styles.endingOverlay} role="alert" aria-busy="true">
            <div className={styles.endingLoaderCard}>
              <div className={styles.endingSpinner}>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" stroke="#e2e8f0" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="#2563eb" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className={styles.endingTitle}>Ending Session & Generating Report...</h3>
              <p className={styles.endingSubtext}>
                We're synthesizing your interview answers, evaluating communication and technical accuracy, and building your comprehensive performance report.
              </p>
              <div className={styles.endingProgressTrack}>
                <div className={styles.endingProgressPulse} />
              </div>
            </div>
          </div>
        )}

        {/* TRANSCRIPT DRAWER / MODAL */}
        {showTranscriptModal && (
          <div className={styles.modalBackdrop}>
            <div className={styles.transcriptDrawer}>
              <div className={styles.transcriptDrawerHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#111113' }}>
                    Session Transcript
                  </h3>
                </div>
                <button
                  type="button"
                  className={styles.transcriptCloseBtn}
                  onClick={() => setShowTranscriptModal(false)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className={styles.transcriptDrawerBody}>
                {turnHistory.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#94a3b8', padding: '32px 0', fontSize: '14px' }}>
                    No turns completed yet. Responses will appear here once submitted.
                  </p>
                ) : (
                  turnHistory.map((item) => (
                    <div
                      key={item.turnIndex}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '12px 16px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb' }}>
                          Question {item.turnIndex + 1}
                        </span>
                        {item.rating && (
                          <span
                            className={`${styles.scoreBadge} ${
                              item.rating.score >= 7 ? styles.scoreBadgeGood : styles.scoreBadgeAverage
                            }`}
                            style={{ fontSize: '11px', padding: '2px 8px' }}
                          >
                            Score: {item.rating.score} / 10
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: 0 }}>
                        {item.question}
                      </p>
                      {item.transcript && (
                        <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '8px', marginTop: '4px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
                            Your Transcribed Answer:
                          </span>
                          <p style={{ fontSize: '13px', color: '#334155', margin: '4px 0 0 0' }}>
                            {item.transcript}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
