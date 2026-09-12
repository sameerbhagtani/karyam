import React, { useState } from 'react'
import styles from './AuthVideoPanel.module.css'

export interface AuthVideoPanelProps {
  videoSrc?: string
  fallbackSrc?: string
  badge?: string
  headline?: string
  subtext?: string
  tag?: string
}

export const AuthVideoPanel: React.FC<AuthVideoPanelProps> = ({
  videoSrc = '/vdo.mp4',
  fallbackSrc = '/vdo.mp4',
  badge = 'KARYAM PLATFORM',
  headline = 'AI-driven career readiness & interview command.',
  subtext = 'Master mock interviews, craft ATS-ready resumes, and land verified job matches through AI coaching.',
  tag = 'SYSTEM OPERATIONAL',
}) => {
  const [currentSrc, setCurrentSrc] = useState(videoSrc)

  const handleVideoError = () => {
    if (currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc)
    }
  }

  return (
    <div className={styles.panel} aria-hidden="true">
      <div className={styles.videoContainer}>
        <video
          key={currentSrc}
          className={styles.video}
          src={currentSrc}
          autoPlay
          loop
          muted
          playsInline
          onError={handleVideoError}
        />
        <div className={styles.overlay} />
      </div>

      <div className={styles.content}>
        <div className={styles.badgeRow}>
          <span className={styles.badge}>{badge}</span>
          <span className={styles.statusDot}>
            <span className={styles.pulse} />
            {tag}
          </span>
        </div>

        <div className={styles.bottomBlock}>
          <h2 className={styles.headline}>{headline}</h2>
          <p className={styles.subtext}>{subtext}</p>

          <div className={styles.indicators}>
            <div className={styles.metric}>
              <span className={styles.metricVal}>99.98%</span>
              <span className={styles.metricLbl}>Uptime SLA</span>
            </div>
            <div className={styles.metricDivider} />
            <div className={styles.metric}>
              <span className={styles.metricVal}>&lt; 140ms</span>
              <span className={styles.metricLbl}>Trace Latency</span>
            </div>
            <div className={styles.metricDivider} />
            <div className={styles.metric}>
              <span className={styles.metricVal}>P1 to Zero</span>
              <span className={styles.metricLbl}>Incident Auto-routing</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthVideoPanel
