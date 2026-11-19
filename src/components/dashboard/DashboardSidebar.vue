<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useThemeStore } from '@/stores/theme/theme.store'
import { useAuthStore } from '@/stores/auth/auth.store'
import { storeToRefs } from 'pinia'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  Eye,
  EyeOff,
  FileSpreadsheet,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Moon,
  PiggyBank,
  Scale,
  ShieldCheck,
  Sun,
  UserCircle,
} from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'

defineProps<{
  collapsed: boolean
  mobileOpen: boolean
}>()

const emit = defineEmits<{
  'toggle-collapse': []
}>()

const router = useRouter()
const route = useRoute()
const themeStore = useThemeStore()
const authStore = useAuthStore()
const { isDark, hideValues } = storeToRefs(themeStore)
const { invoiceAnalysisEnabled, isAdmin, featureFlags } = storeToRefs(authStore)

onMounted(() => {
  if (!authStore.profileLoaded) {
    authStore.fetchProfile()
  }
})

const allNavItems = [
  { to: '/', label: 'Início (Mês)', icon: LayoutDashboard, exact: true, moduleKey: null, requireInvoiceFlag: false, requireAdmin: false },
  { to: '/accounts', label: 'Dinheiro Guardado (CDBs)', icon: PiggyBank, exact: false, moduleKey: 'accounts', requireInvoiceFlag: false, requireAdmin: false },
  { to: '/invoices', label: 'Análise de Faturas', icon: FileSpreadsheet, exact: false, moduleKey: 'invoices', requireInvoiceFlag: true, requireAdmin: false },
  { to: '/monthly-control', label: 'Contas Fixas', icon: ClipboardCheck, exact: false, moduleKey: 'monthly_control', requireInvoiceFlag: false, requireAdmin: false },
  { to: '/debts', label: 'Dívidas & Parcelas', icon: Scale, exact: false, moduleKey: 'debts', requireInvoiceFlag: false, requireAdmin: false },
  { to: '/cards', label: 'Cartões', icon: CreditCard, exact: false, moduleKey: 'cards', requireInvoiceFlag: false, requireAdmin: false },
  { to: '/agenda', label: 'Agenda de Vencimentos', icon: CalendarDays, exact: false, moduleKey: 'agenda', requireInvoiceFlag: false, requireAdmin: false },
  { to: '/admin/users', label: 'Usuários & Features', icon: ShieldCheck, exact: false, moduleKey: null, requireInvoiceFlag: false, requireAdmin: true },
] as const

const navItems = computed(() =>
  allNavItems.filter((item) => {
    if (item.requireAdmin && !isAdmin.value) return false
    if (item.moduleKey && featureFlags.value[item.moduleKey] === false) return false
    if (item.requireInvoiceFlag && !invoiceAnalysisEnabled.value) return false
    return true
  }),
)

function toggleTheme() {
  themeStore.toggle()
}

function togglePrivacy() {
  themeStore.togglePrivacy()
}

function logout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <aside
    class="sidebar border-r border-border bg-card text-card-foreground"
    :class="{
      'sidebar--collapsed': collapsed,
      'sidebar--mobile-open': mobileOpen,
    }"
    aria-label="Menu principal"
  >
    <div class="flex h-full flex-col justify-between p-3">
      <!-- Brand -->
      <div class="space-y-4">
        <div class="flex h-10 items-center gap-2.5 px-2">
          <img
            src="/icon.svg"
            alt="DuoPact"
            class="h-8 w-8 shrink-0 rounded-lg shadow-sm"
          />
          <div v-show="mobileOpen || !collapsed" class="flex flex-col leading-none">
            <span class="text-sm font-semibold tracking-tight text-foreground">DuoPact</span>
            <span class="text-[11px] text-muted-foreground">Finanças a dois</span>
          </div>
        </div>

        <!-- Navigation -->
        <nav class="space-y-1" aria-label="Navegação">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            v-slot="{ href, navigate, isActive, isExactActive }"
            :to="item.to"
            custom
          >
            <a
              :href="href"
              class="flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors"
              :class="
                (item.exact ? isExactActive : isActive)
                  ? 'bg-secondary text-foreground font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              "
              @click.prevent="navigate()"
            >
              <component
                :is="item.icon"
                class="h-4 w-4 shrink-0"
                :class="(item.exact ? isExactActive : isActive) ? 'text-primary' : ''"
                aria-hidden="true"
              />
              <span v-show="mobileOpen || !collapsed" class="truncate">{{ item.label }}</span>
            </a>
          </RouterLink>
        </nav>
      </div>

      <!-- Footer -->
      <div class="space-y-1 border-t border-border pt-3">
        <RouterLink
          to="/profile"
          class="flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors"
          :class="
            route.name === 'profile'
              ? 'bg-secondary text-foreground font-semibold'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          "
        >
          <UserCircle class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span v-show="mobileOpen || !collapsed" class="truncate">Perfil & Casal</span>
        </RouterLink>

        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          :title="hideValues ? 'Mostrar valores' : 'Ocultar valores (Modo Privacidade)'"
          @click="togglePrivacy"
        >
          <EyeOff v-if="hideValues" class="h-4 w-4 shrink-0 text-primary" />
          <Eye v-else class="h-4 w-4 shrink-0" />
          <span v-show="mobileOpen || !collapsed" class="truncate">
            {{ hideValues ? 'Valores ocultos' : 'Ocultar valores' }}
          </span>
        </button>

        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          :title="isDark ? 'Usar tema claro' : 'Usar tema escuro'"
          @click="toggleTheme"
        >
          <Sun v-if="isDark" class="h-4 w-4 shrink-0" />
          <Moon v-else class="h-4 w-4 shrink-0" />
          <span v-show="mobileOpen || !collapsed" class="truncate">
            {{ isDark ? 'Modo claro' : 'Modo escuro' }}
          </span>
        </button>

        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
          title="Sair"
          @click="logout"
        >
          <LogOut class="h-4 w-4 shrink-0" />
          <span v-show="mobileOpen || !collapsed" class="truncate">Sair</span>
        </button>

        <button
          type="button"
          class="collapse-toggle mt-1 flex w-full items-center justify-center rounded-lg py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          :title="collapsed ? 'Expandir menu' : 'Recolher menu'"
          @click="emit('toggle-collapse')"
        >
          <ChevronRight v-if="collapsed" class="h-4 w-4" />
          <ChevronLeft v-else class="h-4 w-4" />
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  flex-shrink: 0;
  width: 15rem;
  min-height: 100vh;
  min-height: 100dvh;
  transition: width 0.2s ease, transform 0.2s ease;
}

@media (min-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 30;
    height: 100vh;
    height: 100dvh;
  }

  .sidebar--collapsed {
    width: 4.25rem;
  }
}

@media (max-width: 767px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 50;
    width: min(16rem, 86vw);
    min-height: 100dvh;
    transform: translateX(-100%);
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.12);
  }

  .sidebar--mobile-open {
    transform: translateX(0);
  }

  .sidebar--collapsed {
    width: min(16rem, 86vw);
  }

  .collapse-toggle {
    display: none;
  }
}
</style>
