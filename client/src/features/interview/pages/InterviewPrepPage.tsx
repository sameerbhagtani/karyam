import React, { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../../store/hooks'
import { setActiveSession, setActiveStep } from '../../../store/slices/sessionSetupSlice'
import { useInterviewSessionQuery } from '../hooks/useInterviewQueries'
import { StepIndicator } from '../components/StepIndicator'
import { ResumeUploadCard } from '../components/ResumeUploadCard'
import { JobDescriptionCard } from '../components/JobDescriptionCard'
import { SessionSetupCard } from '../components/SessionSetupCard'
import { SessionReportCard } from '../components/SessionReportCard'
import styles from '../styles/interview.module.css'

export const InterviewPrepPage: React.FC = () => {
  const { id: paramSessionId } = useParams<{ id?: string }>()
  const dispatch = useAppDispatch()
  const activeStep = useAppSelector((state) => state.sessionSetup.activeStep)
  const session = useAppSelector((state) => state.sessionSetup.session)

  const activeSessionId = paramSessionId || session?.sessionId
  const { data: fetchedSession } = useInterviewSessionQuery(activeSessionId, !!activeSessionId)

  useEffect(() => {
    if (fetchedSession && paramSessionId) {
      dispatch(
        setActiveSession({
          sessionId: fetchedSession.sessionId,
          status: fetchedSession.status,
          currentTurnIndex: fetchedSession.currentTurnIndex,
          targetLoopCount: fetchedSession.targetLoopCount,
        })
      )
      if (fetchedSession.status === 'completed') {
        dispatch(setActiveStep(4))
      } else {
        dispatch(setActiveStep(3))
      }
    }
  }, [fetchedSession, paramSessionId, dispatch])

  return (
    <main className={styles.pageContainer}>
      <div className={styles.contentWrapper}>
        {/* Header Block */}
        <header className={styles.headerBlock}>
          <div className={styles.titleRow}>
            <span className={styles.badge}>Voice Mock Interview Assistant</span>
            <h1 className={styles.pageTitle}>Interview Preparation Workspace</h1>
            <p className={styles.pageSubtitle}>
              Grounded mock interviews powered by your resume, target job description, Mistral embeddings, and Pinecone vector search.
            </p>
          </div>
        </header>

        {/* Step Indicator Navigation */}
        <StepIndicator />

        {/* Step Content */}
        {activeStep === 1 && <ResumeUploadCard />}
        {activeStep === 2 && <JobDescriptionCard />}
        {activeStep === 3 && <SessionSetupCard />}
        {activeStep === 4 && session && <SessionReportCard sessionId={session.sessionId} />}
        {activeStep === 4 && !session && (
          <div className={styles.card}>
            <p className={styles.cardDescription}>
              No session active yet. Please complete steps 1 to 3 to launch an interview and view your report.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}

export default InterviewPrepPage
