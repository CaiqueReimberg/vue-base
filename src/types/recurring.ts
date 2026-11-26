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
  referenceMonth?: string
  isCardInvoice?: boolean
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
  baseAmount?: number
  isMonthOverride?: boolean
  isShared?: boolean
  dueDay: number | null
  kind: RecurringKind
  transactionType: RecurringFlowType
  category?: { id: string; name: string } | null
  owner?: PublicOwner | null
  paid: boolean
  paidAt: string | null
  paidBy?: PublicOwner | null
}

export interface RecurringPausedItem {
  id: string
  name: string
  amount: number
  baseAmount?: number
  isShared?: boolean
  dueDay: number | null
  kind: RecurringKind
  transactionType: RecurringFlowType
  endDate?: string | null
  pausedAfterMonth: string | null
  category?: { id: string; name: string } | null
  owner?: PublicOwner | null
}

export interface RecurringPauseResponse {
  id: string
  endDate: string
  pausedFromMonth: string
  keptCurrentMonthPaid: boolean
}

export interface RecurringMonthlyStatusResponse {
  month: string
  data: RecurringMonthlyItem[]
  pausedData?: RecurringPausedItem[]
}
