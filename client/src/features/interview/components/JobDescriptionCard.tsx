import React, { useState, useRef, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../../store/hooks'
import {
  setJobDescription,
  clearJobDescription,
  setActiveStep,
} from '../../../store/slices/sessionSetupSlice'
import {
  useCreateJobDescriptionMutation,
  useUserJobDescriptionsQuery,
} from '../hooks/useInterviewQueries'
import styles from '../styles/interview.module.css'

export const JobDescriptionCard: React.FC = () => {
  const dispatch = useAppDispatch()
  const currentJd = useAppSelector((state) => state.sessionSetup.jobDescription)
  const [tab, setTab] = useState<'text' | 'file'>('text')
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [rawText, setRawText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const createJdMutation = useCreateJobDescriptionMutation()
  const { data: userJdsData, isLoading: isLoadingUserJds } = useUserJobDescriptionsQuery(true)

  // Automatically restore previously saved job description on page load/refresh if none is selected
  useEffect(() => {
    if (!currentJd && userJdsData?.latest) {
      dispatch(
        setJobDescription({
          jdId: userJdsData.latest.jdId,
          title: userJdsData.latest.title,
          company: userJdsData.latest.company,
          sourceType: userJdsData.latest.sourceType,
        })
      )
    }
  }, [currentJd, userJdsData, dispatch])

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!title.trim()) {
      setErrorMessage('Role title is required.')
      return
    }
    if (!company.trim()) {
      setErrorMessage('Company name is required.')
      return
    }
    if (!rawText.trim() || rawText.trim().length < 50) {
      setErrorMessage('Job description text should be at least 50 characters.')
      return
    }

    try {
      const result = await createJdMutation.mutateAsync({
        type: 'text',
        data: {
          title: title.trim(),
          company: company.trim(),
          rawText: rawText.trim(),
        },
      })

      dispatch(
        setJobDescription({
          jdId: result.jdId,
          title: title.trim(),
          company: company.trim(),
          sourceType: 'pasted_text',
        })
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save job description'
      setErrorMessage(msg)
    }
  }

  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!title.trim()) {
      setErrorMessage('Role title is required.')
      return
    }
    if (!company.trim()) {
      setErrorMessage('Company name is required.')
      return
    }
    if (!selectedFile) {
      setErrorMessage('Please select a PDF or DOCX file containing the job description.')
      return
    }

    try {
      const result = await createJdMutation.mutateAsync({
        type: 'file',
        title: title.trim(),
        company: company.trim(),
        file: selectedFile,
      })

      dispatch(
        setJobDescription({
          jdId: result.jdId,
          title: title.trim(),
          company: company.trim(),
          sourceType: 'upload',
        })
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload job description file'
      setErrorMessage(msg)
    }
  }

  const pastJds = userJdsData?.jobDescriptions || []

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>
          <span>🎯</span>
          <span>Target Job Description</span>
        </h2>
        <p className={styles.cardDescription}>
          Specify the role and company you are interviewing for. The AI tailors difficulty and topic domains directly to this JD.
        </p>
      </div>

      {errorMessage && (
        <div className={styles.alertError} role="alert">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {currentJd ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
          <div className={styles.assetSelectedBox}>
            <div className={styles.assetInfo}>
              <p className={styles.assetTitle}>
                {currentJd.title} • {currentJd.company}
              </p>
              <p className={styles.assetMeta}>
                ID: {currentJd.jdId} • Source: {currentJd.sourceType === 'pasted_text' ? 'Pasted Text' : 'Uploaded File'}
              </p>
            </div>
            <div className={styles.assetActions}>
              <button
                type="button"
                className={styles.btnDangerText}
                onClick={() => dispatch(clearJobDescription())}
              >
                Change / Create New
              </button>
            </div>
          </div>

          {/* Show other saved JDs if available */}
          {pastJds.length > 1 && (
            <div className={styles.previousSection}>
              <p className={styles.previousTitle}>Switch to previously saved target role:</p>
              <div className={styles.previousList}>
                {pastJds.map((j) => {
                  const isSelected = j.jdId === currentJd.jdId
                  return (
                    <button
                      key={j.jdId}
                      type="button"
                      className={`${styles.previousItem} ${isSelected ? styles.previousItemActive : ''}`}
                      onClick={() =>
                        dispatch(
                          setJobDescription({
                            jdId: j.jdId,
                            title: j.title,
                            company: j.company,
                            sourceType: j.sourceType,
                          })
                        )
                      }
                    >
                      <span>{isSelected ? '✓ ' : ''}{j.title} at {j.company}</span>
                      <span className={styles.previousItemMeta}>
                        {new Date(j.createdAt).toLocaleDateString()}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className={styles.tabsNav} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'text'}
              className={`${styles.tabBtn} ${tab === 'text' ? styles.tabBtnActive : ''}`}
              onClick={() => {
                setTab('text')
                setErrorMessage(null)
              }}
            >
              Paste Job Description
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'file'}
              className={`${styles.tabBtn} ${tab === 'file' ? styles.tabBtnActive : ''}`}
              onClick={() => {
                setTab('file')
                setErrorMessage(null)
              }}
            >
              Upload JD Document
            </button>
          </div>

          {tab === 'text' ? (
            <form onSubmit={handleTextSubmit} style={{ display: 'contents' }}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="jd-title">
                  Role Title *
                </label>
                <input
                  id="jd-title"
                  className={styles.input}
                  type="text"
                  placeholder="e.g. Senior Backend Engineer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="jd-company">
                  Company / Organization *
                </label>
                <input
                  id="jd-company"
                  className={styles.input}
                  type="text"
                  placeholder="e.g. Acme Inc."
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="jd-text">
                  Job Description Details *
                </label>
                <textarea
                  id="jd-text"
                  className={styles.textarea}
                  placeholder="Paste the job responsibilities, qualifications, and tech stack here..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={6}
                  required
                />
                <span className={styles.charCounter}>{rawText.length} characters</span>
              </div>

              <div className={styles.buttonRow}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => dispatch(setActiveStep(1))}
                >
                  ← Back to Resume
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={createJdMutation.isPending}
                >
                  {createJdMutation.isPending ? 'Saving JD...' : 'Save Job Description'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleFileSubmit} style={{ display: 'contents' }}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="jd-file-title">
                  Role Title *
                </label>
                <input
                  id="jd-file-title"
                  className={styles.input}
                  type="text"
                  placeholder="e.g. Staff Infrastructure Engineer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="jd-file-company">
                  Company *
                </label>
                <input
                  id="jd-file-company"
                  className={styles.input}
                  type="text"
                  placeholder="e.g. Stripe"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                />
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0])
                  }
                }}
              />

              <div
                className={styles.uploadZone}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
                }}
              >
                <svg
                  className={styles.uploadIcon}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className={styles.uploadPrompt}>
                  {selectedFile
                    ? selectedFile.name
                    : isLoadingUserJds
                    ? 'Checking saved roles...'
                    : 'Select JD PDF or DOCX file'}
                </p>
                <p className={styles.uploadHint}>Maximum 10MB</p>
              </div>

              <div className={styles.buttonRow}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => dispatch(setActiveStep(1))}
                >
                  ← Back to Resume
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={createJdMutation.isPending || !selectedFile}
                >
                  {createJdMutation.isPending ? 'Extracting & Saving...' : 'Upload & Save JD'}
                </button>
              </div>
            </form>
          )}

          {/* List of previously saved JDs if available */}
          {pastJds.length > 0 && (
            <div className={styles.previousSection}>
              <p className={styles.previousTitle}>Or choose from previously saved target roles:</p>
              <div className={styles.previousList}>
                {pastJds.map((j) => (
                  <button
                    key={j.jdId}
                    type="button"
                    className={styles.previousItem}
                    onClick={() =>
                      dispatch(
                        setJobDescription({
                          jdId: j.jdId,
                          title: j.title,
                          company: j.company,
                          sourceType: j.sourceType,
                        })
                      )
                    }
                  >
                    <span>🎯 {j.title} • {j.company}</span>
                    <span className={styles.previousItemMeta}>
                      {new Date(j.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {currentJd && (
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => dispatch(setActiveStep(1))}
          >
            ← Back to Resume
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => dispatch(setActiveStep(3))}
          >
            <span>Next: Session Setup</span>
            <span>→</span>
          </button>
        </div>
      )}
    </div>
  )
}
