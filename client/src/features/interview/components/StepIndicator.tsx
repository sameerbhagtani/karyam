import React from 'react'
import { useAppDispatch, useAppSelector } from '../../../store/hooks'
import { setActiveStep } from '../../../store/slices/sessionSetupSlice'
import styles from '../styles/interview.module.css'

const STEPS = [
  { step: 1 as const, label: '1. Resume' },
  { step: 2 as const, label: '2. Job Description' },
  { step: 3 as const, label: '3. Setup & Launch' },
  { step: 4 as const, label: '4. Session Report' },
]

export const StepIndicator: React.FC = () => {
  const dispatch = useAppDispatch()
  const activeStep = useAppSelector((state) => state.sessionSetup.activeStep)
  const resume = useAppSelector((state) => state.sessionSetup.resume)
  const jd = useAppSelector((state) => state.sessionSetup.jobDescription)
  const session = useAppSelector((state) => state.sessionSetup.session)

  const isStepClickable = (step: 1 | 2 | 3 | 4): boolean => {
    if (step === 1) return true
    if (step === 2) return !!resume
    if (step === 3) return !!resume && !!jd
    if (step === 4) return !!session
    return false
  }

  const handleStepClick = (step: 1 | 2 | 3 | 4) => {
    if (isStepClickable(step)) {
      dispatch(setActiveStep(step))
    }
  }

  return (
    <nav aria-label="Preparation steps" className={styles.stepBar}>
      {STEPS.map(({ step, label }) => {
        const isActive = activeStep === step
        const isCompleted =
          (step === 1 && !!resume) ||
          (step === 2 && !!jd) ||
          (step === 3 && session?.status === 'ready')

        const clickable = isStepClickable(step)

        return (
          <button
            key={step}
            type="button"
            className={`${styles.stepItem} ${isActive ? styles.stepItemActive : ''} ${
              !isActive && isCompleted ? styles.stepItemCompleted : ''
            }`}
            onClick={() => handleStepClick(step)}
            disabled={!clickable}
            aria-current={isActive ? 'step' : undefined}
          >
            <span className={styles.stepNumber}>
              {isCompleted && !isActive ? '✓' : step}
            </span>
            <span className={styles.stepLabel}>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
