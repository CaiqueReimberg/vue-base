import { defineStore } from 'pinia'
import { accountsApi } from '@/api/accounts.api'
import { budgetsApi } from '@/api/budgets.api'
import { transactionsApi } from '@/api/transactions.api'
import type { Budget } from '@/types/budget'

export interface Expense {
  id: string
  description: string
  amount: number
  category: string
  author: string
  createdAt: string
  status: 'pending' | 'confirmed'
}

export type DashboardFilter = 'expense' | 'income' | 'account'

export type DashboardBudgetStatus = 'none' | 'within' | 'over'

export interface DashboardState {
  coupleName: string
  periodLabel: string
  /** Orçamentos mensais individuais (só movimentações não compartilhadas). */
  individualBudgetLimit: number
  individualBudgetSpent: number
  /** Orçamento do casal (movimentações com “compartilhar”). */
  sharedBudgetLimit: number
  sharedBudgetSpent: number
  sharedBudgetIncome: number
  availableBalance: number
  totalExpenses: number
  monthlyIncome: number
  projectedBalance: number
  pendingMessagesCount: number
  expenses: Expense[]
  budgetStatus: DashboardBudgetStatus
  loading: boolean
  error: string | null
  activeFilter: DashboardFilter
}

function currentReferenceMonthParts() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const referenceMonth = `${y}-${String(m).padStart(2, '0')}`
  return { y, m, referenceMonth }
}

