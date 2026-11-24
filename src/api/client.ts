// Usa a API integrada do Nuxt Nitro em /api (ou VITE_API_URL se configurado externamente)
const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const AUTH_TOKEN_KEY = 'auth_token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 dias

function readCookieToken(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${AUTH_TOKEN_KEY}=([^;]+)`))
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  const local = localStorage.getItem(AUTH_TOKEN_KEY)
  if (local) return local
  const cookie = readCookieToken()
  if (cookie) {
    localStorage.setItem(AUTH_TOKEN_KEY, cookie)
    return cookie
  }
  return null
}

function setStoredToken(token: string | null) {
  if (typeof window === 'undefined') return
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
    document.cookie = `${AUTH_TOKEN_KEY}=${encodeURIComponent(token)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    document.cookie = `${AUTH_TOKEN_KEY}=; Path=/; Max-Age=0; SameSite=Lax`
  }
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const token = getStoredToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

function loginPageHref(): string {
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
  const path = `${base}/login`
  return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`
}

function isLoginPath(): boolean {
  const pathname = window.location.pathname
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
  const loginPath = `${base}/login`.replace(/\/+/g, '/') || '/login'
  return pathname === loginPath || pathname.endsWith('/login')
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  })
  if (res.status === 401) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    const data = (err as { message?: string; statusMessage?: string; data?: { message?: string } })
    const message = data.data?.message ?? data.statusMessage ?? data.message ?? 'Não autorizado'
    const hadSession = !!getStoredToken()
    if (hadSession) {
      setStoredToken(null)
      if (typeof window !== 'undefined' && !isLoginPath()) {
        window.location.assign(loginPageHref())
      }
      throw new Error('Sessão expirada. Faça login novamente.')
    }
    throw new Error(message)
  }
  if (!res.ok) {
    const raw = await res.text()
    let message = res.statusText
    if (raw) {
      try {
        const err = JSON.parse(raw) as {
          message?: string
          statusMessage?: string
          data?: { message?: string }
        }
        message = err.data?.message ?? err.statusMessage ?? err.message ?? message
      } catch {
        // ignore JSON parse error
      }
    }
    throw new Error(message || `Erro ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export { BASE_URL, request, AUTH_TOKEN_KEY, getStoredToken, setStoredToken }
