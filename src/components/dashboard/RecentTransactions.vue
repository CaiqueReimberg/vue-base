<script setup lang="ts">
import type { DashboardRecentTransaction } from '@/stores/dashboard/dashboard.store'

defineProps<{
  items: DashboardRecentTransaction[]
  formatCurrency: (value: number) => string
}>()
</script>

<template>
  <section class="recent-card">
    <div class="section-heading">
      <div>
        <h2>Últimos lançamentos</h2>
        <p>Leitura rápida do que acabou de acontecer.</p>
      </div>
      <RouterLink to="/movements" class="see-all">Ver todos</RouterLink>
    </div>

    <ul v-if="items.length" class="recent-list">
      <li v-for="item in items" :key="item.id" class="recent-item">
        <span class="recent-item__icon" :class="`recent-item__icon--${item.type}`">
          {{ item.type === 'income' ? '+' : '-' }}
        </span>
        <div class="recent-item__content">
          <div class="recent-item__head">
            <strong>{{ item.description }}</strong>
            <span class="recent-item__tag">{{ item.category }}</span>
          </div>
          <p>{{ item.source }} • {{ item.dateLabel }}</p>
        </div>
        <span class="recent-item__amount" :class="`recent-item__amount--${item.type}`">
          {{ item.type === 'income' ? '+' : '-' }} {{ formatCurrency(item.amount) }}
        </span>
      </li>
    </ul>
    <p v-else class="recent-empty">Nenhum lançamento recente para mostrar.</p>
  </section>
</template>

<style scoped>
.recent-card {
  border-radius: 1rem;
  border: 1px solid var(--dp-border);
  background: var(--color-background-soft);
  padding: 1rem;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
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

.see-all {
  text-decoration: none;
  color: var(--dp-green);
  font-size: 0.88rem;
  font-weight: 600;
}

.recent-list {
  list-style: none;
  padding: 0;
  margin: 0.9rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 0.9rem;
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.02);
}

.recent-item__icon {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}

.recent-item__icon--expense {
  background: rgba(248, 113, 113, 0.16);
  color: #f87171;
}

.recent-item__icon--income {
  background: rgba(61, 214, 140, 0.16);
  color: #3dd68c;
}

.recent-item__content {
  flex: 1;
  min-width: 0;
}

.recent-item__head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}

.recent-item__head strong {
  color: var(--dp-text-primary);
  font-size: 0.93rem;
}

.recent-item__head p,
.recent-item__content p {
  color: var(--dp-text-muted);
  font-size: 0.8rem;
}

.recent-item__tag {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  font-size: 0.72rem;
  color: var(--dp-text-secondary);
  background: rgba(255, 255, 255, 0.05);
}

.recent-item__amount {
  font-weight: 700;
  white-space: nowrap;
}

.recent-item__amount--expense {
  color: #f87171;
}

.recent-item__amount--income {
  color: #3dd68c;
}

.recent-empty {
  margin-top: 0.9rem;
  color: var(--dp-text-muted);
  font-size: 0.85rem;
}

@media (max-width: 640px) {
  .recent-item {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .recent-item__amount {
    margin-left: 2.85rem;
  }
}
</style>
