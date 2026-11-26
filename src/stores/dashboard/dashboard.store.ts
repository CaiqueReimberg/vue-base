import { defineStore } from 'pinia'
import { accountsApi } from '@/api/accounts.api'
import { budgetsApi } from '@/api/budgets.api'
import { cardsApi } from '@/api/cards.api'
import { transactionsApi } from '@/api/transactions.api'
import { recurringApi } from '@/api/recurring.api'
import type { MonthlyCommitmentResponse } from '@/types/dashboard-commitment'
import { dashboardApi, type MonthlyPlanResponse } from '@/api/dashboard.api'
import type { Budget } from '@/types/budget'
import type { PublicOwner } from '@/types/owner'
import type { DebtCategory, Transaction, TransactionType } from '@/types/transaction'
import { shiftReferenceMonth } from '@/utils/month'

export type DashboardBudgetStatus = 'none' | 'within' | 'attention' | 'over'
export type DashboardTone = 'positive' | 'warning' | 'danger' | 'neutral'
export type DashboardAlertTone = 'info' | 'warning' | 'danger'

export interface DashboardSummaryItem {
  id: string
  label: string
  value: number
  helperLines: string[]
  tone: DashboardTone
}

export interface DashboardAlert {
  id: string
  tone: DashboardAlertTone
  title: string
  message: string
}

export interface DashboardImpactItem {
  id: string
  label: string
  amount: number
  share: number
  insight: string
}

export interface DashboardQuickAction {
  id: string
  label: string
  helper: string
  to: string
  tone: DashboardTone
}

export interface DashboardRecentTransaction {
  id: string
  description: string
  amount: number
  type: TransactionType
  source: string
  dateLabel: string
  category: string
}

export interface DashboardPendingItem {
  id: string
  referenceId: string
  kind: 'recurring' | 'invoice' | 'transaction' | 'savings'
  title: string
  subtitle: string
  amount: number
  dueDay: number | null
  status: 'overdue' | 'urgent' | 'pending'
  statusLabel: string
  canMarkPaid: boolean
  isShared?: boolean
  owner?: PublicOwner | null
  linkTo?: string
}

export interface DashboardPaidItem {
  id: string
  referenceId: string
  kind: 'recurring' | 'invoice' | 'transaction' | 'savings'
  title: string
  subtitle: string
  amount: number
  paidDateLabel: string
  paidBy?: PublicOwner | null
  owner?: PublicOwner | null
  canUnmarkPaid: boolean
  isShared?: boolean
}

export interface DashboardState {
  coupleName: string
  periodLabel: string
  referenceMonth: string
  individualBudgetLimit: number
  individualBudgetSpent: number
  sharedBudgetLimit: number
  sharedBudgetSpent: number
  sharedBudgetIncome: number
  availableBalance: number
  monthlyExpenseTotal: number
  monthlyIncomeTotal: number
  projectedMonthExpense: number
  projectedBalance: number
  daysRemaining: number
  elapsedDays: number
  totalDaysInMonth: number
  pendingMessagesCount: number
  monthlyTransactions: Transaction[]
  recentTransactions: DashboardRecentTransaction[]
  topSpendingCategories: DashboardImpactItem[]
  budgetStatus: DashboardBudgetStatus
  loading: boolean
  error: string | null
  commitment: MonthlyCommitmentResponse | null
  commitmentLoading: boolean
  monthlyPlan: MonthlyPlanResponse | null
  actionLoadingIds: string[]
}

function resolveMonthParts(ym?: string) {
  const now = new Date()
  if (ym && /^\d{4}-\d{2}$/.test(ym)) {
    const [y, m] = ym.split('-').map(Number)
    return { y, m, referenceMonth: ym, now }
  }
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const referenceMonth = `${y}-${String(m).padStart(2, '0')}`
  return { y, m, referenceMonth, now }
}

const SHORT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function formatPeriodLabel(y: number, month1to12: number): string {
  const monthName = SHORT_MONTHS[(month1to12 || 1) - 1] || 'Mês'
  return `${monthName} ${y}`
}

