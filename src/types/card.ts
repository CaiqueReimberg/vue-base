import type { PublicOwner } from './owner'

export interface CardMonthInvoice {
  id: string
  referenceMonth: string
  amount: number
  dueDay: number
  isShared: boolean
  paid: boolean
  paidAt: string | null
  paidByUserId?: string | null
  paidBy?: PublicOwner | null
}

export interface Card {
  id: string
  name: string
  limitAmount: number
  closingDay: number
  dueDay: number
  shareWithPartner?: boolean
  owner?: PublicOwner | null
  monthInvoice?: CardMonthInvoice | null
  analysisId?: string | null
  analysisItemsCount?: number
  analysisTotalAmount?: number | null
  deduplicated?: boolean
}

export interface CardCreateInput {
  name: string
  limitAmount?: number
  closingDay?: number
  dueDay?: number
  shareWithPartner?: boolean
}

export type CardUpdateInput = Partial<CardCreateInput>
