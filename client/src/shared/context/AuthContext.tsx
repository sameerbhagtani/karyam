import React, { useEffect, useState, useCallback } from 'react'
import { authService, type User, type LoginPayload, type SignupPayload } from '../services/auth.service'
import { AuthContext } from './authContextDef'

const TOKEN_KEY = 'conch_access_token'

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
      const storedToken = localStorage.getItem(TOKEN_KEY)

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
