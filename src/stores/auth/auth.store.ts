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
