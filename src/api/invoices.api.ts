import { request } from './client'
import type { PublicOwner } from '@/types/owner'

export interface ParsedInvoiceItem {
  id: string
  date: string
  description: string
  merchant: string
  amount: number
  category: string
  installment?: string | null
}

export interface SavedInvoiceAnalysis {
  id: string
  cardId?: string | null
  cardName: string
  referenceMonth: string
  totalAmount: number
  itemsCount: number
  items: ParsedInvoiceItem[]
  isShared: boolean
  owner?: PublicOwner | null
  syncedBillStatus?: 'created' | 'updated' | 'already_paid' | 'none'
  syncedBillName?: string | null
  createdAt: string
  updatedAt?: string
}

export const invoicesApi = {
  list(month?: string): Promise<SavedInvoiceAnalysis[]> {
    const query = month ? `?month=${encodeURIComponent(month)}` : ''
    return request(`/invoices${query}`)
  },

  create(payload: {
    cardId?: string
    cardName: string
    referenceMonth: string
    items: ParsedInvoiceItem[]
    isShared?: boolean
    syncToMonthlyBill?: boolean
    dueDay?: number
  }): Promise<SavedInvoiceAnalysis> {
    return request('/invoices', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  analyzeContext(items: ParsedInvoiceItem[]): Promise<{ items: ParsedInvoiceItem[] }> {
    return request('/invoices/analyze', {
      method: 'POST',
      body: JSON.stringify({ items }),
    })
  },

  reanalyze(id: string): Promise<SavedInvoiceAnalysis> {
    return request(`/invoices/${id}/reanalyze`, {
      method: 'POST',
    })
  },

  updateItems(id: string, items: ParsedInvoiceItem[]): Promise<SavedInvoiceAnalysis> {
    return request(`/invoices/${id}/items`, {
      method: 'PATCH',
      body: JSON.stringify({ items }),
    })
  },

  delete(id: string): Promise<{ deleted: boolean }> {
    return request(`/invoices/${id}`, {
      method: 'DELETE',
    })
  },
}
