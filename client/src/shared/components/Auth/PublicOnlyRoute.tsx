import React from 'react'
import { Navigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '@/shared/context/useAuth'

interface PublicOnlyRouteProps {
  children?: React.ReactNode
}

export const PublicOnlyRoute: React.FC<PublicOnlyRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--background, #fff)' }}>
        <div
          style={{
            width: 42,
            height: 42,
            border: '3px solid rgba(37, 99, 235, 0.16)',
            borderTopColor: '#2563eb',
            borderRadius: '50%',
            animation: 'karyamSpin 0.75s linear infinite',
          }}
        />
        <style>{`@keyframes karyamSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (isAuthenticated) {
    const destination = (location.state as { from?: { pathname: string } })?.from?.pathname || '/prep'
    return <Navigate to={destination} replace />
  }

  return children ? <>{children}</> : <Outlet />
}

export default PublicOnlyRoute
