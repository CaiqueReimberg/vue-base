import type { PublicOwner } from './owner'

export type RecurringKind = 'fixed_bill' | 'subscription'

export type RecurringFlowType = 'expense' | 'income'

export type RecurringFrequency = 'monthly' | 'yearly'

export interface RecurringCreateInput {
  name: string
  kind: RecurringKind
  transactionType: RecurringFlowType
  amount: number
  description?: string
  startDate: string
  endDate?: string
  frequency?: RecurringFrequency
  dueDay?: number
  accountId?: string
  cardId?: string
  isShared?: boolean
}

export interface RecurringMonthlyItem {
  id: string
  name: string
  amount: number
  dueDay: number | null
  kind: RecurringKind
  transactionType: RecurringFlowType
  category?: { id: string; name: string } | null
  owner?: PublicOwner | null
  paid: boolean
  paidAt: string | null
  paidBy?: PublicOwner | null
}

export interface RecurringMonthlyStatusResponse {
  month: string
  data: RecurringMonthlyItem[]
}
