export type IncomeCategory =
  | 'salary'
  | 'freelance'
  | 'client'
  | 'commission'
  | 'bonus'
  | 'sale'
  | 'investment'
  | 'other'

export interface IncomeEntry {
  id: string
  title: string
  source: string
  category: IncomeCategory
  amount: number
  referenceMonth: string
  receivedAt: string
  isRecurring: boolean
  endMonth: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface IncomeSourceSummary {
  source: string
  amount: number
  count: number
  share: number
}

export interface MonthlyIncomesResponse {
  month: string
  total: number
  fixedTotal: number
  variableTotal: number
  count: number
  items: IncomeEntry[]
  bySource: IncomeSourceSummary[]
  recentSources: string[]
}

export interface CreateIncomeInput {
  title?: string
  source: string
  category?: IncomeCategory
  amount: number
  referenceMonth?: string
  receivedAt?: string
  isRecurring?: boolean
  notes?: string | null
}

export interface UpdateIncomeInput {
  title?: string
  source?: string
  category?: IncomeCategory
  amount?: number
  referenceMonth?: string
  receivedAt?: string
  isRecurring?: boolean
  endMonth?: string | null
  notes?: string | null
}
