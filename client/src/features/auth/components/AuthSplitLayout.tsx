import React from 'react'
import styles from './AuthSplitLayout.module.css'

export interface AuthSplitLayoutProps {
  videoSide: 'left' | 'right'
  videoPanel: React.ReactNode
  children: React.ReactNode
}

export const AuthSplitLayout: React.FC<AuthSplitLayoutProps> = ({
  videoSide,
  videoPanel,
  children,
}) => {
  return (
    <div className={`${styles.container} ${videoSide === 'right' ? styles.videoRight : styles.videoLeft}`}>
      <main className={styles.inner}>
        <div className={styles.videoSlot}>
          {videoPanel}
        </div>
        <div className={styles.formSlot}>
          {children}
        </div>
      </main>
    </div>
  )
}

export default AuthSplitLayout
