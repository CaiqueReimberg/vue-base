import { defineStore } from 'pinia'

export type ToastType = 'success' | 'error'

export interface Toast {
  id: number
  message: string
  type: ToastType
}

let id = 0
const DEFAULT_DURATION = 4000

export const useToastStore = defineStore('toast', {
  state: () => ({
    toasts: [] as Toast[],
  }),

  actions: {
    add(message: string, type: ToastType, duration = DEFAULT_DURATION) {
      const toast: Toast = { id: ++id, message, type }
      this.toasts.push(toast)
      if (duration > 0) {
        setTimeout(() => this.remove(toast.id), duration)
      }
    },

    success(message: string, duration = DEFAULT_DURATION) {
      this.add(message, 'success', duration)
    },

    error(message: string, duration = DEFAULT_DURATION) {
      this.add(message, 'error', duration)
    },

    remove(toastId: number) {
      this.toasts = this.toasts.filter((t) => t.id !== toastId)
    },
  },
})
