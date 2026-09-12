import React, { useState, useRef, useEffect } from 'react'
import styles from './CustomResumeDropdown.module.css'

export interface ResumeOption {
  resumeId: string
  originalFilename: string
  createdAt: string
  version?: number
}

interface CustomResumeDropdownProps {
  resumes: ResumeOption[]
  selectedResumeId: string
  onSelect: (resumeId: string) => void
  theme?: 'light' | 'dark'
  variant?: 'pill' | 'select'
  direction?: 'down' | 'up'
  align?: 'left' | 'right'
  fullWidth?: boolean
  label?: string
  placeholder?: string
  disabled?: boolean
  isLoading?: boolean
}

export const CustomResumeDropdown: React.FC<CustomResumeDropdownProps> = ({
  resumes,
  selectedResumeId,
  onSelect,
  theme = 'light',
  variant = 'select',
  direction = 'down',
  align = 'left',
  fullWidth = false,
  placeholder = 'Select a resume',
  disabled = false,
  isLoading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Find currently selected resume
  const selectedResume =
    resumes.find((r) => r.resumeId === selectedResumeId) || resumes[0]

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleToggle = () => {
    if (!disabled && !isLoading && resumes.length > 0) {
      setIsOpen((prev) => !prev)
    }
  }

  const handleSelect = (resumeId: string) => {
    onSelect(resumeId)
    setIsOpen(false)
  }

  // Format short date
  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return ''
    }
  }

  // Choose trigger styling
  const isPill = variant === 'pill'
  let triggerClassName = ''
  if (isPill) {
    triggerClassName = `${styles.pillTrigger} ${isOpen ? styles.pillTriggerOpen : ''}`
  } else if (theme === 'dark') {
    triggerClassName = `${styles.selectTriggerDark} ${isOpen ? styles.selectTriggerDarkOpen : ''}`
  } else {
    triggerClassName = `${styles.selectTriggerLight} ${isOpen ? styles.selectTriggerLightOpen : ''}`
  }

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${isOpen ? styles.containerOpen : ''} ${fullWidth ? styles.fullWidth : ''}`}
    >
      <button
        type="button"
        className={triggerClassName}
        onClick={handleToggle}
        disabled={disabled || resumes.length === 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className={styles.triggerLeft}>
          {isLoading ? (
            <div className={styles.spinner} />
          ) : (
            <svg
              className={styles.fileIcon}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          )}

          <span className={styles.triggerText}>
            {isLoading ? (
              'Analyzing...'
            ) : selectedResume ? (
              isPill ? (
                `${selectedResume.originalFilename} (V${selectedResume.version || 1})`
              ) : (
                `${selectedResume.originalFilename} (Uploaded ${formatDate(selectedResume.createdAt)})${
                  selectedResume.resumeId === resumes[0]?.resumeId ? ' — Latest' : ''
                }`
              )
            ) : (
              placeholder
            )}
          </span>
        </div>

        {resumes.length > 1 && (
          <svg
            className={`${styles.chevron} ${isOpen ? styles.chevronRotated : ''}`}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {/* FLOATING DROPDOWN LIST */}
      {isOpen && (
        <div
          className={`${styles.menu} ${
            direction === 'up' ? styles.menuUp : styles.menuDown
          } ${
            theme === 'dark' ? styles.menuDark : styles.menuLight
          } ${align === 'right' ? styles.alignRight : styles.alignLeft}`}
          role="listbox"
        >
          <div
            className={`${styles.menuHeader} ${
              theme === 'dark' ? styles.menuHeaderDark : styles.menuHeaderLight
            }`}
          >
            Select Resume ({resumes.length} available)
          </div>

          <div className={styles.itemsList}>
            {resumes.map((r, idx) => {
              const isSelected = selectedResume?.resumeId === r.resumeId
              const itemThemeClass =
                theme === 'dark'
                  ? isSelected
                    ? styles.menuItemDarkActive
                    : styles.menuItemDark
                  : isSelected
                  ? styles.menuItemLightActive
                  : styles.menuItemLight

              return (
                <div
                  key={r.resumeId}
                  className={`${styles.menuItem} ${itemThemeClass}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(r.resumeId)}
                >
                  <div className={styles.itemLeft}>
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ flexShrink: 0, opacity: 0.8 }}
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <div className={styles.itemTextCol}>
                      <span className={styles.itemTitle}>{r.originalFilename}</span>
                      <span className={styles.itemSubtitle}>
                        Uploaded {formatDate(r.createdAt)}
                        {idx === 0 && (
                          <span
                            className={
                              theme === 'dark'
                                ? styles.latestTagDark
                                : styles.latestTagLight
                            }
                          >
                            Latest
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <svg
                      className={styles.checkIcon}
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
