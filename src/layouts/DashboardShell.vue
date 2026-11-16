<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import DashboardSidebar from '@/components/dashboard/DashboardSidebar.vue'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ChevronRight, Home, Menu } from 'lucide-vue-next'

const STORAGE_KEY = 'dp-sidebar-collapsed'

const sidebarCollapsed = ref(false)
const mobileOpen = ref(false)
const route = useRoute()
const router = useRouter()

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

const isHome = computed(() => route.path === '/')

interface BreadcrumbItem {
  label: string
  to?: string
}

const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  const path = route.path
  if (path === '/') return [{ label: 'Início (Mês)' }]

  const items: BreadcrumbItem[] = [{ label: 'Início (Mês)', to: '/' }]

  if (path.startsWith('/debts')) {
    items.push({ label: 'Financiamentos & Parcelas' })
  } else if (path.startsWith('/monthly-control')) {
    items.push({ label: 'Contas Fixas' })
  } else if (path.startsWith('/agenda')) {
    items.push({ label: 'Agenda de Vencimentos' })
  } else if (path.startsWith('/cards')) {
    if (path === '/cards') {
      items.push({ label: 'Cartões' })
    } else {
      items.push({ label: 'Cartões', to: '/cards' })
      if (path.includes('/faturas')) items.push({ label: 'Faturas do Cartão' })
      else if (path.includes('/novo')) items.push({ label: 'Novo Cartão' })
      else if (path.includes('/editar')) items.push({ label: 'Editar Cartão' })
    }
  } else if (path.startsWith('/accounts')) {
    if (path === '/accounts') {
      items.push({ label: 'Contas / Bancos' })
    } else {
      items.push({ label: 'Contas / Bancos', to: '/accounts' })
      if (path.includes('/novo')) items.push({ label: 'Nova Conta' })
      else if (path.includes('/editar')) items.push({ label: 'Editar Conta' })
    }
  } else if (path.startsWith('/budgets')) {
    if (path === '/budgets') {
      items.push({ label: 'Orçamentos' })
    } else {
      items.push({ label: 'Orçamentos', to: '/budgets' })
      if (path.includes('/novo')) items.push({ label: 'Novo Orçamento' })
      else if (path.includes('/editar')) items.push({ label: 'Editar Orçamento' })
    }
  } else if (path.startsWith('/profile')) {
    items.push({ label: 'Perfil & Casal' })
  } else if (path.startsWith('/movements')) {
    items.push({ label: 'Movimentações' })
  } else {
    items.push({ label: 'Página' })
  }

  return items
})

function handleGoBack() {
  const crumbs = breadcrumbs.value
  if (crumbs.length > 2 && crumbs[crumbs.length - 2]?.to) {
    router.push(crumbs[crumbs.length - 2].to!)
    return
  }
  router.push('/')
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
      <!-- Barra Mobile -->
      <header class="mobile-bar">
        <button
          type="button"
          class="mobile-bar__menu"
          aria-label="Abrir menu"
          @click="mobileOpen = true"
        >
          <Menu class="h-5 w-5" />
        </button>
        <span class="mobile-bar__title">DuoPact</span>
      </header>

      <!-- Top Bar com Botão Voltar + Breadcrumb em todas as páginas internas -->
      <div
        v-if="!isHome"
        class="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      >
        <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <div class="flex items-center gap-3 min-w-0">
            <Button
              variant="outline"
              size="xs"
              class="gap-1.5 shrink-0"
              @click="handleGoBack"
            >
              <ArrowLeft class="h-3.5 w-3.5" />
              <span>Voltar</span>
            </Button>

            <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-xs min-w-0 overflow-hidden">
              <template v-for="(crumb, idx) in breadcrumbs" :key="idx">
                <ChevronRight
                  v-if="idx > 0"
                  class="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
                />
                <RouterLink
                  v-if="crumb.to"
                  :to="crumb.to"
                  class="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors truncate"
                >
                  <Home v-if="idx === 0" class="h-3 w-3 shrink-0" />
                  <span>{{ crumb.label }}</span>
                </RouterLink>
                <span
                  v-else
                  class="font-semibold text-foreground truncate"
                >
                  {{ crumb.label }}
                </span>
              </template>
            </nav>
          </div>
        </div>
      </div>

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
    margin-left: 4.25rem;
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
  font-size: 1rem;
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
