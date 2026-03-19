<script setup lang="ts">
import { useDashboardStore } from '@/stores/dashboard/dashboard.store'
import { useThemeStore } from '@/stores/theme/theme.store'
import { storeToRefs } from 'pinia'
import {
  SunIcon,
  MoonIcon,
  Squares2X2Icon,
  ArrowsRightLeftIcon,
  CreditCardIcon,
  BuildingLibraryIcon,
  PlusSmallIcon,
  CalendarDaysIcon,
  EyeIcon,
  ClockIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth/auth.store'
import { useRouter } from 'vue-router'

defineProps<{
  compact?: boolean
}>()

const router = useRouter()
const store = useDashboardStore()
const authStore = useAuthStore()
const { coupleName, periodLabel, budgetStatus } = storeToRefs(store)
const themeStore = useThemeStore()
const { isDark } = storeToRefs(themeStore)

function toggleTheme() {
  themeStore.toggle()
}

function logout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <header class="dashboard-header" :class="{ 'dashboard-header--compact': compact }">
    <div class="header-top">
      <div class="logo">
        <span class="logo-icon">♥</span>
        <span class="logo-text">DuoPact</span>
      </div>
      <div class="header-actions">
        <button
          type="button"
          class="icon-btn theme-toggle"
          :title="isDark ? 'Usar tema claro' : 'Usar tema escuro'"
          :aria-label="isDark ? 'Usar tema claro' : 'Usar tema escuro'"
          @click="toggleTheme"
        >
          <SunIcon v-if="isDark" class="h-5 w-5" />
          <MoonIcon v-else class="h-5 w-5" />
        </button>
        <router-link to="/">
          <button type="button" class="icon-btn" title="Dashboard" aria-label="Dashboard">
            <Squares2X2Icon class="h-5 w-5" />
          </button>
        </router-link>
        <router-link to="/movements">
          <button type="button" class="icon-btn" title="Transferências" aria-label="Transferências">
            <ArrowsRightLeftIcon class="h-5 w-5" />
          </button>
        </router-link>
        <router-link to="/cards">
          <button type="button" class="icon-btn" title="Cartões" aria-label="Cartões">
            <CreditCardIcon class="h-5 w-5" />
          </button>
        </router-link>
        <router-link to="/accounts">
          <button type="button" class="icon-btn" title="Contas" aria-label="Contas bancárias">
            <BuildingLibraryIcon class="h-5 w-5" />
          </button>
        </router-link>
        <button type="button" class="icon-btn" title="Adicionar" aria-label="Adicionar">
          <PlusSmallIcon class="h-5 w-5" />
        </button>
        <button type="button" class="icon-btn" title="Calendário" aria-label="Calendário">
          <CalendarDaysIcon class="h-5 w-5" />
        </button>
        <button type="button" class="icon-btn" title="Visibilidade" aria-label="Visibilidade">
          <EyeIcon class="h-5 w-5" />
        </button>
        <button type="button" class="icon-btn" title="Histórico" aria-label="Histórico">
          <ClockIcon class="h-5 w-5" />
        </button>
        <button type="button" class="icon-btn" title="Configurações" aria-label="Configurações">
          <Cog6ToothIcon class="h-5 w-5" />
        </button>
        <button
          type="button"
          class="icon-btn"
          title="Sair"
          aria-label="Sair"
          @click="logout"
        >
          <ArrowRightOnRectangleIcon class="h-5 w-5" />
        </button>
      </div>
    </div>
    <div v-if="!compact" class="header-context">
      <div class="context-left">
        <h1 class="couple-name">{{ coupleName }}</h1>
        <span class="period-label">{{ periodLabel }}</span>
      </div>
      <span v-if="budgetStatus === 'within'" class="budget-tag budget-tag--ok">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        Dentro do orçamento
      </span>
    </div>
  </header>
</template>

<style scoped>
.dashboard-header {
  margin-bottom: 1.5rem;
}

.dashboard-header--compact .header-context {
  display: none;
}

.dashboard-header--compact {
  margin-bottom: 1rem;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.logo-icon {
  color: var(--dp-green);
  font-size: 1.25rem;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--dp-text-primary);
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  justify-content: flex-end;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: none;
  border-radius: 0.5rem;
  background: transparent;
  color: var(--dp-text-secondary);
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.icon-btn:hover {
  background: var(--dp-surface);
  color: var(--dp-text-primary);
}

.header-context {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.context-left {
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

@media (max-width: 640px) {
  .header-top {
    margin-bottom: 0.75rem;
  }

  .logo-text {
    font-size: 1.1rem;
  }

  .couple-name {
    font-size: 1.25rem;
  }

  .period-label {
    font-size: 0.85rem;
  }

  .header-actions {
    gap: 0.2rem;
  }

  .icon-btn {
    width: 2rem;
    height: 2rem;
  }
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
</style>
