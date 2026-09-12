import React, { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [needRefresh, setNeedRefresh] = useState(false)
  const [updateSW, setUpdateSW] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    // Register Service Worker with auto update / reload handler
    const update = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true)
      },
      onOfflineReady() {
        console.log('App ready to work offline')
      },
    })
    setUpdateSW(() => update)

    // Handle BeforeInstallPrompt for PWA installability
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // If user hasn't dismissed before in this session
      const dismissed = sessionStorage.getItem('pwa_prompt_dismissed')
      if (!dismissed) {
        setShowInstallBanner(true)
      }
    }

    const handleAppInstalled = () => {
      setShowInstallBanner(false)
      setDeferredPrompt(null)
      console.log('Karyam PWA was successfully installed')
    }

    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowInstallBanner(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismissInstall = () => {
    setShowInstallBanner(false)
    sessionStorage.setItem('pwa_prompt_dismissed', 'true')
  }

  const handleReload = () => {
    if (updateSW) {
      updateSW(true)
    } else {
      window.location.reload()
    }
  }

  return (
    <>
      {/* Offline Status Pill */}
      {isOffline && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'rgba(239, 68, 68, 0.92)',
            color: '#ffffff',
            padding: '8px 18px',
            borderRadius: '9999px',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            letterSpacing: '0.01em',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              display: 'inline-block',
            }}
          />
          Offline mode active. Cached features remain accessible.
        </div>
      )}

      {/* New Version Update Toast */}
      {needRefresh && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9999,
            background: '#12151d',
            color: '#f3f4f6',
            border: '1px solid rgba(122, 162, 255, 0.3)',
            padding: '14px 18px',
            borderRadius: '12px',
            fontSize: '14px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            backdropFilter: 'blur(12px)',
          }}
        >
          <span>A new version of Karyam is ready!</span>
          <button
            onClick={handleReload}
            style={{
              background: 'linear-gradient(135deg, #7e14ff 0%, #2563eb 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Update
          </button>
        </div>
      )}

      {/* Install App Prompt */}
      {showInstallBanner && deferredPrompt && (
        <div
          role="dialog"
          aria-label="Install Karyam App"
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            zIndex: 9998,
            background: 'linear-gradient(145deg, #141824 0%, #0d1017 100%)',
            color: '#f3f4f6',
            border: '1px solid rgba(134, 59, 255, 0.25)',
            padding: '14px 18px',
            borderRadius: '16px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(134, 59, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            maxWidth: '380px',
            animation: 'fadeIn 0.3s ease',
          }}
        >
          <img
            src="/pwa-192x192.png"
            alt="Karyam Logo"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              objectFit: 'cover',
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', lineHeight: '1.2' }}>
              Install Karyam
            </div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
              Add to home screen for faster access & offline prep
            </div>
          </div>
          <button
            onClick={handleInstallClick}
            style={{
              background: 'linear-gradient(135deg, #863bff 0%, #2563eb 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(134, 59, 255, 0.4)',
            }}
          >
            Install
          </button>
          <button
            onClick={handleDismissInstall}
            aria-label="Dismiss install prompt"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              fontSize: '18px',
              lineHeight: 1,
              padding: '4px',
              marginLeft: '2px',
            }}
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}

export default PWAInstallPrompt
