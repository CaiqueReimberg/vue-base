<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
} from '@heroicons/vue/24/outline'
import { useRecurringStore } from '@/stores/recurring/recurring.store'
import { useToastStore } from '@/stores/toast/toast.store'
import { formatCurrency } from '@/utils/month'
import type { BillPaymentStatus } from '@/utils/month'

const recurringStore = useRecurringStore()
const toastStore = useToastStore()

const { expenseItems, loading, periodLabel } = storeToRefs(recurringStore)

const statusLabels: Record<BillPaymentStatus, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  overdue: 'Vencido',
}

async function onToggle(id: string) {
  try {
    await recurringStore.togglePaid(id)
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao atualizar pagamento')
  }
}

function paidDateLabel(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

const empty = computed(() => !loading.value && expenseItems.value.length === 0)
</script>

<template>
  <section class="fixed-bills">
    <header class="fixed-bills__header">
      <div>
        <h2 class="fixed-bills__title">Contas fixas do mês</h2>
        <p class="fixed-bills__subtitle">{{ periodLabel }}</p>
      </div>
    </header>

    <p v-if="loading" class="fixed-bills__loading">Carregando contas fixas...</p>
    <p v-else-if="empty" class="fixed-bills__empty">
      Nenhuma conta recorrente ativa para este mês.
    </p>

    <ul v-else class="fixed-bills__list" role="list">
      <li
        v-for="item in expenseItems"
        :key="item.id"
        class="fixed-bill-item"
        :class="{
          'fixed-bill-item--paid': recurringStore.statusFor(item) === 'paid',
        }"
      >
        <div class="fixed-bill-item__main">
          <p class="fixed-bill-item__name">{{ item.name }}</p>
          <p class="fixed-bill-item__meta">
            <span v-if="item.dueDay">Vence dia {{ item.dueDay }}</span>
            <span v-else>Sem dia de vencimento</span>
            <span v-if="item.category?.name"> · {{ item.category.name }}</span>
          </p>
          <p v-if="item.paid && item.paidAt" class="fixed-bill-item__paid-at">
            Pago em {{ paidDateLabel(item.paidAt) }}
          </p>
        </div>
        <div class="fixed-bill-item__aside">
          <strong class="fixed-bill-item__amount">{{ formatCurrency(item.amount) }}</strong>
          <span
            class="status-badge"
            :class="`status-badge--${recurringStore.statusFor(item)}`"
          >
            <CheckCircleIcon
              v-if="recurringStore.statusFor(item) === 'paid'"
              class="status-badge__icon"
            />
            <ExclamationCircleIcon
              v-else-if="recurringStore.statusFor(item) === 'overdue'"
              class="status-badge__icon"
            />
            <ClockIcon v-else class="status-badge__icon" />
            {{ statusLabels[recurringStore.statusFor(item)] }}
          </span>
          <button
            type="button"
            class="toggle-btn"
            :disabled="recurringStore.isToggling(item.id)"
            @click="onToggle(item.id)"
          >
            {{
              item.paid
                ? recurringStore.isToggling(item.id)
                  ? 'Desfazendo...'
                  : 'Desmarcar'
                : recurringStore.isToggling(item.id)
                  ? 'Salvando...'
                  : 'Marcar como pago'
            }}
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.fixed-bills {
  border: 1px solid var(--dp-border);
  border-radius: 1rem;
  background: var(--color-background-soft);
  padding: 1rem 1.1rem;
}

.fixed-bills__header {
  margin-bottom: 0.85rem;
}

.fixed-bills__title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--dp-text-primary);
}

.fixed-bills__subtitle {
  font-size: 0.82rem;
  color: var(--dp-text-muted);
  margin-top: 0.15rem;
}

.fixed-bills__loading,
.fixed-bills__empty {
  font-size: 0.88rem;
  color: var(--dp-text-muted);
}

.fixed-bills__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.fixed-bill-item {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem;
  border-radius: 0.75rem;
  border: 1px solid var(--dp-border);
  background: var(--color-background);
}

.fixed-bill-item--paid {
  opacity: 0.72;
}

.fixed-bill-item__name {
  font-weight: 600;
  color: var(--dp-text-primary);
}

.fixed-bill-item__meta,
.fixed-bill-item__paid-at {
  font-size: 0.8rem;
  color: var(--dp-text-secondary);
  margin-top: 0.2rem;
}

.fixed-bill-item__aside {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.35rem;
  flex-shrink: 0;
}

.fixed-bill-item__amount {
  font-size: 0.95rem;
  color: var(--dp-text-primary);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
}

.status-badge__icon {
  width: 0.9rem;
  height: 0.9rem;
}

.status-badge--paid {
  background: rgba(61, 214, 140, 0.15);
  color: var(--dp-green);
}

.status-badge--pending {
  background: rgba(245, 173, 58, 0.18);
  color: hsl(32, 90%, 40%);
}

.status-badge--overdue {
  background: rgba(248, 113, 113, 0.18);
  color: #dc2626;
}

.toggle-btn {
  font-size: 0.75rem;
  color: var(--dp-green);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

.toggle-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .fixed-bill-item {
    flex-direction: column;
  }

  .fixed-bill-item__aside {
    align-items: flex-start;
  }
}
</style>
