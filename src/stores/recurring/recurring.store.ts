import { defineStore } from 'pinia'
import { recurringApi } from '@/api/recurring.api'
import type { RecurringMonthlyItem } from '@/types/recurring'
import {
  billPaymentStatus,
  currentReferenceMonth,
  formatPeriodLabel,
  type BillPaymentStatus,
} from '@/utils/month'

export interface RecurringStoreState {
  referenceMonth: string
  items: RecurringMonthlyItem[]
  loading: boolean
  error: string | null
  togglingIds: Set<string>
}

export const useRecurringStore = defineStore('recurring', {
  state: (): RecurringStoreState => ({
    referenceMonth: currentReferenceMonth(),
    items: [],
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
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao carregar contas fixas'
        throw e
      } finally {
        this.loading = false
      }
    },

    async markAsPaid(id: string, month?: string) {
      const referenceMonth = month ?? this.referenceMonth
      const item = this.items.find((i) => i.id === id)
      const prevPaid = item?.paid ?? false
      const prevPaidAt = item?.paidAt ?? null

      if (item) {
        item.paid = true
        item.paidAt = new Date().toISOString()
      }
      this.togglingIds.add(id)

      try {
        const res = await recurringApi.markAsPaid(id, referenceMonth)
        if (item) {
          item.paidAt = res.paidAt
        }
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
