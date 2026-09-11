import React, { useState } from 'react'
import type { TurnHistoryItem } from '../../../shared/types/interview.types'
import styles from '../styles/interview.module.css'

interface TurnConversationHistoryProps {
  history: TurnHistoryItem[]
}

export const TurnConversationHistory: React.FC<TurnConversationHistoryProps> = ({ history }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true)

  if (history.length === 0) {
    return null
  }

  return (
    <div className={styles.historyContainer}>
      <div
        className={styles.historyHeader}
        onClick={() => setIsExpanded((prev) => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsExpanded((prev) => !prev)
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
            Interview History ({history.length} {history.length === 1 ? 'turn' : 'turns'} completed)
          </span>
        </div>
        <button type="button" className={styles.historyToggleBtn}>
          {isExpanded ? 'Hide History ▲' : 'Show History ▼'}
        </button>
      </div>

      {isExpanded && (
        <div className={styles.historyList}>
          {history.map((item) => (
            <div key={item.turnIndex} className={styles.historyItemCard}>
              <div className={styles.historyItemHeader}>
                <span className={styles.historyTurnBadge}>Turn {item.turnIndex + 1}</span>
                {item.rating && (
                  <span
                    className={styles.scoreBadge}
                    style={{
                      backgroundColor: item.rating.score >= 8 ? '#f0fdf4' : item.rating.score >= 5 ? '#eff6ff' : '#fef2f2',
                      borderColor: item.rating.score >= 8 ? '#bbf7d0' : item.rating.score >= 5 ? '#bfdbfe' : '#fecaca',
                      color: item.rating.score >= 8 ? '#166534' : item.rating.score >= 5 ? '#1e40af' : '#991b1b',
                    }}
                  >
                    Rating: {item.rating.score} / 10
                  </span>
                )}
              </div>

              {/* Question */}
              <div className={styles.historySection}>
                <span className={styles.historyRoleLabel}>Interviewer:</span>
                <p className={styles.historyText}>{item.question}</p>
              </div>

              {/* Candidate Answer */}
              {item.transcript && (
                <div className={styles.historySection} style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '8px' }}>
                  <span className={styles.historyRoleLabel} style={{ color: '#2563eb' }}>
                    Your Answer (Transcribed):
                  </span>
                  <p className={styles.historyText} style={{ color: '#1e293b', fontStyle: 'italic' }}>
                    &ldquo;{item.transcript}&rdquo;
                  </p>
                </div>
              )}

              {/* Turn Feedback */}
              {item.rating?.feedback && (
                <div className={styles.historyFeedbackBox}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                    Evaluation Note:
                  </span>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#334155' }}>
                    {item.rating.feedback}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
