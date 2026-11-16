<script setup lang="ts">
import type { DashboardImpactItem } from '@/stores/dashboard/dashboard.store'

defineProps<{
  items: DashboardImpactItem[]
  formatCurrency: (value: number) => string
}>()
</script>

<template>
  <section class="impact-card">
    <div class="section-heading">
      <h2>Maiores impactos do mês</h2>
      <p>Os principais responsáveis pela pressão do mês.</p>
    </div>

    <ul v-if="items.length" class="impact-list">
      <li v-for="item in items" :key="item.id" class="impact-item">
        <div class="impact-item__main">
          <strong>{{ item.label }}</strong>
          <span>{{ item.share }}% dos gastos do mês — {{ item.insight }}</span>
        </div>
        <span class="impact-item__amount">{{ formatCurrency(item.amount) }}</span>
      </li>
    </ul>
    <p v-else class="impact-empty">Ainda não há gastos suficientes no mês para destacar impactos.</p>
  </section>
</template>

<style scoped>
.impact-card {
  border-radius: 1rem;
  border: 1px solid var(--dp-border);
  background: var(--color-background-soft);
  padding: 1rem;
}

.section-heading h2 {
  font-size: 1.05rem;
  color: var(--dp-text-primary);
  margin: 0;
}

.section-heading p {
  margin-top: 0.2rem;
  color: var(--dp-text-muted);
  font-size: 0.86rem;
}

.impact-list {
  margin: 0.9rem 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.impact-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.8rem 0.9rem;
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.02);
}

.impact-item__main strong {
  display: block;
  color: var(--dp-text-primary);
  font-size: 0.95rem;
}

.impact-item__main span {
  display: block;
  margin-top: 0.2rem;
  color: var(--dp-text-muted);
  font-size: 0.8rem;
}

.impact-item__amount {
  color: var(--dp-text-primary);
  font-weight: 600;
}

.impact-empty {
  margin-top: 0.9rem;
  color: var(--dp-text-muted);
  font-size: 0.85rem;
}
</style>
