export const TOKEN_KEY = 'conch_access_token'

type TokenRefreshCallback = (token: string) => void
type AuthFailureCallback = () => void

class ApiClient {
  private isRefreshing = false
  private refreshSubscribers: Array<(token: string) => void> = []
  private onTokenRefreshedCallbacks: Array<(token: string) => void> = []
  private onAuthFailedCallbacks: Array<() => void> = []

  // Subscribe to token refreshed events (e.g. for React state sync)
  public onTokenRefreshed(callback: TokenRefreshCallback): () => void {
    this.onTokenRefreshedCallbacks.push(callback)
    return () => {
      this.onTokenRefreshedCallbacks = this.onTokenRefreshedCallbacks.filter((cb) => cb !== callback)
    }
  }

  // Subscribe to auth failure (e.g. session expired, force logout)
  public onAuthFailed(callback: AuthFailureCallback): () => void {
    this.onAuthFailedCallbacks.push(callback)
    return () => {
      this.onAuthFailedCallbacks = this.onAuthFailedCallbacks.filter((cb) => cb !== callback)
    }
  }

  private subscribeTokenRefresh(cb: (token: string) => void) {
    this.refreshSubscribers.push(cb)
  }

  private onRefreshed(token: string) {
    this.refreshSubscribers.forEach((cb) => cb(token))
    this.refreshSubscribers = []
    this.onTokenRefreshedCallbacks.forEach((cb) => cb(token))
  }

  private onFailed() {
    this.refreshSubscribers = []
    this.onAuthFailedCallbacks.forEach((cb) => cb())
  }

  public getStoredToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(TOKEN_KEY)
  }

  public setStoredToken(token: string | null): void {
    if (typeof window === 'undefined') return
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  }

  /**
   * Performs an authenticated fetch with automatic 401 interception & token refreshing.
   */
  public async request(url: string, init: RequestInit = {}): Promise<Response> {
    const isRefreshRequest = url.includes('/api/auth/refresh')
    const isAuthRoute = url.includes('/api/auth/login') || url.includes('/api/auth/signup')

    // Prepare headers
    const headers = new Headers(init.headers || {})
    const currentToken = this.getStoredToken()

    if (currentToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${currentToken}`)
    }

    const config: RequestInit = {
      ...init,
      headers,
      credentials: 'include', // Ensure cookies (refresh token) are always sent
    }

    const response = await fetch(url, config)

    // If request returned 401 and is not an auth/refresh endpoint, intercept & refresh
    if (response.status === 401 && !isRefreshRequest && !isAuthRoute) {
      if (!this.isRefreshing) {
        this.isRefreshing = true

        try {
          const newToken = await this.refreshToken()
          this.isRefreshing = false
          this.onRefreshed(newToken)

          // Retry the original request with the new access token
          headers.set('Authorization', `Bearer ${newToken}`)
          return fetch(url, { ...config, headers })
        } catch {
          this.isRefreshing = false
          this.setStoredToken(null)
          this.onFailed()
          return response // Return original 401 so caller can handle
        }
      }

      // If already refreshing, wait until the in-flight refresh finishes, then retry
      return new Promise<Response>((resolve, reject) => {
        this.subscribeTokenRefresh(async (newToken: string) => {
          try {
            headers.set('Authorization', `Bearer ${newToken}`)
            const retriedResponse = await fetch(url, { ...config, headers })
            resolve(retriedResponse)
          } catch (retryErr) {
            reject(retryErr)
          }
        })
      })
    }

    return response
  }

  /**
   * Calls the backend refresh endpoint to get a new access token
   */
  public async refreshToken(): Promise<string> {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    const json = await response.json().catch(() => ({}))

    if (!response.ok || !json.data?.accessToken) {
      throw new Error(json.message || 'Session expired. Please log in again.')
    }

    const newAccessToken: string = json.data.accessToken
    this.setStoredToken(newAccessToken)
    return newAccessToken
  }

  // Convenient typed helpers
  public async get<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await this.request(url, { ...init, method: 'GET' })
    return this.parseResponse<T>(res)
  }

  public async post<T>(url: string, body?: unknown, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers || {})
    let formattedBody: BodyInit | undefined = undefined

    if (body instanceof FormData) {
      formattedBody = body
      // Let browser set multipart boundary
    } else if (body !== undefined) {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
      }
      formattedBody = JSON.stringify(body)
    }

    const res = await this.request(url, {
      ...init,
      method: 'POST',
      headers,
      body: formattedBody,
    })
    return this.parseResponse<T>(res)
  }

  private async parseResponse<T>(res: Response): Promise<T> {
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      const errorMsg =
        (json as { errors?: Array<{ msg?: string; message?: string }> })?.errors?.[0]?.msg ||
        (json as { message?: string })?.message ||
        `Request failed with status ${res.status}`
      throw new Error(errorMsg)
    }
    return json as T
  }
}

export const apiClient = new ApiClient()
