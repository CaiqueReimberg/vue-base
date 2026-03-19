export type AccountType = 'checking' | 'savings'

export interface Account {
  id: string
  name: string
  type: AccountType
  balance: number
}

export interface AccountCreateInput {
  name: string
  type: AccountType
  initialBalance: number
}

export interface AccountEditInput {
  name: string
  type: AccountType
  balance: number
}

export type AccountUpdateInput = Partial<AccountEditInput>
