import { defineStore } from 'pinia'

export interface Expense {
  id: string
  description: string
  amount: number
  category: string
  author: string
  createdAt: string
  status: 'pending' | 'confirmed'
}

export interface DashboardState {
  coupleName: string
  periodLabel: string
  budget: number
  spent: number
  monthlyIncome: number
  projectedBalance: number
  pendingMessagesCount: number
  expenses: Expense[]
  budgetStatus: 'within' | 'over'
}

export const useDashboardStore = defineStore('dashboard', {
  state: (): DashboardState => ({
    coupleName: 'Beatriz & Caique',
    periodLabel: 'Março de 2026',
    budget: 3000,
    spent: 570.89,
    monthlyIncome: 11150,
    projectedBalance: 10579.11,
    pendingMessagesCount: 2,
    budgetStatus: 'within',
    expenses: [
      {
        id: '1',
        description: 'Mercado - frutas e legumes',
        amount: 45.9,
        category: 'market',
        author: 'Beatriz',
        createdAt: 'há 9 min',
        status: 'confirmed',
      },
    ],
  }),

  getters: {
    remainingBalance(state): number {
      return state.budget - state.spent
    },

    budgetUsedPercent(state): number {
      if (state.budget <= 0) return 0
      return Math.min(100, Math.round((state.spent / state.budget) * 100))
    },

    formatCurrency() {
      return (value: number) =>
        new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(value)
    },
  },
})
