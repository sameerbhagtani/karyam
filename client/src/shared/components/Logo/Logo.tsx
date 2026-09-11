import Image from '@/shared/components/Image/Image'
import styles from './Logo.module.css'

export interface LogoProps {
  compact?: boolean
  revealOnHover?: boolean
  className?: string
}

export default function Logo({
  compact = false,
  revealOnHover = false,
  className = '',
}: LogoProps) {
  const label = compact ? 'CONCH logo mark' : 'CONCH logo'

  return (
    <span
      className={`${styles.logo} ${compact ? styles.compact : ''} ${
        revealOnHover ? styles.revealOnHover : ''
      } ${className}`}
      aria-label={label}
    >
      <Image
        className={styles.mark}
        src="/conch-logo-dark.svg"
        alt=""
        width={34}
        height={34}
        aria-hidden="true"
      />
      {!compact ? <span className={styles.wordmark}>CONCH</span> : null}
    </span>
  )
}
