import { apiClient } from '../api/client'

export interface User {
  _id?: string
  userId?: string
  name: string
  email: string
  providers?: string[]
  isVerified?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface AuthSuccessData {
  user: User
  accessToken: string
}

export interface ApiResponse<T = unknown> {
  message: string
  data?: T
  errors?: Array<{ msg?: string; message?: string; path?: string }>
}

export interface LoginPayload {
  email: string
  password?: string
}

export interface SignupPayload {
  name: string
  email: string
  password?: string
}

class AuthService {
  private baseUrl = '/api/auth'

  async login(payload: LoginPayload): Promise<{ user: User; accessToken: string; message: string }> {
    const response = await fetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })

    const json: ApiResponse<AuthSuccessData> = await response.json().catch(() => ({
      message: 'Network error or invalid server response',
    }))

    if (!response.ok) {
      const errorMsg =
        json.errors?.[0]?.msg ||
        json.errors?.[0]?.message ||
        json.message ||
        'Failed to log in. Please check your credentials.'
      throw new Error(errorMsg)
    }

    if (!json.data) {
      throw new Error(json.message || 'Login succeeded but user data was missing.')
    }

    // Save newly received access token into apiClient
    apiClient.setStoredToken(json.data.accessToken)

    return {
      user: json.data.user,
      accessToken: json.data.accessToken,
      message: json.message,
    }
  }

  async signup(payload: SignupPayload): Promise<{ user: User; accessToken: string; message: string }> {
    const response = await fetch(`${this.baseUrl}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })

    const json: ApiResponse<AuthSuccessData> = await response.json().catch(() => ({
      message: 'Network error or invalid server response',
    }))

    if (!response.ok) {
      const errorMsg =
        json.errors?.[0]?.msg ||
        json.errors?.[0]?.message ||
        json.message ||
        'Failed to register. Please try again.'
      throw new Error(errorMsg)
    }

    if (!json.data) {
      throw new Error(json.message || 'Registration completed.')
    }

    // Save newly received access token into apiClient
    apiClient.setStoredToken(json.data.accessToken)

    return {
      user: json.data.user,
      accessToken: json.data.accessToken,
      message: json.message,
    }
  }

  async getMe(accessToken?: string): Promise<User> {
    const headers: Record<string, string> = {}
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    const response = await apiClient.request(`${this.baseUrl}/me`, {
      method: 'GET',
      headers,
    })

    const json: ApiResponse<{ user: User }> = await response.json().catch(() => ({
      message: 'Network error',
    }))

    if (!response.ok || !json.data?.user) {
      throw new Error(json.message || 'Failed to fetch user profile.')
    }

    return json.data.user
  }

  async refresh(): Promise<{ user: User; accessToken: string }> {
    const newAccessToken = await apiClient.refreshToken()
    const user = await this.getMe(newAccessToken)
    return { user, accessToken: newAccessToken }
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
    } catch {
      // ignore network errors on logout
    } finally {
      apiClient.setStoredToken(null)
    }
  }
}

export const authService = new AuthService()
