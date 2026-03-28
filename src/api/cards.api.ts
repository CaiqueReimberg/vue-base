import type { CardInvoicesResponse } from '@/types/card-invoice'
import type { Card, CardCreateInput, CardUpdateInput } from '@/types/card'
import { request } from './client'

export const cardsApi = {
  list(): Promise<Card[]> {
    return request<Card[]>('/cards')
  },

  getById(id: string): Promise<Card> {
    return request<Card>(`/cards/${id}`)
  },

  getInvoices(
    id: string,
    opts?: { pastCycles?: number; futureCycles?: number },
  ): Promise<CardInvoicesResponse> {
    const p = new URLSearchParams()
    if (opts?.pastCycles != null) p.set('pastCycles', String(opts.pastCycles))
    if (opts?.futureCycles != null) p.set('futureCycles', String(opts.futureCycles))
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
}
