import { defineStore } from 'pinia'

import { getStoredToken, setStoredToken } from '@/api/client'
import { usersApi, type UserProfile } from '@/api/users.api'
import { useAccountsStore } from '@/stores/accounts/accounts.store'
import { useBudgetsStore } from '@/stores/budgets/budgets.store'
import { useCardsStore } from '@/stores/cards/cards.store'
import { useCommitmentStore } from '@/stores/commitment/commitment.store'
import { useDashboardStore } from '@/stores/dashboard/dashboard.store'
import { useMovementsStore } from '@/stores/movements/movements.store'
import { useRecurringStore } from '@/stores/recurring/recurring.store'

function parseJwtPayload(token: string | null): { sub?: string; exp?: number } | null {
  if (!token) return null
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64)) as { sub?: string; exp?: number }
  } catch {
    return null
  }
}

function isTokenValid(token: string | null): boolean {
  const payload = parseJwtPayload(token)
  if (!payload?.sub) return false
  if (typeof payload.exp === 'number') {
    const nowSec = Math.floor(Date.now() / 1000)
    if (payload.exp <= nowSec) return false
  }
  return true
}

export const useAuthStore = defineStore('auth', {
  state: () => {
    const initial = getStoredToken()
    const validInitial = isTokenValid(initial) ? initial : null
    if (initial && !validInitial) {
      setStoredToken(null)
    }
    return {
      token: validInitial,
      profile: null as UserProfile | null,
      profileLoaded: false,
    }
  },

  getters: {
    isAuthenticated(state): boolean {
      const t = state.token ?? getStoredToken()
      return isTokenValid(t)
    },

    isPremium(state): boolean {
      return Boolean(state.profile?.isPremium || state.profile?.isAdmin)
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
      const t = this.token ?? getStoredToken()
      const payload = parseJwtPayload(t)
      return typeof payload?.sub === 'string' && payload.sub.length > 0 ? payload.sub : null
    },
  },

  actions: {
    clearUserDataStores() {
      this.profile = null
      this.profileLoaded = false
      try {
        useDashboardStore().$reset()
        useAccountsStore().$reset()
        useRecurringStore().$reset()
        useMovementsStore().$reset()
        useBudgetsStore().$reset()
        useCardsStore().$reset()
        useCommitmentStore().$reset()
      } catch {
        // Ignora caso alguma store ainda não tenha sido instanciada
      }
    },

    setToken(value: string | null) {
      const previousSub = parseJwtPayload(this.token)?.sub
      const nextSub = parseJwtPayload(value)?.sub

      if (!value || previousSub !== nextSub) {
        this.clearUserDataStores()
      }

      this.token = value
      setStoredToken(value)
    },

    syncTokenFromStorage(): string | null {
      const stored = getStoredToken()
      if (!isTokenValid(stored)) {
        if (this.token || stored) {
          this.setToken(null)
        }
        return null
      }
      if (this.token !== stored) {
        const prevSub = parseJwtPayload(this.token)?.sub
        const nextSub = parseJwtPayload(stored)?.sub
        this.token = stored
        if (prevSub !== nextSub) {
          this.clearUserDataStores()
        }
      }
      return this.token
    },

    async fetchProfile() {
      this.syncTokenFromStorage()
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
      return this.syncTokenFromStorage()
    },
  },
})
