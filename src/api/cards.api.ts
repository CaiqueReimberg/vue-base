import type { CardInvoicesResponse } from '@/types/card-invoice'
import type { Card, CardCreateInput, CardUpdateInput } from '@/types/card'
import type { PublicOwner } from '@/types/owner'
import { request } from './client'

export const cardsApi = {
  list(month?: string): Promise<Card[]> {
    const suffix = month ? `?month=${encodeURIComponent(month)}` : ''
    return request<Card[]>(`/cards${suffix}`)
  },

  getById(id: string): Promise<Card> {
    return request<Card>(`/cards/${id}`)
  },

  getInvoices(
    id: string,
    opts?: {
      pastCycles?: number
      futureCycles?: number
      referenceMonth?: string
    },
  ): Promise<CardInvoicesResponse> {
    const p = new URLSearchParams()
    if (opts?.pastCycles != null) p.set('pastCycles', String(opts.pastCycles))
    if (opts?.futureCycles != null) p.set('futureCycles', String(opts.futureCycles))
    if (opts?.referenceMonth) p.set('referenceMonth', opts.referenceMonth)
    const q = p.toString() ? `?${p}` : ''
    return request<CardInvoicesResponse>(`/cards/${id}/invoices${q}`)
  },

  create(data: CardCreateInput): Promise<Card> {
    return request<Card>('/cards', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update(id: string, data: CardUpdateInput): Promise<Card> {
    return request<Card>(`/cards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  delete(id: string): Promise<void> {
    return request<void>(`/cards/${id}`, { method: 'DELETE' })
  },

  upsertMonthlyInvoice(
    cardId: string,
    payload: {
      referenceMonth: string
      amount: number
      dueDay?: number
      isShared?: boolean
    },
  ): Promise<{ status: 'created' | 'updated' | 'already_paid' }> {
    return request(`/cards/${cardId}/monthly-invoice`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  payMonthlyInvoice(
    cardId: string,
    payload: {
      referenceMonth: string
      amount?: number
      paidByUserId?: string
    },
  ): Promise<{ paid: boolean; paidAt: string; paidBy?: PublicOwner | null }> {
    return request(`/cards/${cardId}/monthly-invoice/pay`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  unpayMonthlyInvoice(cardId: string, referenceMonth: string): Promise<{ unpaid: boolean }> {
    return request(`/cards/${cardId}/monthly-invoice/pay/${encodeURIComponent(referenceMonth)}`, {
      method: 'DELETE',
    })
  },

  deleteMonthlyInvoice(cardId: string, referenceMonth: string): Promise<{ deleted: boolean }> {
    return request(`/cards/${cardId}/monthly-invoice/${encodeURIComponent(referenceMonth)}`, {
      method: 'DELETE',
    })
  },
}
