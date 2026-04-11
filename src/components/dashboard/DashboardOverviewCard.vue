<script setup lang="ts">
import { useDashboardStore } from '@/stores/dashboard/dashboard.store'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

const store = useDashboardStore()
const {
  individualBudgetLimit,
  individualBudgetSpent,
  sharedBudgetLimit,
  sharedBudgetSpent,
  sharedBudgetIncome,
  remainingBalance,
  individualBudgetRingPercent,
  sharedBudgetRingPercent,
  individualBudgetUsedPercentRaw,
  sharedBudgetUsedPercentRaw,
  hasIndividualBudget,
  hasSharedBudget,
  hasAnyMonthlyBudget,
  individualBudgetExceeded,
  sharedBudgetExceeded,
  formatCurrency,
  secondarySpendLabel,
  totalExpenses,
} = storeToRefs(store)

const rInd = 40
const rShared = 40
const circumference = 2 * Math.PI * rInd

const strokeDashoffsetIndividual = computed(
  () => circumference - (individualBudgetRingPercent.value / 100) * circumference,
)
const strokeDashoffsetShared = computed(
  () => circumference - (sharedBudgetRingPercent.value / 100) * circumference,
)

const combinedLimit = computed(
  () => individualBudgetLimit.value + sharedBudgetLimit.value,
)
const combinedSpent = computed(
  () => individualBudgetSpent.value + sharedBudgetSpent.value,
)

const centerLabel = computed(() => {
  if (!hasAnyMonthlyBudget.value) {
    return 'Sem meta'
  }
  if (hasIndividualBudget.value && !hasSharedBudget.value) {
    return `${individualBudgetUsedPercentRaw.value}%`
  }
  if (!hasIndividualBudget.value && hasSharedBudget.value) {
    return `${sharedBudgetUsedPercentRaw.value}%`
  }
  return 'Metas'
})

const sublineLabel = computed(() => {
  if (!hasAnyMonthlyBudget.value) {
    return 'Cadastre orçamentos mensais'
  }
  return 'do limite'
})
</script>

<template>
  <section class="overview-card">
    <div class="overview-main">
      <div class="budget-rings">
        <div v-if="hasIndividualBudget" class="ring-block">
          <div class="ring-caption">Individual</div>
          <div class="progress-ring-wrap">
            <svg class="progress-ring" width="100" height="100" viewBox="0 0 100 100">
              <circle
                class="progress-ring-bg"
                cx="50"
                cy="50"
                :r="rInd"
                fill="none"
                stroke-width="9"
              />
              <circle
                class="progress-ring-fill"
                :class="{ 'progress-ring-fill--over': individualBudgetExceeded }"
                cx="50"
                cy="50"
                :r="rInd"
                fill="none"
                stroke-width="9"
                :stroke-dasharray="circumference"
                :stroke-dashoffset="strokeDashoffsetIndividual"
                stroke-linecap="round"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div class="progress-label-stack">
              <span class="progress-label-main">{{ individualBudgetUsedPercentRaw }}%</span>
            </div>
          </div>
          <p class="ring-meta">
            {{ formatCurrency(individualBudgetSpent) }} / {{ formatCurrency(individualBudgetLimit) }}
          </p>
        </div>

        <div v-if="hasSharedBudget" class="ring-block">
          <div class="ring-caption">Compartilhado</div>
          <div class="progress-ring-wrap">
            <svg class="progress-ring" width="100" height="100" viewBox="0 0 100 100">
              <circle
                class="progress-ring-bg"
                cx="50"
                cy="50"
                :r="rShared"
                fill="none"
                stroke-width="9"
              />
              <circle
                class="progress-ring-fill progress-ring-fill--shared"
                :class="{ 'progress-ring-fill--over': sharedBudgetExceeded }"
                cx="50"
                cy="50"
                :r="rShared"
                fill="none"
                stroke-width="9"
                :stroke-dasharray="circumference"
                :stroke-dashoffset="strokeDashoffsetShared"
                stroke-linecap="round"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div class="progress-label-stack">
              <span class="progress-label-main">{{ sharedBudgetUsedPercentRaw }}%</span>
            </div>
          </div>
          <p class="ring-meta">
            {{ formatCurrency(sharedBudgetSpent) }} / {{ formatCurrency(sharedBudgetLimit) }}
          </p>
          <p v-if="sharedBudgetIncome > 0" class="ring-income">
            Renda compartilhada: {{ formatCurrency(sharedBudgetIncome) }}
          </p>
        </div>

        <div v-if="!hasIndividualBudget && !hasSharedBudget" class="ring-block ring-block--empty">
          <div class="progress-ring-wrap progress-ring-wrap--single">
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
                class="progress-ring-fill progress-ring-fill--muted"
                cx="60"
                cy="60"
                r="45"
                fill="none"
                stroke-width="10"
                stroke-dasharray="283"
                stroke-dashoffset="283"
                stroke-linecap="round"
                transform="rotate(-90 60 60)"
              />
            </svg>
            <div class="progress-label-stack">
              <span class="progress-label-main">{{ centerLabel }}</span>
              <span class="progress-label-sub">{{ sublineLabel }}</span>
            </div>
          </div>
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
              <span class="sub-label">Limite(s) do mês</span>
              <span class="sub-value">{{ formatCurrency(combinedLimit) }}</span>
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
  align-items: flex-start;
  gap: 2rem;
  flex-wrap: wrap;
}

.budget-rings {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: flex-start;
}

.ring-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  min-width: 120px;
}

.ring-block--empty {
  flex: 1;
}

.ring-caption {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--dp-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.progress-ring-wrap {
  position: relative;
  flex-shrink: 0;
}

.progress-ring-wrap--single {
  width: 120px;
  height: 120px;
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

.progress-ring-fill--shared {
  stroke: hsl(210, 65%, 48%);
}

.progress-ring-fill--muted {
  stroke: var(--dp-border);
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
  font-size: 0.85rem;
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

.ring-meta {
  font-size: 0.72rem;
  color: var(--dp-text-secondary);
  margin: 0;
  text-align: center;
}

.ring-income {
  font-size: 0.7rem;
  color: var(--dp-green);
  margin: 0;
  font-weight: 600;
  text-align: center;
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
