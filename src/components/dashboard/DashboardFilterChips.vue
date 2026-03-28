<script setup lang="ts">
import { useDashboardStore } from '@/stores/dashboard/dashboard.store'
import { storeToRefs } from 'pinia'

const store = useDashboardStore()
const { activeFilter } = storeToRefs(store)

const filters = [
  { id: 'expense', label: 'Gasto', icon: 'chart' },
  { id: 'income', label: 'Entrada' },
  { id: 'account', label: 'Conta', icon: 'doc' },
] as const

async function selectFilter(filterId: 'expense' | 'income' | 'account') {
  store.setActiveFilter(filterId)
  await store.fetchSummary()
}
</script>

<template>
  <div class="filter-chips">
    <button
      v-for="f in filters"
      :key="f.id"
      type="button"
      class="chip"
      :class="{ 'chip--active': f.id === activeFilter }"
      @click="selectFilter(f.id)"
    >
      <svg v-if="f.icon === 'chart'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 3v18h18"/>
        <path d="M18 9l-5 5-4-4-3 3"/>
      </svg>
      <svg v-else-if="f.icon === 'doc'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
      </svg>
      {{ f.label }}
    </button>
  </div>
</template>

<style scoped>
.filter-chips {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  border: 1px solid var(--dp-border);
  background: var(--color-background);
  color: var(--dp-text-secondary);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.chip:hover {
  background: var(--dp-surface);
  border-color: var(--dp-border);
}

.chip--active {
  background: var(--dp-green-soft);
  border-color: var(--dp-green-mute);
  color: var(--dp-green);
}
</style>
