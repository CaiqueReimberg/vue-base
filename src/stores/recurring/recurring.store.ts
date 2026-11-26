import { defineStore } from 'pinia'
import { recurringApi } from '@/api/recurring.api'
import type { RecurringMonthlyItem, RecurringPausedItem } from '@/types/recurring'
import {
  billPaymentStatus,
  currentReferenceMonth,
  formatPeriodLabel,
  type BillPaymentStatus,
} from '@/utils/month'

export interface RecurringStoreState {
  referenceMonth: string
  items: RecurringMonthlyItem[]
  pausedItems: RecurringPausedItem[]
  loading: boolean
  error: string | null
  togglingIds: Set<string>
}

export const useRecurringStore = defineStore('recurring', {
  state: (): RecurringStoreState => ({
    referenceMonth: currentReferenceMonth(),
    items: [],
    pausedItems: [],
    loading: false,
    error: null,
    togglingIds: new Set(),
  }),

  getters: {
    periodLabel(state): string {
      return formatPeriodLabel(state.referenceMonth)
    },

    expenseItems(state): RecurringMonthlyItem[] {
      return state.items.filter((i) => i.transactionType === 'expense')
    },
  },

  actions: {
    statusFor(item: RecurringMonthlyItem): BillPaymentStatus {
      return billPaymentStatus(item.paid, item.dueDay, this.referenceMonth)
    },

    async fetchMonthlyStatus(month?: string) {
      if (month) this.referenceMonth = month
      this.loading = true
      this.error = null
      try {
        const res = await recurringApi.getMonthlyStatus(this.referenceMonth)
        this.referenceMonth = res.month
        this.items = res.data
        this.pausedItems = res.pausedData ?? []
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao carregar contas fixas'
        throw e
      } finally {
        this.loading = false
      }
    },

    async setMonthAmount(id: string, amount: number, month?: string) {
      const referenceMonth = month ?? this.referenceMonth
      this.togglingIds.add(id)
      try {
        await recurringApi.setMonthAmount(id, referenceMonth, amount)
        const item = this.items.find((i) => i.id === id)
        if (item) {
          item.amount = amount
          item.isMonthOverride = true
        }
      } finally {
        this.togglingIds.delete(id)
      }
    },

    async markAsPaid(id: string, month?: string, amount?: number, paidByUserId?: string) {
      const referenceMonth = month ?? this.referenceMonth
      const item = this.items.find((i) => i.id === id)
      const prevPaid = item?.paid ?? false
      const prevPaidAt = item?.paidAt ?? null
      const prevAmount = item?.amount

      if (item) {
        item.paid = true
        item.paidAt = new Date().toISOString()
        if (amount !== undefined && amount > 0) {
          item.amount = amount
          item.isMonthOverride = true
        }
      }
      this.togglingIds.add(id)

      try {
        const res = await recurringApi.markAsPaid(id, referenceMonth, amount, paidByUserId)
        if (item) {
          item.paidAt = res.paidAt
          if (res.paidBy !== undefined) {
            item.paidBy = res.paidBy
          }
        }
      } catch (e) {
        if (item) {
          item.paid = prevPaid
          item.paidAt = prevPaidAt
          if (prevAmount !== undefined) item.amount = prevAmount
        }
        throw e
      } finally {
        this.togglingIds.delete(id)
      }
    },

    async unmarkAsPaid(id: string, month?: string) {
      const referenceMonth = month ?? this.referenceMonth
      const item = this.items.find((i) => i.id === id)
      const prevPaid = item?.paid ?? false
      const prevPaidAt = item?.paidAt ?? null

      if (item) {
        item.paid = false
        item.paidAt = null
      }
      this.togglingIds.add(id)

      try {
        await recurringApi.unmarkAsPaid(id, referenceMonth)
      } catch (e) {
        if (item) {
          item.paid = prevPaid
          item.paidAt = prevPaidAt
        }
        throw e
      } finally {
        this.togglingIds.delete(id)
      }
    },

    async togglePaid(id: string) {
      const item = this.items.find((i) => i.id === id)
      if (!item) return
      if (item.paid) {
        await this.unmarkAsPaid(id)
      } else {
        await this.markAsPaid(id)
      }
    },

    isToggling(id: string): boolean {
      return this.togglingIds.has(id)
    },
  },
})
