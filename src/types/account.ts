import type { PublicOwner } from './owner'

export type AccountType = 'checking' | 'savings'

export interface Account {
  id: string
  name: string
  type: AccountType
  balance: number
  shareWithPartner?: boolean
  owner?: PublicOwner | null
}

export interface AccountCreateInput {
  name: string
  type: AccountType
  initialBalance: number
  shareWithPartner?: boolean
}

export interface AccountEditInput {
  name: string
  type: AccountType
  balance: number
  shareWithPartner?: boolean
}

export type AccountUpdateInput = Partial<AccountEditInput>
