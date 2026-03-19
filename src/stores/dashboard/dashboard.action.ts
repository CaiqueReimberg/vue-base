import type { Expense } from './dashboard.store'
import { useDashboardStore } from './dashboard.store'

export function useDashboardActions() {
  const store = useDashboardStore()

  function addExpense(expense: Omit<Expense, 'id' | 'createdAt' | 'status'>) {
    store.expenses.unshift({
      ...expense,
      id: crypto.randomUUID(),
      createdAt: 'agora',
      status: 'confirmed',
    })
    store.spent += expense.amount
  }

  function setBudget(value: number) {
    store.budget = value
  }

  function setPendingMessagesCount(count: number) {
    store.pendingMessagesCount = count
  }

  return {
    addExpense,
    setBudget,
    setPendingMessagesCount,
  }
}
