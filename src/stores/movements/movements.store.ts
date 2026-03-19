import { defineStore } from 'pinia'

export type MovementType = 'expense' | 'income' | 'adjustment'

export interface Movement {
  id: string
  type: MovementType
  description: string
  amount: number
  author: string
  account: string
  origin: string
  createdAt: string
}

export interface MovementsState {
  movements: Movement[]
  searchQuery: string
  filterType: MovementType | 'all'
  filterAccount: string
  filterOrigin: string
}

const MOCK_MOVEMENTS: Movement[] = [
  {
    id: '1',
    type: 'expense',
    description: 'Mercado - frutas e legumes',
    amount: 45.9,
    author: 'Beatriz',
    account: 'Nubank',
    origin: 'WhatsApp',
    createdAt: 'há 12 min',
  },
  {
    id: '2',
    type: 'expense',
    description: 'Jantar restaurante',
    amount: 150,
    author: 'Bruno',
    account: 'Itaú',
    origin: 'Manual',
    createdAt: 'ontem',
  },
  {
    id: '3',
    type: 'income',
    description: 'Salário',
    amount: 5000,
    author: 'Beatriz',
    account: 'Nubank',
    origin: 'Manual',
    createdAt: 'ontem',
  },
  {
    id: '4',
    type: 'adjustment',
    description: 'Ajuste de saldo',
    amount: 20,
    author: 'Bruno',
    account: 'Itaú',
    origin: 'Manual',
    createdAt: 'há 2 dias',
  },
  {
    id: '5',
    type: 'expense',
    description: 'Farmácia',
    amount: 89.5,
    author: 'Beatriz',
    account: 'Nubank',
    origin: 'WhatsApp',
    createdAt: 'há 3 dias',
  },
  {
    id: '6',
    type: 'income',
    description: 'Freelance',
    amount: 1200,
    author: 'Bruno',
    account: 'Itaú',
    origin: 'Manual',
    createdAt: 'há 4 dias',
  },
  {
    id: '7',
    type: 'expense',
    description: 'Conta de luz',
    amount: 320,
    author: 'Beatriz',
    account: 'Nubank',
    origin: 'Manual',
    createdAt: 'há 5 dias',
  },
  {
    id: '8',
    type: 'expense',
    description: 'Supermercado',
    amount: 280.4,
    author: 'Bruno',
    account: 'Itaú',
    origin: 'WhatsApp',
    createdAt: 'há 6 dias',
  },
  {
    id: '9',
    type: 'income',
    description: 'Reembolso',
    amount: 150,
    author: 'Beatriz',
    account: 'Nubank',
    origin: 'Manual',
    createdAt: 'há 1 semana',
  },
  {
    id: '10',
    type: 'adjustment',
    description: 'Correção',
    amount: -15,
    author: 'Bruno',
    account: 'Itaú',
    origin: 'Manual',
    createdAt: 'há 1 semana',
  },
]

export const useMovementsStore = defineStore('movements', {
  state: (): MovementsState => ({
    movements: MOCK_MOVEMENTS,
    searchQuery: '',
    filterType: 'all',
    filterAccount: 'all',
    filterOrigin: 'all',
  }),

  getters: {
    filteredMovements(state): Movement[] {
      let list = state.movements

      if (state.searchQuery.trim()) {
        const q = state.searchQuery.trim().toLowerCase()
        list = list.filter((m) => m.description.toLowerCase().includes(q))
      }

      if (state.filterType !== 'all') {
        list = list.filter((m) => m.type === state.filterType)
      }

      if (state.filterAccount !== 'all') {
        list = list.filter((m) => m.account === state.filterAccount)
      }

      if (state.filterOrigin !== 'all') {
        list = list.filter((m) => m.origin === state.filterOrigin)
      }

      return list
    },

    movementsCount(): number {
      return this.filteredMovements.length
    },

    formatCurrency() {
      return (value: number) =>
        new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(Math.abs(value))
    },

    typeLabel() {
      return (type: MovementType) => {
        const labels: Record<MovementType, string> = {
          expense: 'Gasto',
          income: 'Entrada',
          adjustment: 'Ajuste',
        }
        return labels[type]
      }
    },
  },

  actions: {
    setSearchQuery(query: string) {
      this.searchQuery = query
    },
    setFilterType(value: MovementType | 'all') {
      this.filterType = value
    },
    setFilterAccount(value: string) {
      this.filterAccount = value
    },
    setFilterOrigin(value: string) {
      this.filterOrigin = value
    },
  },
})
