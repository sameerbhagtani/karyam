import Image from '@/shared/components/Image/Image'
import logoPng from '@/assets/images/logo.png'
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
  const label = compact ? 'Karyam logo mark' : 'Karyam logo'

  return (
    <span
      className={`${styles.logo} ${compact ? styles.compact : ''} ${
        revealOnHover ? styles.revealOnHover : ''
      } ${className}`}
      aria-label={label}
    >
      <Image
        className={styles.mark}
        src={logoPng}
        alt=""
        width={34}
        height={34}
        aria-hidden="true"
      />
      {!compact ? <span className={styles.wordmark}>Karyam</span> : null}
    </span>
  )
}
