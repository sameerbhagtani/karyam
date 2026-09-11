import React, { useState, useRef, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../../store/hooks'
import { setResume, clearResume, setActiveStep } from '../../../store/slices/sessionSetupSlice'
import { useUploadResumeMutation, useUserResumesQuery } from '../hooks/useInterviewQueries'
import styles from '../styles/interview.module.css'

export const ResumeUploadCard: React.FC = () => {
  const dispatch = useAppDispatch()
  const currentResume = useAppSelector((state) => state.sessionSetup.resume)
  const [dragActive, setDragActive] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadMutation = useUploadResumeMutation()
  const { data: userResumesData, isLoading: isLoadingUserResumes } = useUserResumesQuery(true)

  // Automatically restore previously uploaded resume on page load/refresh if none is selected
  useEffect(() => {
    if (!currentResume && userResumesData?.latest) {
      dispatch(
        setResume({
          resumeId: userResumesData.latest.resumeId,
          originalFilename: userResumesData.latest.originalFilename,
          status: 'processed',
        })
      )
    }
  }, [currentResume, userResumesData, dispatch])

  const handleProcessFile = async (file: File) => {
    setErrorMessage(null)

    // Validate mime / ext
    const validExtensions = ['.pdf', '.docx']
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))

    if (!hasValidExt) {
      setErrorMessage('Please upload a PDF (.pdf) or Word document (.docx).')
      return
    }

    // Size limit: 10MB
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('File size exceeds 10MB limit.')
      return
    }

    try {
      const result = await uploadMutation.mutateAsync(file)
      dispatch(
        setResume({
          resumeId: result.resumeId,
          originalFilename: result.originalFilename,
          status: result.status,
        })
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.'
      setErrorMessage(msg)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0])
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0])
    }
  }

  const pastResumes = userResumesData?.resumes || []

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>
          <span>📄</span>
          <span>Candidate Resume</span>
        </h2>
        <p className={styles.cardDescription}>
          Upload your latest resume. The assistant extracts your background, skills, and projects to ground interview questions.
        </p>
      </div>

      {errorMessage && (
        <div className={styles.alertError} role="alert">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {currentResume ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
          <div className={styles.assetSelectedBox}>
            <div className={styles.assetInfo}>
              <p className={styles.assetTitle}>✓ {currentResume.originalFilename}</p>
              <p className={styles.assetMeta}>ID: {currentResume.resumeId} • Status: Processed</p>
            </div>
            <div className={styles.assetActions}>
              <button
                type="button"
                className={styles.btnDangerText}
                onClick={() => dispatch(clearResume())}
              >
                Change / Upload New
              </button>
            </div>
          </div>

          {/* Show list of other previously uploaded resumes if any */}
          {pastResumes.length > 1 && (
            <div className={styles.previousSection}>
              <p className={styles.previousTitle}>Switch to previously uploaded resume:</p>
              <div className={styles.previousList}>
                {pastResumes.map((r) => {
                  const isSelected = r.resumeId === currentResume.resumeId
                  return (
                    <button
                      key={r.resumeId}
                      type="button"
                      className={`${styles.previousItem} ${isSelected ? styles.previousItemActive : ''}`}
                      onClick={() =>
                        dispatch(
                          setResume({
                            resumeId: r.resumeId,
                            originalFilename: r.originalFilename,
                            status: 'processed',
                          })
                        )
                      }
                    >
                      <span>{isSelected ? '✓ ' : ''}{r.originalFilename}</span>
                      <span className={styles.previousItemMeta}>
                        {new Date(r.createdAt).toLocaleDateString()}
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
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            style={{ display: 'none' }}
            onChange={handleFileInputChange}
            id="resume-file-upload"
          />

          <div
            className={`${styles.uploadZone} ${dragActive ? styles.uploadZoneDragActive : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click()
              }
            }}
          >
            <svg
              className={styles.uploadIcon}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className={styles.uploadPrompt}>
              {uploadMutation.isPending
                ? 'Extracting & uploading resume...'
                : isLoadingUserResumes
                ? 'Checking saved resumes...'
                : 'Drop your resume here, or click to browse'}
            </p>
            <p className={styles.uploadHint}>Supports PDF or DOCX up to 10MB</p>
          </div>

          {/* If there are previously uploaded resumes in the database, allow selecting one */}
          {pastResumes.length > 0 && (
            <div className={styles.previousSection}>
              <p className={styles.previousTitle}>Or select a previously saved resume:</p>
              <div className={styles.previousList}>
                {pastResumes.map((r) => (
                  <button
                    key={r.resumeId}
                    type="button"
                    className={styles.previousItem}
                    onClick={() =>
                      dispatch(
                        setResume({
                          resumeId: r.resumeId,
                          originalFilename: r.originalFilename,
                          status: 'processed',
                        })
                      )
                    }
                  >
                    <span>📄 {r.originalFilename}</span>
                    <span className={styles.previousItemMeta}>
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className={styles.buttonRow}>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={!currentResume || uploadMutation.isPending}
          onClick={() => dispatch(setActiveStep(2))}
        >
          <span>Next: Target Job Description</span>
          <span>→</span>
        </button>
      </div>
    </div>
  )
}
