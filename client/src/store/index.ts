import { configureStore } from '@reduxjs/toolkit'
import sessionSetupReducer from './slices/sessionSetupSlice'

export const store = configureStore({
  reducer: {
    sessionSetup: sessionSetupReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
