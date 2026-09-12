import React from 'react'

interface CompanyLogoProps {
  company: string
  size?: number
  className?: string
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({ company, size = 36, className }) => {
  const norm = company.toLowerCase().trim()

  if (norm.includes('google')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
        <path
          fill="#4285F4"
          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z"
        />
        <path
          fill="#FBBC05"
          d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.91 0 12s.45 3.85 1.24 5.42l4.04-3.15z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
        />
      </svg>
    )
  }

  if (norm.includes('microsoft')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
        <rect x="1" y="1" width="10" height="10" fill="#F25022" rx="1" />
        <rect x="13" y="1" width="10" height="10" fill="#7FBA00" rx="1" />
        <rect x="1" y="13" width="10" height="10" fill="#00A4EF" rx="1" />
        <rect x="13" y="13" width="10" height="10" fill="#FFB900" rx="1" />
      </svg>
    )
  }

  if (norm.includes('amazon')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
        <circle cx="12" cy="12" r="11" fill="#FFFFFF" stroke="#E5E7EB" />
        <path
          d="M7 15c2.5 2 7.5 2 10 0"
          stroke="#FF9900"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M17 14l1 2-2 .5"
          stroke="#FF9900"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text
          x="12"
          y="11"
          textAnchor="middle"
          fontSize="11"
          fontWeight="bold"
          fill="#111113"
          fontFamily="system-ui, sans-serif"
        >
          a
        </text>
      </svg>
    )
  }

  if (norm.includes('openai') || norm.includes('chatgpt')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#111113" strokeWidth="1.8" className={className}>
        <circle cx="12" cy="12" r="11" fill="#FAFAF9" stroke="#E5E7EB" />
        <path d="M12 4a4 4 0 0 1 4 4v1.5a2.5 2.5 0 0 1 2.5 2.5 2.5 2.5 0 0 1-1.5 2.3A4 4 0 0 1 12 18a4 4 0 0 1-4-4v-1.5A2.5 2.5 0 0 1 5.5 10a2.5 2.5 0 0 1 1.5-2.3A4 4 0 0 1 12 4z" />
        <circle cx="12" cy="12" r="2" fill="#111113" />
      </svg>
    )
  }

  if (norm.includes('apple')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#111113" className={className}>
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.77 1.06-1.85.94-2.93-.91.04-2.02.61-2.67 1.37-.58.67-1.09 1.76-.95 2.81 1.02.08 2.05-.48 2.68-1.25z" />
      </svg>
    )
  }

  // Fallback initial badge with smooth brand colors
  const char = company.trim().charAt(0).toUpperCase() || 'J'
  const colors = [
    { bg: '#EEF2FF', text: '#3730A3' },
    { bg: '#FDF2F8', text: '#9D174D' },
    { bg: '#ECFDF5', text: '#065F46' },
    { bg: '#FFFBEB', text: '#92400E' },
    { bg: '#F5F3FF', text: '#5B21B6' },
  ]
  const colorIndex = (company.charCodeAt(0) + (company.charCodeAt(1) || 0)) % colors.length
  const color = colors[colorIndex]

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '10px',
        background: color.bg,
        color: color.text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.46),
        fontWeight: 700,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        border: '1px solid rgba(0,0,0,0.06)',
        flexShrink: 0,
      }}
    >
      {char}
    </div>
  )
}

export default CompanyLogo
