<script setup lang="ts">
import { useDashboardStore } from '@/stores/dashboard/dashboard.store'
import { storeToRefs } from 'pinia'

const store = useDashboardStore()
const { expenses, formatCurrency, listTitle } = storeToRefs(store)
</script>

<template>
  <section class="latest-expenses">
    <div class="section-header">
      <h2 class="section-title">{{ listTitle }}</h2>
      <router-link to="/movements" class="see-all">Ver todos</router-link>
    </div>
    <ul class="expense-list">
      <li v-for="expense in expenses" :key="expense.id" class="expense-item">
        <span class="expense-avatar" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </span>
        <div class="expense-info">
          <p class="expense-desc">
            {{ expense.description }}
            <span v-if="expense.status === 'confirmed'" class="expense-status" title="Confirmado">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </span>
          </p>
          <p class="expense-meta">{{ expense.author }} • {{ expense.createdAt }}</p>
        </div>
        <span class="expense-amount">{{ formatCurrency(expense.amount) }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.latest-expenses {
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--dp-text-primary);
}

.see-all {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--dp-green);
  text-decoration: none;
  transition: opacity 0.2s;
}

.see-all:hover {
  opacity: 0.85;
}

.expense-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.expense-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: var(--dp-green-soft);
  border: 1px solid var(--dp-green-mute);
  border-radius: 0.75rem;
}

.expense-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: var(--dp-green-mute);
  color: var(--dp-green);
  flex-shrink: 0;
}

.expense-info {
  flex: 1;
  min-width: 0;
}

.expense-desc {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--dp-text-primary);
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.15rem;
}

.expense-status {
  display: inline-flex;
  color: var(--dp-green);
}

.expense-meta {
  font-size: 0.8rem;
  color: var(--dp-text-muted);
}

.expense-amount {
  font-size: 1rem;
  font-weight: 600;
  color: var(--dp-text-primary);
  flex-shrink: 0;
}
</style>
