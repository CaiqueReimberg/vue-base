import { defineStore } from 'pinia'

import { AUTH_TOKEN_KEY } from '@/api/client'

const TOKEN_KEY = AUTH_TOKEN_KEY

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) as string | null,
  }),

  getters: {
    isAuthenticated(state): boolean {
      return !!state.token
    },

    /** `sub` do JWT (id do usuário logado) */
    currentUserId(): string | null {
      const t = this.token ?? localStorage.getItem(TOKEN_KEY)
      if (!t) return null
      try {
        const payload = JSON.parse(atob(t.split('.')[1])) as { sub?: string }
        return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null
      } catch {
        return null
      }
    },
  },

  actions: {
    setToken(value: string | null) {
      this.token = value
      if (value) localStorage.setItem(TOKEN_KEY, value)
      else localStorage.removeItem(TOKEN_KEY)
    },

    logout() {
      this.setToken(null)
    },

    getToken(): string | null {
      return this.token ?? localStorage.getItem(TOKEN_KEY)
    },
  },
})
