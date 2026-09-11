import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { InterviewSessionStatus } from '../../shared/types/interview.types'

export interface SelectedResume {
  resumeId: string
  originalFilename: string
  status?: string
}

export interface SelectedJobDescription {
  jdId: string
  title: string
  company: string
  sourceType: 'upload' | 'pasted_text'
}

export interface ActiveSession {
  sessionId: string
  status: InterviewSessionStatus
  currentTurnIndex: number
  targetLoopCount: number
}

export interface SessionSetupState {
  activeStep: 1 | 2 | 3 | 4
  resume: SelectedResume | null
  jobDescription: SelectedJobDescription | null
  targetLoopCount: number
  session: ActiveSession | null
}

const initialState: SessionSetupState = {
  activeStep: 1,
  resume: null,
  jobDescription: null,
  targetLoopCount: 7,
  session: null,
}

export const sessionSetupSlice = createSlice({
  name: 'sessionSetup',
  initialState,
  reducers: {
    setActiveStep: (state, action: PayloadAction<1 | 2 | 3 | 4>) => {
      state.activeStep = action.payload
    },
    setResume: (state, action: PayloadAction<SelectedResume>) => {
      state.resume = action.payload
    },
    clearResume: (state) => {
      state.resume = null
    },
    setJobDescription: (state, action: PayloadAction<SelectedJobDescription>) => {
      state.jobDescription = action.payload
    },
    clearJobDescription: (state) => {
      state.jobDescription = null
    },
    setTargetLoopCount: (state, action: PayloadAction<number>) => {
      const val = Math.max(1, Math.min(10, action.payload))
      state.targetLoopCount = val
    },
    setActiveSession: (state, action: PayloadAction<ActiveSession>) => {
      state.session = action.payload
    },
    updateSessionStatus: (state, action: PayloadAction<InterviewSessionStatus>) => {
      if (state.session) {
        state.session.status = action.payload
      }
    },
    resetSetup: (state) => {
      state.activeStep = 1
      state.resume = null
      state.jobDescription = null
      state.targetLoopCount = 7
      state.session = null
    },
  },
})

export const {
  setActiveStep,
  setResume,
  clearResume,
  setJobDescription,
  clearJobDescription,
  setTargetLoopCount,
  setActiveSession,
  updateSessionStatus,
  resetSetup,
} = sessionSetupSlice.actions

export default sessionSetupSlice.reducer
