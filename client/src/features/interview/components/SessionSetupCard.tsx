import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../../store/hooks'
import {
  setTargetLoopCount,
  setActiveSession,
  setActiveStep,
} from '../../../store/slices/sessionSetupSlice'
import { useCreateSessionMutation } from '../hooks/useInterviewQueries'
import { EmbeddingProgressCard } from './EmbeddingProgressCard'
import styles from '../styles/interview.module.css'

export const SessionSetupCard: React.FC = () => {
  const dispatch = useAppDispatch()
  const resume = useAppSelector((state) => state.sessionSetup.resume)
  const jd = useAppSelector((state) => state.sessionSetup.jobDescription)
  const targetLoopCount = useAppSelector((state) => state.sessionSetup.targetLoopCount)
  const activeSession = useAppSelector((state) => state.sessionSetup.session)

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const createSessionMutation = useCreateSessionMutation()

  const handleCreateSession = async () => {
    if (!resume) {
      setErrorMessage('Please upload a resume first.')
      dispatch(setActiveStep(1))
      return
    }
    if (!jd) {
      setErrorMessage('Please provide a job description first.')
      dispatch(setActiveStep(2))
      return
    }

    setErrorMessage(null)
    try {
      const res = await createSessionMutation.mutateAsync({
        resumeId: resume.resumeId,
        jdId: jd.jdId,
        targetLoopCount,
      })

      dispatch(
        setActiveSession({
          sessionId: res.sessionId,
          status: res.status,
          currentTurnIndex: 0,
          targetLoopCount,
        })
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize session'
      setErrorMessage(msg)
    }
  }

  // If a session has already been kicked off, show the live embedding progress card
  if (activeSession) {
    return <EmbeddingProgressCard sessionId={activeSession.sessionId} />
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>
          <span>⚙️</span>
          <span>Interview Configuration & Launch</span>
        </h2>
        <p className={styles.cardDescription}>
          Confirm your resume and target role pairing, set the desired interview depth, and generate your isolated Pinecone vector knowledge base.
        </p>
      </div>

      {errorMessage && (
        <div className={styles.alertError} role="alert">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Selected Pairings */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryBox}>
          <span className={styles.summaryLabel}>Candidate Resume</span>
          <span className={styles.summaryValue}>{resume?.originalFilename || 'Not selected'}</span>
        </div>

        <div className={styles.summaryBox}>
          <span className={styles.summaryLabel}>Target Role</span>
          <span className={styles.summaryValue}>
            {jd ? `${jd.title} at ${jd.company}` : 'Not selected'}
          </span>
        </div>
      </div>

      {/* Target Loop Count Slider */}
      <div className={styles.sliderContainer}>
        <div className={styles.sliderHeader}>
          <label htmlFor="loop-count-range" className={styles.label}>
            <span>Interview Length (Questions)</span>
            <span className={styles.sliderValueBadge}>
              {targetLoopCount} {targetLoopCount === 1 ? 'Question' : 'Questions'}
            </span>
          </label>
        </div>
        <input
          id="loop-count-range"
          type="range"
          min={1}
          max={10}
          step={1}
          value={targetLoopCount}
          onChange={(e) => dispatch(setTargetLoopCount(Number(e.target.value)))}
          className={styles.rangeInput}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#64748b',
          }}
        >
          <span>1 (Quick test)</span>
          <span>5 (Standard 15 min)</span>
          <span>10 (Full 40 min)</span>
        </div>
      </div>

      <div className={styles.buttonRow}>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={() => dispatch(setActiveStep(2))}
        >
          ← Back to JD
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={createSessionMutation.isPending || !resume || !jd}
          onClick={handleCreateSession}
        >
          <span>{createSessionMutation.isPending ? 'Initializing...' : '🚀 Create & Embed Session'}</span>
        </button>
      </div>
    </div>
  )
}
