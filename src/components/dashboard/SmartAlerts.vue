<script setup lang="ts">
import type { DashboardAlert } from '@/stores/dashboard/dashboard.store'

defineProps<{
  alerts: DashboardAlert[]
}>()
</script>

<template>
  <section v-if="alerts.length" class="alerts">
    <div class="section-heading">
      <h2>Alertas inteligentes</h2>
      <p>O que merece sua atenção agora.</p>
    </div>
    <div class="alerts__grid">
      <article
        v-for="alert in alerts"
        :key="alert.id"
        class="alert-card"
        :class="`alert-card--${alert.tone}`"
      >
        <h3>{{ alert.title }}</h3>
        <p>{{ alert.message }}</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
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

.alerts__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 0.8rem;
}

.alert-card {
  border-radius: 0.9rem;
  border: 1px solid var(--dp-border);
  background: var(--color-background-soft);
  padding: 0.95rem 1rem;
}

.alert-card h3 {
  margin: 0;
  font-size: 0.95rem;
  color: var(--dp-text-primary);
}

.alert-card p {
  margin-top: 0.35rem;
  font-size: 0.84rem;
  line-height: 1.45;
  color: var(--dp-text-secondary);
}

.alert-card--danger {
  border-color: rgba(248, 113, 113, 0.28);
}

.alert-card--warning {
  border-color: rgba(245, 173, 58, 0.28);
}

.alert-card--info {
  border-color: rgba(96, 165, 250, 0.28);
}

@media (max-width: 700px) {
  .alerts__grid {
    grid-template-columns: 1fr;
  }
}
</style>
