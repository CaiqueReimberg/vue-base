export interface RecurringBillCommitmentItem {
  id: string
  name: string
  value: number
  dueDay: number | null
  paid: boolean
  paidAt?: string | null
  category?: string | null
  isShared?: boolean
}

export interface CardInvoiceCommitmentItem {
  cardId: string
  name: string
  invoiceValue: number
  closingDay: number
  dueDay: number
  paid: boolean
}

export interface MonthlyCommitmentResponse {
  month: string
  totalCommitted: number
  totalPaid: number
  remainingToPay: number
  freeBalance: number
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

export type AgendaEventType = 'bill_due' | 'invoice_close' | 'invoice_due'

export interface AgendaEvent {
  day: number
  type: AgendaEventType
  name: string
  value: number | null
  paid: boolean
  referenceId: string
  ownerId?: string
}

export interface AgendaResponse {
  month: string
  events: AgendaEvent[]
}
