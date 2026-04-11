import type { PublicOwner } from './owner'

export interface Card {
  id: string
  name: string
  limitAmount: number
  closingDay: number
  dueDay: number
  shareWithPartner?: boolean
  /** Quando o cartão é de outra pessoa do vínculo */
  owner?: PublicOwner | null
}

export interface CardCreateInput {
  name: string
  limitAmount: number
  closingDay: number
  dueDay: number
  shareWithPartner?: boolean
}

export type CardUpdateInput = Partial<CardCreateInput>
