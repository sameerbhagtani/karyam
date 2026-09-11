import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { interviewApi } from '../../../shared/api/interview.api'
import { useInterviewSessionQuery } from '../hooks/useInterviewQueries'
import { useAudioQueuePlayer } from '../hooks/useAudioQueuePlayer'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import { AiVoiceVisualizer } from '../components/AiVoiceVisualizer'
import { MicrophoneVisualizer } from '../components/MicrophoneVisualizer'
import { TurnConversationHistory } from '../components/TurnConversationHistory'
import type {
  InterviewStage,
  TurnHistoryItem,
  TurnRating,
} from '../../../shared/types/interview.types'
import styles from '../styles/interview.module.css'

export const InterviewRoomPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const sessionId = id || ''

  const { data: session, isLoading: isSessionLoading } = useInterviewSessionQuery(sessionId)

  const [stage, setStage] = useState<InterviewStage>('initializing')
  const [currentTurn, setCurrentTurn] = useState<number>(0)
  const [targetLoopCount, setTargetLoopCount] = useState<number>(7)
  const [currentQuestion, setCurrentQuestion] = useState<string>('')
  const [isSseActive, setIsSseActive] = useState<boolean>(false)
  const [hasStartedSession, setHasStartedSession] = useState<boolean>(false)
  const [latestRating, setLatestRating] = useState<TurnRating | null>(null)
  const [latestTranscript, setLatestTranscript] = useState<string>('')
  const [turnHistory, setTurnHistory] = useState<TurnHistoryItem[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [autoAdvanceTimer, setAutoAdvanceTimer] = useState<number | null>(null)

  const streamCleanupRef = useRef<(() => void) | null>(null)
  const isComponentMounted = useRef<boolean>(true)

  // Audio queue player handles streaming chunks from Sarvam TTS
  const handlePlaybackFinished = useCallback(() => {
    if (!isComponentMounted.current) return
    setStage('candidate_speaking')
  }, [])

  const audioPlayer = useAudioQueuePlayer({
    onAllPlaybackEnded: handlePlaybackFinished,
  })

  // Voice recorder handles candidate microphone input
  const voiceRecorder = useVoiceRecorder()

  // Clean up SSE and audio on unmount
  useEffect(() => {
    isComponentMounted.current = true
    return () => {
      isComponentMounted.current = false
      if (streamCleanupRef.current) {
        streamCleanupRef.current()
        streamCleanupRef.current = null
      }
      audioPlayer.stopAll()
      voiceRecorder.cancelRecording()
    }
  }, [])

  // Sync initial target loop count from session
  useEffect(() => {
    if (session?.targetLoopCount) {
      setTargetLoopCount(session.targetLoopCount)
    }
    if (session?.currentTurnIndex !== undefined) {
      setCurrentTurn(session.currentTurnIndex)
    }
    if (session?.status === 'completed') {
      navigate(`/sessions/${sessionId}/report`)
    }
  }, [session, sessionId, navigate])

  // Stream question via SSE (either initial turn or next turn)
  const startTurnStream = useCallback(
    (isInitial: boolean) => {
      if (!sessionId) return

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

  // Start the interview session when candidate enters
  const handleStartInterview = useCallback(() => {
    setHasStartedSession(true)
    const isInitial = (session?.currentTurnIndex || 0) === 0
    startTurnStream(isInitial)
  }, [session?.currentTurnIndex, startTurnStream])

  // Submit candidate spoken answer
  const handleSubmitCandidateAnswer = async () => {
    try {
      const audioBlob = await voiceRecorder.stopRecording()
      if (!audioBlob || audioBlob.size === 0) {
        setErrorMessage('No voice audio detected. Please record your answer before submitting.')
        return
      }

      setStage('submitting_answer')
      setErrorMessage(null)

      const result = await interviewApi.submitTurnAnswer(sessionId, currentTurn, audioBlob)

      setLatestTranscript(result.transcript)
      setLatestRating(result.rating)

      // Record to history
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

      // Check if session loop completed
      if (result.sessionComplete || currentTurn + 1 >= targetLoopCount) {
        setStage('finishing')
        try {
          await interviewApi.endInterviewSession(sessionId)
        } catch {
          // If already ended or network error, proceed to report
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

  // Advance to the next question
  const handleNextQuestion = () => {
    if (autoAdvanceTimer) {
      clearInterval(autoAdvanceTimer)
      setAutoAdvanceTimer(null)
    }
    startTurnStream(false)
  }

  // End interview session early
  const handleEndSessionEarly = async () => {
    const confirm = window.confirm(
      'Are you sure you want to end this interview session early? Your report will be generated based on the turns completed so far.'
    )
    if (!confirm) return

    setStage('finishing')
    audioPlayer.stopAll()
    voiceRecorder.cancelRecording()

    try {
      await interviewApi.endInterviewSession(sessionId)
    } catch {
      // Proceed even if ended
    }
    navigate(`/sessions/${sessionId}/report`)
  }

  if (isSessionLoading && !session) {
    return (
      <main className={styles.pageContainer}>
        <div className={styles.contentWrapper}>
          <div className={styles.card}>
            <div className={styles.progressItem}>
              <div className={styles.spinner} />
              <div className={styles.progressTextGroup}>
                <p className={styles.progressTitle}>Loading interview room...</p>
                <p className={styles.progressDetail}>Connecting to audio session and loading candidate profile.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.pageContainer}>
      <div className={styles.contentWrapper}>
        {/* Navigation & Header Status Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <Link
            to="/prep"
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#2563eb',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            ← Back to Preparation Hub
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={audioPlayer.toggleMute}
              className={styles.btnSecondary}
              style={{ padding: '4px 10px', height: '28px', fontSize: '12px' }}
              title={audioPlayer.isMuted ? 'Unmute AI Voice' : 'Mute AI Voice'}
            >
              {audioPlayer.isMuted ? '🔇 Audio Muted' : '🔊 Sound On'}
            </button>
            <span
              className={styles.badge}
              style={{
                backgroundColor: '#f0fdf4',
                borderColor: '#bbf7d0',
                color: '#166534',
              }}
            >
              Voice Session Active
            </span>
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className={styles.alertError} style={{ width: '100%' }}>
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Pre-Session Start Banner */}
        {!hasStartedSession && (
          <div className={styles.card} style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            </div>
            <h2 className={styles.cardTitle} style={{ marginBottom: '8px' }}>
              Welcome to Your Mock Interview
            </h2>
            <p className={styles.cardDescription} style={{ maxWidth: '540px', margin: '0 auto 24px' }}>
              Your resume and job description have been indexed. The interviewer will ask personalized questions out loud, listen to your spoken answers, and provide real-time ratings.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleStartInterview}
                style={{ height: '48px', padding: '0 28px', fontSize: '15px' }}
              >
                🎙️ Begin Interview Session
              </button>
            </div>
          </div>
        )}

        {/* Live Interview Session View */}
        {hasStartedSession && (
          <>
            {/* Top Session Status Card */}
            <div className={styles.card} style={{ padding: '16px 20px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: '#2563eb',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Question {Math.min(currentTurn + 1, targetLoopCount)} of {targetLoopCount}
                  </span>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
                    {stage === 'streaming_question' && 'Generating and synthesizing question...'}
                    {stage === 'ai_speaking' && 'AI Interviewer is speaking question...'}
                    {stage === 'candidate_speaking' && 'Your turn: Speak your response.'}
                    {stage === 'submitting_answer' && 'Analyzing answer with Sarvam STT & Mistral...'}
                    {stage === 'turn_evaluated' && 'Answer evaluated. Ready for next question.'}
                    {stage === 'finishing' && 'Completing session and generating report...'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleEndSessionEarly}
                  style={{
                    background: 'none',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  End Interview Early
                </button>
              </div>
            </div>

            {/* AI Interviewer Audio Visualizer */}
            <AiVoiceVisualizer
              isSpeaking={audioPlayer.isPlaying}
              audioLevel={audioPlayer.audioLevel}
              currentSubtitle={audioPlayer.currentSubtitle}
              spokenSentences={audioPlayer.spokenSentences}
              questionText={currentQuestion}
              isStreaming={isSseActive}
            />

            {/* Candidate Voice Input & Recording Area */}
            {(stage === 'candidate_speaking' ||
              stage === 'submitting_answer' ||
              stage === 'turn_evaluated') && (
              <MicrophoneVisualizer
                isRecording={voiceRecorder.isRecording}
                duration={voiceRecorder.duration}
                volume={voiceRecorder.micVolume}
                isSubmitting={stage === 'submitting_answer'}
                onStartRecording={voiceRecorder.startRecording}
                onStopAndSubmit={handleSubmitCandidateAnswer}
                onCancelRecording={voiceRecorder.cancelRecording}
                permissionError={voiceRecorder.permissionError}
              />
            )}

            {/* Turn Evaluated Feedback Card & Next Question Trigger */}
            {stage === 'turn_evaluated' && latestRating && (
              <div
                className={styles.card}
                style={{
                  backgroundColor: '#ffffff',
                  borderColor: '#bfdbfe',
                  borderWidth: '1.5px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e40af' }}>
                    Turn Evaluation Result
                  </span>
                  <span
                    className={styles.scoreBadge}
                    style={{
                      backgroundColor: latestRating.score >= 8 ? '#f0fdf4' : latestRating.score >= 5 ? '#eff6ff' : '#fef2f2',
                      borderColor: latestRating.score >= 8 ? '#bbf7d0' : latestRating.score >= 5 ? '#bfdbfe' : '#fecaca',
                      color: latestRating.score >= 8 ? '#166534' : latestRating.score >= 5 ? '#1e40af' : '#991b1b',
                      fontSize: '13px',
                      padding: '3px 10px',
                    }}
                  >
                    Score: {latestRating.score} / 10
                  </span>
                </div>

                {latestTranscript && (
                  <div style={{ fontSize: '13px', color: '#334155', fontStyle: 'italic' }}>
                    &ldquo;{latestTranscript}&rdquo;
                  </div>
                )}

                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    fontSize: '13px',
                    color: '#0f172a',
                    lineHeight: '1.4',
                  }}
                >
                  <strong style={{ color: '#2563eb' }}>Feedback: </strong>
                  {latestRating.feedback}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={handleNextQuestion}
                    style={{ height: '42px', padding: '0 20px' }}
                  >
                    Next Question →
                  </button>
                </div>
              </div>
            )}

            {/* Conversation History */}
            <TurnConversationHistory history={turnHistory} />
          </>
        )}
      </div>
    </main>
  )
}

export default InterviewRoomPage
