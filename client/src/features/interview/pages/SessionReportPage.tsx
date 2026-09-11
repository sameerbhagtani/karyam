import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { SessionReportCard } from '../components/SessionReportCard'
import styles from '../styles/interview.module.css'

export const SessionReportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()

  return (
    <main className={styles.pageContainer}>
      <div className={styles.contentWrapper}>
        <div style={{ marginBottom: '-8px' }}>
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
        </div>

        {id ? (
          <SessionReportCard sessionId={id} />
        ) : (
          <div className={styles.card}>
            <div className={styles.alertError}>No session ID provided in the URL.</div>
          </div>
        )}
      </div>
    </main>
  )
}

export default SessionReportPage
