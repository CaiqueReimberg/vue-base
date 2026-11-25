import type { PublicOwner } from './owner'

export interface RecurringBillCommitmentItem {
  id: string
  name: string
  value: number
  dueDay: number | null
  paid: boolean
  paidAt?: string | null
  paidByUserId?: string | null
  paidBy?: PublicOwner | null
  owner?: PublicOwner | null
  ownerId?: string
  category?: string | null
  isShared?: boolean
}

export interface CardInvoiceCommitmentItem {
  invoiceId?: string | null
  cardId: string
  name: string
  invoiceValue: number
  closingDay: number
  dueDay: number
  paid: boolean
  paidAt?: string | null
  paidByUserId?: string | null
  paidBy?: PublicOwner | null
  owner?: PublicOwner | null
  ownerId?: string
  isShared?: boolean
  analysisId?: string | null
}

export interface PartnerMonthlyOverview {
  userId: string
  name: string
  email: string
  monthlyIncome: number
  individualBillsTotal: number
  sharedBillsHalf: number
  totalBillsShare: number
  savingsGoal: number
  savingsPaid: boolean
  freeBalance: number
  savedInAccounts: number
}

export interface MonthlyCommitmentResponse {
  month: string
  totalCommitted: number
  totalPaid: number
  remainingToPay: number
  freeBalance: number
  shareOverview?: boolean
  partnerOverview?: PartnerMonthlyOverview | null
  breakdown: {
    recurringBills: {
      total: number
      paid: number
      items: RecurringBillCommitmentItem[]
    }
    cardInvoices: {
      total: number
      paid: number
      items: CardInvoiceCommitmentItem[]
    }
  }
}

export type AgendaEventType = 'bill_due' | 'debt_due' | 'invoice_close' | 'invoice_due'

export interface AgendaEvent {
  day: number | null
  type: AgendaEventType
  name: string
  subtitle?: string | null
  value: number | null
  paid: boolean
  paidBy?: PublicOwner | null
  isShared?: boolean
  referenceId: string
  ownerId?: string
}

export interface AgendaResponse {
  month: string
  events: AgendaEvent[]
}
