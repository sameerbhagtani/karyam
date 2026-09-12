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
import KaryamDashboard from './features/dashboard/KaryamDashboard'
import SessionReportPage from './features/interview/pages/SessionReportPage'
import { InterviewRoomPage } from './features/interview/pages/InterviewRoomPage'
import JdWorkspacePage from './features/dashboard/components/JdWorkspacePage'
import ProtectedRoute from './shared/components/Auth/ProtectedRoute'
import PublicOnlyRoute from './shared/components/Auth/PublicOnlyRoute'
import PWAInstallPrompt from './shared/components/PWAInstallPrompt'
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
            <PWAInstallPrompt />
            <Routes>
              <Route path="/" element={<LandingPage />} />

              {/* Public only: logged-in users cannot access login/signup */}
              <Route element={<PublicOnlyRoute />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
              </Route>

              {/* Protected: guests cannot access prep, dashboard, and interview rooms without login */}
              <Route element={<ProtectedRoute />}>
                <Route path="/prep" element={<KaryamDashboard view="home" />} />
                <Route path="/dashboard" element={<KaryamDashboard view="home" />} />
                <Route path="/dashboard/resumes" element={<KaryamDashboard view="resumes" />} />
                <Route path="/resumes" element={<KaryamDashboard view="resumes" />} />
                <Route path="/dashboard/jds" element={<KaryamDashboard view="jds" />} />
                <Route path="/job-descriptions" element={<KaryamDashboard view="jds" />} />
                <Route path="/dashboard/job-hunt" element={<KaryamDashboard view="job-hunt" />} />
                <Route path="/job-hunt" element={<KaryamDashboard view="job-hunt" />} />
                <Route path="/dashboard/interviews" element={<KaryamDashboard view="interviews" />} />
                <Route path="/interviews" element={<KaryamDashboard view="interviews" />} />
                <Route path="/dashboard/settings" element={<KaryamDashboard view="settings" />} />
                <Route path="/settings" element={<KaryamDashboard view="settings" />} />
                <Route path="/jds/:id" element={<JdWorkspacePage />} />
                <Route path="/sessions/:id" element={<InterviewPrepPage />} />
                <Route path="/sessions/:id/interview" element={<InterviewRoomPage />} />
                <Route path="/sessions/:id/report" element={<SessionReportPage />} />
                <Route path="/interviews/:id/report" element={<SessionReportPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </Provider>
  )
}
