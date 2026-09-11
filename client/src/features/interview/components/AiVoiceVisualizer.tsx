import React from 'react'
import styles from '../styles/interview.module.css'

interface AiVoiceVisualizerProps {
  isSpeaking: boolean
  audioLevel: number // 0 to 1
  currentSubtitle?: string
  spokenSentences?: string[]
  questionText?: string
  isStreaming: boolean
  interviewerTitle?: string
}

export const AiVoiceVisualizer: React.FC<AiVoiceVisualizerProps> = ({
  isSpeaking,
  audioLevel,
  currentSubtitle = '',
  spokenSentences = [],
  questionText = '',
  isStreaming,
  interviewerTitle = 'AI Technical Interviewer',
}) => {
  // Height multipliers for 5 waveform bars
  const barHeights = [
    Math.max(6, Math.round(audioLevel * 32 * 0.7)),
    Math.max(8, Math.round(audioLevel * 48 * 1.0)),
    Math.max(10, Math.round(audioLevel * 56 * 1.2)),
    Math.max(8, Math.round(audioLevel * 44 * 0.9)),
    Math.max(6, Math.round(audioLevel * 28 * 0.6)),
  ]

  const hasSpokenSentences = spokenSentences.length > 0
  const hasQuestionText = Boolean(questionText && questionText.trim())

  return (
    <div className={styles.interviewerContainer}>
      <div className={styles.interviewerAvatarWrap}>
        <div
          className={`${styles.interviewerAvatar} ${isSpeaking ? styles.avatarSpeaking : ''}`}
          aria-label="AI Interviewer"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        </div>

        {/* Real-time wave bars */}
        <div className={styles.waveBarGroup}>
          {barHeights.map((h, i) => (
            <span
              key={i}
              className={styles.waveBar}
              style={{
                height: isSpeaking ? `${h}px` : '4px',
                backgroundColor: isSpeaking ? '#2563eb' : '#cbd5e1',
                transition: 'height 120ms ease-in-out',
              }}
            />
          ))}
        </div>
      </div>

      <div className={styles.interviewerMeta}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={styles.interviewerName}>{interviewerTitle}</span>
          {isSpeaking && (
            <span className={styles.statusPillActive}>
              <span className={styles.statusDotLive} /> Speaking
            </span>
          )}
          {isStreaming && !isSpeaking && (
            <span className={styles.statusPillNeutral}>
              <span className={styles.spinnerTiny} /> Formulating Question...
            </span>
          )}
          {!isSpeaking && !isStreaming && (hasSpokenSentences || hasQuestionText) && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#2563eb',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                padding: '2px 8px',
                borderRadius: '12px',
              }}
            >
              Question Ready
            </span>
          )}
        </div>

        {hasSpokenSentences ? (
          <div className={styles.liveSubtitleBox}>
            <p className={styles.liveSubtitle}>
              &ldquo;
              {spokenSentences.map((sentence, idx) => {
                const isActive =
                  isSpeaking &&
                  Boolean(currentSubtitle) &&
                  sentence.trim().toLowerCase() === currentSubtitle.trim().toLowerCase()

                return (
                  <span
                    key={idx}
                    className={isActive ? styles.activeSubtitleSentence : styles.spokenSubtitleSentence}
                  >
                    {sentence}{idx < spokenSentences.length - 1 ? ' ' : ''}
                  </span>
                )
              })}
              &rdquo;
            </p>
          </div>
        ) : hasQuestionText ? (
          <div className={styles.liveSubtitleBox}>
            <p className={styles.liveSubtitle}>
              &ldquo;{questionText}&rdquo;
            </p>
          </div>
        ) : (
          <p className={styles.liveSubtitlePlaceholder}>
            {isStreaming
              ? 'Listening to candidate context and formulating question...'
              : 'Waiting for interview question...'}
          </p>
        )}
      </div>
    </div>
  )
}
