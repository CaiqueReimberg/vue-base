import type {
  CreateIncomeInput,
  IncomeEntry,
  MonthlyIncomesResponse,
  UpdateIncomeInput,
} from '@/types/income'
import { request } from './client'

export const incomesApi = {
  listByMonth(month?: string): Promise<MonthlyIncomesResponse> {
    const suffix = month ? `?month=${encodeURIComponent(month)}` : ''
    return request<MonthlyIncomesResponse>(`/incomes${suffix}`)
  },

  create(data: CreateIncomeInput): Promise<IncomeEntry> {
    return request<IncomeEntry>('/incomes', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update(id: string, data: UpdateIncomeInput): Promise<IncomeEntry> {
    return request<IncomeEntry>(`/incomes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  remove(id: string, stopFromMonth?: string): Promise<{ deleted?: boolean; stopped?: boolean }> {
    const suffix = stopFromMonth ? `?stopFromMonth=${encodeURIComponent(stopFromMonth)}` : ''
    return request<{ deleted?: boolean; stopped?: boolean }>(`/incomes/${id}${suffix}`, {
      method: 'DELETE',
    })
  },
}
