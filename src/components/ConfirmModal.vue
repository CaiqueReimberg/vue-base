<script setup lang="ts">
import { watch } from 'vue'
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
}>()

const emit = defineEmits<{
  close: []
  confirm: []
}>()

function onOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).dataset.overlay) emit('close')
}

function onConfirm() {
  emit('confirm')
}

function onCancel() {
  emit('close')
}

function onEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (open) => {
    if (open) document.addEventListener('keydown', onEscape)
    else document.removeEventListener('keydown', onEscape)
  }
)
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="confirm-overlay"
        data-overlay
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        @click="onOverlayClick"
      >
        <div class="confirm-modal" @click.stop>
          <div class="confirm-icon-wrap" :class="{ 'confirm-icon-wrap--danger': variant === 'danger' }">
            <ExclamationTriangleIcon class="confirm-icon" />
          </div>
          <h2 id="confirm-modal-title" class="confirm-title">{{ title }}</h2>
          <p v-if="description" class="confirm-description">{{ description }}</p>
          <div class="confirm-actions">
            <button type="button" class="btn-secondary" @click="onCancel">
              {{ cancelLabel ?? 'Cancelar' }}
            </button>
            <button
              type="button"
              class="btn-confirm"
              :class="variant === 'danger' ? 'btn-confirm--danger' : 'btn-confirm--primary'"
              @click="onConfirm"
            >
              {{ confirmLabel ?? 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  overflow-y: auto;
}

.confirm-modal {
  width: 100%;
  max-width: 400px;
  padding: 1.25rem 1rem;
  margin: auto;
  background: var(--dp-surface);
  border: 1px solid var(--dp-border);
  border-radius: 0.75rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  text-align: center;
}

.confirm-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  margin-bottom: 1rem;
  border-radius: 50%;
  background: var(--dp-green-mute);
  color: var(--dp-green);
}

.confirm-icon-wrap--danger {
  background: rgba(220, 38, 38, 0.12);
  color: #dc2626;
}

.confirm-icon {
  width: 1.75rem;
  height: 1.75rem;
}

.confirm-title {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--dp-text-primary);
  margin-bottom: 0.35rem;
}

.confirm-description {
  font-size: 0.9rem;
  color: var(--dp-text-muted);
  margin-bottom: 1.25rem;
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

@media (max-width: 480px) {
  .confirm-overlay {
    padding: 0.75rem;
    align-items: flex-start;
    padding-top: 2rem;
  }

  .confirm-modal {
    padding: 1rem 0.875rem;
  }

  .confirm-title {
    font-size: 1.05rem;
  }

  .confirm-description {
    font-size: 0.85rem;
  }

  .confirm-actions {
    flex-direction: column;
  }

  .confirm-actions .btn-secondary,
  .confirm-actions .btn-confirm {
    width: 100%;
  }
}

.btn-secondary {
  padding: 0.6rem 1.25rem;
  background: var(--dp-surface);
  color: var(--dp-text-primary);
  font-size: 0.95rem;
  font-weight: 500;
  border: 1px solid var(--dp-border);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: var(--dp-surface-hover);
}

.btn-confirm {
  padding: 0.6rem 1.25rem;
  font-size: 0.95rem;
  font-weight: 600;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-confirm--primary {
  background: var(--dp-green);
  color: white;
}

.btn-confirm--primary:hover {
  opacity: 0.92;
}

.btn-confirm--danger {
  background: #dc2626;
  color: white;
}

.btn-confirm--danger:hover {
  opacity: 0.92;
}

/* transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .confirm-modal,
.modal-leave-active .confirm-modal {
  transition: transform 0.2s ease;
}

.modal-enter-from .confirm-modal,
.modal-leave-to .confirm-modal {
  transform: scale(0.96);
}
</style>
