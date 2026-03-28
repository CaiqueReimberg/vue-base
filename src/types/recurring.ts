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
  accountId?: string
  cardId?: string
}
