import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { store } from './store'
import { AuthProvider } from './shared/context/AuthContext'
import NavbarGate from './shared/components/Navbar/NavbarGate'
import LandingPage from './features/landing/components/LandingPage'
import LoginPage from './features/auth/pages/LoginPage'
import SignupPage from './features/auth/pages/SignupPage'
import InterviewPrepPage from './features/interview/pages/InterviewPrepPage'
import SessionReportPage from './features/interview/pages/SessionReportPage'
import InterviewRoomPage from './features/interview/pages/InterviewRoomPage'
import './globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <NavbarGate />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/prep" element={<InterviewPrepPage />} />
              <Route path="/dashboard" element={<Navigate to="/prep" replace />} />
              <Route path="/sessions/:id" element={<InterviewPrepPage />} />
              <Route path="/sessions/:id/interview" element={<InterviewRoomPage />} />
              <Route path="/sessions/:id/report" element={<SessionReportPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </Provider>
  )
}
