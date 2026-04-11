import type {
  Budget,
  BudgetFormOptions,
  BudgetListResponse,
  BudgetStatus,
  MonthlyBudgetCreateInput,
  MonthlyBudgetUpdateInput,
} from '@/types/budget'
import { request } from './client'

function monthlyPayload(input: MonthlyBudgetCreateInput | MonthlyBudgetUpdateInput) {
  const body: Record<string, unknown> = {
    ...input,
    scope: 'person',
    period: 'monthly',
  }
  if (body.audience == null) {
    body.audience = 'individual'
  }
  return body
}

export const budgetsApi = {
  list(params?: {
    page?: number
    limit?: number
    period?: string
    referenceMonth?: string
    scope?: string
    audience?: string
    isActive?: boolean
  }): Promise<BudgetListResponse> {
    const q = new URLSearchParams()
    if (params?.page != null) q.set('page', String(params.page))
    if (params?.limit != null) q.set('limit', String(params.limit))
    if (params?.period) q.set('period', params.period)
    if (params?.referenceMonth) q.set('referenceMonth', params.referenceMonth)
    if (params?.scope) q.set('scope', params.scope)
    if (params?.audience) q.set('audience', params.audience)
    if (params?.isActive !== undefined) q.set('isActive', String(params.isActive))
    const qs = q.toString()
    return request<BudgetListResponse>(`/budgets${qs ? `?${qs}` : ''}`)
  },

  getFormOptions(): Promise<BudgetFormOptions> {
    return request<BudgetFormOptions>('/budgets/meta/form-options')
  },

  getById(id: string): Promise<Budget> {
    return request<Budget>(`/budgets/${id}`)
  },

  getStatus(
    id: string,
    query?: { month?: number; year?: number },
  ): Promise<BudgetStatus> {
    const q = new URLSearchParams()
    if (query?.month != null) q.set('month', String(query.month))
    if (query?.year != null) q.set('year', String(query.year))
    const qs = q.toString()
    return request<BudgetStatus>(`/budgets/${id}/status${qs ? `?${qs}` : ''}`)
  },

  createMonthly(data: MonthlyBudgetCreateInput): Promise<Budget> {
    return request<Budget>('/budgets', {
      method: 'POST',
      body: JSON.stringify(monthlyPayload(data)),
    })
  },

  updateMonthly(id: string, data: MonthlyBudgetUpdateInput): Promise<Budget> {
    return request<Budget>(`/budgets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(monthlyPayload(data)),
    })
  },

  delete(id: string): Promise<void> {
    return request<void>(`/budgets/${id}`, { method: 'DELETE' })
  },
}
