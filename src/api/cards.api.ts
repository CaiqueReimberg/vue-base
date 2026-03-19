import type { Card, CardCreateInput, CardUpdateInput } from '@/types/card'
import { request } from './client'

export const cardsApi = {
  list(): Promise<Card[]> {
    return request<Card[]>('/cards')
  },

  getById(id: string): Promise<Card> {
    return request<Card>(`/cards/${id}`)
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
