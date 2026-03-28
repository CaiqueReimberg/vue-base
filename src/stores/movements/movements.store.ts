import { defineStore } from 'pinia'
import { recurringApi } from '@/api/recurring.api'
import { transactionsApi } from '@/api/transactions.api'
import type {
  Transaction,
  TransactionCreateInput,
  TransactionType,
  TransactionUpdateInput,
} from '@/types/transaction'

function endDateAfterMonths(startYmd: string, months: number): string {
  const d = new Date(`${startYmd}T12:00:00`)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export type MovementType = TransactionType
export type Movement = Transaction

export interface MovementsState {
  movements: Movement[]
  loading: boolean
  error: string | null
  searchQuery: string
  filterType: MovementType | 'all'
  filterAccountId: string | 'all'
  filterCardId: string | 'all'
  page: number
  limit: number
  total: number
  totalPages: number
}

export const useMovementsStore = defineStore('movements', {
  state: (): MovementsState => ({
    movements: [],
    loading: false,
    error: null,
    searchQuery: '',
    filterType: 'all',
    filterAccountId: 'all',
    filterCardId: 'all',
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  }),

  getters: {
    filteredMovements(state): Movement[] {
      let list = state.movements

      if (state.searchQuery.trim()) {
        const q = state.searchQuery.trim().toLowerCase()
        list = list.filter((m) => m.description.toLowerCase().includes(q))
      }

      return list
    },

    movementsCount(): number {
      return this.searchQuery.trim() ? this.filteredMovements.length : this.total
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
    setFilterAccountId(value: string | 'all') {
      this.filterAccountId = value
    },
    setFilterCardId(value: string | 'all') {
      this.filterCardId = value
    },
    setPage(value: number) {
      this.page = value
    },
    async fetchAll() {
      this.loading = true
      this.error = null
      try {
        const accountId =
          this.filterAccountId !== 'all' && this.filterCardId === 'all'
            ? this.filterAccountId
            : undefined
        const cardId =
          this.filterCardId !== 'all' && this.filterAccountId === 'all'
            ? this.filterCardId
            : undefined

        const response = await transactionsApi.list({
          type: this.filterType === 'all' ? undefined : this.filterType,
          accountId,
          cardId,
          page: this.page,
          limit: this.limit,
        })
        this.movements = response.data
        this.total = response.pagination.total
        this.totalPages = response.pagination.totalPages || 1
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao carregar movimentações'
        throw e
      } finally {
        this.loading = false
      }
    },
    async create(
      data: TransactionCreateInput & {
        type: MovementType
        createRecurringFromCard?: boolean
        recurringMonths?: number
        installmentTotal?: number
      },
    ) {
      this.loading = true
      this.error = null
      try {
        const {
          type,
          createRecurringFromCard,
          recurringMonths,
          installmentTotal,
          ...payload
        } = data
        const incomePayload: TransactionCreateInput = {
          amount: payload.amount,
          description: payload.description,
          occurredAt: payload.occurredAt,
          accountId: payload.accountId,
        }
        if (type === 'expense') {
          if (installmentTotal != null && installmentTotal >= 2) {
            await transactionsApi.createInstallmentExpense({
              amount: payload.amount,
              description: payload.description,
              occurredAt: payload.occurredAt,
              accountId: payload.accountId,
              cardId: payload.cardId,
              installmentTotal,
            })
          } else {
            await transactionsApi.createExpense(payload)
            if (createRecurringFromCard && payload.cardId) {
              const startDate = payload.occurredAt.slice(0, 10)
              const endDate =
                recurringMonths != null && recurringMonths > 0
                  ? endDateAfterMonths(startDate, recurringMonths)
                  : undefined
              await recurringApi.create({
                name: payload.description.trim().slice(0, 120) || 'Recorrente',
                kind: 'fixed_bill',
                transactionType: 'expense',
                frequency: 'monthly',
                amount: payload.amount,
                description: payload.description,
                startDate,
                endDate,
                cardId: payload.cardId,
              })
            }
          }
        } else {
          await transactionsApi.createIncome(incomePayload)
        }
        this.page = 1
        await this.fetchAll()
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao criar movimentação'
        throw e
      } finally {
        this.loading = false
      }
    },
    async update(id: string, data: TransactionUpdateInput) {
      this.loading = true
      this.error = null
      try {
        await transactionsApi.update(id, data)
        await this.fetchAll()
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao atualizar movimentação'
        throw e
      } finally {
        this.loading = false
      }
    },
    async remove(id: string) {
      this.loading = true
      this.error = null
      try {
        await transactionsApi.delete(id)
        if (this.movements.length === 1 && this.page > 1) {
          this.page -= 1
        }
        await this.fetchAll()
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao excluir movimentação'
        throw e
      } finally {
        this.loading = false
      }
    },
  },
})
