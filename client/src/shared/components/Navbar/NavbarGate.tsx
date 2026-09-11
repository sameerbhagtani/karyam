import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Navbar from './Navbar'

export default function NavbarGate() {
  const { pathname } = useLocation()
  const hiddenOnRoutes = new Set(['/login', '/signup', '/create'])
  const isDashboardRoute = pathname.startsWith('/dashboard')
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
