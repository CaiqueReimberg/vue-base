import type { AgendaResponse, MonthlyCommitmentResponse } from '@/types/dashboard-commitment'
import { request } from './client'

export interface MonthlyPlanResponse {
  referenceMonth: string
  baseMonthlyIncome?: number
  incomesTotal?: number
  incomesCount?: number
  monthlyIncome: number
  savingsGoal: number
  savingsPaid: boolean
  savingsPaidAt: string | null
  endOfMonthLeftover: number | null
  closedAt: string | null
  notes: string | null
  isInherited: boolean
}

export interface MonthlyHistoryEntry {
  month: string
  hasPlan: boolean
  isInheritedPlan?: boolean
  hasActivity?: boolean
  income: number
  bills: number
  billsPaid?: number
  billsPending?: number
  recurringTotal?: number
  debtsTotal?: number
  cardsTotal?: number
  savingsGoal: number
  savingsPaid: boolean
  saved: number
  free: number
  leftover: number | null
}

export const dashboardApi = {
  getHistory(months = 6, endMonth?: string): Promise<{ months: MonthlyHistoryEntry[] }> {
    const q = new URLSearchParams({ months: String(months) })
    if (endMonth) q.set('endMonth', endMonth)
    return request(`/dashboard/history?${q.toString()}`)
  },

  getMonthlyCommitment(month: string): Promise<MonthlyCommitmentResponse> {
    return request(
      `/dashboard/monthly-commitment?month=${encodeURIComponent(month)}`,
    )
  },

  getAgenda(month: string): Promise<AgendaResponse> {
    return request(`/dashboard/agenda?month=${encodeURIComponent(month)}`)
  },

  getMonthlyPlan(month: string): Promise<MonthlyPlanResponse> {
    return request(`/dashboard/monthly-plan?month=${encodeURIComponent(month)}`)
  },

  saveMonthlyPlan(payload: {
    referenceMonth: string
    monthlyIncome?: number
    savingsGoal?: number
    savingsPaid?: boolean
    endOfMonthLeftover?: number | null
    notes?: string | null
  }): Promise<MonthlyPlanResponse> {
    return request('/dashboard/monthly-plan', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },
}
