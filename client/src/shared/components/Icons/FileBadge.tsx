import React from 'react'

interface FileBadgeProps {
  filename: string
  mimeType?: string
  size?: number
  className?: string
}

export const FileBadge: React.FC<FileBadgeProps> = ({ filename, mimeType = '', size = 42, className }) => {
  const isDocx = filename.toLowerCase().endsWith('.docx') || mimeType.includes('word') || mimeType.includes('officedocument')

  if (isDocx) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '12px',
          background: '#EFF6FF',
          border: '1px solid #DBEAFE',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          gap: '1px',
        }}
        title="Word Document (.docx)"
      >
        <svg width={Math.round(size * 0.44)} height={Math.round(size * 0.44)} viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span
          style={{
            fontSize: '9px',
            fontWeight: 800,
            color: '#1D4ED8',
            letterSpacing: '0.04em',
            lineHeight: 1,
          }}
        >
          DOCX
        </span>
      </div>
    )
  }

  // PDF badge (matches mockup: soft red document badge)
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '12px',
        background: '#FEF2F2',
        border: '1px solid #FEE2E2',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        gap: '1px',
      }}
      title="PDF Document"
    >
      <svg width={Math.round(size * 0.44)} height={Math.round(size * 0.44)} viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <span
        style={{
          fontSize: '9px',
          fontWeight: 800,
          color: '#DC2626',
          letterSpacing: '0.04em',
          lineHeight: 1,
        }}
      >
        PDF
      </span>
    </div>
  )
}

export default FileBadge
