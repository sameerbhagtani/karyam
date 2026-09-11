import React, { useEffect, useState, useCallback } from 'react'
import { authService, type User, type LoginPayload, type SignupPayload } from '../services/auth.service'
import { apiClient, TOKEN_KEY } from '../api/client'
import { AuthContext } from './authContextDef'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Initialize and verify authentication on app load
  useEffect(() => {
    let isMounted = true

    const initAuth = async () => {
      // Capture token from OAuth redirect query param if present
      let storedToken = localStorage.getItem(TOKEN_KEY)
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search)
        const queryToken = urlParams.get('token')
        if (queryToken) {
          localStorage.setItem(TOKEN_KEY, queryToken)
          storedToken = queryToken
          // Clean token query parameter from address bar
          const cleanUrl = window.location.pathname + window.location.hash
          window.history.replaceState({}, document.title, cleanUrl)
        }
      }

      if (storedToken) {
        try {
          const profile = await authService.getMe(storedToken)
          if (isMounted) {
            setUser(profile)
            setAccessToken(storedToken)
          }
        } catch {
          // Token may be expired, attempt refresh via cookie
          try {
            const { user: refreshedUser, accessToken: newToken } = await authService.refresh()
            if (isMounted) {
              setUser(refreshedUser)
              setAccessToken(newToken)
              localStorage.setItem(TOKEN_KEY, newToken)
            }
          } catch {
            if (isMounted) {
              setUser(null)
              setAccessToken(null)
              localStorage.removeItem(TOKEN_KEY)
            }
          }
        }
      } else {
        // Try refresh token cookie if no access token stored
        try {
          const { user: refreshedUser, accessToken: newToken } = await authService.refresh()
          if (isMounted) {
            setUser(refreshedUser)
            setAccessToken(newToken)
            localStorage.setItem(TOKEN_KEY, newToken)
          }
        } catch {
          if (isMounted) {
            setUser(null)
            setAccessToken(null)
          }
        }
      }

      if (isMounted) {
        setIsLoading(false)
      }
    }

    initAuth()

    return () => {
      isMounted = false
    }
  }, [])

  // Synchronize React auth state when interceptor automatically refreshes the token in the background
  useEffect(() => {
    const unsubRefreshed = apiClient.onTokenRefreshed(async (newToken) => {
      setAccessToken(newToken)
      try {
        const profile = await authService.getMe(newToken)
        setUser(profile)
      } catch {
        // keep existing user if profile fetch fails
      }
    })

    const unsubFailed = apiClient.onAuthFailed(() => {
      setUser(null)
      setAccessToken(null)
    })

    return () => {
      unsubRefreshed()
      unsubFailed()
    }
  }, [])

  const login = useCallback(async (payload: LoginPayload) => {
    setIsLoading(true)
    try {
      const { user: loggedInUser, accessToken: token } = await authService.login(payload)
      setUser(loggedInUser)
      setAccessToken(token)
      localStorage.setItem(TOKEN_KEY, token)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signup = useCallback(async (payload: SignupPayload) => {
    setIsLoading(true)
    try {
      const { user: registeredUser, accessToken: token } = await authService.signup(payload)
      setUser(registeredUser)
      setAccessToken(token)
      localStorage.setItem(TOKEN_KEY, token)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      await authService.logout()
    } finally {
      setUser(null)
      setAccessToken(null)
      localStorage.removeItem(TOKEN_KEY)
      setIsLoading(false)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user && !!accessToken,
        isLoading,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