function getDebtMonthStatus(
  tx: Transaction,
  y: number,
  month1to12: number,
  ym: string,
): { active: boolean; installmentNumber: number | null; isPaidInMonth: boolean } {
  if (tx.kind !== 'debt') {
    return {
      active: false,
      installmentNumber: tx.installmentNumber ?? null,
      isPaidInMonth: tx.status === 'cleared' || tx.status === 'paid' || Boolean(tx.paidAt),
    }
  }
  const startYm =
    tx.referenceMonth && /^\d{4}-\d{2}$/.test(tx.referenceMonth)
      ? tx.referenceMonth
      : String(tx.occurredAt).slice(0, 7)
  const [sy, sm] = startYm.split('-').map(Number)
  if (!sy || !sm) {
    return { active: false, installmentNumber: null, isPaidInMonth: false }
  }
  const diff = (y - sy) * 12 + (month1to12 - sm)
  const total = Math.max(Number(tx.installmentTotal || 1), 1)
  const active = diff >= 0 && diff < total
  const paidMonths = Array.isArray(tx.paidMonths) ? tx.paidMonths : []
  const isPaidInMonth = paidMonths.includes(ym)
  return {
    active,
    installmentNumber: active ? diff + 1 : null,
    isPaidInMonth,
  }
}

function occurredInCalendarMonth(tx: Transaction, y: number, month1to12: number, ym: string): boolean {
  if (tx.kind === 'debt') {
    return getDebtMonthStatus(tx, y, month1to12, ym).active
  }
  if (tx.referenceMonth === ym) return true
  const d = new Date(tx.occurredAt)
  return d.getFullYear() === y && d.getMonth() + 1 === month1to12
}

function audienceOf(b: Budget): 'individual' | 'shared' {
  return b.audience ?? 'individual'
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function debtCategoryLabel(value?: DebtCategory | null): string | null {
  const labels: Record<DebtCategory, string> = {
    car: 'Veículo',
    home: 'Moradia',
    personal_loan: 'Empréstimo',
    student: 'Estudos',
    other: 'Outros',
  }
  return value ? labels[value] : null
}

function groupLabelForTransaction(tx: Transaction): string {
  return (
    tx.category?.name ||
    debtCategoryLabel(tx.debtCategory) ||
    tx.card?.name ||
    tx.account?.name ||
    tx.description
  )
}

function transactionSourceLabel(tx: Transaction): string {
  if (tx.card?.name) return `Cartão ${tx.card.name}`
  if (tx.account?.name) return `Conta ${tx.account.name}`
  if (tx.kind === 'debt') return 'Dívida / Financiamento'
  return 'Movimentação'
}

function mapRecentTransaction(tx: Transaction): DashboardRecentTransaction {
  return {
    id: tx.id,
    description: tx.description,
    amount: tx.amount,
    type: tx.type,
    source: transactionSourceLabel(tx),
    dateLabel: new Date(tx.occurredAt).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    }),
    category: tx.category?.name || debtCategoryLabel(tx.debtCategory) || 'Sem categoria',
  }
}

function computeDueUrgency(
  dueDay: number | null,
  referenceMonth: string,
): { status: 'overdue' | 'urgent' | 'pending'; label: string } {
  if (!dueDay) return { status: 'pending', label: 'Pendente' }
  const [y, m] = referenceMonth.split('-').map(Number)
  const now = new Date()
  const curY = now.getFullYear()
  const curM = now.getMonth() + 1
  const today = now.getDate()

  if (y < curY || (y === curY && m < curM)) {
    return { status: 'overdue', label: `Venceu dia ${dueDay}` }
  }
  if (y === curY && m === curM) {
    if (dueDay < today) return { status: 'overdue', label: `Venceu dia ${dueDay}` }
    if (dueDay === today) return { status: 'urgent', label: 'Vence hoje' }
    if (dueDay - today <= 5) return { status: 'urgent', label: `Vence em ${dueDay - today}d` }
  }
  return { status: 'pending', label: `Vence dia ${dueDay}` }
}

async function fetchAllTransactions(params?: { type?: TransactionType }): Promise<Transaction[]> {
  const all: Transaction[] = []
  let page = 1
  let totalPages = 1

  do {
    const res = await transactionsApi.list({ ...params, page, limit: 100 })
    all.push(...res.data)
    totalPages = res.pagination.totalPages || 1
    page += 1
  } while (page <= totalPages)

  return all
}

