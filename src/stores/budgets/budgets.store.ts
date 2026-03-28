import { defineStore } from 'pinia'
import type { Budget, MonthlyBudgetCreateInput, MonthlyBudgetUpdateInput } from '@/types/budget'
import { budgetsApi } from '@/api/budgets.api'

export const useBudgetsStore = defineStore('budgets', {
  state: () => ({
    budgets: [] as Budget[],
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
    budgetById: (state) => (id: string) => state.budgets.find((b) => b.id === id),
  },

  actions: {
    async fetchMonthlyList() {
      this.loading = true
      this.error = null
      try {
        const res = await budgetsApi.list({ period: 'monthly', limit: 100 })
        this.budgets = res.data
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao carregar orçamentos'
      } finally {
        this.loading = false
      }
    },

    async fetchOne(id: string) {
      this.loading = true
      this.error = null
      try {
        const budget = await budgetsApi.getById(id)
        const idx = this.budgets.findIndex((b) => b.id === id)
        if (idx >= 0) this.budgets[idx] = budget
        else this.budgets.push(budget)
        return budget
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao carregar orçamento'
        throw e
      } finally {
        this.loading = false
      }
    },

    async create(data: MonthlyBudgetCreateInput) {
      this.loading = true
      this.error = null
      try {
        const budget = await budgetsApi.createMonthly(data)
        this.budgets.unshift(budget)
        return budget
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao criar orçamento'
        throw e
      } finally {
        this.loading = false
      }
    },

    async update(id: string, data: MonthlyBudgetUpdateInput) {
      this.loading = true
      this.error = null
      try {
        const budget = await budgetsApi.updateMonthly(id, data)
        const idx = this.budgets.findIndex((b) => b.id === id)
        if (idx >= 0) this.budgets[idx] = budget
        return budget
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao atualizar orçamento'
        throw e
      } finally {
        this.loading = false
      }
    },

    async remove(id: string) {
      this.loading = true
      this.error = null
      try {
        await budgetsApi.delete(id)
        this.budgets = this.budgets.filter((b) => b.id !== id)
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao excluir orçamento'
        throw e
      } finally {
        this.loading = false
      }
    },
  },
})