function formatPeriodLabel(y: number, month1to12: number): string {
  const raw = new Date(y, month1to12 - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function occurredInCalendarMonth(iso: string, y: number, month1to12: number): boolean {
  const d = new Date(iso)
  return d.getFullYear() === y && d.getMonth() + 1 === month1to12
}

function audienceOf(b: Budget): 'individual' | 'shared' {
  return b.audience ?? 'individual'
}

async function sumTransactionAmountInMonth(
  type: 'expense' | 'income',
  year: number,
  month1to12: number,
): Promise<number> {
  let sum = 0
  let page = 1
  let totalPages = 1
  do {
    const res = await transactionsApi.list({ type, page, limit: 100 })
    for (const tx of res.data) {
      if (occurredInCalendarMonth(tx.occurredAt, year, month1to12)) {
        sum += tx.amount
      }
    }
    totalPages = res.pagination.totalPages || 1
    page += 1
  } while (page <= totalPages)
  return sum
}

export const useDashboardStore = defineStore('dashboard', {
  state: (): DashboardState => ({
    coupleName: 'Painel financeiro',
    periodLabel: '',
    individualBudgetLimit: 0,
    individualBudgetSpent: 0,
    sharedBudgetLimit: 0,
    sharedBudgetSpent: 0,
    sharedBudgetIncome: 0,
    availableBalance: 0,
    totalExpenses: 0,
    monthlyIncome: 0,
    projectedBalance: 0,
    pendingMessagesCount: 0,
    expenses: [],
    budgetStatus: 'none',
    loading: false,
    error: null,
    activeFilter: 'expense',
  }),

  getters: {
    remainingBalance(state): number {
      return state.availableBalance
    },

    individualBudgetUsedPercentRaw(state): number {
      if (state.individualBudgetLimit <= 0) return 0
      return Math.round((state.individualBudgetSpent / state.individualBudgetLimit) * 100)
    },

    sharedBudgetUsedPercentRaw(state): number {
      if (state.sharedBudgetLimit <= 0) return 0
      return Math.round((state.sharedBudgetSpent / state.sharedBudgetLimit) * 100)
    },

    individualBudgetRingPercent(): number {
      return Math.min(100, this.individualBudgetUsedPercentRaw)
    },

    sharedBudgetRingPercent(): number {
      return Math.min(100, this.sharedBudgetUsedPercentRaw)
    },

    individualBudgetExceeded(state): boolean {
      return (
        state.individualBudgetLimit > 0 && state.individualBudgetSpent > state.individualBudgetLimit
      )
    },

    sharedBudgetExceeded(state): boolean {
      return state.sharedBudgetLimit > 0 && state.sharedBudgetSpent > state.sharedBudgetLimit
    },

    hasIndividualBudget(): boolean {
      return this.individualBudgetLimit > 0
    },

    hasSharedBudget(): boolean {
      return this.sharedBudgetLimit > 0
    },

    hasAnyMonthlyBudget(): boolean {
      return this.hasIndividualBudget || this.hasSharedBudget
    },

    formatCurrency() {
      return (value: number) =>
        new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(value)
    },

    activeFilterLabel(state): string {
      const labels: Record<DashboardFilter, string> = {
        expense: 'Gasto',
        income: 'Entrada',
        account: 'Conta',
      }
      return labels[state.activeFilter]
    },

    secondarySpendLabel(): string {
      if (this.hasAnyMonthlyBudget) {
        return 'Realizado nos orçamentos'
      }
      if (this.activeFilter === 'expense') {
        return 'Gastos no mês'
      }
      if (this.activeFilter === 'income') {
        return 'Entradas no mês'
      }
      return 'Movimentação no mês'
    },

    listTitle(state): string {
      if (state.activeFilter === 'income') return 'Últimas entradas'
      if (state.activeFilter === 'account') return 'Últimas movimentações da conta'
      return 'Últimos gastos'
    },
  },

  actions: {
    setActiveFilter(filter: DashboardFilter) {
      this.activeFilter = filter
    },

    async fetchSummary() {
      this.loading = true
      this.error = null

      const { y, m, referenceMonth } = currentReferenceMonthParts()
      this.periodLabel = formatPeriodLabel(y, m)

      try {
        const typeParam =
          this.activeFilter === 'account' ? undefined : this.activeFilter

        const [accounts, monthlyExpenseSum, monthlyIncomeSum, budgetListRes, firstListPage] =
          await Promise.all([
            accountsApi.list(),
            sumTransactionAmountInMonth('expense', y, m),
            sumTransactionAmountInMonth('income', y, m),
            budgetsApi.list({
              period: 'monthly',
              referenceMonth,
              isActive: true,
              limit: 100,
            }),
            transactionsApi.list({ type: typeParam, page: 1, limit: 100 }),
          ])

        this.availableBalance = accounts.reduce(
          (sum, account) => sum + Number(account.balance),
          0,
        )
        this.monthlyIncome = monthlyIncomeSum

        const individualBudgets = budgetListRes.data.filter((b) => audienceOf(b) === 'individual')
        const sharedBudgets = budgetListRes.data.filter((b) => audienceOf(b) === 'shared')

        this.individualBudgetLimit = individualBudgets.reduce((s, b) => s + b.limitAmount, 0)
        this.sharedBudgetLimit = sharedBudgets.reduce((s, b) => s + b.limitAmount, 0)

        let individualSpent = 0
        if (individualBudgets.length > 0) {
          const statuses = await Promise.all(
            individualBudgets.map((b) => budgetsApi.getStatus(b.id)),
          )
          individualSpent = statuses.reduce((s, st) => s + st.spent, 0)
        }
        this.individualBudgetSpent = individualSpent

        let sharedSpent = 0
        let sharedIncome = 0
        if (sharedBudgets.length > 0) {
          const statuses = await Promise.all(
            sharedBudgets.map((b) => budgetsApi.getStatus(b.id)),
          )
          sharedSpent = statuses.reduce((s, st) => s + st.spent, 0)
          sharedIncome = statuses.reduce((s, st) => s + (st.sharedIncomeTotal ?? 0), 0)
        }
        this.sharedBudgetSpent = sharedSpent
        this.sharedBudgetIncome = sharedIncome

        const hasAnyLimit = this.individualBudgetLimit > 0 || this.sharedBudgetLimit > 0
        const indOver =
          this.individualBudgetLimit > 0 && this.individualBudgetSpent > this.individualBudgetLimit
        const shOver =
          this.sharedBudgetLimit > 0 && this.sharedBudgetSpent > this.sharedBudgetLimit

        if (!hasAnyLimit) {
          this.budgetStatus = 'none'
        } else if (indOver || shOver) {
          this.budgetStatus = 'over'
        } else {
          this.budgetStatus = 'within'
        }

        const totalLimitForUi =
          this.individualBudgetLimit + this.sharedBudgetLimit
        const totalSpentForUi = individualSpent + sharedSpent

        if (this.activeFilter === 'expense') {
          this.totalExpenses = totalLimitForUi > 0 ? totalSpentForUi : monthlyExpenseSum
        } else if (this.activeFilter === 'income') {
          this.totalExpenses = monthlyIncomeSum
        } else {
          this.totalExpenses = monthlyExpenseSum + monthlyIncomeSum
        }

        this.projectedBalance = this.availableBalance - monthlyExpenseSum + monthlyIncomeSum

        this.expenses = firstListPage.data.slice(0, 5).map((tx) => ({
          id: tx.id,
          description: tx.description,
          amount: tx.amount,
          category: tx.type,
          author: tx.account?.name || tx.card?.name || 'Movimento',
          createdAt: new Date(tx.occurredAt).toLocaleDateString('pt-BR'),
          status: 'confirmed',
        }))
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao carregar resumo do dashboard'
      } finally {
        this.loading = false
      }
    },
  },
})
