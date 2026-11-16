<script setup lang="ts">
import type { DashboardSummaryItem } from '@/stores/dashboard/dashboard.store'

defineProps<{
  items: DashboardSummaryItem[]
  formatCurrency: (value: number) => string
}>()
</script>

<template>
  <section class="summary-grid">
    <article
      v-for="item in items"
      :key="item.id"
      class="summary-card"
      :class="`summary-card--${item.tone}`"
    >
      <p class="summary-card__label">{{ item.label }}</p>
      <strong class="summary-card__value">{{ formatCurrency(item.value) }}</strong>
      <ul class="summary-card__helper">
        <li v-for="(line, idx) in item.helperLines" :key="`${item.id}-${idx}`">{{ line }}</li>
      </ul>
    </article>
  </section>
</template>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.8rem;
}

.summary-card {
  padding: 1rem;
  border-radius: 0.9rem;
  border: 1px solid var(--dp-border);
  background: var(--color-background-soft);
  min-height: 8.4rem;
}

.summary-card--positive {
  border-color: rgba(61, 214, 140, 0.22);
}

.summary-card--warning {
  border-color: rgba(245, 173, 58, 0.25);
}

.summary-card--danger {
  border-color: rgba(248, 113, 113, 0.26);
}

.summary-card__label {
  font-size: 0.82rem;
  color: var(--dp-text-muted);
  margin-bottom: 0.45rem;
}

.summary-card__value {
  display: block;
  font-size: 1.35rem;
  line-height: 1.15;
  color: var(--dp-text-primary);
}

.summary-card__helper {
  font-size: 0.8rem;
  color: var(--dp-text-secondary);
  line-height: 1.4;
  margin-top: 0.55rem;
  padding: 0;
  list-style: none;
}

.summary-card__helper li {
  margin-top: 0.15rem;
}

@media (max-width: 960px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 540px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
