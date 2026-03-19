<script setup lang="ts">
import { useDashboardStore } from '@/stores/dashboard/dashboard.store'
import { storeToRefs } from 'pinia'

const store = useDashboardStore()
const { monthlyIncome, projectedBalance, formatCurrency } = storeToRefs(store)
</script>

<template>
  <div class="income-cards">
    <div class="income-card income-card--green">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 17l6-6 4 4 8-8"/>
        <path d="M21 9v8h-8"/>
      </svg>
      <div>
        <span class="income-label">Entradas do mês</span>
        <span class="income-value income-value--green">{{ formatCurrency(monthlyIncome) }}</span>
      </div>
    </div>
    <div class="income-card">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 3v18h18"/>
        <path d="M7 16v-5M12 16v-8M17 16v-11"/>
      </svg>
      <div>
        <span class="income-label">Saldo projetado</span>
        <span class="income-value">{{ formatCurrency(projectedBalance) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.income-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.income-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: var(--dp-surface);
  border-radius: 0.75rem;
  border: 1px solid var(--dp-border);
}

.income-card--green {
  background: var(--dp-green-soft);
  border-color: var(--dp-green-mute);
}

.income-card svg {
  flex-shrink: 0;
  color: var(--dp-text-muted);
}

.income-card--green svg {
  color: var(--dp-green);
}

.income-card div {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.income-label {
  font-size: 0.8rem;
  color: var(--dp-text-muted);
}

.income-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--dp-text-primary);
}

.income-value--green {
  color: var(--dp-green);
}
</style>
