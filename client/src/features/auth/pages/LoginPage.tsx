import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import Logo from '@/shared/components/Logo/Logo'
import { useAuth } from '@/shared/context/useAuth'
import GoogleButton from '../components/GoogleButton'
import styles from '../styles/KodexAuth.module.css'

interface LocationState {
  from?: { pathname: string }
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const from = (location.state as LocationState)?.from?.pathname || '/prep'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.')
      return
    }

    if (!password) {
      setErrorMessage('Please enter your password.')
      return
    }

    setIsSubmitting(true)
    try {
      await login({ email: email.trim(), password })
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid email or password.'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.container}>
      {/* Left Side Video (from Kodex layout) */}
      <div className={styles.videoSide}>
        <video
          autoPlay
          muted
          loop
          playsInline
          src="/loginVideo.mp4"
          className={styles.video}
        />

        <div className={styles.videoOverlay} />

        <div className={styles.videoContent}>
          <div className={styles.videoInner}>
            <h2 className={styles.videoHeading}>
              PRACTICE.
              <br />
              INTERVIEW.
              <br />
              SUCCEED.
            </h2>

            <p className={styles.videoSubtext}>
              Master real-time AI mock interviews, optimize your resume for ATS filters, and land verified job offers with total confidence.
            </p>

            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <p className={styles.statNumber}>30K+</p>
                <p className={styles.statLabel}>Registered Candidates</p>
              </div>

              <div className={styles.statCard}>
                <p className={styles.statNumber}>15K+</p>
                <p className={styles.statLabel}>Mock Interviews</p>
              </div>

              <div className={styles.statCard}>
                <p className={styles.statNumber}>94%</p>
                <p className={styles.statLabel}>Placement Rate</p>
              </div>

              <div className={styles.statCard}>
                <p className={styles.statNumber}>100%</p>
                <p className={styles.statLabel}>AI Grounded</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side Form (Crisp White Background) */}
      <div className={styles.formSide}>
        <div className={styles.formContainer}>
          <div className={styles.header}>
            <div className={styles.brandRow}>
              <Link to="/" aria-label="Karyam home" className={styles.logoLink}>
                <Logo />
              </Link>
              <Link to="/" className={styles.backHome}>
                ← Back to site
              </Link>
            </div>

            <h1 className={styles.title}>
              Welcome
              <br />
              Back.
            </h1>

            <p className={styles.subtitle}>
              Sign in to continue your interview preparation and manage your career radar.
            </p>
          </div>

          {errorMessage && (
            <div className={styles.errorBanner} role="alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-email">
                Email
              </label>
              <div className={styles.inputWrapper}>
                <input
                  id="login-email"
                  type="email"
                  className={`${styles.input} ${errorMessage && !email ? styles.inputError : ''}`}
                  placeholder="Enter your email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label} htmlFor="login-password">
                  Password
                </label>
                <Link to="/forgot-password" className={styles.forgotLink}>
                  Forgot Password?
                </Link>
              </div>
              <div className={styles.inputWrapper}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`${styles.input} ${errorMessage && !password ? styles.inputError : ''}`}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  disabled={isSubmitting}
                  required
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className={styles.divider}>
            <div className={styles.dividerLine} />
            <span className={styles.dividerText}>OR</span>
            <div className={styles.dividerLine} />
          </div>

          <GoogleButton />

          <p className={styles.switchText}>
            Don't have an account?
            <Link to="/signup" className={styles.switchLink}>
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
