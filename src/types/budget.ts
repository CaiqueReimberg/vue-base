export type BudgetScope = 'total' | 'category' | 'person'
export type BudgetPeriod = 'monthly' | 'yearly'

export interface BudgetPersonRef {
  id: string
  name: string | null
  email: string
}

export interface BudgetFamilyRef {
  id: string
  name: string
}

export interface Budget {
  id: string
  name: string
  scope: BudgetScope
  period: BudgetPeriod
  limitAmount: number
  isActive: boolean
  startDate: string | null
  endDate: string | null
  referenceMonth: string | null
  createdAt: string
  updatedAt: string
  category: { id: string; name: string } | null
  person: BudgetPersonRef | null
  family: BudgetFamilyRef | null
}

export interface BudgetListResponse {
  data: Budget[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface BudgetFormOptions {
  persons: BudgetPersonRef[]
  family: BudgetFamilyRef | null
}

/** Orçamento mensal por pessoa (API: scope person + period monthly). */
export interface MonthlyBudgetCreateInput {
  name: string
  referenceMonth: string
  limitAmount: number
  personId: string
  familyId?: string
  isActive?: boolean
}

export type MonthlyBudgetUpdateInput = Partial<MonthlyBudgetCreateInput> & {
  familyId?: string | null
}

export interface BudgetStatus {
  budgetId: string
  name: string
  scope: string
  period: string
  limitAmount: number
  spent: number
  remaining: number
  progress: number
  isExceeded: boolean
  periodStart: string
  periodEnd: string
}
