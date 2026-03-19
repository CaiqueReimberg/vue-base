<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useToastStore } from '@/stores/toast/toast.store'
import type { Toast } from '@/stores/toast/toast.store'
import { CheckCircleIcon, XCircleIcon, XMarkIcon } from '@heroicons/vue/24/solid'

const toastStore = useToastStore()
const { toasts } = storeToRefs(toastStore)

function iconFor(toast: Toast) {
  return toast.type === 'success' ? CheckCircleIcon : XCircleIcon
}

function close(id: number) {
  toastStore.remove(id)
}
</script>

<template>
  <div class="toast-container" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        :class="`toast--${toast.type}`"
        role="alert"
      >
        <component :is="iconFor(toast)" class="toast-icon" />
        <span class="toast-message">{{ toast.message }}</span>
        <button
          type="button"
          class="toast-close"
          aria-label="Fechar"
          @click="close(toast.id)"
        >
          <XMarkIcon class="h-5 w-5" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: max(1rem, env(safe-area-inset-top));
  right: max(1rem, env(safe-area-inset-right));
  left: max(1rem, env(safe-area-inset-left));
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: min(400px, calc(100vw - 2rem));
  margin-left: auto;
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid transparent;
}

.toast--success {
  background: var(--dp-green-mute, #dcfce7);
  color: #166534;
  border-color: var(--dp-green);
}

.toast--error {
  background: #fef2f2;
  color: #b91c1c;
  border-color: #dc2626;
}

.toast-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.toast--success .toast-icon {
  color: var(--dp-green);
}

.toast--error .toast-icon {
  color: #dc2626;
}

.toast-message {
  flex: 1;
  font-size: 0.9rem;
  font-weight: 500;
  min-width: 0;
  word-break: break-word;
}

@media (max-width: 480px) {
  .toast-container {
    top: 0.5rem;
    right: 0.5rem;
    left: 0.5rem;
    max-width: none;
  }

  .toast {
    padding: 0.75rem 0.875rem;
  }

  .toast-message {
    font-size: 0.85rem;
  }
}

.toast-close {
  display: flex;
  padding: 0.25rem;
  border: none;
  background: transparent;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
  border-radius: 0.25rem;
  transition: opacity 0.2s;
}

.toast-close:hover {
  opacity: 1;
}

/* dark mode */
@media (prefers-color-scheme: dark) {
  .toast--success {
    background: var(--dp-green-mute);
    color: #86efac;
  }

  .toast--error {
    background: rgba(220, 38, 38, 0.2);
    color: #fca5a5;
  }
}

/* transitions */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-move {
  transition: transform 0.25s ease;
}
</style>
