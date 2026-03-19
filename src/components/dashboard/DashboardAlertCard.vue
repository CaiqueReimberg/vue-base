<script setup lang="ts">
import { useDashboardStore } from '@/stores/dashboard/dashboard.store'
import { storeToRefs } from 'pinia'

const store = useDashboardStore()
const { pendingMessagesCount } = storeToRefs(store)
</script>

<template>
  <div class="alert-card">
    <span class="alert-icon" aria-hidden="true">!</span>
    <div class="alert-content">
      <p class="alert-title">{{ pendingMessagesCount }} mensagens pendentes</p>
      <p class="alert-desc">Precisam de revisão manual para completar o registro</p>
    </div>
    <button type="button" class="alert-arrow" aria-label="Ver mensagens">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14M12 5l7 7-7 7"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.alert-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: var(--dp-yellow-bg);
  border: 1px solid var(--dp-yellow-border);
  border-radius: 0.75rem;
  margin-bottom: 1rem;
}

.alert-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--dp-yellow-icon);
  color: white;
  font-size: 1rem;
  font-weight: 700;
  flex-shrink: 0;
}

.alert-content {
  flex: 1;
  min-width: 0;
}

.alert-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--dp-text-primary);
  margin-bottom: 0.15rem;
}

.alert-desc {
  font-size: 0.85rem;
  color: var(--dp-text-secondary);
}

.alert-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  border: none;
  background: transparent;
  color: var(--dp-text-secondary);
  cursor: pointer;
  border-radius: 0.5rem;
  transition: background 0.2s, color 0.2s;
}

.alert-arrow:hover {
  background: var(--dp-surface);
  color: var(--dp-text-primary);
}
</style>
