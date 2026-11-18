import { defineStore } from 'pinia'

import { AUTH_TOKEN_KEY } from '@/api/client'
import { usersApi, type UserProfile } from '@/api/users.api'

const TOKEN_KEY = AUTH_TOKEN_KEY

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) as string | null,
    profile: null as UserProfile | null,
    profileLoaded: false,
  }),

  getters: {
    isAuthenticated(state): boolean {
      return !!state.token
    },

    invoiceAnalysisEnabled(state): boolean {
      const globalEnabled = state.profile?.features?.invoices !== false
      return Boolean(globalEnabled && (state.profile?.invoiceAnalysisEnabled || state.profile?.isAdmin))
    },

    isAdmin(state): boolean {
      return Boolean(state.profile?.isAdmin)
    },

    featureFlags(state): Record<string, boolean> {
      return (
        state.profile?.features ?? {
          accounts: true,
          invoices: true,
          monthly_control: true,
          debts: true,
          cards: false,
          agenda: true,
        }
      )
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
      if (value) {
        localStorage.setItem(TOKEN_KEY, value)
      } else {
        localStorage.removeItem(TOKEN_KEY)
        this.profile = null
        this.profileLoaded = false
      }
    },

    async fetchProfile() {
      if (!this.isAuthenticated) {
        this.profile = null
        this.profileLoaded = false
        return null
      }
      try {
        this.profile = await usersApi.getMe()
        this.profileLoaded = true
        return this.profile
      } catch {
        this.profileLoaded = true
        return null
      }
    },

    logout() {
      this.setToken(null)
    },

    getToken(): string | null {
      return this.token ?? localStorage.getItem(TOKEN_KEY)
    },
  },
})
