import type {
  RecurringCreateInput,
  RecurringMonthlyStatusResponse,
} from '@/types/recurring'
import { request } from './client'

export const recurringApi = {
  create(data: RecurringCreateInput): Promise<unknown> {
    return request('/recurring', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update(id: string, data: Partial<RecurringCreateInput>): Promise<unknown> {
    return request(`/recurring/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  setMonthAmount(
    id: string,
    referenceMonth: string,
    amount: number,
  ): Promise<{ recurringId: string; referenceMonth: string; amount: number }> {
    return request(`/recurring/${id}/month-amount`, {
      method: 'PUT',
      body: JSON.stringify({ referenceMonth, amount }),
    })
  },

  getMonthlyStatus(month: string): Promise<RecurringMonthlyStatusResponse> {
    return request(`/recurring/monthly-status?month=${encodeURIComponent(month)}`)
  },

  markAsPaid(
    id: string,
    referenceMonth: string,
    amount?: number,
    paidByUserId?: string,
  ): Promise<{ paidAt: string; paid: boolean; paidBy?: { id: string; email: string; name: string | null } | null }> {
    return request(`/recurring/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify({
        referenceMonth,
        ...(amount !== undefined ? { amount } : {}),
        ...(paidByUserId ? { paidByUserId } : {}),
      }),
    })
  },

  unmarkAsPaid(id: string, referenceMonth: string): Promise<void> {
    return request(`/recurring/${id}/pay/${encodeURIComponent(referenceMonth)}`, {
      method: 'DELETE',
    })
  },

  delete(id: string): Promise<void> {
    return request(`/recurring/${id}`, {
      method: 'DELETE',
    })
  },
}
