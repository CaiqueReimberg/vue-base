export interface CardInvoiceTransaction {
  id: string
  description: string
  amount: number
  occurredAt: string
  installmentNumber?: number | null
  installmentTotal?: number | null
}

export interface CardInvoicePeriod {
  periodStart: string
  periodEnd: string
  dueDate: string
  total: number
  transactionCount: number
  transactions: CardInvoiceTransaction[]
}

import type { PublicOwner } from './owner'

export interface CardInvoicesResponse {
  card: {
    id: string
    name: string
    closingDay: number
    dueDay: number
    limitAmount: number
    owner?: PublicOwner | null
  }
  invoices: CardInvoicePeriod[]
}
