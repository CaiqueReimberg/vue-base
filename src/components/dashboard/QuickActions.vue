<script setup lang="ts">
import type { DashboardQuickAction } from '@/stores/dashboard/dashboard.store'

defineProps<{
  actions: DashboardQuickAction[]
}>()
</script>

<template>
  <section class="quick-actions">
    <div class="section-heading">
      <h2>Ações rápidas</h2>
      <p>Tarefas práticas para agir sem sair do contexto.</p>
    </div>
    <div class="quick-actions__grid">
      <RouterLink
        v-for="action in actions"
        :key="action.id"
        :to="action.to"
        class="quick-action"
        :class="`quick-action--${action.tone}`"
      >
        <strong>{{ action.label }}</strong>
        <span>{{ action.helper }}</span>
      </RouterLink>
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

.quick-actions__grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 0.85rem;
}

.quick-action {
  display: block;
  text-decoration: none;
  border: 1px solid var(--dp-border);
  border-radius: 0.9rem;
  background: var(--color-background-soft);
  padding: 0.95rem;
  transition: transform 0.14s ease, border-color 0.14s ease;
}

.quick-action:hover {
  transform: translateY(-1px);
}

.quick-action strong {
  display: block;
  color: var(--dp-text-primary);
  font-size: 0.92rem;
}

.quick-action span {
  display: block;
  margin-top: 0.28rem;
  font-size: 0.8rem;
  line-height: 1.35;
  color: var(--dp-text-muted);
}

.quick-action--positive {
  border-color: rgba(61, 214, 140, 0.24);
}

.quick-action--warning {
  border-color: rgba(245, 173, 58, 0.24);
}

.quick-action--danger {
  border-color: rgba(248, 113, 113, 0.24);
}

@media (max-width: 1100px) {
  .quick-actions__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .quick-actions__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 480px) {
  .quick-actions__grid {
    grid-template-columns: 1fr;
  }
}
</style>
