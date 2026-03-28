<script setup lang="ts">
import { useDashboardStore } from '@/stores/dashboard/dashboard.store'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

const store = useDashboardStore()
const {
  budget,
  totalExpenses,
  remainingBalance,
  budgetRingPercent,
  budgetUsedPercentRaw,
  hasMonthlyBudget,
  budgetExceeded,
  formatCurrency,
  secondarySpendLabel,
} = storeToRefs(store)

const circumference = 2 * Math.PI * 45
const strokeDashoffset = computed(
  () => circumference - (budgetRingPercent.value / 100) * circumference,
)

const centerLabel = computed(() => {
  if (!hasMonthlyBudget.value) {
    return 'Sem meta'
  }
  const raw = budgetUsedPercentRaw.value
  return `${raw}%`
})

const sublineLabel = computed(() => {
  if (!hasMonthlyBudget.value) {
    return 'Cadastre orçamentos mensais'
  }
  return 'do orçamento'
})
</script>

<template>
  <section class="overview-card">
    <div class="overview-main">
      <div class="progress-ring-wrap">
        <svg class="progress-ring" width="120" height="120" viewBox="0 0 120 120">
          <circle
            class="progress-ring-bg"
            cx="60"
            cy="60"
            r="45"
            fill="none"
            stroke-width="10"
          />
          <circle
            class="progress-ring-fill"
            :class="{ 'progress-ring-fill--over': budgetExceeded }"
            cx="60"
            cy="60"
            r="45"
            fill="none"
            stroke-width="10"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="strokeDashoffset"
            stroke-linecap="round"
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div class="progress-label-stack">
          <span class="progress-label-main">{{ centerLabel }}</span>
          <span v-if="hasMonthlyBudget" class="progress-label-sub">{{ sublineLabel }}</span>
        </div>
      </div>
      <div class="overview-values">
        <p class="label">Saldo disponível</p>
        <p class="remaining">{{ formatCurrency(remainingBalance) }}</p>
        <div class="sub-cards">
          <div class="sub-card">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M12 12h.01M17 8H7a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1z"/>
            </svg>
            <div>
              <span class="sub-label">Orçamento do mês</span>
              <span class="sub-value">{{ formatCurrency(budget) }}</span>
            </div>
          </div>
          <div class="sub-card">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3v18h18"/>
              <path d="M18 9l-5 5-4-4-3 3"/>
            </svg>
            <div>
              <span class="sub-label">{{ secondarySpendLabel }}</span>
              <span class="sub-value">{{ formatCurrency(totalExpenses) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.overview-card {
  background: var(--color-background);
  border: 1px solid var(--dp-border);
  border-radius: 1rem;
  padding: 1.5rem;
  margin-bottom: 1.25rem;
}

.overview-main {
  display: flex;
  align-items: center;
  gap: 2rem;
  flex-wrap: wrap;
}

.progress-ring-wrap {
  position: relative;
  flex-shrink: 0;
}

.progress-ring {
  display: block;
}

.progress-ring-bg {
  stroke: var(--dp-border);
}

.progress-ring-fill {
  stroke: var(--dp-green);
  transition: stroke-dashoffset 0.4s ease, stroke 0.3s ease;
}

.progress-ring-fill--over {
  stroke: hsl(0, 72%, 50%);
}

.progress-label-stack {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  padding: 0 0.5rem;
  text-align: center;
}

.progress-label-main {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--dp-text-primary);
  line-height: 1.1;
}

.progress-label-sub {
  font-size: 0.68rem;
  font-weight: 500;
  color: var(--dp-text-muted);
  line-height: 1.2;
  max-width: 5.5rem;
}

.overview-values {
  flex: 1;
  min-width: 200px;
}

.label {
  font-size: 0.9rem;
  color: var(--dp-text-muted);
  margin-bottom: 0.25rem;
}

.remaining {
  font-size: 2rem;
  font-weight: 700;
  color: var(--dp-green);
  margin-bottom: 1rem;
  line-height: 1.2;
}

.sub-cards {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.sub-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--dp-surface);
  border-radius: 0.75rem;
  color: var(--dp-text-secondary);
}

.sub-card svg {
  flex-shrink: 0;
  color: var(--dp-text-muted);
}

.sub-card div {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.sub-label {
  font-size: 0.75rem;
  color: var(--dp-text-muted);
}

.sub-value {
  font-size: 0.95rem;
  font-weight: 600;
}
</style>
