import { useDashboardStore } from './dashboard.store'

export function useDashboardActions() {
  const store = useDashboardStore()

  function setPendingMessagesCount(count: number) {
    store.pendingMessagesCount = count
  }

  return {
    setPendingMessagesCount,
  }
}
