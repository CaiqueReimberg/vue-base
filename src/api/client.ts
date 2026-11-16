// Usa a API integrada do Nuxt Nitro em /api (ou VITE_API_URL se configurado externamente)
const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const AUTH_TOKEN_KEY = 'auth_token'

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(AUTH_TOKEN_KEY)
    if (token) headers['Authorization'] = `Bearer ${token}`
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
    const hadSession = typeof window !== 'undefined' && !!localStorage.getItem(AUTH_TOKEN_KEY)
    if (hadSession) {
      localStorage.removeItem(AUTH_TOKEN_KEY)
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

export { BASE_URL, request, AUTH_TOKEN_KEY }
