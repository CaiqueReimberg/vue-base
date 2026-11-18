import { defineStore } from 'pinia'
import type { Account, AccountCreateInput, AccountUpdateInput } from '@/types/account'
import { accountsApi } from '@/api/accounts.api'

export const useAccountsStore = defineStore('accounts', {
  state: () => ({
    accounts: [] as Account[],
    loading: false,
    error: null as string | null,
  }),

  getters: {
    formatCurrency() {
      return (value: number) =>
        new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(value)
    },
    accountById: (state) => (id: string) => state.accounts.find((a) => a.id === id),
    typeLabel(): (type: string) => string {
      return (type: string) => {
        if (type === 'investment') return 'CDB / Investimento'
        if (type === 'savings') return 'Caixinha / Reserva'
        return 'Conta Corrente'
      }
    },
    totalSavedBalance(state): number {
      return state.accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0)
    },
  },

  actions: {
    async fetchAll() {
      this.loading = true
      this.error = null
      try {
        this.accounts = await accountsApi.list()
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao carregar contas'
      } finally {
        this.loading = false
      }
    },

    async fetchOne(id: string) {
      this.loading = true
      this.error = null
      try {
        const account = await accountsApi.getById(id)
        const idx = this.accounts.findIndex((a) => a.id === id)
        if (idx >= 0) this.accounts[idx] = account
        else this.accounts.push(account)
        return account
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao carregar conta'
        throw e
      } finally {
        this.loading = false
      }
    },

    async create(data: AccountCreateInput) {
      this.error = null
      try {
        const account = await accountsApi.create(data)
        this.accounts.unshift(account)
        return account
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao criar conta'
        throw e
      }
    },

    async update(id: string, data: AccountUpdateInput) {
      this.error = null
      try {
        const account = await accountsApi.update(id, data)
        const idx = this.accounts.findIndex((a) => a.id === id)
        if (idx >= 0) this.accounts[idx] = account
        return account
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao atualizar conta'
        throw e
      }
    },

    async adjustBalance(id: string, delta: number) {
      return this.update(id, { delta })
    },

    async remove(id: string) {
      this.error = null
      try {
        await accountsApi.delete(id)
        this.accounts = this.accounts.filter((a) => a.id !== id)
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao excluir conta'
        throw e
      }
    },
  },
})
