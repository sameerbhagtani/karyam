import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '@/shared/components/Logo/Logo'
import { useAuth } from '@/shared/context/useAuth'
import GoogleButton from '../components/GoogleButton'
import styles from '../styles/KodexAuth.module.css'

export default function SignupPage() {
  const navigate = useNavigate()
  const { signup } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!name.trim() || name.trim().length < 3) {
      setErrorMessage('Full name must be at least 3 characters long.')
      return
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.')
      return
    }

    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      await signup({
        name: name.trim(),
        email: email.trim(),
        password,
      })
      setSuccessMessage('Account created successfully! Redirecting...')
      setTimeout(() => {
        navigate('/prep', { replace: true })
      }, 1200)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.'
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
          src="/registerVideo.webm"
          className={styles.video}
        />

        <div className={styles.videoOverlay} />

        <div className={styles.videoContent}>
          <div className={styles.videoInner}>
            <h2 className={styles.videoHeading}>
              CRAFT.
              <br />
              PRACTICE.
              <br />
              GET HIRED.
            </h2>

            <p className={styles.videoSubtext}>
              Create your account and join thousands of ambitious candidates practicing with AI, polishing resumes, and landing dream roles.
            </p>

            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <p className={styles.statNumber}>30K+</p>
                <p className={styles.statLabel}>Active Job Seekers</p>
              </div>

              <div className={styles.statCard}>
                <p className={styles.statNumber}>98%</p>
                <p className={styles.statLabel}>ATS Resume Score</p>
              </div>

              <div className={styles.statCard}>
                <p className={styles.statNumber}>18+</p>
                <p className={styles.statLabel}>Top Tech Roles</p>
              </div>

              <div className={styles.statCard}>
                <p className={styles.statNumber}>100%</p>
                <p className={styles.statLabel}>Interview Ready</p>
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
              Create
              <br />
              Account.
            </h1>

            <p className={styles.subtitle}>
              Join Karyam and start practicing AI mock interviews to land your dream role.
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

          {successMessage && (
            <div className={styles.successBanner} role="status">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{successMessage}</span>
            </div>
          )}

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="signup-name">
                Full Name
              </label>
              <div className={styles.inputWrapper}>
                <input
                  id="signup-name"
                  type="text"
                  className={styles.input}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="signup-email">
                Email
              </label>
              <div className={styles.inputWrapper}>
                <input
                  id="signup-email"
                  type="email"
                  className={styles.input}
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
              <label className={styles.label} htmlFor="signup-password">
                Password
              </label>
              <div className={styles.inputWrapper}>
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  className={styles.input}
                  placeholder="Create a strong password (6+ chars)"
                  autoComplete="new-password"
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

            <div className={styles.field}>
              <label className={styles.label} htmlFor="signup-confirm-password">
                Confirm Password
              </label>
              <div className={styles.inputWrapper}>
                <input
                  id="signup-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  className={styles.input}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className={styles.divider}>
            <div className={styles.dividerLine} />
            <span className={styles.dividerText}>OR</span>
            <div className={styles.dividerLine} />
          </div>

          <GoogleButton />

          <p className={styles.switchText}>
            Already have an account?
            <Link to="/login" className={styles.switchLink}>
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
