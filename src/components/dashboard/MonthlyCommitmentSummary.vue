<script setup lang="ts">
import { computed } from 'vue'
import type { MonthlyCommitmentResponse } from '@/types/dashboard-commitment'
import { formatCurrency } from '@/utils/month'

const props = defineProps<{
  data: MonthlyCommitmentResponse | null
  loading?: boolean
}>()

const topMetrics = computed(() => {
  if (!props.data) return []
  return [
    { id: 'committed', label: 'Total comprometido', value: props.data.totalCommitted },
    { id: 'paid', label: 'Já pago', value: props.data.totalPaid },
    { id: 'remaining', label: 'Ainda a pagar', value: props.data.remainingToPay },
  ]
})

const secondaryMetrics = computed(() => {
  if (!props.data) return []
  const b = props.data.breakdown
  return [
    { id: 'bills', label: 'Contas fixas', value: b.recurringBills.total },
    { id: 'cards', label: 'Faturas cartão', value: b.cardInvoices.total },
    { id: 'free', label: 'Saldo livre', value: props.data.freeBalance },
  ]
})

const tableRows = computed(() => {
  if (!props.data) return []
  const rows: Array<{
    id: string
    section: string
    name: string
    value: number
    paid: boolean
    isSubtotal?: boolean
    isTotal?: boolean
  }> = []

  for (const item of props.data.breakdown.recurringBills.items) {
    rows.push({
      id: `bill-${item.id}`,
      section: 'Contas fixas',
      name: item.name,
      value: item.value,
      paid: item.paid,
    })
  }
  rows.push({
    id: 'sub-bills',
    section: '',
    name: 'Subtotal contas fixas',
    value: props.data.breakdown.recurringBills.total,
    paid: false,
    isSubtotal: true,
  })

  for (const item of props.data.breakdown.cardInvoices.items) {
    rows.push({
      id: `card-${item.cardId}`,
      section: 'Faturas cartão',
      name: item.name,
      value: item.invoiceValue,
      paid: item.paid,
    })
  }
  rows.push({
    id: 'sub-cards',
    section: '',
    name: 'Subtotal faturas',
    value: props.data.breakdown.cardInvoices.total,
    paid: false,
    isSubtotal: true,
  })

  rows.push({
    id: 'total',
    section: '',
    name: 'TOTAL comprometido',
    value: props.data.totalCommitted,
    paid: false,
    isTotal: true,
  })

  return rows
})
</script>

<template>
  <section class="commitment">
    <header class="commitment__header">
      <h2 class="commitment__title">Comprometido no mês</h2>
      <p v-if="data" class="commitment__subtitle">
        Renda do mês menos o que já está reservado para contas e faturas
      </p>
    </header>

    <p v-if="loading" class="commitment__loading">Carregando compromissos...</p>

    <template v-else-if="data">
      <div class="commitment__top">
        <article
          v-for="metric in topMetrics"
          :key="metric.id"
          class="metric-card metric-card--primary"
        >
          <p class="metric-card__label">{{ metric.label }}</p>
          <strong class="metric-card__value">{{ formatCurrency(metric.value) }}</strong>
        </article>
      </div>

      <div class="commitment__secondary">
        <article
          v-for="metric in secondaryMetrics"
          :key="metric.id"
          class="metric-card"
          :class="{ 'metric-card--free': metric.id === 'free' }"
        >
          <p class="metric-card__label">{{ metric.label }}</p>
          <strong class="metric-card__value">{{ formatCurrency(metric.value) }}</strong>
        </article>
      </div>

      <div class="commitment-table-wrap">
        <table class="commitment-table">
          <thead>
            <tr>
              <th>Seção</th>
              <th>Item</th>
              <th>Valor</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in tableRows"
              :key="row.id"
              :class="{
                'commitment-table__subtotal': row.isSubtotal,
                'commitment-table__total': row.isTotal,
              }"
            >
              <td>{{ row.section }}</td>
              <td>{{ row.name }}</td>
              <td>{{ formatCurrency(row.value) }}</td>
              <td>
                <span v-if="row.isSubtotal || row.isTotal">—</span>
                <span
                  v-else
                  class="status-pill"
                  :class="row.paid ? 'status-pill--paid' : 'status-pill--open'"
                >
                  {{ row.paid ? 'Pago' : 'Em aberto' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<style scoped>
.commitment {
  border: 1px solid var(--dp-border);
  border-radius: 1rem;
  background: var(--color-background-soft);
  padding: 1rem 1.1rem;
}

.commitment__title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--dp-text-primary);
}

.commitment__subtitle {
  font-size: 0.8rem;
  color: var(--dp-text-muted);
  margin-top: 0.2rem;
}

.commitment__loading {
  font-size: 0.88rem;
  color: var(--dp-text-muted);
  margin-top: 0.75rem;
}

.commitment__top {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
  margin-top: 0.85rem;
}

.commitment__secondary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
  margin-top: 0.65rem;
}

.metric-card {
  padding: 0.85rem;
  border-radius: 0.75rem;
  border: 1px solid var(--dp-border);
  background: var(--color-background);
}

.metric-card--primary {
  border-color: rgba(61, 214, 140, 0.22);
}

.metric-card--free .metric-card__value {
  color: var(--dp-green);
}

.metric-card__label {
  font-size: 0.78rem;
  color: var(--dp-text-muted);
}

.metric-card__value {
  display: block;
  margin-top: 0.35rem;
  font-size: 1.1rem;
  color: var(--dp-text-primary);
}

.commitment-table-wrap {
  margin-top: 1rem;
  overflow-x: auto;
}

.commitment-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.commitment-table th,
.commitment-table td {
  text-align: left;
  padding: 0.5rem 0.4rem;
  border-bottom: 1px solid var(--dp-border);
  color: var(--dp-text-secondary);
}

.commitment-table th {
  color: var(--dp-text-muted);
  font-weight: 600;
  font-size: 0.75rem;
}

.commitment-table__subtotal td {
  font-weight: 600;
  color: var(--dp-text-primary);
}

.commitment-table__total td {
  font-weight: 700;
  color: var(--dp-text-primary);
  border-bottom: none;
}

.status-pill {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.12rem 0.4rem;
  border-radius: 999px;
}

.status-pill--paid {
  background: rgba(61, 214, 140, 0.15);
  color: var(--dp-green);
}

.status-pill--open {
  background: rgba(245, 173, 58, 0.18);
  color: hsl(32, 90%, 40%);
}

@media (max-width: 768px) {
  .commitment__top,
  .commitment__secondary {
    grid-template-columns: 1fr;
  }
}
</style>
