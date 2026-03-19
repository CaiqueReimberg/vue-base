<script setup lang="ts">
import { storeToRefs } from 'pinia'
import DashboardHeader from '@/components/dashboard/DashboardHeader.vue'
import { useMovementsStore } from '@/stores/movements/movements.store'
import type { Movement, MovementType } from '@/stores/movements/movements.store'

const store = useMovementsStore()
const {
  filteredMovements,
  movementsCount,
  formatCurrency,
  typeLabel,
  searchQuery,
  filterType,
  filterAccount,
  filterOrigin,
} = storeToRefs(store)

const typeOptions: { value: MovementType | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'expense', label: 'Gasto' },
  { value: 'income', label: 'Entrada' },
  { value: 'adjustment', label: 'Ajuste' },
]

function getMovementMeta(m: Movement) {
  return `${m.author} • ${m.account} • ${m.origin} • ${m.createdAt}`
}

function getAmountClass(m: Movement) {
  if (m.type === 'expense') return 'amount amount--expense'
  return 'amount amount--income'
}

function formatMovementAmount(m: Movement) {
  const formatted = formatCurrency.value(m.amount)
  if (m.type === 'expense') return `- ${formatted}`
  return `+ ${formatted}`
}
</script>

<template>
  <div class="movements-page">
    <DashboardHeader compact />
    <main class="movements-main">
      <header class="movements-header">
        <div class="movements-title-block">
          <h1 class="movements-title">Movimentações</h1>
          <p class="movements-subtitle">Entradas, saídas e ajustes do casal</p>
        </div>
        <router-link to="/" class="btn-add">
          <span class="btn-add-icon">+</span>
          Adicionar
        </router-link>
      </header>

      <div class="search-wrap">
        <span class="search-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </span>
        <input
          v-model="searchQuery"
          type="search"
          class="search-input"
          placeholder="Buscar por descrição..."
          aria-label="Buscar por descrição"
        />
      </div>

      <div class="filters-row">
        <span class="filter-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
          </svg>
        </span>
        <select v-model="filterType" class="filter-select" aria-label="Filtrar por tipo">
          <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <select v-model="filterAccount" class="filter-select" aria-label="Filtrar por conta">
          <option value="all">Todos</option>
          <option value="Nubank">Nubank</option>
          <option value="Itaú">Itaú</option>
        </select>
        <select v-model="filterOrigin" class="filter-select" aria-label="Filtrar por origem">
          <option value="all">Todas as origens</option>
          <option value="Manual">Manual</option>
          <option value="WhatsApp">WhatsApp</option>
        </select>
      </div>

      <p class="movements-count">{{ movementsCount }} movimentações</p>

      <ul class="movements-list">
        <li v-for="movement in filteredMovements" :key="movement.id" class="movement-item">
          <span
            class="movement-icon"
            :class="`movement-icon--${movement.type}`"
            :aria-label="typeLabel(movement.type)"
          >
            <svg v-if="movement.type === 'expense'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M5 12h14"/>
            </svg>
            <svg v-else-if="movement.type === 'income'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </span>
          <div class="movement-body">
            <div class="movement-head">
              <span class="movement-description">{{ movement.description }}</span>
              <span class="movement-type-tag" :class="`movement-type-tag--${movement.type}`">
                {{ typeLabel(movement.type) }}
              </span>
            </div>
            <p class="movement-meta">{{ getMovementMeta(movement) }}</p>
          </div>
          <span :class="getAmountClass(movement)">{{ formatMovementAmount(movement) }}</span>
        </li>
      </ul>
    </main>
  </div>
</template>

<style scoped>
.movements-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 1rem 1.5rem 2rem;
}

@media (max-width: 640px) {
  .movements-page {
    padding: 0.75rem 1rem 1.5rem;
  }

  .movements-title {
    font-size: 1.25rem;
  }

  .movements-subtitle {
    font-size: 0.85rem;
  }

  .btn-add {
    width: 100%;
    justify-content: center;
  }

  .movement-item {
    flex-wrap: wrap;
    padding: 0.875rem 1rem;
  }

  .movement-body {
    flex: 1 1 calc(100% - 3rem);
  }
}

@media (max-width: 380px) {
  .movements-page {
    padding: 0.5rem 0.75rem 1rem;
  }
}

.movements-main {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.movements-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.movements-title-block {
  flex: 1;
  min-width: 0;
}

.movements-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--dp-text-primary);
  margin-bottom: 0.2rem;
  line-height: 1.2;
}

.movements-subtitle {
  font-size: 0.9rem;
  color: var(--dp-text-muted);
}

.btn-add {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1.25rem;
  background: var(--dp-green);
  color: white;
  font-size: 0.95rem;
  font-weight: 600;
  border-radius: 0.5rem;
  text-decoration: none;
  transition: opacity 0.2s, transform 0.05s;
}

.btn-add:hover {
  opacity: 0.92;
}

.btn-add:active {
  transform: scale(0.98);
}

.btn-add-icon {
  font-size: 1.1rem;
  line-height: 1;
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 1rem;
  display: flex;
  color: var(--dp-text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.75rem;
  font-size: 0.95rem;
  border: 1px solid var(--dp-border);
  border-radius: 0.75rem;
  background: var(--color-background);
  color: var(--dp-text-primary);
  outline: none;
  transition: border-color 0.2s;
}

.search-input::placeholder {
  color: var(--dp-text-muted);
}

.search-input:focus {
  border-color: var(--dp-green);
}

.filters-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-icon {
  display: flex;
  color: var(--dp-text-muted);
}

.filter-select {
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  font-size: 0.9rem;
  border: 1px solid var(--dp-border);
  border-radius: 0.5rem;
  background: var(--color-background);
  color: var(--dp-text-primary);
  cursor: pointer;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.5rem center;
}

.movements-count {
  font-size: 0.85rem;
  color: var(--dp-text-muted);
}

.movements-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.movement-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: var(--dp-surface);
  border: 1px solid var(--dp-border);
  border-radius: 0.75rem;
}

.movement-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  flex-shrink: 0;
  color: white;
}

.movement-icon--expense {
  background: #dc2626;
}

.movement-icon--income {
  background: var(--dp-green);
}

.movement-icon--adjustment {
  background: var(--dp-text-muted);
}

.movement-body {
  flex: 1;
  min-width: 0;
}

.movement-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.2rem;
}

.movement-description {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--dp-text-primary);
}

.movement-type-tag {
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  font-weight: 500;
}

.movement-type-tag--expense {
  background: rgba(220, 38, 38, 0.15);
  color: #dc2626;
}

.movement-type-tag--income {
  background: var(--dp-green-mute);
  color: var(--dp-green);
}

.movement-type-tag--adjustment {
  background: var(--dp-surface-hover);
  color: var(--dp-text-muted);
}

.movement-meta {
  font-size: 0.8rem;
  color: var(--dp-text-muted);
}

.amount {
  font-size: 1rem;
  font-weight: 600;
  flex-shrink: 0;
}

.amount--expense {
  color: #dc2626;
}

.amount--income {
  color: var(--dp-green);
}
</style>
