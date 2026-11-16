import { defineStore } from 'pinia'
import { dashboardApi } from '@/api/dashboard.api'
import type { MonthlyCommitmentResponse } from '@/types/dashboard-commitment'
import { currentReferenceMonth } from '@/utils/month'

export const useCommitmentStore = defineStore('commitment', {
  state: () => ({
    referenceMonth: currentReferenceMonth(),
    data: null as MonthlyCommitmentResponse | null,
    loading: false,
    error: null as string | null,
  }),

  getters: {
    totalCommitted(state): number {
      return state.data?.totalCommitted ?? 0
    },
    totalPaid(state): number {
      return state.data?.totalPaid ?? 0
    },
    freeBalance(state): number {
      return state.data?.freeBalance ?? 0
    },
    remainingToPay(state): number {
      return state.data?.remainingToPay ?? 0
    },
  },

  actions: {
    async fetchCommitment(month?: string) {
      if (month) this.referenceMonth = month
      this.loading = true
      this.error = null
      try {
        const res = await dashboardApi.getMonthlyCommitment(this.referenceMonth)
        this.referenceMonth = res.month
        this.data = res
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao carregar comprometido'
        throw e
      } finally {
        this.loading = false
      }
    },
  },
})
