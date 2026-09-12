import React, { useState, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '@/shared/components/Logo/Logo'
import { useAuth } from '@/shared/context/useAuth'
import { CompanyLogo } from '@/shared/components/Icons/CompanyLogo'
import { FileBadge } from '@/shared/components/Icons/FileBadge'
import {
  useUserResumesQuery,
  useUserJobDescriptionsQuery,
  useUserSessionsQuery,
  useUploadResumeMutation,
  useCreateJobDescriptionMutation,
  useCreateSessionMutation,
  useDeleteResumeMutation,
  useDeleteJobDescriptionMutation,
} from '@/features/interview/hooks/useInterviewQueries'
import JobHuntView from '@/features/jobHunt/components/JobHuntView'
import { ResumeViewModal } from './components/ResumeViewModal'
import type { ResumeDetails } from '@/shared/types/interview.types'
import styles from './KaryamDashboard.module.css'

export type NavTab = 'home' | 'resumes' | 'jds' | 'job-hunt' | 'interviews' | 'settings'

interface KaryamDashboardProps {
  view?: NavTab
}

export const KaryamDashboard: React.FC<KaryamDashboardProps> = ({ view = 'home' }) => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  // Real data queries
  const { data: userResumes, refetch: refetchResumes } = useUserResumesQuery()
  const { data: userJds, refetch: refetchJds } = useUserJobDescriptionsQuery()
  const { data: userSessionsData } = useUserSessionsQuery()

  // Mutations
  const uploadResumeMutation = useUploadResumeMutation()
  const createJdMutation = useCreateJobDescriptionMutation()
  const createSessionMutation = useCreateSessionMutation()
  const deleteResumeMutation = useDeleteResumeMutation()
  const deleteJdMutation = useDeleteJobDescriptionMutation()

  // Resumes Page States (Mockup 1)
  const [resumeSearch, setResumeSearch] = useState('')
  const [resumeSort, setResumeSort] = useState<'newest' | 'oldest' | 'name'>('newest')
  const [activeResumeMenuId, setActiveResumeMenuId] = useState<string | null>(null)
  const [resumeUploadError, setResumeUploadError] = useState<string | null>(null)
  const [viewingResume, setViewingResume] = useState<ResumeDetails | null>(null)
  const resumeFileInputRef = useRef<HTMLInputElement | null>(null)

  // Job Descriptions Page States (Mockup 2)
  const [jdSearch, setJdSearch] = useState('')
  const [jdSort, setJdSort] = useState<'newest' | 'oldest' | 'company'>('newest')
  const [activeJdMenuId, setActiveJdMenuId] = useState<string | null>(null)
  const [showCreateJdSection, setShowCreateJdSection] = useState(false)
  const [jdMode, setJdMode] = useState<'text' | 'file'>('text')
  const [jdTitle, setJdTitle] = useState('')
  const [jdCompany, setJdCompany] = useState('')
  const [jdText, setJdText] = useState('')
  const [jdFile, setJdFile] = useState<File | null>(null)
  const [jdError, setJdError] = useState<string | null>(null)
  const jdFileInputRef = useRef<HTMLInputElement | null>(null)

  // Interviews Page States (Mockup 3)
  const [selectedJdId, setSelectedJdId] = useState<string | null>(null)
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null)
  const [isJdDropdownOpen, setIsJdDropdownOpen] = useState(false)
  const [isResumeDropdownOpen, setIsResumeDropdownOpen] = useState(false)
  const [isStartingInterview, setIsStartingInterview] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)

  const displayName = user?.name ? user.name.split(' ')[0] : 'Bhavya'
  const displayInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'B'

  // Navigation handlers
  const handleNavClick = (tab: NavTab) => {
    switch (tab) {
      case 'home':
        navigate('/dashboard')
        break
      case 'resumes':
        navigate('/dashboard/resumes')
        break
      case 'jds':
        navigate('/dashboard/jds')
        break
      case 'job-hunt':
        navigate('/dashboard/job-hunt')
        break
      case 'interviews':
        navigate('/dashboard/interviews')
        break
      case 'settings':
        navigate('/dashboard/settings')
        break
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch {
      navigate('/login')
    }
  }

  // Helper: Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '842 KB'
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Helper: Format date nicely (e.g. 10 Sep 2026)
  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Recent'
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return 'Recent'
    }
  }

  // Filtered and sorted resumes
  const filteredResumes = useMemo(() => {
    const list = [...(userResumes?.resumes || [])]
    const query = resumeSearch.toLowerCase().trim()
    const filtered = query
      ? list.filter((r) => r.originalFilename.toLowerCase().includes(query))
      : list

    if (resumeSort === 'newest') {
      return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    if (resumeSort === 'oldest') {
      return filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }
    if (resumeSort === 'name') {
      return filtered.sort((a, b) => a.originalFilename.localeCompare(b.originalFilename))
    }
    return filtered
  }, [userResumes?.resumes, resumeSearch, resumeSort])

  // Filtered and sorted JDs
  const filteredJds = useMemo(() => {
    const list = [...(userJds?.jobDescriptions || [])]
    const query = jdSearch.toLowerCase().trim()
    const filtered = query
      ? list.filter(
          (j) =>
            j.title.toLowerCase().includes(query) ||
            j.company.toLowerCase().includes(query) ||
            (j.rawText && j.rawText.toLowerCase().includes(query))
        )
      : list

    if (jdSort === 'newest') {
      return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    if (jdSort === 'oldest') {
      return filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }
    if (jdSort === 'company') {
      return filtered.sort((a, b) => a.company.localeCompare(b.company))
    }
    return filtered
  }, [userJds?.jobDescriptions, jdSearch, jdSort])

  // Resolve selected JD & Resume for Interview page
  const selectedJd = useMemo(() => {
    if (!userJds?.jobDescriptions || userJds.jobDescriptions.length === 0) return null
    if (selectedJdId) {
      return userJds.jobDescriptions.find((j) => j.jdId === selectedJdId) || userJds.jobDescriptions[0]
    }
    return userJds.latest || userJds.jobDescriptions[0]
  }, [userJds, selectedJdId])

  const selectedResume = useMemo(() => {
    if (!userResumes?.resumes || userResumes.resumes.length === 0) return null
    if (selectedResumeId) {
      return userResumes.resumes.find((r) => r.resumeId === selectedResumeId) || userResumes.resumes[0]
    }
    return userResumes.latest || userResumes.resumes[0]
  }, [userResumes, selectedResumeId])

  // Resume upload handlers
  const handleResumeFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return
    const file = e.target.files[0]
    setResumeUploadError(null)

    const validExtensions = ['.pdf', '.docx']
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
    if (!hasValidExt) {
      setResumeUploadError('Please upload a PDF (.pdf) or Word document (.docx).')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setResumeUploadError('File size exceeds 10MB limit.')
      return
    }

    try {
      await uploadResumeMutation.mutateAsync(file)
      refetchResumes()
    } catch (err: unknown) {
      setResumeUploadError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  // Resume deletion handler
  const handleDeleteResume = async (resumeId: string) => {
    if (!window.confirm('Are you sure you want to remove this resume from your library?')) return
    try {
      await deleteResumeMutation.mutateAsync(resumeId)
      setActiveResumeMenuId(null)
      refetchResumes()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete resume')
    }
  }

  // JD creation handler
  const handleCreateJdSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setJdError(null)

    if (!jdTitle.trim() || !jdCompany.trim()) {
      setJdError('Please enter both a job title and company name.')
      return
    }

    try {
      if (jdMode === 'text') {
        if (!jdText.trim()) {
          setJdError('Please paste the job description text.')
          return
        }
        await createJdMutation.mutateAsync({
          type: 'text',
          data: {
            title: jdTitle.trim(),
            company: jdCompany.trim(),
            rawText: jdText.trim(),
          },
        })
      } else {
        if (!jdFile) {
          setJdError('Please select a PDF or DOCX job description file.')
          return
        }
        await createJdMutation.mutateAsync({
          type: 'file',
          title: jdTitle.trim(),
          company: jdCompany.trim(),
          file: jdFile,
        })
      }

      setJdTitle('')
      setJdCompany('')
      setJdText('')
      setJdFile(null)
      setShowCreateJdSection(false)
      refetchJds()
    } catch (err: unknown) {
      setJdError(err instanceof Error ? err.message : 'Failed to create job description.')
    }
  }

  // JD deletion handler
  const handleDeleteJd = async (jdId: string) => {
    if (!window.confirm('Are you sure you want to delete this job description?')) return
    try {
      await deleteJdMutation.mutateAsync(jdId)
      setActiveJdMenuId(null)
      refetchJds()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete job description')
    }
  }

  // Launch interview session with selected JD + Resume
  const handleStartMockInterview = async () => {
    if (!selectedJd) {
      setSessionError('Please select a job description.')
      return
    }
    if (!selectedResume) {
      setSessionError('Please select a resume.')
      return
    }

    try {
      setIsStartingInterview(true)
      setSessionError(null)
      const session = await createSessionMutation.mutateAsync({
        jdId: selectedJd.jdId,
        resumeId: selectedResume.resumeId,
        targetLoopCount: 7,
      })
      navigate(`/sessions/${session.sessionId}/interview`)
    } catch (err: unknown) {
      setIsStartingInterview(false)
      setSessionError(err instanceof Error ? err.message : 'Failed to create interview session.')
    }
  }

  // Helper for JD category badge
  const getCategoryFromTitle = (title: string): string => {
    const t = title.toLowerCase()
    if (t.includes('front')) return 'Frontend'
    if (t.includes('back')) return 'Backend'
    if (t.includes('ml') || t.includes('machine') || t.includes('ai')) return 'Machine Learning'
    if (t.includes('data')) return 'Data Science'
    if (t.includes('product')) return 'Product Management'
    if (t.includes('devops') || t.includes('cloud')) return 'Cloud & DevOps'
    if (t.includes('design') || t.includes('ui') || t.includes('ux')) return 'Product Design'
    return 'Software Engineering'
  }

  return (
    <div className={styles.dashboardShell}>
      {/* LEFT SIDEBAR */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <Link to="/" className={styles.logoLink} title="Karyam Home">
            <Logo />
          </Link>

          <nav className={styles.nav} aria-label="Dashboard Navigation">
            <button
              type="button"
              className={`${styles.navItem} ${view === 'home' ? styles.navItemActive : ''}`}
              onClick={() => handleNavClick('home')}
            >
              <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>Home</span>
            </button>

            <button
              type="button"
              className={`${styles.navItem} ${view === 'resumes' ? styles.navItemActive : ''}`}
              onClick={() => handleNavClick('resumes')}
            >
              <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>My Resumes</span>
            </button>

            <button
              type="button"
              className={`${styles.navItem} ${view === 'jds' ? styles.navItemActive : ''}`}
              onClick={() => handleNavClick('jds')}
            >
              <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              <span>Job Descriptions</span>
            </button>

            <button
              type="button"
              className={`${styles.navItem} ${view === 'job-hunt' ? styles.navItemActive : ''}`}
              onClick={() => handleNavClick('job-hunt')}
            >
              <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
              <span>Job Hunt</span>
            </button>

            <button
              type="button"
              className={`${styles.navItem} ${view === 'interviews' ? styles.navItemActive : ''}`}
              onClick={() => handleNavClick('interviews')}
            >
              <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>Interviews</span>
            </button>

            <div className={styles.navDivider} />

            <button
              type="button"
              className={`${styles.navItem} ${view === 'settings' ? styles.navItemActive : ''}`}
              onClick={() => handleNavClick('settings')}
            >
              <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Settings</span>
            </button>
          </nav>
        </div>

        <div className={styles.sidebarBottom}>
          <div className={styles.brandCard}>
            <div className={styles.brandDeco} aria-hidden="true" />
            <p className={styles.brandText}>
              Better Conversations.
              <br />
              Brighter Careers.
            </p>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className={styles.mainContent}>
        {/* TOP BAR */}
        <header className={styles.topBar}>
          <div className={styles.topBarActions}>
            <button type="button" className={styles.notifBtn} aria-label="Notifications" title="Notifications">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </button>

            <button
              type="button"
              className={styles.profileButton}
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              aria-label="User profile menu"
              aria-expanded={showProfileMenu}
            >
              <div className={styles.avatar}>{displayInitial}</div>
              <span className={styles.userName}>{displayName}</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className={styles.dropdownIcon}
                style={{ transform: showProfileMenu ? 'rotate(180deg)' : 'none' }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showProfileMenu && (
              <div className={styles.dropdownMenu}>
                <div className={styles.dropdownEmail}>{user?.email || 'user@karyam.ai'}</div>
                <button
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => {
                    setShowProfileMenu(false)
                    navigate('/dashboard/settings')
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  Account Settings
                </button>
                <button type="button" className={styles.dropdownItem} onClick={handleLogout}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ==================================================================
            1. HOME VIEW
           ================================================================== */}
        {view === 'home' && (
          <>
            <section className={styles.heroSection}>
              <div className={styles.heroLeft}>
                <p className={styles.eyebrow}>Good to see you again,</p>
                <h1 className={styles.headline}>
                  Ready for your
                  <br />
                  next opportunity?
                </h1>
                <p className={styles.subtext}>Practice with AI. Get real feedback. Be interview ready.</p>
              </div>

              <div className={styles.quoteCard}>
                <div className={styles.quoteDeco} aria-hidden="true" />
                <div className={styles.quoteDecoInner} aria-hidden="true" />
                <p className={styles.quoteText}>
                  Progress today
                  <br />
                  leads to opportunities
                  <br />
                  tomorrow.
                </p>
                <div className={styles.quoteDash} aria-hidden="true" />
              </div>
            </section>

            {/* QUICK ACTIONS */}
            <section className={styles.actionGrid} aria-label="Quick Actions">
              <div
                className={styles.actionCard}
                onClick={() => navigate('/dashboard/resumes')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate('/dashboard/resumes')}
              >
                <div className={styles.actionCardLeft}>
                  <div className={styles.actionIconCircle}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </div>
                  <div className={styles.actionCardInfo}>
                    <h3 className={styles.actionCardTitle}>My Resumes</h3>
                    <p className={styles.actionCardDesc}>
                      {userResumes?.latest ? (
                        <>Current: {userResumes.latest.originalFilename}</>
                      ) : (
                        <>
                          Upload and organize your
                          <br />
                          career resume versions.
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className={styles.actionArrowCircle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </div>
              </div>

              <div
                className={`${styles.actionCard} ${styles.actionCardJd}`}
                onClick={() => navigate('/dashboard/jds')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate('/dashboard/jds')}
              >
                <div className={styles.actionCardLeft}>
                  <div className={`${styles.actionIconCircle} ${styles.actionIconCircleJd}`}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                  </div>
                  <div className={styles.actionCardInfo}>
                    <h3 className={styles.actionCardTitle}>Job Descriptions</h3>
                    <p className={styles.actionCardDesc}>
                      {userJds?.latest ? (
                        <>
                          {userJds.latest.title} ({userJds.latest.company})
                          <br />
                          ATS Analysis & Workspaces →
                        </>
                      ) : (
                        <>
                          Manage target roles and
                          <br />
                          prepare for applications.
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className={styles.actionArrowCircle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </div>
              </div>
            </section>

            {/* PRIMARY DARK CARD */}
            <section className={styles.primaryDarkCard} aria-label="AI Mock Interview">
              <svg className={styles.waveSvg} viewBox="0 0 500 180" fill="none" aria-hidden="true">
                <path d="M0 90 C 120 40, 220 140, 360 80 C 420 50, 470 120, 520 90" stroke="#ffffff" strokeWidth="1.4" strokeOpacity="0.45" />
                <path d="M0 110 C 130 60, 240 160, 370 100 C 430 70, 480 140, 520 110" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.3" />
                <path d="M0 70 C 110 20, 200 120, 350 60 C 410 30, 460 100, 520 70" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.2" />
              </svg>

              <div className={styles.primaryDarkLeft}>
                <span className={styles.primaryEyebrow}>AI MOCK INTERVIEW</span>
                <h2 className={styles.primaryTitle}>
                  Start a personalized
                  <br />
                  mock interview
                </h2>
                <p className={styles.primaryDesc}>
                  Select your target job description and resume to begin a realistic voice simulation.
                </p>
              </div>

              <button
                type="button"
                className={styles.primaryStartBtn}
                onClick={() => navigate('/dashboard/interviews')}
              >
                <span>Start Interview</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </section>

            {/* RECENT ACTIVITY */}
            {userSessionsData?.sessions && userSessionsData.sessions.length > 0 && (
              <section className={styles.recentSection} aria-label="Recent Activity">
                <div className={styles.recentHeader}>
                  <h2 className={styles.recentTitle}>Previous Interviews</h2>
                  <button
                    type="button"
                    className={styles.viewAllLink}
                    onClick={() => navigate('/dashboard/interviews')}
                  >
                    <span>View all</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </button>
                </div>

                {userSessionsData.sessions.slice(0, 3).map((sess) => (
                  <div key={sess.sessionId} className={styles.activityCard}>
                    <div className={styles.activityLeft}>
                      <CompanyLogo company={sess.jd?.company || 'Job'} size={40} />
                      <div className={styles.activityInfo}>
                        <h4 className={styles.activityTitle}>
                          {sess.jd?.title || 'Role'} – {sess.jd?.company || 'Company'}
                        </h4>
                        <p className={styles.activityMeta}>
                          Completed on {formatDate(sess.completedAt || sess.createdAt)} · {sess.targetLoopCount || 7} questions
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={styles.reportPillBtn}
                      onClick={() => navigate(`/sessions/${sess.sessionId}/report`)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                      <span>View Report</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>
                ))}
              </section>
            )}
          </>
        )}

        {/* ==================================================================
            2. RESUMES PAGE (MOCKUP 1: media_1789144492098.png)
           ================================================================== */}
        {view === 'resumes' && (
          <div>
            {/* Top Row: Title + [ + Upload Resume ] */}
            <div className={styles.headerTopRow}>
              <div className={styles.headerTitles}>
                <p className={styles.pageEyebrow}>RESUMES</p>
                <h1 className={styles.pageTitle} style={{ fontSize: '32px' }}>
                  Your resumes,
                  <br />
                  ready when you are.
                </h1>
                <p className={styles.pageSubtitle}>
                  Upload, manage and use your resumes for ATS analysis and mock interviews.
                </p>
              </div>

              <div>
                <input
                  ref={resumeFileInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  style={{ display: 'none' }}
                  onChange={handleResumeFileSelect}
                />
                <button
                  type="button"
                  className={styles.bluePillBtn}
                  onClick={() => resumeFileInputRef.current?.click()}
                  disabled={uploadResumeMutation.isPending}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>{uploadResumeMutation.isPending ? 'Uploading...' : 'Upload Resume'}</span>
                </button>
              </div>
            </div>

            {/* Optional Drag-and-drop feedback / error */}
            {resumeUploadError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 18px', borderRadius: '12px', fontSize: '13.5px', marginBottom: '20px' }}>
                {resumeUploadError}
              </div>
            )}

            {/* KEEP IMPROVING BANNER CARD */}
            <section className={styles.keepImprovingBanner} aria-label="Resume Guidance">
              <div className={styles.keepImprovingLeft}>
                <div className={styles.keepImprovingIconWrap}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <div className={styles.keepImprovingText}>
                  <span className={styles.keepImprovingEyebrow}>KEEP IMPROVING</span>
                  <h3 className={styles.keepImprovingTitle}>
                    A well-tailored resume can open the right doors.
                  </h3>
                  <p className={styles.keepImprovingDesc}>
                    Upload different versions and see what works best for each opportunity.
                  </p>
                </div>
              </div>

              <div className={styles.keepImprovingCursive} aria-hidden="true">
                Small
                <br />
                Changes
                <br />
                Big Opportunities
              </div>
            </section>

            {/* SECTION: ALL RESUMES + SEARCH & SORT */}
            <div className={styles.allResumesHeaderRow}>
              <h2 className={styles.sectionHeading}>All Resumes</h2>

              <div className={styles.filterActionsRow}>
                <div className={styles.searchPillInputWrap}>
                  <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    className={styles.searchPillInput}
                    placeholder="Search resumes..."
                    value={resumeSearch}
                    onChange={(e) => setResumeSearch(e.target.value)}
                  />
                </div>

                <select
                  className={styles.sortSelectPill}
                  value={resumeSort}
                  onChange={(e) => setResumeSort(e.target.value as any)}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="name">Sort by name</option>
                </select>
              </div>
            </div>

            {/* RESUMES LIST */}
            {filteredResumes.length === 0 ? (
              <div className={styles.emptyStateNotice}>
                {resumeSearch ? 'No resumes match your search filter.' : 'No resumes uploaded yet. Click "+ Upload Resume" above to add your first document.'}
              </div>
            ) : (
              <div className={styles.resumeListStack}>
                {filteredResumes.map((resume, idx) => {
                  const isLatest = idx === 0 && !resumeSearch
                  return (
                    <div key={resume.resumeId} className={styles.resumeCard}>
                      <div className={styles.resumeCardLeft}>
                        <FileBadge filename={resume.originalFilename} mimeType={resume.mimeType} size={42} />

                        <div className={styles.resumeCardInfo}>
                          <div className={styles.resumeCardTitleRow}>
                            <h4 className={styles.resumeCardTitle}>{resume.originalFilename}</h4>
                            {isLatest && <span className={styles.latestPill}>Latest</span>}
                          </div>
                          <p className={styles.resumeCardMeta}>
                            Uploaded on {formatDate(resume.createdAt)} · {formatFileSize(resume.fileSize)}
                          </p>
                        </div>
                      </div>

                      <div className={styles.resumeCardRight}>
                        <button
                          type="button"
                          className={styles.viewBtnPill}
                          onClick={() => {
                            setViewingResume(resume)
                          }}
                          title="View and export resume PDF"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          <span>View</span>
                        </button>

                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            className={styles.actionMenuTrigger}
                            onClick={() =>
                              setActiveResumeMenuId(activeResumeMenuId === resume.resumeId ? null : resume.resumeId)
                            }
                            aria-label="More options"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <circle cx="12" cy="12" r="1" />
                              <circle cx="19" cy="12" r="1" />
                              <circle cx="5" cy="12" r="1" />
                            </svg>
                          </button>

                          {activeResumeMenuId === resume.resumeId && (
                            <div className={styles.actionMenuDropdown}>
                              <button
                                type="button"
                                className={styles.actionMenuItem}
                                onClick={() => {
                                  setSelectedResumeId(resume.resumeId)
                                  setActiveResumeMenuId(null)
                                  navigate('/dashboard/interviews')
                                }}
                              >
                                Practice Interview
                              </button>
                              <button
                                type="button"
                                className={`${styles.actionMenuItem} ${styles.actionMenuItemDanger}`}
                                onClick={() => handleDeleteResume(resume.resumeId)}
                              >
                                Delete Resume
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================
            3. JOB DESCRIPTIONS PAGE (MOCKUP 2: media_1789144496618.png)
           ================================================================== */}
        {view === 'jds' && (
          <div>
            {/* Top Row: Title + [ + Add Job Description ] */}
            <div className={styles.headerTopRow}>
              <div className={styles.headerTitles}>
                <p className={styles.pageEyebrow}>JOB DESCRIPTIONS</p>
                <h1 className={styles.pageTitle} style={{ fontSize: '32px' }}>
                  Turn opportunities
                  <br />
                  into preparation.
                </h1>
                <p className={styles.pageSubtitle}>
                  Add and manage job descriptions to get personalized analysis and mock interviews.
                </p>
              </div>

              <button
                type="button"
                className={styles.bluePillBtn}
                onClick={() => setShowCreateJdSection(!showCreateJdSection)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>{showCreateJdSection ? 'Close Form' : 'Add Job Description'}</span>
              </button>
            </div>

            {/* INLINE CREATE JD FORM (WHEN TOGGLED) */}
            {showCreateJdSection && (
              <section className={styles.pageCard} style={{ border: '1.5px solid #2563eb', marginBottom: '28px' }}>
                <h3 className={styles.pageCardTitle}>Add New Target Job Description</h3>
                <form onSubmit={handleCreateJdSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Job Title *</label>
                      <input
                        type="text"
                        className={styles.formInput}
                        placeholder="e.g. Software Engineer"
                        value={jdTitle}
                        onChange={(e) => setJdTitle(e.target.value)}
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Company Name *</label>
                      <input
                        type="text"
                        className={styles.formInput}
                        placeholder="e.g. Google"
                        value={jdCompany}
                        onChange={(e) => setJdCompany(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Mode switch */}
                  <div className={styles.tabSwitchRow}>
                    <button
                      type="button"
                      className={`${styles.tabSwitchBtn} ${jdMode === 'text' ? styles.tabSwitchBtnActive : ''}`}
                      onClick={() => setJdMode('text')}
                    >
                      Paste Text
                    </button>
                    <button
                      type="button"
                      className={`${styles.tabSwitchBtn} ${jdMode === 'file' ? styles.tabSwitchBtnActive : ''}`}
                      onClick={() => setJdMode('file')}
                    >
                      Upload File (PDF/DOCX)
                    </button>
                  </div>

                  {jdMode === 'text' ? (
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Job Description Content *</label>
                      <textarea
                        className={styles.formTextarea}
                        placeholder="Paste the full job posting, requirements, and responsibilities here..."
                        value={jdText}
                        onChange={(e) => setJdText(e.target.value)}
                        rows={6}
                      />
                    </div>
                  ) : (
                    <div
                      className={styles.fileDropZone}
                      onClick={() => jdFileInputRef.current?.click()}
                    >
                      <input
                        ref={jdFileInputRef}
                        type="file"
                        accept=".pdf,.docx"
                        style={{ display: 'none' }}
                        onChange={(e) => e.target.files && setJdFile(e.target.files[0])}
                      />
                      <div style={{ fontSize: '28px', marginBottom: '8px' }}>📄</div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>
                        {jdFile ? jdFile.name : 'Click to select JD Document (PDF / DOCX)'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#71717a', marginTop: '4px' }}>
                        Max file size: 10MB
                      </div>
                    </div>
                  )}

                  {jdError && (
                    <div style={{ color: '#dc2626', fontSize: '13.5px' }}>{jdError}</div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      className={styles.btnSecondaryPill}
                      onClick={() => setShowCreateJdSection(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={styles.btnBlackPill}
                      disabled={createJdMutation.isPending}
                    >
                      {createJdMutation.isPending ? 'Saving...' : 'Save Job Description'}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* SEARCH & SORT ROW */}
            <div className={styles.jdSearchBarRow}>
              <div className={styles.jdSearchInputWrap}>
                <svg className={styles.searchIcon} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className={styles.jdSearchInput}
                  placeholder="Search job descriptions..."
                  value={jdSearch}
                  onChange={(e) => setJdSearch(e.target.value)}
                />
              </div>

              <select
                className={styles.sortSelectPill}
                value={jdSort}
                onChange={(e) => setJdSort(e.target.value as any)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="company">Company (A-Z)</option>
              </select>
            </div>

            {/* JOB DESCRIPTIONS CARDS LIST (Mockup 2) */}
            {filteredJds.length === 0 ? (
              <div className={styles.emptyStateNotice}>
                {jdSearch ? 'No job descriptions match your search.' : 'No job descriptions added yet. Click "+ Add Job Description" above to create your first career target.'}
              </div>
            ) : (
              <div className={styles.jdCardsStack}>
                {filteredJds.map((jd) => {
                  const words = jd.wordCount || (jd.rawText ? jd.rawText.trim().split(/\s+/).filter(Boolean).length : 1245)
                  const category = jd.category || getCategoryFromTitle(jd.title)
                  const location = jd.location || (jd.company.toLowerCase().includes('google') ? 'Bengaluru, India' : jd.company.toLowerCase().includes('microsoft') ? 'Hyderabad, India' : 'Remote')

                  return (
                    <div key={jd.jdId} className={styles.jdCardItem}>
                      <div className={styles.jdCardLeft}>
                        <CompanyLogo company={jd.company} size={46} />

                        <div className={styles.jdCardInfo}>
                          <h3 className={styles.jdCardTitle}>{jd.title}</h3>
                          <div className={styles.jdCardCompany}>{jd.company}</div>

                          <div className={styles.jdMetaChipsRow}>
                            <span className={styles.jdMetaChip}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                              </svg>
                              Added on {formatDate(jd.createdAt)}
                            </span>

                            <span className={styles.jdMetaChip}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                              {words.toLocaleString()} words
                            </span>

                            <span className={styles.jdMetaChip}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                              </svg>
                              {jd.employmentType || 'Full-time'}
                            </span>

                            <span className={styles.jdMetaChip}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                              </svg>
                              {location}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.jdCardRight}>
                        <span className={styles.jdCategoryBadge}>{category}</span>

                        <div className={styles.jdCardActions}>
                          <div style={{ position: 'relative' }}>
                            <button
                              type="button"
                              className={styles.actionMenuTrigger}
                              onClick={() =>
                                setActiveJdMenuId(activeJdMenuId === jd.jdId ? null : jd.jdId)
                              }
                              aria-label="More options"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="19" cy="12" r="1" />
                                <circle cx="5" cy="12" r="1" />
                              </svg>
                            </button>

                            {activeJdMenuId === jd.jdId && (
                              <div className={styles.actionMenuDropdown}>
                                <button
                                  type="button"
                                  className={styles.actionMenuItem}
                                  onClick={() => {
                                    setSelectedJdId(jd.jdId)
                                    setActiveJdMenuId(null)
                                    navigate('/dashboard/interviews')
                                  }}
                                >
                                  Mock Interview
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.actionMenuItem} ${styles.actionMenuItemDanger}`}
                                  onClick={() => handleDeleteJd(jd.jdId)}
                                >
                                  Delete JD
                                </button>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            className={styles.viewDetailsBtn}
                            onClick={() => navigate(`/jds/${jd.jdId}`)}
                          >
                            <span>View Details</span>
                            <span aria-hidden="true">→</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================
            JOB HUNT PAGE
           ================================================================== */}
        {view === 'job-hunt' && <JobHuntView />}

        {/* ==================================================================
            4. INTERVIEWS PAGE (MOCKUP 3: media_1789144500135.png)
           ================================================================== */}
        {view === 'interviews' && (
          <div>
            {/* Header */}
            <div className={styles.headerTitles} style={{ marginBottom: '28px' }}>
              <p className={styles.pageEyebrow}>INTERVIEW</p>
              <h1 className={styles.pageTitle} style={{ fontSize: '32px' }}>
                Practice. Improve. Get Hired.
              </h1>
              <p className={styles.pageSubtitle}>
                Select a job description and a resume to start your personalized mock interview.
              </p>
            </div>

            {/* TWO-COLUMN SETUP SECTION */}
            <section className={styles.interviewSetupGrid}>
              {/* Left Column: Interactive Setup Card */}
              <div className={styles.interviewSetupCard}>
                {/* STEP 1: SELECT JOB DESCRIPTION */}
                <div className={styles.stepBlock}>
                  <div className={styles.stepTopRow}>
                    <div className={styles.stepLeftGroup}>
                      <div className={styles.stepNumberBadge}>1</div>
                      <div className={styles.stepTitles}>
                        <h3 className={styles.stepMainTitle}>Select Job Description</h3>
                        <p className={styles.stepDesc}>Choose a job description you've added.</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={styles.stepActionLink}
                      onClick={() => navigate('/dashboard/jds')}
                    >
                      + Add New JD
                    </button>
                  </div>

                  {/* Custom JD Selector */}
                  <div
                    className={`${styles.customSelectBox} ${isJdDropdownOpen ? styles.customSelectBoxActive : ''}`}
                    onClick={() => {
                      setIsJdDropdownOpen(!isJdDropdownOpen)
                      setIsResumeDropdownOpen(false)
                    }}
                  >
                    <div className={styles.selectContentLeft}>
                      {selectedJd ? (
                        <>
                          <CompanyLogo company={selectedJd.company} size={32} />
                          <div className={styles.selectTextGroup}>
                            <div className={styles.selectTitle}>{selectedJd.title}</div>
                            <div className={styles.selectMeta}>
                              {selectedJd.company} · Added on {formatDate(selectedJd.createdAt)}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div style={{ color: '#71717a', fontSize: '14px' }}>
                          No job descriptions found. Add a JD first.
                        </div>
                      )}
                    </div>

                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      style={{
                        transform: isJdDropdownOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 150ms ease',
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>

                    {/* JD Dropdown Menu */}
                    {isJdDropdownOpen && userJds?.jobDescriptions && userJds.jobDescriptions.length > 0 && (
                      <div className={styles.selectDropdownMenu} onClick={(e) => e.stopPropagation()}>
                        {userJds.jobDescriptions.map((j) => (
                          <div
                            key={j.jdId}
                            className={`${styles.selectOptionItem} ${selectedJd?.jdId === j.jdId ? styles.selectOptionSelected : ''}`}
                            onClick={() => {
                              setSelectedJdId(j.jdId)
                              setIsJdDropdownOpen(false)
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <CompanyLogo company={j.company} size={28} />
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111113' }}>
                                  {j.title}
                                </div>
                                <div style={{ fontSize: '12px', color: '#71717a' }}>
                                  {j.company} · Added {formatDate(j.createdAt)}
                                </div>
                              </div>
                            </div>
                            {selectedJd?.jdId === j.jdId && (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* STEP 2: SELECT RESUME */}
                <div className={styles.stepBlock}>
                  <div className={styles.stepTopRow}>
                    <div className={styles.stepLeftGroup}>
                      <div className={styles.stepNumberBadge}>2</div>
                      <div className={styles.stepTitles}>
                        <h3 className={styles.stepMainTitle}>Select Resume</h3>
                        <p className={styles.stepDesc}>Choose the resume you want to use for this interview.</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={styles.stepActionLink}
                      onClick={() => navigate('/dashboard/resumes')}
                    >
                      + Upload New Resume
                    </button>
                  </div>

                  {/* Custom Resume Selector */}
                  <div
                    className={`${styles.customSelectBox} ${isResumeDropdownOpen ? styles.customSelectBoxActive : ''}`}
                    onClick={() => {
                      setIsResumeDropdownOpen(!isResumeDropdownOpen)
                      setIsJdDropdownOpen(false)
                    }}
                  >
                    <div className={styles.selectContentLeft}>
                      {selectedResume ? (
                        <>
                          <FileBadge filename={selectedResume.originalFilename} mimeType={selectedResume.mimeType} size={32} />
                          <div className={styles.selectTextGroup}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className={styles.selectTitle}>{selectedResume.originalFilename}</span>
                              {userResumes?.latest?.resumeId === selectedResume.resumeId && (
                                <span className={styles.latestPill} style={{ fontSize: '10px', padding: '2px 8px' }}>
                                  Latest
                                </span>
                              )}
                            </div>
                            <div className={styles.selectMeta}>
                              Uploaded on {formatDate(selectedResume.createdAt)} · {formatFileSize(selectedResume.fileSize)}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div style={{ color: '#71717a', fontSize: '14px' }}>
                          No resumes found. Upload a resume first.
                        </div>
                      )}
                    </div>

                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      style={{
                        transform: isResumeDropdownOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 150ms ease',
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>

                    {/* Resume Dropdown Menu */}
                    {isResumeDropdownOpen && userResumes?.resumes && userResumes.resumes.length > 0 && (
                      <div className={styles.selectDropdownMenu} onClick={(e) => e.stopPropagation()}>
                        {userResumes.resumes.map((r) => (
                          <div
                            key={r.resumeId}
                            className={`${styles.selectOptionItem} ${selectedResume?.resumeId === r.resumeId ? styles.selectOptionSelected : ''}`}
                            onClick={() => {
                              setSelectedResumeId(r.resumeId)
                              setIsResumeDropdownOpen(false)
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <FileBadge filename={r.originalFilename} mimeType={r.mimeType} size={28} />
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111113' }}>
                                  {r.originalFilename}
                                </div>
                                <div style={{ fontSize: '12px', color: '#71717a' }}>
                                  {formatDate(r.createdAt)} · {formatFileSize(r.fileSize)}
                                </div>
                              </div>
                            </div>
                            {selectedResume?.resumeId === r.resumeId && (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {sessionError && (
                  <div style={{ color: '#dc2626', fontSize: '13.5px' }}>{sessionError}</div>
                )}

                {/* STEP 3: START BUTTON */}
                <button
                  type="button"
                  className={styles.startInterviewSubmitBtn}
                  onClick={handleStartMockInterview}
                  disabled={!selectedJd || !selectedResume || isStartingInterview}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>{isStartingInterview ? 'Preparing Interview Room...' : 'Start Mock Interview →'}</span>
                </button>
              </div>

              {/* Right Column: "What to expect?" Card */}
              <div className={styles.whatToExpectSidebar}>
                <div>
                  <h3 className={styles.expectHeader}>What to expect?</h3>
                  <div className={styles.expectItemsList} style={{ marginTop: '20px' }}>
                    <div className={styles.expectItemRow}>
                      <div className={styles.expectIconCircle}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <circle cx="12" cy="12" r="6" />
                          <circle cx="12" cy="12" r="2" />
                        </svg>
                      </div>
                      <div className={styles.expectTextGroup}>
                        <h4 className={styles.expectTitle}>Personalized questions</h4>
                        <p className={styles.expectDesc}>Based on your JD and resume</p>
                      </div>
                    </div>

                    <div className={styles.expectItemRow}>
                      <div className={styles.expectIconCircle}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>
                      <div className={styles.expectTextGroup}>
                        <h4 className={styles.expectTitle}>Real-time conversation</h4>
                        <p className={styles.expectDesc}>Short, relevant and engaging</p>
                      </div>
                    </div>

                    <div className={styles.expectItemRow}>
                      <div className={styles.expectIconCircle}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </div>
                      <div className={styles.expectTextGroup}>
                        <h4 className={styles.expectTitle}>Detailed feedback</h4>
                        <p className={styles.expectDesc}>Get clear explanations and suggestions</p>
                      </div>
                    </div>

                    <div className={styles.expectItemRow}>
                      <div className={styles.expectIconCircle}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      </div>
                      <div className={styles.expectTextGroup}>
                        <h4 className={styles.expectTitle}>Final report</h4>
                        <p className={styles.expectDesc}>Know your strengths and areas to improve</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className={styles.expectDivider} />
                  <p className={styles.expectCursive} style={{ marginTop: '12px' }}>
                    Same preparation.
                    <br />
                    A brighter you.
                  </p>
                </div>
              </div>
            </section>

            {/* PREVIOUS INTERVIEWS SECTION */}
            <section className={styles.previousInterviewsSection}>
              <div className={styles.previousInterviewsHeader}>
                <h3 className={styles.previousInterviewsTitle}>Previous Interviews</h3>
                <span style={{ fontSize: '13px', color: '#71717a' }}>View all →</span>
              </div>

              {userSessionsData?.sessions && userSessionsData.sessions.length > 0 ? (
                <div>
                  {userSessionsData.sessions.map((sess) => (
                    <div key={sess.sessionId} className={styles.previousCard}>
                      <div className={styles.previousCardLeft}>
                        <CompanyLogo company={sess.jd?.company || 'Job'} size={38} />
                        <div className={styles.previousCardInfo}>
                          <h4 className={styles.previousCardTitle}>
                            {sess.jd?.title || 'Software Engineer'} – {sess.jd?.company || 'Google'}
                          </h4>
                          <p className={styles.previousCardMeta}>
                            Completed on {formatDate(sess.completedAt || sess.createdAt)} · {sess.targetLoopCount || 7} questions
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        className={styles.viewReportBtn}
                        onClick={() => navigate(`/sessions/${sess.sessionId}/report`)}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="20" x2="18" y2="10" />
                          <line x1="12" y1="20" x2="12" y2="4" />
                          <line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                        <span>View Report</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyStateNotice}>
                  No previous mock interviews yet. Select a job description and resume above to start your first session.
                </div>
              )}
            </section>
          </div>
        )}

        {/* ==================================================================
            5. SETTINGS PAGE
           ================================================================== */}
        {view === 'settings' && (
          <div>
            <div className={styles.pageHeader}>
              <p className={styles.pageEyebrow}>ACCOUNT & PREFERENCES</p>
              <h1 className={styles.pageTitle}>Account Settings</h1>
              <p className={styles.pageSubtitle}>
                Manage your Karyam career profile, voice synthesis preferences, and authentication details.
              </p>
            </div>

            <div className={styles.pageCard}>
              <h3 className={styles.pageCardTitle}>Profile Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Full Name</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    readOnly
                    value={user?.name || 'Bhavya Dhanwani'}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Email Address</label>
                  <input
                    type="email"
                    className={styles.formInput}
                    readOnly
                    value={user?.email || 'bhavya@karyam.ai'}
                  />
                </div>
              </div>
            </div>

            <div className={styles.pageCard}>
              <h3 className={styles.pageCardTitle}>Interview & Speech Preferences</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>AI Voice Persona</label>
                  <select className={styles.formInput} defaultValue="nova">
                    <option value="nova">Nova (Warm & Professional Female)</option>
                    <option value="alloy">Alloy (Clear & Direct Neutral)</option>
                    <option value="echo">Echo (Calm & Authoritative Male)</option>
                    <option value="shimmer">Shimmer (Expressive & Engaging Female)</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Interview Feedback Rigor</label>
                  <select className={styles.formInput} defaultValue="strict">
                    <option value="strict">FAANG / High Bar (In-depth evaluation on depth, metrics, and STAR structure)</option>
                    <option value="balanced">Standard Professional (Balanced coaching on clarity and relevance)</option>
                    <option value="supportive">Supportive Practice (Encouraging feedback for confidence building)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.pageCard}>
              <h3 className={styles.pageCardTitle}>Session Security</h3>
              <p style={{ fontSize: '13.5px', color: '#71717a', margin: 0 }}>
                Signed in to Karyam. If you are on a public device, remember to sign out of your session.
              </p>
              <div>
                <button
                  type="button"
                  className={styles.btnSecondaryPill}
                  onClick={handleLogout}
                  style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Sign Out of Karyam</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Resume Document View & PDF Export Modal */}
      {viewingResume && (
        <ResumeViewModal
          resume={viewingResume}
          onClose={() => setViewingResume(null)}
          onPracticeInterview={(resumeId) => {
            setSelectedResumeId(resumeId)
            setViewingResume(null)
            navigate('/dashboard/interviews')
          }}
        />
      )}
    </div>
  )
}

export default KaryamDashboard
