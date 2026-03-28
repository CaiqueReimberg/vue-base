import { defineStore } from 'pinia'
import { accountsApi } from '@/api/accounts.api'
import { budgetsApi } from '@/api/budgets.api'
import { transactionsApi } from '@/api/transactions.api'

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
  budget: number
  spent: number
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
    budget: 0,
    spent: 0,
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

    /** Percentual real (pode passar de 100). */
    budgetUsedPercentRaw(state): number {
      if (state.budget <= 0) return 0
      return Math.round((state.spent / state.budget) * 100)
    },

    /** Arco do gráfico: no máximo 100%. */
    budgetRingPercent(): number {
      return Math.min(100, this.budgetUsedPercentRaw)
    },

    budgetExceeded(): boolean {
      return this.budget > 0 && this.spent > this.budget
    },

    hasMonthlyBudget(): boolean {
      return this.budget > 0
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

    /** Texto do valor secundário ao lado do orçamento (sub-card). */
    secondarySpendLabel(): string {
      if (this.hasMonthlyBudget) {
        return 'Realizado no orçamento'
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

        const [
          accounts,
          monthlyExpenseSum,
          monthlyIncomeSum,
          budgetListRes,
          firstListPage,
        ] = await Promise.all([
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

        /** Saldo disponível = soma dos saldos de todas as contas bancárias (corrente/poupança etc.). */
        this.availableBalance = accounts.reduce(
          (sum, account) => sum + Number(account.balance),
          0,
        )
        this.monthlyIncome = monthlyIncomeSum

        const monthlyBudgets = budgetListRes.data
        const totalLimit = monthlyBudgets.reduce((s, b) => s + b.limitAmount, 0)
        let totalSpentBudget = 0
        if (monthlyBudgets.length > 0) {
          const statuses = await Promise.all(
            monthlyBudgets.map((b) => budgetsApi.getStatus(b.id)),
          )
          totalSpentBudget = statuses.reduce((s, st) => s + st.spent, 0)
        }

        this.budget = totalLimit
        this.spent = totalSpentBudget

        if (totalLimit <= 0) {
          this.budgetStatus = 'none'
        } else if (totalSpentBudget > totalLimit) {
          this.budgetStatus = 'over'
        } else {
          this.budgetStatus = 'within'
        }

        if (this.activeFilter === 'expense') {
          this.totalExpenses = totalLimit > 0 ? totalSpentBudget : monthlyExpenseSum
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
