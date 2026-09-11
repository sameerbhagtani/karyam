import React from 'react'
import styles from '../styles/interview.module.css'

interface MicrophoneVisualizerProps {
  isRecording: boolean
  duration: number
  volume: number // 0 to 1
  isSubmitting: boolean
  onStartRecording: () => void
  onStopAndSubmit: () => void
  onCancelRecording: () => void
  permissionError: string | null
}

export const MicrophoneVisualizer: React.FC<MicrophoneVisualizerProps> = ({
  isRecording,
  duration,
  volume,
  isSubmitting,
  onStartRecording,
  onStopAndSubmit,
  onCancelRecording,
  permissionError,
}) => {
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60)
    const s = sec % 60
    return `${mins}:${s < 10 ? '0' : ''}${s}`
  }

  // 8 visualizer bars driven by volume
  const numBars = 8
  const barHeights = Array.from({ length: numBars }, (_, i) => {
    if (!isRecording) return 4
    const waveFactor = 0.5 + 0.5 * Math.sin((i / numBars) * Math.PI)
    return Math.max(4, Math.round(volume * 40 * waveFactor + Math.random() * 6))
  })

  return (
    <div className={styles.micCard}>
      {permissionError && (
        <div className={styles.alertError} style={{ width: '100%', marginBottom: '12px' }}>
          <span>⚠️</span>
          <span>{permissionError}</span>
        </div>
      )}

      {!isRecording && !isSubmitting && (
        <div className={styles.micPromptBox}>
          <div className={styles.micInactiveIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </div>
          <div className={styles.micPromptContent}>
            <p className={styles.micPromptTitle}>Ready for your response</p>
            <p className={styles.micPromptDesc}>
              Click the microphone button to begin speaking your answer. Answer concisely as you would in a real interview.
            </p>
          </div>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={onStartRecording}
            style={{ minWidth: '160px', height: '44px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
            Start Speaking
          </button>
        </div>
      )}

      {isRecording && (
        <div className={styles.micActiveBox}>
          <div className={styles.micActiveHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={styles.statusDotLive} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#dc2626' }}>
                Recording Answer
              </span>
            </div>
            <span className={styles.recordingTimer}>{formatTime(duration)}</span>
          </div>

          {/* Volume meter bars */}
          <div className={styles.volumeMeterRow}>
            {barHeights.map((h, i) => (
              <span
                key={i}
                className={styles.volumeBar}
                style={{
                  height: `${h}px`,
                  backgroundColor: volume > 0.1 ? '#2563eb' : '#94a3b8',
                }}
              />
            ))}
          </div>

          <p className={styles.micHint}>
            Speak clearly into your microphone. Click &ldquo;Submit Answer&rdquo; when you finish.
          </p>

          <div className={styles.buttonRow} style={{ marginTop: '8px' }}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onCancelRecording}
              style={{ flex: 1, minWidth: '120px' }}
            >
              Cancel &amp; Re-record
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={onStopAndSubmit}
              style={{ flex: 2, minWidth: '160px', backgroundColor: '#1d4ed8' }}
            >
              ✓ Submit Answer
            </button>
          </div>
        </div>
      )}

      {isSubmitting && (
        <div className={styles.micActiveBox} style={{ alignItems: 'center', textAlign: 'center', padding: '24px 16px' }}>
          <div className={styles.spinner} style={{ width: '32px', height: '32px', marginBottom: '12px' }} />
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
            Transcribing and evaluating your spoken response...
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            Sarvam STT is transcribing speech, and Mistral is formulating structured rating and feedback.
          </p>
        </div>
      )}
    </div>
  )
}
