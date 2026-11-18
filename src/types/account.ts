import type { PublicOwner } from './owner'

export type AccountType = 'investment' | 'savings' | 'checking'

export interface Account {
  id: string
  name: string
  type: AccountType
  balance: number
  bankName?: string | null
  shareWithPartner?: boolean
  owner?: PublicOwner | null
}

export interface AccountCreateInput {
  name: string
  type: AccountType
  initialBalance: number
  bankName?: string | null
  shareWithPartner?: boolean
}

export interface AccountEditInput {
  name: string
  type: AccountType
  balance: number
  delta?: number
  bankName?: string | null
  shareWithPartner?: boolean
}

export type AccountUpdateInput = Partial<AccountEditInput>
