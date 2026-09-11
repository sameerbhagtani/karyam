import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Logo from '@/shared/components/Logo/Logo'
import {
  ArrowRightIcon,
  InstagramIcon,
  LinkedinIcon,
  XIcon,
  YoutubeIcon,
} from './icons'
import styles from './Navbar.module.css'

gsap.registerPlugin(ScrollTrigger)

interface NavItem {
  label: string
  href: string
}

const navItems: NavItem[] = [
  { label: 'Docs', href: '/docs' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Start Building', href: '/create' },
]

const secondaryItems: NavItem[] = [
  { label: 'About', href: '/about' },
  { label: 'Docs', href: '/docs' },
  { label: 'Contact', href: '/contact' },
  { label: 'Templates', href: '/create' },
  { label: 'Builder', href: '/create' },
  { label: 'Deployment', href: '/dashboard/deployments' },
  { label: 'Support', href: '/docs' },
]

import { useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/shared/context/useAuth'

export default function Navbar() {
  const { pathname } = useLocation()
  const { isAuthenticated, user } = useAuth()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const drawerRef = useRef<HTMLElement | null>(null)
  const menuItemRefs = useRef<(HTMLElement | null)[]>([])
  const accountItem: NavItem = isAuthenticated
    ? { label: user?.name ? user.name.split(' ')[0] : 'Dashboard', href: '/dashboard' }
    : { label: 'Get Started', href: '/signup' }

  useEffect(() => {
    const trigger = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        const scrollY = self.scroll()

        setIsScrolled(scrollY > 12)
        setIsCollapsed(scrollY > 160 && self.direction === 1)
      },
    })

    return () => trigger.kill()
  }, [])

  const openMenu = () => {
    setIsMenuOpen(true)
  }

  const expandNavbar = () => {
    setIsCollapsed(false)
  }

  const closeMenu = () => {
    const timeline = gsap.timeline({
      defaults: { ease: 'power3.inOut' },
      onComplete: () => setIsMenuOpen(false),
    })

    timeline
      .to(menuItemRefs.current, {
        autoAlpha: 0,
        y: 16,
        duration: 0.16,
        stagger: 0.015,
      })
      .to(
        drawerRef.current,
        {
          xPercent: -108,
          duration: 0.44,
        },
        '-=0.06',
      )
      .to(
        overlayRef.current,
        {
          autoAlpha: 0,
          duration: 0.3,
        },
        '-=0.34',
      )
  }

  useEffect(() => {
    if (!isMenuOpen) {
      return
    }

    menuItemRefs.current = menuItemRefs.current.filter(Boolean)

    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })

    timeline
      .set(overlayRef.current, { autoAlpha: 0 })
      .set(drawerRef.current, { xPercent: -108 })
      .set(menuItemRefs.current, { autoAlpha: 0, y: 20 })
      .to(overlayRef.current, { autoAlpha: 1, duration: 0.28 })
      .to(
        drawerRef.current,
        {
          xPercent: 0,
          duration: 0.54,
        },
        '-=0.18',
      )
      .to(
        menuItemRefs.current,
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.34,
          stagger: 0.035,
        },
        '-=0.28',
      )
  }, [isMenuOpen])

  useEffect(() => {
    if (!isMenuOpen) {
      return undefined
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [isMenuOpen])

  if (pathname === '/create' || pathname === '/dashboard') {
    return null
  }

  return (
    <>
      <header
        className={`${styles.shell} ${isScrolled ? styles.scrolled : ''} ${
          isCollapsed ? styles.collapsed : ''
        }`}
      >
        <nav className={styles.nav} aria-label="Primary navigation">
          <button
            className={styles.menuButton}
            type="button"
            aria-label="Open menu"
            aria-expanded={isMenuOpen}
            onClick={openMenu}
          >
            <span />
            <span />
          </button>

          <div className={styles.navCluster} aria-hidden={isCollapsed}>
            <div className={styles.links}>
              {navItems.slice(0, 2).map((item) => (
                <a href={item.href} key={item.href}>
                  {item.label}
                </a>
              ))}
            </div>

            <Link
              className={styles.logoLink}
              to="/"
              aria-label="CONCH home"
              data-nav-logo-target="primary"
            >
              <Logo revealOnHover />
            </Link>

            <div className={styles.links}>
              {navItems.slice(2).map((item) => (
                <a href={item.href} key={item.href}>
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          <button
            className={styles.collapsedLogoLink}
            type="button"
            aria-label="Expand navigation"
            aria-hidden={!isCollapsed}
            onClick={expandNavbar}
          >
            <Logo compact />
          </button>

          <div className={styles.actions}>
            <Link className={styles.action} to={accountItem.href}>
              {accountItem.label}
              <ArrowRightIcon className={styles.inlineIcon} />
            </Link>
          </div>
        </nav>
      </header>

      {isMenuOpen ? (
        <div
          className={styles.drawerOverlay}
          ref={overlayRef}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeMenu()
            }
          }}
        >
          <aside
            className={styles.drawer}
            ref={drawerRef}
            aria-label="Menu"
            aria-modal="true"
            role="dialog"
          >
            <div className={styles.drawerHeader}>
              <button
                className={styles.closeButton}
                type="button"
                aria-label="Close menu"
                onClick={closeMenu}
              >
                <span />
                <span />
              </button>
              <Logo />
            </div>

            <div className={styles.drawerPrimary}>
              {navItems.map((item, index) => (
                <a
                  href={item.href}
                  key={item.href}
                  ref={(node) => {
                    menuItemRefs.current[index] = node
                  }}
                  onClick={closeMenu}
                >
                  {item.label}
                  <span aria-hidden="true">
                    <ArrowRightIcon className={styles.arrowIcon} />
                  </span>
                </a>
              ))}
            </div>

            <div className={styles.drawerSecondary}>
              <a
                href={accountItem.href}
                ref={(node) => {
                  menuItemRefs.current[navItems.length] = node
                }}
                onClick={closeMenu}
              >
                {accountItem.label}
                <ArrowRightIcon className={styles.smallArrowIcon} />
              </a>

              {secondaryItems.map((item, index) => (
                <a
                  href={item.href}
                  key={item.href}
                  ref={(node) => {
                    menuItemRefs.current[navItems.length + index + 1] = node
                  }}
                  onClick={closeMenu}
                >
                  {item.label}
                  <ArrowRightIcon className={styles.smallArrowIcon} />
                </a>
              ))}
            </div>

            <div
              className={styles.socials}
              ref={(node) => {
                menuItemRefs.current[navItems.length + secondaryItems.length + 1] = node
              }}
            >
              <span>Socials</span>
              <div>
                <a
                  href="https://www.youtube.com/@bhavya_the_dev"
                  aria-label="YouTube"
                  target="_blank"
                  rel="noreferrer"
                >
                  <YoutubeIcon className={styles.socialIcon} />
                </a>
                <a
                  href="https://www.linkedin.com/in/bhavya-dhanwani/"
                  aria-label="LinkedIn"
                  target="_blank"
                  rel="noreferrer"
                >
                  <LinkedinIcon className={styles.socialIcon} />
                </a>
                <a
                  href="https://www.instagram.com/bhavya_dhanwani__/"
                  aria-label="Instagram"
                  target="_blank"
                  rel="noreferrer"
                >
                  <InstagramIcon className={styles.socialIcon} />
                </a>
                <a
                  href="https://x.com/BhavyaDhan24029"
                  aria-label="X"
                  target="_blank"
                  rel="noreferrer"
                >
                  <XIcon className={styles.socialIcon} />
                </a>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  )
}
