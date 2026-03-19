import type { Account, AccountCreateInput, AccountUpdateInput } from '@/types/account'
import { request } from './client'

export const accountsApi = {
  list(): Promise<Account[]> {
    return request<Account[]>('/accounts')
  },

  getById(id: string): Promise<Account> {
    return request<Account>(`/accounts/${id}`)
  },

  create(data: AccountCreateInput): Promise<Account> {
    return request<Account>('/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update(id: string, data: AccountUpdateInput): Promise<Account> {
    return request<Account>(`/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  delete(id: string): Promise<void> {
    return request<void>(`/accounts/${id}`, { method: 'DELETE' })
  },
}
