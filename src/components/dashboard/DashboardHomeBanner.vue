<script setup lang="ts">
import { useDashboardStore } from '@/stores/dashboard/dashboard.store'
import { storeToRefs } from 'pinia'

const store = useDashboardStore()
const { coupleName, periodLabel, budgetStatus } = storeToRefs(store)
</script>

<template>
  <div class="home-banner">
    <div class="home-banner__left">
      <h1 class="couple-name">{{ coupleName }}</h1>
      <span class="period-label">{{ periodLabel }}</span>
    </div>
    <span v-if="budgetStatus === 'within'" class="budget-tag budget-tag--ok">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      Dentro do orçamento
    </span>
    <span v-else-if="budgetStatus === 'over'" class="budget-tag budget-tag--over">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 9v4M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
      </svg>
      Acima do orçamento
    </span>
  </div>
</template>

<style scoped>
.home-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.home-banner__left {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.couple-name {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--dp-text-primary);
  line-height: 1.2;
}

.period-label {
  font-size: 0.9rem;
  color: var(--dp-text-muted);
}

.budget-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 500;
}

.budget-tag--ok {
  background: var(--dp-green-mute);
  color: var(--dp-green);
}

.budget-tag--over {
  background: hsl(0, 55%, 94%);
  color: hsl(0, 65%, 40%);
}

@media (prefers-color-scheme: dark) {
  .budget-tag--over {
    background: hsl(0, 35%, 22%);
    color: hsl(0, 80%, 72%);
  }
}

html[data-theme='dark'] .budget-tag--over {
  background: hsl(0, 35%, 22%);
  color: hsl(0, 80%, 72%);
}

@media (max-width: 640px) {
  .couple-name {
    font-size: 1.25rem;
  }

  .period-label {
    font-size: 0.85rem;
  }
}
</style>
