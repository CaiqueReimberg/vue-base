import type {
  InstallmentExpenseCreateInput,
  Transaction,
  TransactionCreateInput,
  TransactionsListResponse,
  TransactionType,
  TransactionUpdateInput,
} from '@/types/transaction'
import { request } from './client'

export const transactionsApi = {
  getById(id: string): Promise<Transaction> {
    return request<Transaction>(`/transactions/${id}`)
  },

  list(params?: {
    type?: TransactionType
    accountId?: string
    cardId?: string
    page?: number
    limit?: number
  }): Promise<TransactionsListResponse> {
    const search = new URLSearchParams()
    if (params?.type) search.set('type', params.type)
    if (params?.accountId) search.set('accountId', params.accountId)
    if (params?.cardId) search.set('cardId', params.cardId)
    if (params?.page) search.set('page', String(params.page))
    if (params?.limit) search.set('limit', String(params.limit))
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request<TransactionsListResponse>(`/transactions${suffix}`)
  },

  createExpense(data: TransactionCreateInput): Promise<Transaction> {
    return request<Transaction>('/transactions/expense', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  createInstallmentExpense(data: InstallmentExpenseCreateInput): Promise<Transaction[]> {
    return request<Transaction[]>('/transactions/expense/installments', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  createIncome(data: TransactionCreateInput): Promise<Transaction> {
    return request<Transaction>('/transactions/income', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update(id: string, data: TransactionUpdateInput): Promise<Transaction> {
    return request<Transaction>(`/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  delete(id: string): Promise<void> {
    return request<void>(`/transactions/${id}`, { method: 'DELETE' })
  },
}
