import type { PublicOwner } from './owner'

export type TransactionType = 'expense' | 'income'

/** Alinhado ao backend (`TransactionKind`). */
export type TransactionKind =
  | 'purchase'
  | 'invoice_payment'
  | 'transfer'
  | 'adjustment'
  | 'debt'

export type DebtCategory = 'car' | 'home' | 'personal_loan' | 'student' | 'other'

export interface TransactionRelationRef {
  id: string
  name?: string
}

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  description: string
  occurredAt: string
  createdAt: string
  dueDate?: string | null
  paidAt?: string | null
  paidBy?: PublicOwner | null
  paidByByMonth?: Record<string, PublicOwner>
  status?: 'pending' | 'cleared' | 'paid'
  paidMonths?: string[]
  /** Visível para o parceiro no vínculo + entra no orçamento compartilhado quando true. */
  isShared?: boolean
  installmentNumber?: number | null
  installmentTotal?: number | null
  account?: TransactionRelationRef | null
  card?: TransactionRelationRef | null
  category?: TransactionRelationRef | null
  owner?: PublicOwner | null
  kind?: TransactionKind | null
  debtCategory?: DebtCategory | null
  referenceMonth?: string | null
  notes?: string | null
}

export interface TransactionsListResponse {
  data: Transaction[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface TransactionCreateInput {
  amount: number
  description: string
  occurredAt: string
  accountId?: string
  cardId?: string
  isShared?: boolean
}

export interface TransactionUpdateInput {
  type?: TransactionType
  accountId?: string
  cardId?: string
  amount?: number
  description?: string
  occurredAt?: string
  dueDate?: string | null
  paidAt?: string | null
  paidByUserId?: string | null
  status?: 'pending' | 'cleared' | 'paid'
  paymentMonth?: string | null
  isShared?: boolean
  kind?: TransactionKind
  debtCategory?: DebtCategory
  referenceMonth?: string | null
  notes?: string | null
  installmentTotal?: number
}

export interface DebtExpenseCreateInput {
  amount: number
  /** Quantidade de parcelas do contrato (estimativa do total: parcela × parcelas). */
  installmentTotal: number
  description: string
  occurredAt: string
  debtCategory: DebtCategory
  referenceMonth?: string
  isShared?: boolean
  notes?: string
}

export interface InstallmentExpenseCreateInput {
  amount: number
  description: string
  occurredAt: string
  installmentTotal: number
  accountId?: string
  cardId?: string
  isShared?: boolean
}
