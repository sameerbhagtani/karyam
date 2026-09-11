import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch } from '../../../store/hooks'
import { updateSessionStatus } from '../../../store/slices/sessionSetupSlice'
import { useInterviewSessionQuery } from '../hooks/useInterviewQueries'
import styles from '../styles/interview.module.css'

interface EmbeddingProgressCardProps {
  sessionId: string
  onStartInterview?: () => void
}

export const EmbeddingProgressCard: React.FC<EmbeddingProgressCardProps> = ({
  sessionId,
  onStartInterview,
}) => {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { data: session, isLoading, isError, error } = useInterviewSessionQuery(sessionId)

  useEffect(() => {
    if (session?.status) {
      dispatch(updateSessionStatus(session.status))
    }
  }, [session?.status, dispatch])

  const status = session?.status || 'embedding'
  const isEmbedding = status === 'embedding'
  const isReady = status === 'ready'
  const isCompleted = status === 'completed'

  const handleLaunchInterview = () => {
    if (onStartInterview) {
      onStartInterview()
    } else {
      navigate(`/sessions/${sessionId}/interview`)
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <h2 className={styles.cardTitle}>
            <span>⚡</span>
            <span>RAG Vector Indexing Status</span>
          </h2>
          <span
            className={styles.badge}
            style={{
              backgroundColor: isReady ? '#f0fdf4' : isCompleted ? '#eff6ff' : '#fffbeb',
              borderColor: isReady ? '#bbf7d0' : isCompleted ? '#bfdbfe' : '#fde68a',
              color: isReady ? '#166534' : isCompleted ? '#1e40af' : '#b45309',
            }}
          >
            {isEmbedding ? 'Vectorizing...' : isReady ? 'Session Ready' : status.toUpperCase()}
          </span>
        </div>
        <p className={styles.cardDescription}>
          Session ID: <code style={{ fontSize: '12px', color: '#2563eb' }}>{sessionId}</code> • Pinecone Namespace Scoped
        </p>
      </div>

      {isError && (
        <div className={styles.alertError} role="alert">
          <span>⚠️</span>
          <span>{error instanceof Error ? error.message : 'Error polling session status'}</span>
        </div>
      )}

      {isLoading && !session ? (
        <div className={styles.progressItem}>
          <div className={styles.spinner} />
          <div className={styles.progressTextGroup}>
            <p className={styles.progressTitle}>Connecting to session orchestrator...</p>
          </div>
        </div>
      ) : (
        <div className={styles.progressList}>
          {/* Step 1: Text extraction */}
          <div className={`${styles.progressItem} ${styles.progressItemComplete}`}>
            <span className={styles.progressIcon} style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>
            <div className={styles.progressTextGroup}>
              <p className={styles.progressTitle}>Document Ingestion & Text Extraction</p>
              <p className={styles.progressDetail}>Resume and Job Description text extracted and verified.</p>
            </div>
          </div>

          {/* Step 2: LangChain Chunker */}
          <div className={`${styles.progressItem} ${styles.progressItemComplete}`}>
            <span className={styles.progressIcon} style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>
            <div className={styles.progressTextGroup}>
              <p className={styles.progressTitle}>LangChain Recursive Character Chunking</p>
              <p className={styles.progressDetail}>~500 token windowing with 50 token overlap.</p>
            </div>
          </div>

          {/* Step 3: Mistral Embeddings */}
          <div
            className={`${styles.progressItem} ${
              isReady || isCompleted ? styles.progressItemComplete : styles.progressItemActive
            }`}
          >
            {isReady || isCompleted ? (
              <span className={styles.progressIcon} style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>
            ) : (
              <div className={styles.spinner} />
            )}
            <div className={styles.progressTextGroup}>
              <p className={styles.progressTitle}>Mistral Embeddings (`mistral-embed`)</p>
              <p className={styles.progressDetail}>
                {isReady || isCompleted
                  ? 'High-dimensional embeddings generated across all chunks.'
                  : 'Synthesizing contextual embeddings with Mistral AI...'}
              </p>
            </div>
          </div>

          {/* Step 4: Pinecone Upsert */}
          <div
            className={`${styles.progressItem} ${
              isReady || isCompleted ? styles.progressItemComplete : styles.progressItemActive
            }`}
          >
            {isReady || isCompleted ? (
              <span className={styles.progressIcon} style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>
            ) : (
              <div className={styles.spinner} />
            )}
            <div className={styles.progressTextGroup}>
              <p className={styles.progressTitle}>Pinecone Vector Indexing</p>
              <p className={styles.progressDetail}>
                {isReady || isCompleted
                  ? `Vectors indexed in isolated namespace '${sessionId}'.`
                  : 'Upserting vectors with source metadata into Pinecone index...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {isReady && (
        <div className={styles.alertSuccess}>
          <span>✓</span>
          <span>
            Knowledge base ready! The AI interviewer is grounded in your resume projects and job criteria.
          </span>
        </div>
      )}

      <div className={styles.buttonRow}>
        {isReady && (
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleLaunchInterview}
          >
            <span>🎙️ Begin Mock Interview</span>
            <span>→</span>
          </button>
        )}

        {isCompleted && (
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => navigate(`/sessions/${sessionId}/report`)}
          >
            <span>📊 View Final Report</span>
            <span>→</span>
          </button>
        )}
      </div>
    </div>
  )
}
