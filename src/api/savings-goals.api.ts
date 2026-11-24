import { request } from './client'

export interface SavingsContribution {
  id: string
  amount: number
  contributedAt: string
  note: string | null
  userId: string
}

export interface LinkedAccountSummary {
  id: string
  name: string
  bankName: string | null
  balance: number
}

export interface SavingsGoal {
  id: string
  name: string
  targetAmount: number
  targetDate: string | null
  isShared: boolean
  archived: boolean
  ownerId: string
  accountId: string | null
  linkedAccount: LinkedAccountSummary | null
  saved: number
  remaining: number
  percent: number
  completed: boolean
  monthsLeft: number | null
  monthlyNeeded: number | null
  contributions: SavingsContribution[]
}

export const savingsGoalsApi = {
  list(): Promise<SavingsGoal[]> {
    return request('/savings-goals')
  },

  create(payload: {
    name: string
    targetAmount: number
    targetDate?: string | null
    isShared?: boolean
    accountId?: string | null
  }): Promise<SavingsGoal> {
    return request('/savings-goals', { method: 'POST', body: JSON.stringify(payload) })
  },

  update(
    id: string,
    payload: {
      name?: string
      targetAmount?: number
      targetDate?: string | null
      isShared?: boolean
      archived?: boolean
      accountId?: string | null
    },
  ): Promise<SavingsGoal> {
    return request(`/savings-goals/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },

  remove(id: string): Promise<{ deleted: boolean }> {
    return request(`/savings-goals/${id}`, { method: 'DELETE' })
  },

  addContribution(
    id: string,
    payload: {
      amount: number
      note?: string | null
      contributedAt?: string
      accountId?: string | null
    },
  ): Promise<SavingsGoal> {
    return request(`/savings-goals/${id}/contributions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  removeContribution(id: string, contributionId: string): Promise<SavingsGoal> {
    return request(`/savings-goals/${id}/contributions/${contributionId}`, { method: 'DELETE' })
  },
}
