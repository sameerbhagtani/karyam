import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Logo from '@/shared/components/Logo/Logo'
import styles from './LandingFooter.module.css'

gsap.registerPlugin(ScrollTrigger)

interface FooterLink {
  label: string
  href: string
}

const footerLinks: FooterLink[] = [
  { label: 'Mock Interview', href: '/prep' },
  { label: 'Resume Builder', href: '/create' },
  { label: 'Platform Steps', href: '#command-room' },
  { label: 'Docs', href: '/docs' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
]

const socialLinks: FooterLink[] = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/bhavya-dhanwani/' },
  { label: 'Instagram', href: 'https://www.instagram.com/bhavya_dhanwani__/' },
  { label: 'YouTube', href: 'https://www.youtube.com/@bhavya_the_dev' },
  { label: 'X', href: 'https://x.com/BhavyaDhan24029' },
]

export default function LandingFooter() {
  const footerRef = useRef<HTMLElement | null>(null)
  const revealRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    const footer = footerRef.current

    if (!footer) {
      return undefined
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        revealRefs.current.filter(Boolean),
        { autoAlpha: 0, y: 34, filter: 'blur(10px)' },
        {
          autoAlpha: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 0.85,
          stagger: 0.08,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: footer,
            start: 'top 78%',
            once: true,
          },
        },
      )
    }, footer)

    return () => context.revert()
  }, [])

  return (
    <footer className={styles.footer} id="docs" ref={footerRef} aria-label="Karyam footer">
      <div className={styles.inner}>
        <div
          className={styles.brand}
          ref={(node) => {
            revealRefs.current[0] = node
          }}
        >
          <Logo className={styles.logo} />
          <p>AI-powered job matching, resume building, and mock interviews to make you job-ready.</p>
        </div>

        <nav
          className={styles.linkGrid}
          ref={(node) => {
            revealRefs.current[1] = node
          }}
          aria-label="Footer navigation"
        >
          <div>
            <h3>Platform</h3>
            {footerLinks.map((link) => (
              <a href={link.href} key={link.href}>
                {link.label}
              </a>
            ))}
          </div>

          <div>
            <h3>Social</h3>
            {socialLinks.map((link) => (
              <a href={link.href} key={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
          </div>
        </nav>

        <div
          className={styles.bottom}
          ref={(node) => {
            revealRefs.current[2] = node
          }}
        >
          <span>© {new Date().getFullYear()} Karyam</span>
          <span>AI-Powered Career & Interview Platform</span>
        </div>
      </div>
    </footer>
  )
}
