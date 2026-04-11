<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import DashboardSidebar from '@/components/dashboard/DashboardSidebar.vue'
import { Bars3Icon } from '@heroicons/vue/24/outline'

const STORAGE_KEY = 'dp-sidebar-collapsed'

const sidebarCollapsed = ref(false)
const mobileOpen = ref(false)
const route = useRoute()

onMounted(() => {
  sidebarCollapsed.value = localStorage.getItem(STORAGE_KEY) === '1'
})

watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false
  },
)

function toggleCollapse() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  localStorage.setItem(STORAGE_KEY, sidebarCollapsed.value ? '1' : '0')
}
</script>

<template>
  <div class="dashboard-shell" :class="{ 'dashboard-shell--collapsed': sidebarCollapsed }">
    <DashboardSidebar
      :collapsed="sidebarCollapsed"
      :mobile-open="mobileOpen"
      @toggle-collapse="toggleCollapse"
    />

    <div
      v-if="mobileOpen"
      class="dashboard-shell__backdrop"
      aria-hidden="true"
      @click="mobileOpen = false"
    />

    <div class="dashboard-shell__main">
      <header class="mobile-bar">
        <button
          type="button"
          class="mobile-bar__menu"
          aria-label="Abrir menu"
          @click="mobileOpen = true"
        >
          <Bars3Icon class="h-6 w-6" />
        </button>
        <span class="mobile-bar__title">DuoPact</span>
      </header>

      <div class="dashboard-shell__content">
        <RouterView />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-shell {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--color-background);
}

@media (min-width: 768px) {
  .dashboard-shell__main {
    margin-left: 15rem;
    transition: margin-left 0.2s ease;
  }

  .dashboard-shell--collapsed .dashboard-shell__main {
    margin-left: 4.5rem;
  }
}

.dashboard-shell__backdrop {
  display: none;
}

.dashboard-shell__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.mobile-bar {
  display: none;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--dp-border);
  background: var(--color-background-soft);
}

.mobile-bar__menu {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem;
  margin: -0.35rem;
  border: none;
  border-radius: 0.5rem;
  background: transparent;
  color: var(--dp-text-primary);
  cursor: pointer;
}

.mobile-bar__menu:hover {
  background: var(--dp-surface);
}

.mobile-bar__title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--dp-text-primary);
}

.dashboard-shell__content {
  flex: 1;
  min-width: 0;
}

@media (max-width: 767px) {
  .dashboard-shell__backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(0, 0, 0, 0.35);
  }

  .mobile-bar {
    display: flex;
  }
}
</style>