export const useDashboardStore = defineStore('dashboard', {
  state: (): DashboardState => ({
    coupleName: 'Painel financeiro',
    periodLabel: '',
    referenceMonth: '',
    individualBudgetLimit: 0,
    individualBudgetSpent: 0,
    sharedBudgetLimit: 0,
    sharedBudgetSpent: 0,
    sharedBudgetIncome: 0,
    availableBalance: 0,
    monthlyExpenseTotal: 0,
    monthlyIncomeTotal: 0,
    projectedMonthExpense: 0,
    projectedBalance: 0,
    daysRemaining: 0,
    elapsedDays: 0,
    totalDaysInMonth: 0,
    pendingMessagesCount: 0,
    monthlyTransactions: [],
    recentTransactions: [],
    topSpendingCategories: [],
    budgetStatus: 'none',
    loading: false,
    error: null,
    commitment: null,
    commitmentLoading: false,
    monthlyPlan: null,
    actionLoadingIds: [],
  }),

  getters: {
    totalBudgetLimit(state): number {
      return state.individualBudgetLimit + state.sharedBudgetLimit
    },

    totalBudgetSpent(state): number {
      return state.individualBudgetSpent + state.sharedBudgetSpent
    },

    budgetRemaining(): number {
      return this.totalBudgetLimit > 0
        ? this.totalBudgetLimit - this.totalBudgetSpent
        : this.availableBalance
    },

    budgetUsedPercent(): number {
      if (this.totalBudgetLimit <= 0) return 0
      return Math.round((this.totalBudgetSpent / this.totalBudgetLimit) * 100)
    },

    expectedBudgetUsedPercentByNow(): number {
      if (this.totalBudgetLimit <= 0 || !this.elapsedDays || !this.totalDaysInMonth) return 0
      return Math.round((this.elapsedDays / this.totalDaysInMonth) * 100)
    },

    currentDailySpend(): number {
      if (!this.elapsedDays) return 0
      return this.monthlyExpenseTotal / this.elapsedDays
    },

    dailyAvailableLimit(): number {
      const divisor = Math.max(this.daysRemaining, 1)
      return this.budgetRemaining / divisor
    },

    paceDeltaPercent(): number {
      if (!this.totalBudgetLimit || !this.elapsedDays || !this.totalDaysInMonth) return 0
      const idealSpentByNow = this.totalBudgetLimit * (this.elapsedDays / this.totalDaysInMonth)
      if (idealSpentByNow <= 0) return 0
      return Math.round(((this.totalBudgetSpent - idealSpentByNow) / idealSpentByNow) * 100)
    },

    monthNet(): number {
      return this.monthlyIncomeTotal - this.monthlyExpenseTotal
    },

    /** Lista unificada de contas pendentes no mês */
    pendingItems(state): DashboardPendingItem[] {
      const items: DashboardPendingItem[] = []
      const ym = state.referenceMonth

      // 0. Meta "Quero guardar" quando definida (> 0) e ainda não guardada no mês
      if (state.monthlyPlan && state.monthlyPlan.savingsGoal > 0 && !state.monthlyPlan.savingsPaid) {
        items.push({
          id: 'savings-goal',
          referenceId: 'savings-goal',
          kind: 'savings',
          title: 'Reserva do mês',
          subtitle: 'Meta de economia definida no mês',
          amount: state.monthlyPlan.savingsGoal,
          dueDay: null,
          status: 'pending',
          statusLabel: 'Reserva',
          canMarkPaid: true,
        })
      }

      // 1. Contas fixas / recorrências não pagas
      const recItems = state.commitment?.breakdown.recurringBills.items ?? []
      for (const r of recItems) {
        if (r.paid) continue
        const urgency = computeDueUrgency(r.dueDay, ym)
        items.push({
          id: `rec-${r.id}`,
          referenceId: r.id,
          kind: 'recurring',
          title: r.name,
          subtitle: r.category ? `Conta fixa · ${r.category}` : 'Conta fixa mensal',
          amount: r.value,
          dueDay: r.dueDay,
          status: urgency.status,
          statusLabel: urgency.label,
          canMarkPaid: true,
          isShared: Boolean(r.isShared),
          owner: r.owner ?? null,
        })
      }

      // 2. Faturas de cartão não pagas (com valor > 0)
      const cardItems = state.commitment?.breakdown.cardInvoices.items ?? []
      for (const c of cardItems) {
        if (c.paid || c.invoiceValue <= 0) continue
        const urgency = computeDueUrgency(c.dueDay, ym)
        items.push({
          id: `card-${c.cardId}`,
          referenceId: c.cardId,
          kind: 'invoice',
          title: `Fatura ${c.name}`,
          subtitle: `Cartão de crédito · Vence dia ${c.dueDay}`,
          amount: c.invoiceValue,
          dueDay: c.dueDay,
          status: urgency.status,
          statusLabel: urgency.label,
          canMarkPaid: true,
          isShared: Boolean(c.isShared),
          owner: c.owner ?? null,
          linkTo: c.analysisId ? '/invoices' : '/cards',
        })
      }

      // 3. Dívidas ou gastos avulsos com status pendente (exceto compras no cartão que já estão na fatura)
      for (const tx of state.monthlyTransactions) {
        if (tx.type !== 'expense') continue
        if (tx.card?.id) continue // já contabilizado na fatura do cartão
        if (tx.status === 'pending' && !tx.paidAt) {
          const dueDay = tx.dueDate
            ? new Date(tx.dueDate).getUTCDate()
            : tx.kind === 'debt' && tx.occurredAt
              ? new Date(tx.occurredAt).getUTCDate()
              : null
          const urgency = computeDueUrgency(dueDay, ym)
          const parcelBadge =
            tx.kind === 'debt' && tx.installmentNumber && tx.installmentTotal
              ? ` · Parcela ${tx.installmentNumber}/${tx.installmentTotal}`
              : ''
          items.push({
            id: `tx-${tx.id}`,
            referenceId: tx.id,
            kind: 'transaction',
            title: tx.description,
            subtitle: `${transactionSourceLabel(tx)}${parcelBadge}${tx.category?.name ? ` · ${tx.category.name}` : ''}`,
            amount: tx.amount,
            dueDay,
            status: urgency.status,
            statusLabel: dueDay ? urgency.label : 'Aberto',
            canMarkPaid: true,
            isShared: Boolean(tx.isShared),
            owner: tx.owner ?? null,
          })
        }
      }

      const statusOrder = { overdue: 0, urgent: 1, pending: 2 }
      return items.sort(
        (a, b) =>
          statusOrder[a.status] - statusOrder[b.status] ||
          (a.dueDay ?? 99) - (b.dueDay ?? 99) ||
          b.amount - a.amount,
      )
    },

    /** Lista unificada do que já foi pago no mês */
    paidItems(state): DashboardPaidItem[] {
      const items: DashboardPaidItem[] = []

      // 0. Meta "Quero guardar" quando já guardada no mês
      if (state.monthlyPlan && state.monthlyPlan.savingsGoal > 0 && state.monthlyPlan.savingsPaid) {
        const paidLabel = state.monthlyPlan.savingsPaidAt
          ? `Guardado em ${new Date(state.monthlyPlan.savingsPaidAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
          : 'Guardado neste mês'
        items.push({
          id: 'savings-goal-paid',
          referenceId: 'savings-goal',
          kind: 'savings',
          title: 'Reserva do mês',
          subtitle: 'Meta de economia definida no mês',
          amount: state.monthlyPlan.savingsGoal,
          paidDateLabel: paidLabel,
          canUnmarkPaid: true,
        })
      }

      // 1. Contas fixas pagas no mês
      const recItems = state.commitment?.breakdown.recurringBills.items ?? []
      for (const r of recItems) {
        if (!r.paid) continue
        const paidLabel = r.paidAt
          ? `Pago em ${new Date(r.paidAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
          : 'Pago neste mês'
        items.push({
          id: `rec-paid-${r.id}`,
          referenceId: r.id,
          kind: 'recurring',
          title: r.name,
          subtitle: r.category ? `Conta fixa · ${r.category}` : 'Conta fixa mensal',
          amount: r.value,
          paidDateLabel: paidLabel,
          paidBy: r.paidBy ?? null,
          owner: r.owner ?? null,
          canUnmarkPaid: true,
          isShared: Boolean(r.isShared),
        })
      }

      // 2. Faturas de cartão pagas no mês
      const cardItems = state.commitment?.breakdown.cardInvoices.items ?? []
      for (const c of cardItems) {
        if (!c.paid) continue
        const paidLabel = c.paidAt
          ? `Pago em ${new Date(c.paidAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
          : 'Fatura quitada'
        items.push({
          id: `card-paid-${c.cardId}`,
          referenceId: c.cardId,
          kind: 'invoice',
          title: `Fatura ${c.name}`,
          subtitle: 'Cartão de crédito',
          amount: c.invoiceValue,
          paidDateLabel: paidLabel,
          paidBy: c.paidBy ?? null,
          canUnmarkPaid: true,
          isShared: Boolean(c.isShared),
          owner: c.owner ?? null,
        })
      }

      // 3. Gastos quitados/pagos no mês (em conta ou dívida paga)
      for (const tx of state.monthlyTransactions) {
        if (tx.type !== 'expense') continue
        if (tx.card?.id) continue
        const isPaid = tx.status === 'cleared' || Boolean(tx.paidAt) || Boolean(tx.account?.id && tx.kind !== 'debt')
        if (!isPaid) continue

        const dateRef = tx.paidAt || tx.occurredAt
        const paidLabel = `Pago em ${new Date(dateRef).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
        })}`

        const parcelBadge =
          tx.kind === 'debt' && tx.installmentNumber && tx.installmentTotal
            ? ` · Parcela ${tx.installmentNumber}/${tx.installmentTotal}`
            : ''

        items.push({
          id: `tx-paid-${tx.id}`,
          referenceId: tx.id,
          kind: 'transaction',
          title: tx.description,
          subtitle: `${transactionSourceLabel(tx)}${parcelBadge}${tx.category?.name ? ` · ${tx.category.name}` : ''}`,
          amount: tx.amount,
          paidDateLabel: paidLabel,
          paidBy: tx.paidBy ?? null,
          owner: tx.owner ?? null,
          canUnmarkPaid: tx.kind === 'debt',
          isShared: Boolean(tx.isShared),
        })
      }

      return items
    },

    pendingTotalAmount(): number {
      return this.pendingItems.reduce((sum, item) => sum + item.amount, 0)
    },

    paidTotalAmount(): number {
      return this.paidItems.reduce((sum, item) => sum + item.amount, 0)
    },

    monthPaymentProgressPercent(): number {
      const total = this.pendingTotalAmount + this.paidTotalAmount
      if (total <= 0) return 0
      return Math.round((this.paidTotalAmount / total) * 100)
    },

    statusTone(): DashboardTone {
      if (this.projectedBalance < 0) return 'danger'
      if (this.totalBudgetLimit > 0 && this.dailyAvailableLimit < this.currentDailySpend) return 'warning'
      if (this.totalBudgetLimit > 0) return 'positive'
      return this.projectedBalance >= 0 ? 'neutral' : 'danger'
    },

    statusTitle(): string {
      if (!Number.isFinite(this.projectedBalance)) return 'Resumo indisponível'
      if (this.projectedBalance < 0) {
        return `Projeção de fechamento: -${formatCurrency(Math.abs(this.projectedBalance))}`
      }
      return `Projeção de fechamento: ${formatCurrency(this.projectedBalance)}`
    },

    statusMessage(): string {
      if (this.projectedBalance < 0) {
        return 'Atenção: o ritmo atual de gastos supera o saldo disponível para o mês.'
      }
      return 'Suas contas estão equilibradas para fechar o mês no azul.'
    },

    statusRecommendation(): string {
      const d = Math.max(this.daysRemaining, 1)
      if (this.projectedBalance < 0) {
        const needed = Math.abs(this.projectedBalance) / d
        return `Reduza cerca de ${formatCurrency(needed)}/dia nos próximos ${d} dias.`
      }
      if (this.totalBudgetLimit > 0) {
        const safe = Math.max(this.budgetRemaining, 0)
        return `Orçamento disponível: ${formatCurrency(safe)} (~${formatCurrency(this.dailyAvailableLimit)}/dia).`
      }
      return `Ritmo médio atual: ${formatCurrency(this.currentDailySpend)}/dia.`
    },

    summaryCards(): DashboardSummaryItem[] {
      return [
        {
          id: 'current-balance',
          label: 'Saldo em contas',
          value: this.availableBalance,
          helperLines: ['Soma atual das contas ativas'],
          tone: this.availableBalance >= 0 ? 'neutral' : 'danger',
        },
        {
          id: 'pending-month',
          label: 'Contas pendentes',
          value: this.pendingTotalAmount,
          helperLines: [`${this.pendingItems.length} item(ns) aguardando pagamento`],
          tone: this.pendingTotalAmount > 0 ? 'warning' : 'positive',
        },
        {
          id: 'paid-month',
          label: 'Já pago no mês',
          value: this.paidTotalAmount,
          helperLines: [`${this.paidItems.length} pagamento(s) quitado(s)`],
          tone: 'positive',
        },
        {
          id: 'free-balance',
          label: 'Resultado do mês',
          value: this.monthlyIncomeTotal - (this.pendingTotalAmount + this.paidTotalAmount),
          helperLines: [`Entradas: ${formatCurrency(this.monthlyIncomeTotal)}`],
          tone:
            this.monthlyIncomeTotal - (this.pendingTotalAmount + this.paidTotalAmount) >= 0
              ? 'positive'
              : 'danger',
        },
      ]
    },

    smartAlerts(): DashboardAlert[] {
      const alerts: DashboardAlert[] = []

      const overdueCount = this.pendingItems.filter((i) => i.status === 'overdue').length
      if (overdueCount > 0) {
        alerts.push({
          id: 'overdue-bills',
          tone: 'danger',
          title: `${overdueCount} conta(s) vencida(s) neste mês`,
          message: 'Quite ou atualize o status das contas em atraso na lista de pendências.',
        })
      }

      if (this.projectedBalance < 0) {
        alerts.push({
          id: 'projected-negative',
          tone: 'danger',
          title: 'Projeção de fechamento no vermelho',
          message: `A estimativa atual indica ${formatCurrency(this.projectedBalance)} até o fim do mês.`,
        })
      }

      if (this.totalBudgetLimit > 0 && this.paceDeltaPercent >= 10) {
        alerts.push({
          id: 'pace',
          tone: 'warning',
          title: 'Ritmo de gastos acima da meta',
          message: `Seu consumo está ${this.paceDeltaPercent}% acima do ideal para hoje.`,
        })
      }

      return alerts.slice(0, 3)
    },

    quickActions(): DashboardQuickAction[] {
      return [
        {
          id: 'expense',
          label: 'Novo lançamento',
          helper: 'Registrar gasto ou entrada',
          to: '/movements',
          tone: 'positive',
        },
        {
          id: 'monthly-control',
          label: 'Contas fixas',
          helper: 'Gerenciar recorrências',
          to: '/monthly-control',
          tone: 'neutral',
        },
        {
          id: 'cards',
          label: 'Cartões e faturas',
          helper: 'Limites e fechamentos',
          to: '/cards',
          tone: 'neutral',
        },
        {
          id: 'budgets',
          label: 'Orçamentos',
          helper: 'Metas individuais e casal',
          to: '/budgets',
          tone: 'neutral',
        },
      ]
    },

    formatCurrency() {
      return formatCurrency
    },

    totalCommitted(state): number {
      return state.commitment?.totalCommitted ?? 0
    },

    totalPaidCommitment(state): number {
      return state.commitment?.totalPaid ?? 0
    },

    freeBalance(state): number {
      return state.commitment?.freeBalance ?? 0
    },
  },

  actions: {
    isActionLoading(id: string): boolean {
      return this.actionLoadingIds.includes(id)
    },

    async changeMonth(delta: number) {
      const nextYm = shiftReferenceMonth(this.referenceMonth || resolveMonthParts().referenceMonth, delta)
      await this.fetchSummary(nextYm)
    },

    async markPendingItemAsPaid(
      item: DashboardPendingItem,
      customAmount?: number,
      paidByUserId?: string,
    ) {
      if (this.actionLoadingIds.includes(item.id)) return
      this.actionLoadingIds.push(item.id)
      try {
        const finalAmount =
          customAmount !== undefined && Number.isFinite(customAmount) && customAmount > 0
            ? customAmount
            : undefined

        if (item.kind === 'savings') {
          await this.saveMonthlyPlan({
            savingsPaid: true,
            ...(finalAmount !== undefined ? { savingsGoal: finalAmount } : {}),
          })
          return
        }
        if (item.kind === 'recurring') {
          await recurringApi.markAsPaid(
            item.referenceId,
            this.referenceMonth,
            finalAmount,
            paidByUserId,
          )
        } else if (item.kind === 'invoice') {
          await cardsApi.payMonthlyInvoice(item.referenceId, {
            referenceMonth: this.referenceMonth,
            amount: finalAmount,
            paidByUserId,
          })
        } else if (item.kind === 'transaction') {
          await transactionsApi.update(item.referenceId, {
            status: 'cleared',
            paidAt: new Date().toISOString(),
            paymentMonth: this.referenceMonth,
            ...(paidByUserId ? { paidByUserId } : {}),
            ...(finalAmount !== undefined ? { amount: finalAmount } : {}),
          })
        }
        await this.fetchSummary(this.referenceMonth)
      } finally {
        this.actionLoadingIds = this.actionLoadingIds.filter((id) => id !== item.id)
      }
    },

    async updateItemMonthAmount(
      item: DashboardPendingItem | DashboardPaidItem,
      amount: number,
    ) {
      if (this.actionLoadingIds.includes(item.id)) return
      this.actionLoadingIds.push(item.id)
      try {
        if (item.kind === 'savings') {
          await this.saveMonthlyPlan({ savingsGoal: amount })
          return
        }
        if (item.kind === 'recurring') {
          await recurringApi.setMonthAmount(item.referenceId, this.referenceMonth, amount)
        } else if (item.kind === 'invoice') {
          await cardsApi.upsertMonthlyInvoice(item.referenceId, {
            referenceMonth: this.referenceMonth,
            amount,
          })
        } else if (item.kind === 'transaction') {
          await transactionsApi.update(item.referenceId, { amount })
        }
        await this.fetchSummary(this.referenceMonth)
      } finally {
        this.actionLoadingIds = this.actionLoadingIds.filter((id) => id !== item.id)
      }
    },

    async unmarkPaidItem(item: DashboardPaidItem) {
      if (this.actionLoadingIds.includes(item.id)) return
      this.actionLoadingIds.push(item.id)
      try {
        if (item.kind === 'savings') {
          await this.saveMonthlyPlan({ savingsPaid: false })
          return
        }
        if (item.kind === 'recurring') {
          await recurringApi.unmarkAsPaid(item.referenceId, this.referenceMonth)
        } else if (item.kind === 'invoice') {
          await cardsApi.unpayMonthlyInvoice(item.referenceId, this.referenceMonth)
        } else if (item.kind === 'transaction') {
          await transactionsApi.update(item.referenceId, {
            status: 'pending',
            paidAt: undefined,
            paymentMonth: this.referenceMonth,
          })
        }
        await this.fetchSummary(this.referenceMonth)
      } finally {
        this.actionLoadingIds = this.actionLoadingIds.filter((id) => id !== item.id)
      }
    },

    async pauseRecurringItem(item: DashboardPendingItem) {
      if (item.kind !== 'recurring') return null
      if (this.actionLoadingIds.includes(item.id)) return null
      this.actionLoadingIds.push(item.id)
      try {
        const res = await recurringApi.pause(item.referenceId, this.referenceMonth)
        await this.fetchSummary(this.referenceMonth)
        return res
      } finally {
        this.actionLoadingIds = this.actionLoadingIds.filter((id) => id !== item.id)
      }
    },

    async removePendingItem(item: DashboardPendingItem) {
      if (this.actionLoadingIds.includes(item.id)) return
      this.actionLoadingIds.push(item.id)
      try {
        if (item.kind === 'savings') {
          await this.saveMonthlyPlan({ savingsGoal: 0, savingsPaid: false })
          return
        }
        if (item.kind === 'recurring') {
          await recurringApi.delete(item.referenceId)
        } else if (item.kind === 'invoice') {
          await cardsApi.deleteMonthlyInvoice(item.referenceId, this.referenceMonth)
        } else if (item.kind === 'transaction') {
          await transactionsApi.delete(item.referenceId)
        }
        await this.fetchSummary(this.referenceMonth)
      } finally {
        this.actionLoadingIds = this.actionLoadingIds.filter((id) => id !== item.id)
      }
    },

    async saveMonthlyPlan(payload: {
      monthlyIncome?: number
      savingsGoal?: number
      savingsPaid?: boolean
      endOfMonthLeftover?: number | null
      notes?: string | null
    }) {
      const referenceMonth = this.referenceMonth || resolveMonthParts().referenceMonth
      const updated = await dashboardApi.saveMonthlyPlan({
        referenceMonth,
        ...payload,
      })
      this.monthlyPlan = updated
      return updated
    },

    async fetchSummary(targetMonth?: string) {
      this.loading = true
      this.error = null

      const { y, m, referenceMonth, now } = resolveMonthParts(targetMonth || this.referenceMonth)
      this.periodLabel = formatPeriodLabel(y, m)
      this.referenceMonth = referenceMonth

      this.commitmentLoading = true
      try {
        const [
          accounts,
          budgetListRes,
          expenseTransactions,
          incomeTransactions,
          recentList,
          commitment,
          monthlyPlan,
        ] = await Promise.all([
          accountsApi.list(),
          budgetsApi.list({
            period: 'monthly',
            referenceMonth,
            isActive: true,
            limit: 100,
          }),
          fetchAllTransactions({ type: 'expense' }),
          fetchAllTransactions({ type: 'income' }),
          transactionsApi.list({ page: 1, limit: 20 }),
          dashboardApi.getMonthlyCommitment(referenceMonth).catch(() => null),
          dashboardApi.getMonthlyPlan(referenceMonth).catch(() => null),
        ])
        this.commitment = commitment
        this.monthlyPlan = monthlyPlan

        const monthlyExpenses = expenseTransactions
          .filter((tx) => occurredInCalendarMonth(tx, y, m, referenceMonth))
          .map((tx) => {
            if (tx.kind !== 'debt') return tx
            const debtState = getDebtMonthStatus(tx, y, m, referenceMonth)
            return {
              ...tx,
              installmentNumber: debtState.installmentNumber,
              status: debtState.isPaidInMonth ? ('cleared' as const) : ('pending' as const),
              paidAt: debtState.isPaidInMonth ? tx.paidAt ?? new Date().toISOString() : null,
              paidBy: debtState.isPaidInMonth
                ? tx.paidByByMonth?.[referenceMonth] ?? tx.paidBy ?? null
                : null,
            }
          })
        const monthlyIncomes = incomeTransactions.filter((tx) =>
          occurredInCalendarMonth(tx, y, m, referenceMonth),
        )
        const monthlyTransactions = [...monthlyExpenses, ...monthlyIncomes].sort(
          (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
        )

        this.monthlyTransactions = monthlyTransactions
        this.availableBalance = accounts.reduce((sum, account) => sum + Number(account.balance), 0)
        this.monthlyExpenseTotal = monthlyExpenses.reduce((sum, tx) => sum + tx.amount, 0)
        this.monthlyIncomeTotal = monthlyIncomes.reduce((sum, tx) => sum + tx.amount, 0)

        const individualBudgets = budgetListRes.data.filter((b) => audienceOf(b) === 'individual')
        const sharedBudgets = budgetListRes.data.filter((b) => audienceOf(b) === 'shared')

        this.individualBudgetLimit = individualBudgets.reduce((sum, budget) => sum + budget.limitAmount, 0)
        this.sharedBudgetLimit = sharedBudgets.reduce((sum, budget) => sum + budget.limitAmount, 0)

        let individualSpent = 0
        if (individualBudgets.length > 0) {
          const statuses = await Promise.all(
            individualBudgets.map((budget) => budgetsApi.getStatus(budget.id)),
          )
          individualSpent = statuses.reduce((sum, status) => sum + status.spent, 0)
        }
        this.individualBudgetSpent = individualSpent

        let sharedSpent = 0
        let sharedIncome = 0
        if (sharedBudgets.length > 0) {
          const statuses = await Promise.all(sharedBudgets.map((budget) => budgetsApi.getStatus(budget.id)))
          sharedSpent = statuses.reduce((sum, status) => sum + status.spent, 0)
          sharedIncome = statuses.reduce((sum, status) => sum + (status.sharedIncomeTotal ?? 0), 0)
        }
        this.sharedBudgetSpent = sharedSpent
        this.sharedBudgetIncome = sharedIncome

        const daysInMonth = new Date(y, m, 0).getDate()
        const isCurrentMonth = now.getFullYear() === y && now.getMonth() + 1 === m
        const elapsedDays = isCurrentMonth ? now.getDate() : daysInMonth
        const daysRemaining = isCurrentMonth ? Math.max(daysInMonth - elapsedDays, 0) : 0
        this.totalDaysInMonth = daysInMonth
        this.elapsedDays = elapsedDays
        this.daysRemaining = daysRemaining

        const expenseRunRate = elapsedDays > 0 ? this.monthlyExpenseTotal / elapsedDays : 0
        this.projectedMonthExpense = isCurrentMonth ? expenseRunRate * daysInMonth : this.monthlyExpenseTotal
        const projectedRemainingExpense = Math.max(this.projectedMonthExpense - this.monthlyExpenseTotal, 0)
        this.projectedBalance = this.availableBalance - projectedRemainingExpense

        const totalBudgetLimit = this.individualBudgetLimit + this.sharedBudgetLimit

        if (!totalBudgetLimit) {
          this.budgetStatus = 'none'
        } else if (this.projectedBalance < 0) {
          this.budgetStatus = 'over'
        } else if (this.currentDailySpend > this.dailyAvailableLimit) {
          this.budgetStatus = 'attention'
        } else {
          this.budgetStatus = 'within'
        }

        const impactMap = new Map<string, DashboardImpactItem>()
        for (const tx of monthlyExpenses) {
          const label = groupLabelForTransaction(tx)
          const previous = impactMap.get(label)
          const nextAmount = (previous?.amount ?? 0) + tx.amount
          impactMap.set(label, {
            id: label,
            label,
            amount: nextAmount,
            share: 0,
            insight: tx.category?.name ? 'Categoria de despesa' : 'Gasto no período',
          })
        }

        this.topSpendingCategories = Array.from(impactMap.values())
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 4)
          .map((item) => ({
            ...item,
            share: this.monthlyExpenseTotal > 0 ? Math.round((item.amount / this.monthlyExpenseTotal) * 100) : 0,
          }))

        this.recentTransactions = recentList.data
          .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
          .slice(0, 6)
          .map(mapRecentTransaction)
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao carregar resumo do dashboard'
      } finally {
        this.loading = false
        this.commitmentLoading = false
      }
    },
  },
})
