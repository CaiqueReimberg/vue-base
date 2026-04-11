import type { PublicOwner } from './owner'

export type TransactionType = 'expense' | 'income'

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
  /** Visível para o parceiro no vínculo + entra no orçamento compartilhado quando true. */
  isShared?: boolean
  installmentNumber?: number | null
  installmentTotal?: number | null
  account?: TransactionRelationRef | null
  card?: TransactionRelationRef | null
  owner?: PublicOwner | null
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
  isShared?: boolean
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
