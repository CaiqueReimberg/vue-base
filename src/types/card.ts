export interface Card {
  id: string
  name: string
  limitAmount: number
  closingDay: number
  dueDay: number
}

export interface CardCreateInput {
  name: string
  limitAmount: number
  closingDay: number
  dueDay: number
}

export type CardUpdateInput = Partial<CardCreateInput>
