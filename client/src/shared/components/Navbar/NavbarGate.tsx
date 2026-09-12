import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Navbar from './Navbar'

export default function NavbarGate() {
  const { pathname } = useLocation()
  const hiddenOnRoutes = new Set(['/login', '/signup', '/create', '/prep', '/dashboard', '/resumes', '/interviews', '/settings', '/job-descriptions'])
  const isDashboardRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/prep') ||
    pathname.startsWith('/sessions') ||
    pathname.startsWith('/jds') ||
    pathname.startsWith('/resumes') ||
    pathname.startsWith('/interviews') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/job-descriptions')
  const isPublicSiteRoute = pathname.startsWith('/site')

  useEffect(() => {
    document.body.style.overflow = ''
    document.body.style.overflowY = ''
    document.documentElement.style.overflow = ''
    document.documentElement.style.overflowY = ''
    document.documentElement.classList.remove(
      'lenis',
      'lenis-smooth',
      'lenis-stopped',
      'lenis-scrolling',
    )
    document.body.classList.remove('lenis', 'lenis-smooth', 'lenis-stopped', 'lenis-scrolling')
  }, [pathname])

  if (hiddenOnRoutes.has(pathname) || isDashboardRoute || isPublicSiteRoute) {
    return null
  }

  return <Navbar />
}
