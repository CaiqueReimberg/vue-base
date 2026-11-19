<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import DashboardSidebar from '@/components/dashboard/DashboardSidebar.vue'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth/auth.store'
import { useThemeStore } from '@/stores/theme/theme.store'
import { useToastStore } from '@/stores/toast/toast.store'
import {
  ArrowLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  EyeOff,
  FileSpreadsheet,
  HeartHandshake,
  Home,
  LayoutDashboard,
  Menu,
  Moon,
  PiggyBank,
  Scale,
  Sun,
} from 'lucide-vue-next'

const config = useRuntimeConfig()
const appVersion = config.public.appVersion || '1.0.0'
const STORAGE_KEY = 'dp-sidebar-collapsed'

const sidebarCollapsed = ref(false)
const mobileOpen = ref(false)
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const themeStore = useThemeStore()
const toastStore = useToastStore()
const { isDark, hideValues } = storeToRefs(themeStore)
const { invoiceAnalysisEnabled, featureFlags } = storeToRefs(authStore)

const mobileBottomTabs = computed(() => {
  const tabs: Array<{ to: string; label: string; icon: any; exact?: boolean }> = [
    { to: '/', label: 'Início', icon: LayoutDashboard, exact: true },
  ]
  if (featureFlags.value.accounts !== false) {
    tabs.push({ to: '/accounts', label: 'CDBs', icon: PiggyBank })
  }
  if (invoiceAnalysisEnabled.value) {
    tabs.push({ to: '/invoices', label: 'Faturas', icon: FileSpreadsheet })
  }
  if (featureFlags.value.monthly_control !== false) {
    tabs.push({ to: '/monthly-control', label: 'Fixas', icon: ClipboardCheck })
  }
  if (featureFlags.value.debts !== false && tabs.length < 4) {
    tabs.push({ to: '/debts', label: 'Parcelas', icon: Scale })
  }
  return tabs
})

function checkRouteModuleAccess(path: string) {
  if (!authStore.profileLoaded) return
  const flags = authStore.featureFlags
  if (path.startsWith('/cards') && flags.cards === false) {
    toastStore.error('O módulo de Cartões está bloqueado no momento.')
    router.replace('/')
  } else if (path.startsWith('/accounts') && flags.accounts === false) {
    toastStore.error('O módulo de Dinheiro Guardado está bloqueado no momento.')
    router.replace('/')
  } else if (path.startsWith('/monthly-control') && flags.monthly_control === false) {
    toastStore.error('O módulo de Contas Fixas está bloqueado no momento.')
    router.replace('/')
  } else if (path.startsWith('/debts') && flags.debts === false) {
    toastStore.error('O módulo de Dívidas & Parcelas está bloqueado no momento.')
    router.replace('/')
  } else if (path.startsWith('/agenda') && flags.agenda === false) {
    toastStore.error('O módulo de Agenda está bloqueado no momento.')
    router.replace('/')
  }
}

onMounted(async () => {
  sidebarCollapsed.value = localStorage.getItem(STORAGE_KEY) === '1'
  if (!authStore.profileLoaded) {
    await authStore.fetchProfile()
  }
  checkRouteModuleAccess(route.path)
})

watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false
    checkRouteModuleAccess(route.path)
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
  } else if (path.startsWith('/invoices')) {
    items.push({ label: 'Análise de Faturas' })
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
      items.push({ label: 'Dinheiro Guardado & CDBs' })
    } else {
      items.push({ label: 'Dinheiro Guardado & CDBs', to: '/accounts' })
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
  } else if (path.startsWith('/admin/users')) {
    items.push({ label: 'Usuários & Features (Admin)' })
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
      <!-- Barra Mobile estilo App Nativo -->
      <header class="mobile-bar">
        <button
          type="button"
          class="flex items-center gap-2.5 rounded-lg py-1 pr-2 text-left transition-opacity active:opacity-75"
          aria-label="Abrir menu lateral"
          title="Abrir menu"
          @click="mobileOpen = !mobileOpen"
        >
          <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-2xs">
            <HeartHandshake class="h-3.5 w-3.5" />
          </div>
          <span class="mobile-bar__title">DuoPact</span>
        </button>

        <div class="flex items-center gap-1">
          <button
            type="button"
            class="mobile-bar__icon-btn"
            :aria-label="hideValues ? 'Mostrar valores' : 'Ocultar valores'"
            :title="hideValues ? 'Mostrar valores' : 'Ocultar valores'"
            @click="themeStore.togglePrivacy()"
          >
            <EyeOff v-if="hideValues" class="h-4 w-4 text-primary" />
            <Eye v-else class="h-4 w-4" />
          </button>

          <button
            type="button"
            class="mobile-bar__icon-btn"
            :aria-label="isDark ? 'Modo claro' : 'Modo escuro'"
            @click="themeStore.toggle()"
          >
            <Sun v-if="isDark" class="h-4 w-4" />
            <Moon v-else class="h-4 w-4" />
          </button>
        </div>
      </header>

      <!-- Top Bar com Botão Voltar + Breadcrumb + Olhinho em todas as páginas internas -->
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

          <button
            type="button"
            class="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            :title="hideValues ? 'Mostrar valores' : 'Ocultar valores'"
            @click="themeStore.togglePrivacy()"
          >
            <EyeOff v-if="hideValues" class="h-3.5 w-3.5 text-primary" />
            <Eye v-else class="h-3.5 w-3.5" />
            <span>{{ hideValues ? 'Valores ocultos' : 'Ocultar valores' }}</span>
          </button>
        </div>
      </div>

      <div class="dashboard-shell__content">
        <RouterView v-slot="{ Component }">
          <Transition name="dp-page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </div>

      <footer class="dashboard-footer border-t border-border/60 py-4 px-6 text-center text-[11px] text-muted-foreground">
        <span>DuoPact Finanças a dois</span>
        <span class="mx-1.5">•</span>
        <span class="font-mono font-medium">v{{ appVersion }}</span>
      </footer>

      <!-- Barra de Navegação Inferior Fixa no Mobile (App Bottom Nav) -->
      <nav class="mobile-bottom-nav" aria-label="Navegação rápida mobile">
        <RouterLink
          v-for="tab in mobileBottomTabs"
          :key="tab.to"
          v-slot="{ href, navigate, isActive, isExactActive }"
          :to="tab.to"
          custom
        >
          <a
            :href="href"
            class="mobile-bottom-nav__item"
            :class="{
              'mobile-bottom-nav__item--active': tab.exact ? isExactActive : isActive,
            }"
            @click.prevent="navigate()"
          >
            <component :is="tab.icon" class="h-5 w-5" />
            <span>{{ tab.label }}</span>
          </a>
        </RouterLink>

        <button
          type="button"
          class="mobile-bottom-nav__item"
          :class="{ 'mobile-bottom-nav__item--active': mobileOpen }"
          @click="mobileOpen = !mobileOpen"
        >
          <Menu class="h-5 w-5" />
          <span>Menu</span>
        </button>
      </nav>
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
  justify-content: space-between;
  gap: 0.75rem;
  flex-shrink: 0;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--dp-border);
  background: var(--color-background-soft);
}

.mobile-bar__icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.15rem;
  height: 2.15rem;
  border: none;
  border-radius: 0.5rem;
  background: transparent;
  color: var(--dp-text-secondary);
  cursor: pointer;
}

.mobile-bar__icon-btn:hover {
  background: var(--dp-surface);
  color: var(--dp-text-primary);
}

.mobile-bar__title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--dp-text-primary);
}

.dashboard-shell__content {
  flex: 1;
  min-width: 0;
}

.mobile-bottom-nav {
  display: none;
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

  .dashboard-footer {
    padding-bottom: calc(4.75rem + env(safe-area-inset-bottom, 0px));
  }

  .mobile-bottom-nav {
    display: flex;
    align-items: center;
    justify-content: space-around;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 35;
    height: calc(3.85rem + env(safe-area-inset-bottom, 0px));
    padding-bottom: env(safe-area-inset-bottom, 0px);
    border-top: 1px solid hsl(var(--border));
    background: hsl(var(--card) / 0.94);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .mobile-bottom-nav__item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    height: 100%;
    border: none;
    background: transparent;
    color: hsl(var(--muted-foreground));
    font-size: 0.68rem;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .mobile-bottom-nav__item--active {
    color: hsl(var(--primary));
    font-weight: 700;
  }
}
</style>
